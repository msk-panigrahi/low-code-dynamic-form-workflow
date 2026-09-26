from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, email={self.email})>"


class ConditionalRule(Base):
    __tablename__ = "conditional_rules"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=False)
    trigger_field_id = Column(Integer, ForeignKey("fields.id"), nullable=False)
    operator = Column(String(50), nullable=False)  # equals, not_equals, contains, greater_than, less_than, is_empty, is_not_empty
    compare_value = Column(String(255), nullable=True)
    target_field_id = Column(Integer, ForeignKey("fields.id"), nullable=False)
    action = Column(String(20), nullable=False)  # show, hide, require
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    form = relationship("Form", backref="conditional_rules")
    trigger_field = relationship("Field", foreign_keys=[trigger_field_id])
    target_field = relationship("Field", foreign_keys=[target_field_id])

    def __repr__(self):
        return f"<ConditionalRule(id={self.id}, form_id={self.form_id}, trigger={self.trigger_field_id}, action={self.action})>"


class Form(Base):
    __tablename__ = "forms"
    
    id = Column(Integer, primary_key=True, index=True)
    # Owner of the form (nullable for legacy forms created before ownership
    # tracking existed — those remain exportable by any authenticated user).
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    versions = relationship("FormVersion", back_populates="form", cascade="all, delete-orphan", order_by="FormVersion.version_number.desc()")
    owner = relationship("User", backref="forms")
    
    def __repr__(self):
        return f"<Form(id={self.id}, title={self.title})>"


class FormVersion(Base):
    __tablename__ = "form_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="draft")  # "draft", "published", "archived"
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    form = relationship("Form", back_populates="versions")
    fields = relationship("Field", back_populates="form_version", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<FormVersion(id={self.id}, form_id={self.form_id}, version={self.version_number}, status={self.status})>"


class Field(Base):
    __tablename__ = "fields"
    
    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(Integer, ForeignKey("form_versions.id"), nullable=False)
    field_type = Column(String(50), nullable=False)  # text, number, email, dropdown, checkbox, date, file, rating
    label = Column(String(255), nullable=False)
    placeholder = Column(String(255), nullable=True)
    is_required = Column(Integer, default=0)  # 0 = optional, 1 = required
    order = Column(Integer, nullable=False, default=0)
    configuration = Column(JSON, nullable=True)  # JSONB field for storing type-specific configuration
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    form_version = relationship("FormVersion", back_populates="fields")
    options = relationship("FieldOption", back_populates="field", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Field(id={self.id}, field_type={self.field_type}, label={self.label})>"


class FieldOption(Base):
    __tablename__ = "field_options"
    
    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=False)
    label = Column(String(255), nullable=False)
    value = Column(String(255), nullable=False)
    order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    field = relationship("Field", back_populates="options")
    
    def __repr__(self):
        return f"<FieldOption(id={self.id}, field_id={self.field_id}, label={self.label})>"


class PublicLink(Base):
    __tablename__ = "public_links"
    
    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=False)
    form_version_id = Column(Integer, ForeignKey("form_versions.id"), nullable=False)
    link_token = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    form = relationship("Form", backref="public_links")
    form_version = relationship("FormVersion", backref="public_links")
    
    def __repr__(self):
        return f"<PublicLink(id={self.id}, token={self.link_token}, form_id={self.form_id})>"


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=False)
    form_version_id = Column(Integer, ForeignKey("form_versions.id"), nullable=False)
    link_token = Column(String(64), nullable=False)
    response_id = Column(String(36), unique=True, nullable=False, index=True)
    status = Column(String(20), default="completed", nullable=False)  # "completed", "archived", "partial"
    metadata_json = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    session_id = Column(String(64), nullable=True, index=True)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    archived_at = Column(DateTime, nullable=True)  # set when retention archival marks this submission archived
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    form = relationship("Form", backref="submissions")
    form_version = relationship("FormVersion", backref="submissions")
    responses = relationship("ResponseValue", back_populates="submission", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Submission(id={self.id}, response_id={self.response_id}, form_id={self.form_id})>"


class ResponseValue(Base):
    __tablename__ = "response_values"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=False)
    value = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    submission = relationship("Submission", back_populates="responses")
    field = relationship("Field", backref="response_values")

    def __repr__(self):
        return f"<ResponseValue(id={self.id}, field_id={self.field_id})>"


class FormSession(Base):
    """Lightweight tracking of a respondent session opening a public form."""
    __tablename__ = "form_sessions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=False)
    session_id = Column(String(64), nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    form = relationship("Form", backref="form_sessions")

    def __repr__(self):
        return f"<FormSession(id={self.id}, form_id={self.form_id}, session_id={self.session_id})>"


class FileMetadata(Base):
    __tablename__ = "file_metadata"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, index=True)
    content_type = Column(String(127), nullable=False)
    size = Column(Integer, nullable=False)
    relative_path = Column(String(512), nullable=False)
    upload_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    download_token = Column(String(64), unique=True, nullable=True, index=True)
    token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    submission = relationship("Submission", backref="file_metadata")
    field = relationship("Field", backref="file_metadata")

    def __repr__(self):
        return f"<FileMetadata(id={self.id}, stored={self.stored_filename}, original={self.original_filename})>"


class RetentionPolicy(Base):
    """Configurable per-form retention policy (Day 19).

    One policy per form. When `enabled` is True and `retention_days` is set,
    the scheduler marks submissions older than the cutoff as `archived`
    (data is preserved — never physically deleted). A disabled policy or
    `retention_days = None` means "Never" (keep everything).
    """
    __tablename__ = "retention_policies"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=False, unique=True, index=True)
    retention_days = Column(Integer, nullable=True)  # None = "Never"
    action = Column(String(20), default="archive", nullable=False)  # "archive"
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    form = relationship("Form", backref="retention_policy")

    def __repr__(self):
        return f"<RetentionPolicy(id={self.id}, form_id={self.form_id}, days={self.retention_days}, enabled={self.enabled})>"


class AuditLog(Base):
    """Append-only audit trail for archive/delete operations (Day 19).

    `actor_id` is NULL for system-driven operations (the retention scheduler);
    `actor_type` distinguishes "system" from "user" actors.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_type = Column(String(20), default="user", nullable=False)  # "user" | "system"
    action = Column(String(50), nullable=False)  # "archive", "delete"
    entity_type = Column(String(50), nullable=False)  # "submission", "form", "retention_policy"
    entity_id = Column(Integer, nullable=True)  # e.g. a submission id (or None when bulk)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=True)
    details = Column(JSON, nullable=True)
    records_affected = Column(Integer, default=0, nullable=False)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    actor = relationship("User", foreign_keys=[actor_id], backref="audit_logs")
    form = relationship("Form", foreign_keys=[form_id], backref="audit_logs")

    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, entity={self.entity_type}, affected={self.records_affected})>"


class FormArchiveJobRun(Base):
    """Tracks a single scheduler run of the retention archive job (Day 19).

    Keeps the archival idempotent and auditable: each run records how many
    submissions were archived across which policies, so operators can see
    exactly what the scheduler did.
    """
    __tablename__ = "archive_job_runs"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    archived_total = Column(Integer, default=0, nullable=False)
    policies_processed = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="running", nullable=False)  # "running", "completed", "failed"
    error_message = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<FormArchiveJobRun(id={self.id}, status={self.status}, archived={self.archived_total})>"
