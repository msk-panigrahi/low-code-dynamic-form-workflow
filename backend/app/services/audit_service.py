"""
Audit logging service (Day 19).

Append-only audit trail for archive/delete operations. Every entry records:

- WHO   : the authenticated user, or the system scheduler (actor_type="system")
- WHAT  : the action ("archive", "delete")
- WHICH : entity type + id (submission / form / retention_policy)
- HOW MANY : records affected
- WHERE : IP address when available
- WHEN  : created_at
- DETAILS : structured JSON metadata (never sensitive response contents)

Entries are only ever created — there is no update/delete API, keeping the
trail append-only.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from ..models import AuditLog, User


class AuditService:
    """Factory for audit log entries."""

    @staticmethod
    def log(
        db: Session,
        *,
        action: str,
        entity_type: str,
        actor_id: Optional[int] = None,
        actor_type: str = "user",
        entity_id: Optional[int] = None,
        form_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        records_affected: int = 0,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """Create and commit an audit log entry.

        Args:
            db: Database session
            action: "archive" | "delete" | ...
            entity_type: "submission" | "form" | "retention_policy" | ...
            actor_id: The authenticated user's id (None for system operations)
            actor_type: "user" or "system" (system when actor_id is None)
            entity_id: Optional primary-key id of the entity
            form_id: Optional form id this event belongs to
            details: Optional structured metadata (JSON-serializable)
            records_affected: Number of records affected by the operation
            ip_address: Optional client IP (user actions only)
        """
        log = AuditLog(
            actor_id=actor_id,
            actor_type="system" if actor_id is None else actor_type,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            form_id=form_id,
            details=details,
            records_affected=records_affected,
            ip_address=ip_address,
            created_at=datetime.utcnow(),
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def log_system(
        db: Session,
        *,
        action: str,
        entity_type: str,
        entity_id: Optional[int] = None,
        form_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        records_affected: int = 0,
    ) -> AuditLog:
        """Create an audit entry attributed to the system scheduler."""
        return AuditService.log(
            db,
            action=action,
            entity_type=entity_type,
            actor_id=None,
            actor_type="system",
            entity_id=entity_id,
            form_id=form_id,
            details=details,
            records_affected=records_affected,
        )
