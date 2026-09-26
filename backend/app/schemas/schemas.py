from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any


class FieldSchema(BaseModel):
    id: Optional[int] = None
    form_version_id: Optional[int] = None
    field_type: str
    label: str
    placeholder: Optional[str] = None
    is_required: int = 0
    order: int = 0
    configuration: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FormSchema(BaseModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FormCreateResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class FormCreateSchema(BaseModel):
    title: str
    description: Optional[str] = None


class FieldCreateRequest(BaseModel):
    label: str
    field_type: str
    required: bool = False
    order: int = 0
    config: Optional[Dict[str, Any]] = None


class FieldResponse(BaseModel):
    id: int
    label: str
    type: str
    config: Dict[str, Any] = {}
    is_required: bool = False
    order: int = 0

    class Config:
        from_attributes = True


class FieldUpdateRequest(BaseModel):
    label: Optional[str] = None
    placeholder: Optional[str] = None
    required: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None


class FieldReorderRequest(BaseModel):
    ordered_field_ids: List[int]


class DeleteResponse(BaseModel):
    message: str


class FormDetailResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    fields: List[FieldResponse] = []
    version_id: Optional[int] = None
    version_number: Optional[int] = None
    version_status: str = "draft"

    class Config:
        from_attributes = True


class VersionSummary(BaseModel):
    id: int
    version_number: int
    status: str
    title: str
    description: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    field_count: int = 0

    class Config:
        from_attributes = True


class PublishResponse(BaseModel):
    version_id: int
    version_number: int
    status: str
    published_at: datetime
    message: str


class ArchiveResponse(BaseModel):
    version_id: int
    version_number: int
    status: str
    message: str


class DraftCreateResponse(BaseModel):
    version_id: int
    version_number: int
    status: str
    message: str


class FormStats(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str = "draft"
    latest_version: Optional[int] = None
    latest_version_id: Optional[int] = None
    field_count: int = 0
    version_count: int = 0
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GenerateLinkResponse(BaseModel):
    success: bool = True
    link_token: str
    public_url: str
    form_version: int


class PublicFormFieldResponse(BaseModel):
    id: int
    label: str
    type: str
    config: Dict[str, Any] = {}
    is_required: bool = False
    order: int = 0

    class Config:
        from_attributes = True


class PublicFormResponse(BaseModel):
    success: bool = True
    form: Dict[str, Any]
    fields: List[PublicFormFieldResponse] = []
    version: int


class RuleCreate(BaseModel):
    trigger_field_id: int
    operator: str
    compare_value: Optional[str] = None
    target_field_id: int
    action: str


class RuleUpdate(BaseModel):
    trigger_field_id: Optional[int] = None
    operator: Optional[str] = None
    compare_value: Optional[str] = None
    target_field_id: Optional[int] = None
    action: Optional[str] = None


class RuleResponse(BaseModel):
    id: int
    form_id: int
    trigger_field_id: int
    operator: str
    compare_value: Optional[str] = None
    target_field_id: int
    action: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RuleList(BaseModel):
    rules: List[RuleResponse] = []
    total: int = 0


class FileMetadataResponse(BaseModel):
    field_id: int
    original_filename: str
    stored_filename: str
    content_type: str
    size: int
    download_url: str

    class Config:
        from_attributes = True


class FormSubmissionRequest(BaseModel):
    form_values: Dict[str, Any] = {}

    class Config:
        extra = "forbid"


class FormSubmissionResponse(BaseModel):
    success: bool = True
    message: str = "Validation successful"
    errors: Optional[Dict[str, List[str]]] = None
    response_id: Optional[str] = None
    submitted_at: Optional[datetime] = None
    form_id: Optional[int] = None
    form_version_id: Optional[int] = None
    summary: Optional[Dict[str, int]] = None
    files: Optional[List[FileMetadataResponse]] = None


class RuleEvaluationRequest(BaseModel):
    form_values: Dict[str, Any] = {}


class FieldEvaluation(BaseModel):
    field_id: int
    visible: bool = True
    required: bool = False
    disabled: bool = False


class RuleEvaluationResponse(BaseModel):
    field_states: List[FieldEvaluation] = []
    triggered_rules: List[int] = []


# ─── Submission / Response schemas (Day 12) ───────────────────────────

class ResponseValueSchema(BaseModel):
    field_id: int
    field_label: str
    field_type: str
    value: Optional[str] = None
    file_download_url: Optional[str] = None

    class Config:
        from_attributes = True


class SubmissionSummary(BaseModel):
    id: int
    response_id: str
    form_id: int
    form_title: str = ""
    submitted_at: datetime
    status: str = "completed"
    field_count: int = 0

    class Config:
        from_attributes = True


class SubmissionDetail(BaseModel):
    id: int
    response_id: str
    form_id: int
    form_version_id: int
    link_token: str
    status: str
    submitted_at: datetime
    responses: List[ResponseValueSchema] = []

    class Config:
        from_attributes = True


class SubmissionListResponse(BaseModel):
    submissions: List[SubmissionSummary] = []
    total: int = 0
    form_title: str = ""


class SubmissionStatsResponse(BaseModel):
    total: int = 0
    today: int = 0
    this_week: int = 0


# ─── Response browser schemas (Day 16) ───────────────────────────────

class ResponseListItem(BaseModel):
    """One row in the response browser table (summary only — not every field)."""
    response_id: Optional[str] = None
    submitted_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    status: str = "completed"
    time_to_complete: Optional[str] = None
    has_attachments: bool = False
    summary: Dict[str, Any] = {}

    class Config:
        from_attributes = True


class ResponseListResponse(BaseModel):
    total: int = 0
    count: int = 0
    offset: int = 0
    limit: int = 0
    responses: List[ResponseListItem] = []

    class Config:
        from_attributes = True


class ResponseDetailValue(BaseModel):
    """A single field/value pair inside the response detail view."""
    field_id: int
    field_label: str
    field_type: str
    value: Optional[str] = None
    file_download_url: Optional[str] = None
    file_content_type: Optional[str] = None

    class Config:
        from_attributes = True


class ResponseDetailResponse(BaseModel):
    """Full response detail powering the detail modal."""
    response_id: str
    form_id: int
    form_title: str = ""
    form_version_id: Optional[int] = None
    status: str = "completed"
    submitted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    time_to_complete: Optional[str] = None
    responses: List[ResponseDetailValue] = []
    files: List[FileMetadataResponse] = []
    summary: Dict[str, Any] = {}

    class Config:
        from_attributes = True


# ─── Analytics schemas (Day 14) ─────────────────────────────────────

class FormAnalyticsResponse(BaseModel):
    form_id: int
    form_name: str
    total_submissions: int = 0
    started_sessions: int = 0
    completed_submissions: int = 0
    completion_rate: float = 0.0
    average_completion_time_seconds: int = 0
    average_completion_time: str = "0s"
    last_submission: Optional[str] = None
    last_updated: Optional[str] = None
    field_distributions: List["FieldDistribution"] = []
    submissions_over_time: List["TrendPoint"] = []

    class Config:
        from_attributes = True


# ─── Per-field distribution schemas (Day 17) ─────────────────────────

class FieldDistributionValue(BaseModel):
    """A single option/value bucket inside a field distribution."""

    value: str
    count: int = 0
    percentage: float = 0.0

    class Config:
        from_attributes = True


class FieldDistribution(BaseModel):
    """Response distribution for one supported question (dropdown/radio/checkbox/rating)."""

    field_id: int
    label: str
    type: str
    total_responses: int = 0
    average: Optional[float] = None  # rating only: mean rating across responses
    distribution: List[FieldDistributionValue] = []

    class Config:
        from_attributes = True


class TrendPoint(BaseModel):
    """One daily submissions-over-time bucket (date as ISO `YYYY-MM-DD`)."""

    date: str
    count: int = 0

    class Config:
        from_attributes = True


class AnalyticsSummaryResponse(BaseModel):
    total_forms: int = 0
    total_submissions: int = 0
    total_started_sessions: int = 0
    completion_rate: float = 0.0
    average_completion_time_seconds: int = 0
    average_completion_time: str = "0s"

    class Config:
        from_attributes = True


class TrackSessionRequest(BaseModel):
    session_id: str
    started_at: Optional[datetime] = None


class TrackSessionResponse(BaseModel):
    success: bool = True
    session_id: str
    started_at: Optional[str] = None
    form_id: Optional[int] = None


# ─── Form duplication schemas (Day 18) ──────────────────────────────

class DuplicatedFormInfo(BaseModel):
    """Summary of the newly created duplicate form."""
    id: int
    title: str
    status: str = "draft"

    class Config:
        from_attributes = True


class FormDuplicateResponse(BaseModel):
    """Response returned by POST /forms/{form_id}/duplicate."""
    success: bool = True
    message: str = "Form duplicated successfully"
    form: DuplicatedFormInfo

    class Config:
        from_attributes = True


# ─── Retention policy schemas (Day 19) ──────────────────────────────

class RetentionPolicySchema(BaseModel):
    """A per-form retention policy (or the "Never" placeholder row)."""
    id: Optional[int] = None
    form_id: int
    form_name: str = ""
    retention_days: Optional[int] = None  # None = Never
    action: str = "archive"
    enabled: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RetentionPolicyCreate(BaseModel):
    retention_days: Optional[int] = None  # None = Never
    action: str = "archive"
    enabled: bool = True


class RetentionPolicyUpdate(BaseModel):
    retention_days: Optional[int] = None
    action: Optional[str] = None
    enabled: Optional[bool] = None


class RetentionPolicyListResponse(BaseModel):
    policies: List[RetentionPolicySchema] = []
    total: int = 0


# ─── Bulk response deletion (Day 19) ────────────────────────────────

class BulkDeleteRequest(BaseModel):
    """
    Bulk-delete criteria for a form's responses.

    Two modes (mutually exclusive):
    - **Selected**: pass an explicit non-empty `response_ids` list.
    - **Filtered**: pass at least one of `from_date` / `to_date` / `status`.

    `confirm` MUST be true — the backend rejects the request otherwise.
    """
    response_ids: Optional[List[str]] = None
    from_date: Optional[str] = None  # YYYY-MM-DD (inclusive start)
    to_date: Optional[str] = None    # YYYY-MM-DD (inclusive end)
    status: Optional[str] = None     # all | completed | archived
    confirm: bool = False


class BulkDeleteResponse(BaseModel):
    success: bool = True
    message: str = ""
    deleted: int = 0
    deleted_ids: List[str] = []


# ─── Audit log schemas (Day 19) ─────────────────────────────────────

class AuditLogResponse(BaseModel):
    """One audit log entry."""
    id: int
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None  # resolved from User (None for system)
    actor_type: str = "user"
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    form_id: Optional[int] = None
    form_name: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    records_affected: int = 0
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    total: int = 0
    count: int = 0
    offset: int = 0
    limit: int = 0
    logs: List[AuditLogResponse] = []

    class Config:
        from_attributes = True

