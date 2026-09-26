import secrets
import uuid
import json
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, case
from datetime import datetime, timezone
from ..models import Form, FormVersion, Field, FieldOption, PublicLink, Submission, ResponseValue, FileMetadata, ConditionalRule
from .field_validation_service import FieldValidationService
from sqlalchemy import func as sql_func


class FormService:
    """Service for managing forms and their fields"""

    @staticmethod
    def _get_latest_version(db: Session, form_id: int) -> Optional[FormVersion]:
        """Get the latest version of a form"""
        return (
            db.query(FormVersion)
            .filter(FormVersion.form_id == form_id)
            .order_by(desc(FormVersion.version_number))
            .first()
        )

    @staticmethod
    def _get_latest_draft_version(db: Session, form_id: int) -> Optional[FormVersion]:
        """Get the latest DRAFT version of a form"""
        return (
            db.query(FormVersion)
            .filter(FormVersion.form_id == form_id, FormVersion.status == "draft")
            .order_by(desc(FormVersion.version_number))
            .first()
        )

    @staticmethod
    def _ensure_draft(version: FormVersion):
        """Raise error if the form version is not in draft status"""
        if version.status != "draft":
            raise ValueError(f"Only draft versions can be modified. Current status: {version.status}")

    @staticmethod
    def _next_copy_title(db: Session, original_title: str) -> str:
        """Build a collision-free duplicate title: "X (Copy)", "X (Copy 2)", ..."""
        base = f"{original_title} (Copy)"
        if not db.query(Form).filter(Form.title == base).first():
            return base
        counter = 2
        while True:
            candidate = f"{original_title} (Copy {counter})"
            if not db.query(Form).filter(Form.title == candidate).first():
                return candidate
            counter += 1

    @staticmethod
    def duplicate_form(
        db: Session,
        form_id: int,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Duplicate a form as a fresh, independent draft.

        Copies the reusable structure — form details, fields (order preserved),
        field options and conditional rules — but NOT runtime data (versions,
        submissions, analytics, sessions or public links).

        Field IDs are re-mapped: every copied field gets a brand-new ID and all
        copied conditional rules point at the NEW field IDs, never the original
        ones.

        The operation is atomic: nothing is committed until every copy step has
        succeeded. Any exception rolls the whole transaction back so a partially
        duplicated form is never left behind.

        Args:
            db: Database session
            form_id: The source form id
            user_id: The owner of the new duplicate (current authenticated user)

        Returns:
            Dict with the new form's id, title, status and copy counts.
        """
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        # Source version: prefer the editable draft, then the latest published
        # snapshot, then any version (same selection logic as get_form_with_fields).
        source_version = (
            db.query(FormVersion)
            .filter(FormVersion.form_id == form_id)
            .order_by(
                case(
                    (FormVersion.status == "draft", 0),
                    (FormVersion.status == "published", 1),
                    else_=2,
                ),
                desc(FormVersion.version_number),
            )
            .first()
        )
        if not source_version:
            raise ValueError(f"Form with id {form_id} has no versions to duplicate")

        # Unique, human-friendly title: "X (Copy)", "X (Copy 2)", ...
        new_title = FormService._next_copy_title(db, form.title)

        # ── 1. New form record + fresh v1 draft version ─────────────
        new_form = Form(
            title=new_title,
            description=form.description,
            user_id=user_id,
        )
        db.add(new_form)
        db.flush()

        new_version = FormVersion(
            form_id=new_form.id,
            version_number=1,
            title=new_title,
            description=form.description,
            status="draft",
        )
        db.add(new_version)
        db.flush()

        # ── 2. Copy fields (order preserved) + field options ─────────
        # Build an explicit old_field_id → new_field_id mapping.
        field_id_map: Dict[int, int] = {}
        source_fields = (
            db.query(Field)
            .filter(Field.form_version_id == source_version.id)
            .order_by(Field.order)
            .all()
        )
        for sf in source_fields:
            new_field = Field(
                form_version_id=new_version.id,
                field_type=sf.field_type,
                label=sf.label,
                placeholder=sf.placeholder,
                is_required=sf.is_required,
                order=sf.order,
                configuration=sf.configuration,
            )
            db.add(new_field)
            db.flush()
            field_id_map[sf.id] = new_field.id

            options = (
                db.query(FieldOption)
                .filter(FieldOption.field_id == sf.id)
                .order_by(FieldOption.order)
                .all()
            )
            for opt in options:
                db.add(FieldOption(
                    field_id=new_field.id,
                    label=opt.label,
                    value=opt.value,
                    order=opt.order,
                ))

        # ── 3. Copy conditional rules using the NEW field ids ────────
        # Rules whose trigger/target fields were not part of the copied
        # structure (stale references to removed fields) are skipped — they
        # cannot be mapped and must not dangle against the new form.
        source_rules = (
            db.query(ConditionalRule)
            .filter(ConditionalRule.form_id == form_id)
            .order_by(asc(ConditionalRule.id))
            .all()
        )
        copied_rule_count = 0
        for rule in source_rules:
            new_trigger_id = field_id_map.get(rule.trigger_field_id)
            new_target_id = field_id_map.get(rule.target_field_id)
            if new_trigger_id is None or new_target_id is None:
                continue
            db.add(ConditionalRule(
                form_id=new_form.id,
                trigger_field_id=new_trigger_id,
                operator=rule.operator,
                compare_value=rule.compare_value,
                target_field_id=new_target_id,
                action=rule.action,
                is_active=rule.is_active,
            ))
            copied_rule_count += 1

        # ── 4. Commit atomically ─────────────────────────────────────
        db.flush()
        db.commit()
        db.refresh(new_form)

        return {
            "id": new_form.id,
            "title": new_form.title,
            "status": "draft",
            "field_count": len(source_fields),
            "rule_count": copied_rule_count,
        }

    @staticmethod
    def create_form(
        db: Session,
        title: str,
        description: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Form:
        """Create a new form with an initial version.

        Args:
            db: Database session
            title: Form title
            description: Optional description
            user_id: Optional owner id (set when the authenticated user creates
                     the form; None for legacy/backfilled records)
        """
        form = Form(title=title, description=description, user_id=user_id)
        db.add(form)
        db.flush()

        version = FormVersion(
            form_id=form.id,
            version_number=1,
            title=title,
            description=description,
            status="draft"
        )
        db.add(version)
        db.flush()

        db.commit()
        db.refresh(form)
        return form

    @staticmethod
    def add_field(
        db: Session,
        form_id: int,
        label: str,
        field_type: str,
        required: bool,
        order: int,
        config: Optional[Dict[str, Any]] = None
    ) -> Field:
        """Add a field to the latest draft version of a form.
        If the latest version is published, auto-create a new draft version first.
        """
        version = FormService._get_latest_draft_version(db, form_id)
        if not version:
            # No draft version exists - create one from the latest version
            latest = FormService._get_latest_version(db, form_id)
            if not latest:
                raise ValueError(f"Form with id {form_id} not found")
            version = FormService._create_new_draft_version(db, latest)
            db.flush()

        # Validate config against field type library
        if config:
            errors = FieldValidationService.validate_config(field_type, config)
            if errors:
                raise ValueError(f"Config validation failed: {', '.join(errors)}")

        field = Field(
            form_version_id=version.id,
            field_type=field_type,
            label=label,
            is_required=1 if required else 0,
            order=order,
            configuration=config or {}
        )
        db.add(field)
        db.flush()
        db.commit()
        db.refresh(field)
        return field

    @staticmethod
    def update_field(
        db: Session,
        form_id: int,
        field_id: int,
        label: Optional[str] = None,
        placeholder: Optional[str] = None,
        required: Optional[bool] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> Field:
        """Update an existing field. Does NOT allow changing field type.
        If latest version is published, auto-create a new draft version first.
        """
        version = FormService._get_latest_draft_version(db, form_id)
        if not version:
            latest = FormService._get_latest_version(db, form_id)
            if not latest:
                raise ValueError(f"Form with id {form_id} not found")
            version = FormService._create_new_draft_version(db, latest)
            db.flush()

        field = db.query(Field).filter(
            Field.id == field_id,
            Field.form_version_id == version.id
        ).first()
        if not field:
            raise ValueError(f"Field with id {field_id} not found in form {form_id}")

        if label is not None:
            field.label = label
        if placeholder is not None:
            field.placeholder = placeholder
        if required is not None:
            field.is_required = 1 if required else 0
        if config is not None:
            # Validate the new config
            errors = FieldValidationService.validate_config(field.field_type, config)
            if errors:
                raise ValueError(f"Config validation failed: {', '.join(errors)}")
            field.configuration = config

        db.flush()
        db.commit()
        db.refresh(field)
        return field

    @staticmethod
    def delete_field(
        db: Session,
        form_id: int,
        field_id: int
    ) -> None:
        """Delete a field from a form.
        If latest version is published, auto-create a new draft version first.
        """
        version = FormService._get_latest_draft_version(db, form_id)
        if not version:
            latest = FormService._get_latest_version(db, form_id)
            if not latest:
                raise ValueError(f"Form with id {form_id} not found")
            version = FormService._create_new_draft_version(db, latest)
            db.flush()

        field = db.query(Field).filter(
            Field.id == field_id,
            Field.form_version_id == version.id
        ).first()
        if not field:
            raise ValueError(f"Field with id {field_id} not found in form {form_id}")

        db.delete(field)
        db.commit()

    @staticmethod
    def reorder_fields(
        db: Session,
        form_id: int,
        ordered_field_ids: List[int]
    ) -> List[Field]:
        """Reorder fields in a form.
        If latest version is published, auto-create a new draft version first.
        """
        version = FormService._get_latest_draft_version(db, form_id)
        if not version:
            latest = FormService._get_latest_version(db, form_id)
            if not latest:
                raise ValueError(f"Form with id {form_id} not found")
            version = FormService._create_new_draft_version(db, latest)
            db.flush()

        # Get all fields in this version
        fields = (
            db.query(Field)
            .filter(Field.form_version_id == version.id)
            .all()
        )
        field_map = {f.id: f for f in fields}

        # Validate all IDs exist
        for fid in ordered_field_ids:
            if fid not in field_map:
                raise ValueError(f"Field with id {fid} not found in form {form_id}")

        # Update order
        for idx, fid in enumerate(ordered_field_ids):
            field_map[fid].order = idx + 1

        db.flush()
        db.commit()

        # Return fields in new order
        ordered_fields = [field_map[fid] for fid in ordered_field_ids]
        return ordered_fields

    @staticmethod
    def get_form(db: Session, form_id: int) -> Optional[Form]:
        """Get form by id"""
        return db.query(Form).filter(Form.id == form_id).first()

    @staticmethod
    def get_form_with_fields(db: Session, form_id: int) -> Optional[Dict[str, Any]]:
        """Get form with its latest draft/published version's fields.
        Prefers draft version; falls back to latest published.
        """
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            return None

        # Prefer draft version for editing, then published, then any
        version = (
            db.query(FormVersion)
            .filter(FormVersion.form_id == form_id)
            .order_by(
                case(
                    (FormVersion.status == "draft", 0),
                    (FormVersion.status == "published", 1),
                    else_=2
                ),
                desc(FormVersion.version_number)
            )
            .first()
        )
        if not version:
            return None

        fields = (
            db.query(Field)
            .filter(Field.form_version_id == version.id)
            .order_by(Field.order)
            .all()
        )

        return {
            "id": form.id,
            "title": form.title,
            "description": form.description,
            "fields": [
                {
                    "id": f.id,
                    "label": f.label,
                    "type": f.field_type,
                    "config": f.configuration or {},
                    "is_required": f.is_required == 1,
                    "order": f.order,
                    "form_version_id": f.form_version_id,
                }
                for f in fields
            ],
            "version_id": version.id,
            "version_number": version.version_number,
            "version_status": version.status,
        }

    @staticmethod
    def _create_new_draft_version(db: Session, source_version: FormVersion) -> FormVersion:
        """Create a new draft version by copying from source version"""
        new_version_number = source_version.version_number + 1

        new_version = FormVersion(
            form_id=source_version.form_id,
            version_number=new_version_number,
            title=source_version.title,
            description=source_version.description,
            status="draft"
        )
        db.add(new_version)
        db.flush()

        # Copy all fields from source version
        source_fields = (
            db.query(Field)
            .filter(Field.form_version_id == source_version.id)
            .order_by(Field.order)
            .all()
        )

        # old field id -> new field id (needed to re-map conditional rules below)
        field_id_map: Dict[int, int] = {}

        for sf in source_fields:
            new_field = Field(
                form_version_id=new_version.id,
                field_type=sf.field_type,
                label=sf.label,
                placeholder=sf.placeholder,
                is_required=sf.is_required,
                order=sf.order,
                configuration=sf.configuration
            )
            db.add(new_field)
            db.flush()
            field_id_map[sf.id] = new_field.id

            # Copy field options
            options = (
                db.query(FieldOption)
                .filter(FieldOption.field_id == sf.id)
                .order_by(FieldOption.order)
                .all()
            )
            for opt in options:
                new_option = FieldOption(
                    field_id=new_field.id,
                    label=opt.label,
                    value=opt.value,
                    order=opt.order
                )
                db.add(new_option)

        # Conditional rules are stored per FORM, but every copied field gets a
        # brand-new id. Re-map the rules to the new draft's field ids, otherwise
        # they keep pointing at the source version's fields and stop firing for
        # the draft (and for any version published from it), and duplication can
        # no longer copy them either. Rules referencing fields that are not part
        # of the copied version (already-stale references) are left untouched.
        rules = (
            db.query(ConditionalRule)
            .filter(ConditionalRule.form_id == source_version.form_id)
            .all()
        )
        for rule in rules:
            if rule.trigger_field_id in field_id_map:
                rule.trigger_field_id = field_id_map[rule.trigger_field_id]
            if rule.target_field_id in field_id_map:
                rule.target_field_id = field_id_map[rule.target_field_id]

        db.flush()
        return new_version

    @staticmethod
    def publish_version(db: Session, form_id: int) -> Dict[str, Any]:
        """Publish the latest draft version of a form"""
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        version = FormService._get_latest_draft_version(db, form_id)
        if not version:
            raise ValueError("No draft version found to publish")

        # Validate form has at least one field
        field_count = db.query(Field).filter(Field.form_version_id == version.id).count()
        if field_count == 0:
            raise ValueError("Cannot publish a form with no fields. Add at least one field first.")

        # Check if there's an existing published version with the same content
        # Mark previous published as superseded (keep it as published)
        now = datetime.utcnow()

        version.status = "published"
        version.published_at = now

        db.flush()
        db.commit()

        return {
            "version_id": version.id,
            "version_number": version.version_number,
            "status": version.status,
            "published_at": now,
            "message": f"Version {version.version_number} published successfully",
        }

    @staticmethod
    def archive_version(db: Session, form_id: int) -> Dict[str, Any]:
        """Archive the latest version of a form"""
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        # Get latest version regardless of status
        version = FormService._get_latest_version(db, form_id)
        if not version:
            raise ValueError(f"Form with id {form_id} not found")

        if version.status == "archived":
            raise ValueError("Form is already archived")

        version.status = "archived"

        db.flush()
        db.commit()

        return {
            "version_id": version.id,
            "version_number": version.version_number,
            "status": version.status,
            "message": f"Version {version.version_number} archived successfully",
        }

    @staticmethod
    def create_draft_from_version(db: Session, form_id: int, version_id: Optional[int] = None) -> Dict[str, Any]:
        """Create a new draft version from a specified version (or latest if not specified)"""
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        # Check if there's already a draft - if so, return it
        existing_draft = FormService._get_latest_draft_version(db, form_id)
        if existing_draft:
            return {
                "version_id": existing_draft.id,
                "version_number": existing_draft.version_number,
                "status": existing_draft.status,
                "message": f"Draft version {existing_draft.version_number} already exists",
            }

        # Find source version
        if version_id:
            source = db.query(FormVersion).filter(
                FormVersion.id == version_id,
                FormVersion.form_id == form_id
            ).first()
        else:
            source = FormService._get_latest_version(db, form_id)

        if not source:
            raise ValueError("No source version found to create draft from")

        new_version = FormService._create_new_draft_version(db, source)
        db.commit()

        return {
            "version_id": new_version.id,
            "version_number": new_version.version_number,
            "status": new_version.status,
            "message": f"Draft version {new_version.version_number} created successfully",
        }

    @staticmethod
    def get_versions(db: Session, form_id: int) -> List[Dict[str, Any]]:
        """Get all versions of a form with field counts"""
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        versions = (
            db.query(FormVersion)
            .filter(FormVersion.form_id == form_id)
            .order_by(desc(FormVersion.version_number))
            .all()
        )

        result = []
        for v in versions:
            field_count = db.query(Field).filter(Field.form_version_id == v.id).count()
            result.append({
                "id": v.id,
                "version_number": v.version_number,
                "status": v.status,
                "title": v.title,
                "description": v.description,
                "published_at": v.published_at,
                "created_at": v.created_at,
                "updated_at": v.updated_at,
                "field_count": field_count,
            })

        return result

    @staticmethod
    def list_forms(db: Session) -> List[Dict[str, Any]]:
        """Get all forms with their stats"""
        forms = db.query(Form).order_by(desc(Form.updated_at)).all()

        result = []
        for form in forms:
            # Get latest version
            latest = (
                db.query(FormVersion)
                .filter(FormVersion.form_id == form.id)
                .order_by(desc(FormVersion.version_number))
                .first()
            )

            version_count = db.query(FormVersion).filter(
                FormVersion.form_id == form.id
            ).count()

            # Count total fields across all versions
            field_count = 0
            status = "draft"
            latest_version = None
            latest_version_id = None
            if latest:
                status = latest.status
                latest_version = latest.version_number
                latest_version_id = latest.id
                field_count = db.query(Field).filter(
                    Field.form_version_id == latest.id
                ).count()

            # Count submissions for this form
            submission_count = db.query(sql_func.count(Submission.id)).filter(
                Submission.form_id == form.id
            ).scalar() or 0

            result.append({
                "id": form.id,
                "title": form.title,
                "description": form.description,
                "status": status,
                "latest_version": latest_version,
                "latest_version_id": latest_version_id,
                "field_count": field_count,
                "version_count": version_count,
                "submission_count": submission_count,
                "created_at": form.created_at,
                "updated_at": form.updated_at,
            })

        return result

    # ─── Submission Listing (Day 12) ───────────────────────────────────

    @staticmethod
    def list_submissions(
        db: Session,
        form_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """List submissions for a form."""
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        total = db.query(sql_func.count(Submission.id)).filter(
            Submission.form_id == form_id
        ).scalar() or 0

        submissions = (
            db.query(Submission)
            .filter(Submission.form_id == form_id)
            .order_by(desc(Submission.submitted_at))
            .offset(offset)
            .limit(limit)
            .all()
        )

        result = []
        for sub in submissions:
            # Count response values
            field_count = db.query(sql_func.count(ResponseValue.id)).filter(
                ResponseValue.submission_id == sub.id
            ).scalar() or 0

            result.append({
                "id": sub.id,
                "response_id": sub.response_id,
                "form_id": sub.form_id,
                "form_title": form.title,
                "submitted_at": sub.submitted_at,
                "status": sub.status,
                "field_count": field_count,
            })

        return {
            "submissions": result,
            "total": total,
            "form_title": form.title,
        }

    @staticmethod
    def get_submission_detail(
        db: Session,
        form_id: int,
        submission_id: int,
        base_url: str = "",
    ) -> Dict[str, Any]:
        """Get detailed submission with all response values.

        Args:
            db: Database session
            form_id: The form ID
            submission_id: The submission ID
            base_url: Optional base URL for constructing absolute file download URLs
        """
        submission = (
            db.query(Submission)
            .filter(
                Submission.id == submission_id,
                Submission.form_id == form_id,
            )
            .first()
        )
        if not submission:
            raise ValueError(f"Submission with id {submission_id} not found in form {form_id}")

        responses = (
            db.query(ResponseValue)
            .filter(ResponseValue.submission_id == submission.id)
            .all()
        )

        form = db.query(Form).filter(Form.id == form_id).first()

        response_list = []
        for rv in responses:
            field = db.query(Field).filter(Field.id == rv.field_id).first()
            field_type = field.field_type if field else "unknown"
            value = rv.value

            # Include file download URL for file-type fields
            file_download_url = None
            if field_type == "file" and rv.value:
                file_meta = db.query(FileMetadata).filter(
                    FileMetadata.submission_id == submission.id,
                    FileMetadata.field_id == rv.field_id,
                    FileMetadata.stored_filename == rv.value,
                ).first()
                if file_meta and file_meta.download_token:
                    from ..services.file_storage_service import FileStorageService
                    info = FileStorageService.get_file_info_response(file_meta, base_url=base_url)
                    file_download_url = info["download_url"]

            response_list.append({
                "field_id": rv.field_id,
                "field_label": field.label if field else f"Field #{rv.field_id}",
                "field_type": field_type,
                "value": value,
                "file_download_url": file_download_url,
            })

        return {
            "id": submission.id,
            "response_id": submission.response_id,
            "form_id": submission.form_id,
            "form_version_id": submission.form_version_id,
            "link_token": submission.link_token,
            "status": submission.status,
            "submitted_at": submission.submitted_at,
            "responses": response_list,
        }

    @staticmethod
    def get_submission_stats(db: Session, form_id: int) -> Dict[str, int]:
        """Get submission statistics for a form."""
        from datetime import timedelta

        # Verify form exists
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        # Use naive UTC (same convention as the stored submitted_at column).
        # An aware datetime here would be converted to the DB session timezone
        # by the driver and silently shift the comparison window.
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())

        total = db.query(sql_func.count(Submission.id)).filter(
            Submission.form_id == form_id
        ).scalar() or 0

        today = db.query(sql_func.count(Submission.id)).filter(
            Submission.form_id == form_id,
            Submission.submitted_at >= today_start,
        ).scalar() or 0

        this_week = db.query(sql_func.count(Submission.id)).filter(
            Submission.form_id == form_id,
            Submission.submitted_at >= week_start,
        ).scalar() or 0

        return {
            "total": total,
            "today": today,
            "this_week": this_week,
        }

    # ─── Shareable Link Methods (Day 6) ────────────────────────────────

    @staticmethod
    def generate_link(db: Session, form_id: int) -> Dict[str, Any]:
        """Generate a shareable link for a published form."""
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        # Find the latest published version
        published_version = (
            db.query(FormVersion)
            .filter(
                FormVersion.form_id == form_id,
                FormVersion.status == "published"
            )
            .order_by(desc(FormVersion.version_number))
            .first()
        )

        if not published_version:
            raise ValueError("Please publish the form before generating a public link.")

        # Generate a unique token
        while True:
            link_token = secrets.token_hex(6)  # 12-char hex string
            existing = db.query(PublicLink).filter(
                PublicLink.link_token == link_token
            ).first()
            if not existing:
                break

        public_link = PublicLink(
            form_id=form_id,
            form_version_id=published_version.id,
            link_token=link_token
        )
        db.add(public_link)
        db.flush()
        db.commit()

        public_url = f"http://localhost:5173/f/{link_token}"

        return {
            "link_token": link_token,
            "public_url": public_url,
            "form_version": published_version.version_number,
        }

    @staticmethod
    def get_public_form(db: Session, link_token: str) -> Dict[str, Any]:
        """Get the published form data for a public link token."""
        public_link = db.query(PublicLink).filter(
            PublicLink.link_token == link_token
        ).first()

        if not public_link:
            raise ValueError("Invalid or expired public link.")

        # Fetch the specific published version (immutable snapshot)
        version = db.query(FormVersion).filter(
            FormVersion.id == public_link.form_version_id
        ).first()

        if not version or version.status != "published":
            raise ValueError("Invalid or expired public link.")

        # Get fields from this specific published version
        fields = (
            db.query(Field)
            .filter(Field.form_version_id == version.id)
            .order_by(Field.order)
            .all()
        )

        return {
            "form": {
                "id": public_link.form_id,
                "title": version.title,
                "description": version.description,
            },
            "fields": [
                {
                    "id": f.id,
                    "label": f.label,
                    "type": f.field_type,
                    "config": f.configuration or {},
                    "is_required": f.is_required == 1,
                    "order": f.order,
                }
                for f in fields
            ],
            "version": version.version_number,
            "form_version_id": version.id,
        }

    # ─── Submission Storage (Day 11) ───────────────────────────────────

    @staticmethod
    def get_submission_by_idempotency_key(
        db: Session,
        form_id: int,
        idempotency_key: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Find an existing submission by idempotency key.

        Args:
            db: Database session
            form_id: The form ID
            idempotency_key: The idempotency key from the request header

        Returns:
            Dict with submission info if found, None otherwise
        """
        submissions = (
            db.query(Submission)
            .filter(Submission.form_id == form_id)
            .all()
        )
        for sub in submissions:
            meta = sub.metadata_json or {}
            if meta.get("idempotency_key") == idempotency_key:
                return {
                    "id": sub.id,
                    "response_id": sub.response_id,
                    "submitted_at": sub.submitted_at,
                    "files": [],
                }
        return None

    @staticmethod
    def store_submission(
        db: Session,
        form_id: int,
        form_version_id: int,
        link_token: str,
        form_values: Dict[str, Any],
        field_states: Dict[int, Dict[str, bool]],
        idempotency_key: Optional[str] = None,
        started_at: Optional[datetime] = None,
        session_id: Optional[str] = None,
    ) -> str:
        """
        Store a validated form submission.

        Args:
            db: Database session
            form_id: The form ID
            form_version_id: The published version ID
            link_token: The public link token
            form_values: Dict mapping field_id -> submitted value
            field_states: Dict mapping field_id -> {visible, required, disabled}
            idempotency_key: Optional idempotency key to store in metadata_json
            started_at: Optional timestamp when the respondent started the form
            session_id: Optional session id (linked to form_sessions tracking)

        Returns:
            response_id: UUID string for the submission
        """
        response_id = str(uuid.uuid4())

        # Build metadata JSON with optional idempotency key
        metadata = {}
        if idempotency_key:
            metadata["idempotency_key"] = idempotency_key

        # Normalize both timestamps to NAIVE UTC.
        #
        # CRITICAL: the DB session timezone is NOT UTC (e.g. Asia/Calcutta).
        # Writing an *aware* datetime here makes psycopg2 convert it to the
        # session timezone before storing it in the naive `timestamp` column,
        # silently shifting it (e.g. +5:30). started_at and submitted_at must
        # use the SAME naive-UTC convention or `submitted_at - started_at`
        # becomes wrong by the session offset — which showed up as bogus
        # "5h 30m" average completion times.
        normalized_started_at = None
        if started_at is not None:
            if started_at.tzinfo is not None:
                normalized_started_at = started_at.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                normalized_started_at = started_at

        normalized_submitted_at = datetime.now(timezone.utc).replace(tzinfo=None)

        submission = Submission(
            form_id=form_id,
            form_version_id=form_version_id,
            link_token=link_token,
            response_id=response_id,
            status="completed",
            started_at=normalized_started_at,
            session_id=session_id,
            submitted_at=normalized_submitted_at,
            metadata_json=metadata if metadata else None,
        )
        db.add(submission)
        db.flush()

        # Insert response values for every visible submitted field
        for field_id_str, value in form_values.items():
            try:
                field_id = int(field_id_str)
            except (ValueError, TypeError):
                continue

            state = field_states.get(field_id, {"visible": True})
            # Only store visible fields
            if state.get("visible") is False:
                continue

            if value is None or (isinstance(value, str) and value.strip() == ""):
                continue

            # Convert list values to JSON string for storage
            if isinstance(value, (list, dict)):
                stored_value = json.dumps(value)
            else:
                stored_value = str(value)

            response_val = ResponseValue(
                submission_id=submission.id,
                field_id=field_id,
                value=stored_value,
            )
            db.add(response_val)

        db.flush()
        db.commit()
        db.refresh(submission)

        # Invalidate analytics cache for this form (new submission).
        # (Deletes / response updates should also call invalidate() — no such
        # endpoints exist yet, but the hook is in place for when they do.)
        from .analytics_service import AnalyticsService
        AnalyticsService.invalidate(form_id)

        return response_id

    # ─── File Handling (Day 12) ──────────────────────────────────────

    @staticmethod
    def get_submission_by_response_id(db: Session, response_id: str) -> Optional[Submission]:
        """Get a submission by its response_id."""
        return db.query(Submission).filter(Submission.response_id == response_id).first()

    @staticmethod
    def store_field_file_reference(
        db: Session,
        submission_id: int,
        field_id: int,
        stored_filename: str,
    ) -> None:
        """Store a file reference in the response_values table for file-type fields."""
        response_val = ResponseValue(
            submission_id=submission_id,
            field_id=field_id,
            value=stored_filename,
        )
        db.add(response_val)
        db.flush()
