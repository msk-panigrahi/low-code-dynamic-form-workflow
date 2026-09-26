"""
Retention policy service (Day 19).

Per-form retention policies with an idempotent archival job:

- Policies belong to exactly one form (unique form_id).
- `enabled=False` or `retention_days=None` means "Never" (keep everything).
- The archive job (`run_archive_job`) marks submissions older than the
  cutoff as `status="archived"` + `archived_at`. It NEVER deletes rows —
  archival always preserves data.
- The job is idempotent: submissions already archived (or already having an
  archived_at) are never touched again, so running it repeatedly has no
  duplicate effects.

Every policy mutation and every archive run writes an audit log entry.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..models import Form, RetentionPolicy, Submission, FormArchiveJobRun
from .analytics_service import AnalyticsService
from .audit_service import AuditService


class RetentionService:
    """CRUD for retention policies + the archival job."""

    # ─── Policy helpers ─────────────────────────────────────────────

    @staticmethod
    def _get_form(db: Session, form_id: int) -> Form:
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")
        return form

    @classmethod
    def _serialize(cls, policy: RetentionPolicy, form_title: Optional[str] = None) -> Dict[str, Any]:
        return {
            "id": policy.id,
            "form_id": policy.form_id,
            "form_name": form_title or "",
            "retention_days": policy.retention_days,
            "action": policy.action,
            "enabled": policy.enabled,
            "created_at": policy.created_at,
            "updated_at": policy.updated_at,
        }

    # ─── CRUD ───────────────────────────────────────────────────────

    @classmethod
    def list_policies(cls, db: Session, current_user_id: int) -> List[Dict[str, Any]]:
        """List policies the user may manage (owned forms + legacy NULL-owner forms)."""
        forms = (
            db.query(Form)
            .filter((Form.user_id == current_user_id) | (Form.user_id.is_(None)))
            .order_by(Form.title)
            .all()
        )
        form_map = {f.id: f for f in forms}
        policies = (
            db.query(RetentionPolicy)
            .filter(RetentionPolicy.form_id.in_(form_map.keys()))
            .all()
        )
        policy_map = {p.form_id: p for p in policies}
        # One row per accessible form, with or without a policy (Never = no policy).
        result = []
        for form in forms:
            policy = policy_map.get(form.id)
            if policy:
                result.append(cls._serialize(policy, form.title))
            else:
                result.append(
                    {
                        "id": None,
                        "form_id": form.id,
                        "form_name": form.title,
                        "retention_days": None,
                        "action": "archive",
                        "enabled": False,
                        "created_at": None,
                        "updated_at": None,
                    }
                )
        return result

    @classmethod
    def get_policy(cls, db: Session, form_id: int) -> Optional[Dict[str, Any]]:
        cls._get_form(db, form_id)
        policy = db.query(RetentionPolicy).filter(RetentionPolicy.form_id == form_id).first()
        if not policy:
            return None
        form = db.query(Form).filter(Form.id == form_id).first()
        return cls._serialize(policy, form.title if form else None)

    @classmethod
    def create_policy(
        cls,
        db: Session,
        form_id: int,
        retention_days: Optional[int],
        action: str = "archive",
        enabled: bool = True,
        actor_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Create a retention policy for a form. One policy per form (unique)."""
        cls._get_form(db, form_id)
        existing = db.query(RetentionPolicy).filter(RetentionPolicy.form_id == form_id).first()
        if existing:
            raise ValueError(f"A retention policy already exists for form {form_id}")

        if action not in ("archive",):
            raise ValueError("Unsupported action. Supported actions: archive")

        if enabled and retention_days is not None and retention_days < 1:
            raise ValueError("Retention days must be a positive integer when enabled.")

        policy = RetentionPolicy(
            form_id=form_id,
            retention_days=retention_days,
            action=action,
            enabled=enabled,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)

        form = db.query(Form).filter(Form.id == form_id).first()
        AuditService.log(
            db,
            action="create",
            entity_type="retention_policy",
            actor_id=actor_id,
            entity_id=policy.id,
            form_id=form_id,
            details={
                "retention_days": retention_days,
                "action": action,
                "enabled": enabled,
            },
            records_affected=1,
        )
        return cls._serialize(policy, form.title if form else None)

    @classmethod
    def update_policy(
        cls,
        db: Session,
        form_id: int,
        retention_days: Optional[int] = None,
        action: Optional[str] = None,
        enabled: Optional[bool] = None,
        actor_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Update an existing policy (partial update)."""
        policy = db.query(RetentionPolicy).filter(RetentionPolicy.form_id == form_id).first()
        if not policy:
            raise ValueError(f"No retention policy found for form {form_id}")

        if retention_days is not None:
            if retention_days < 1:
                raise ValueError("Retention days must be a positive integer when enabled.")
            policy.retention_days = retention_days
        if action is not None:
            if action not in ("archive",):
                raise ValueError("Unsupported action. Supported actions: archive")
            policy.action = action
        if enabled is not None:
            policy.enabled = enabled

        policy.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(policy)

        form = db.query(Form).filter(Form.id == form_id).first()
        AuditService.log(
            db,
            action="update",
            entity_type="retention_policy",
            actor_id=actor_id,
            entity_id=policy.id,
            form_id=form_id,
            details={
                "retention_days": policy.retention_days,
                "action": policy.action,
                "enabled": policy.enabled,
            },
            records_affected=1,
        )
        return cls._serialize(policy, form.title if form else None)

    @classmethod
    def delete_policy(cls, db: Session, form_id: int, actor_id: Optional[int] = None) -> None:
        """Remove a retention policy (returns the form to \"Never\")."""
        policy = db.query(RetentionPolicy).filter(RetentionPolicy.form_id == form_id).first()
        if not policy:
            raise ValueError(f"No retention policy found for form {form_id}")
        policy_id = policy.id
        db.delete(policy)
        db.commit()
        AuditService.log(
            db,
            action="delete",
            entity_type="retention_policy",
            actor_id=actor_id,
            entity_id=policy_id,
            form_id=form_id,
            details={},
            records_affected=1,
        )

    # ─── Archive job ────────────────────────────────────────────────

    @staticmethod
    def _naive_utc_now() -> datetime:
        return datetime.utcnow()

    @classmethod
    def run_archive_job(cls, db: Session) -> Dict[str, Any]:
        """
        Run the retention archival job once.

        For every **enabled** policy with a `retention_days` value, find
        submissions of that form that are:
          - still `completed` (active),
          - `submitted_at` older than the cutoff (`now - retention_days`),
          - not already archived (archived_at IS NULL),

        and mark them `status="archived"` + `archived_at=now`.

        Idempotent: already-archived rows are never re-archived. One audit
        log entry is written per affected form, plus one run record.

        Returns a summary dict: {run_id, archived_total, affected_forms}.
        """
        run = FormArchiveJobRun(
            started_at=cls._naive_utc_now(),
            status="running",
            archived_total=0,
            policies_processed=0,
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        now = cls._naive_utc_now()
        archived_total = 0
        affected_forms: List[Dict[str, Any]] = []
        policies_processed = 0

        try:
            policies = (
                db.query(RetentionPolicy)
                .filter(RetentionPolicy.enabled.is_(True))
                .all()
            )
            for policy in policies:
                if not policy.retention_days or policy.retention_days < 1:
                    continue  # "Never" policy — nothing to do
                policies_processed += 1

                cutoff = now - timedelta(days=policy.retention_days)
                submissions = (
                    db.query(Submission)
                    .filter(
                        Submission.form_id == policy.form_id,
                        Submission.status == "completed",
                        Submission.archived_at.is_(None),
                        Submission.submitted_at < cutoff,
                    )
                    .all()
                )
                if not submissions:
                    continue

                for sub in submissions:
                    sub.status = "archived"
                    sub.archived_at = now
                db.commit()

                archived_total += len(submissions)
                affected_forms.append(
                    {"form_id": policy.form_id, "archived": len(submissions)}
                )

                # Audit entry for this automatic archival (system actor).
                AuditService.log_system(
                    db,
                    action="archive",
                    entity_type="submission",
                    form_id=policy.form_id,
                    details={
                        "reason": "retention_policy",
                        "retention_days": policy.retention_days,
                        "cutoff": cutoff.isoformat(),
                    },
                    records_affected=len(submissions),
                )
                # Archived submissions drop out of active analytics.
                AnalyticsService.invalidate(policy.form_id)

            run.archived_total = archived_total
            run.policies_processed = policies_processed
            run.status = "completed"
            run.finished_at = cls._naive_utc_now()
            db.commit()
        except Exception as e:
            db.rollback()
            run.status = "failed"
            run.error_message = str(e)[:500]
            run.finished_at = cls._naive_utc_now()
            db.commit()
            raise

        return {
            "run_id": run.id,
            "archived_total": archived_total,
            "policies_processed": policies_processed,
            "affected_forms": affected_forms,
        }
