"""
Analytics aggregation service.

Calculates per-form response analytics (Day 14 / Milestone 3):

- Total submissions
- Completed submissions
- Started sessions (lightweight session tracking)
- Completion rate = completed / started * 100
- Average completion time (seconds + human readable)
- Latest submission timestamp

Design notes (future-ready):
- The service is intentionally structured so charts, field analytics,
  rating analytics and export can be added as new methods without
  refactoring the existing surface.
- A simple in-memory cache (dict) with a TTL is used. It is invalidated
  whenever a submission is created / updated / deleted, or a session is
  tracked, so analytics never goes stale for long.
"""
import json
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func as sql_func, desc, exists, and_
from sqlalchemy.orm import Session

from ..models import Field, Form, FormVersion, ResponseValue, Submission, FormSession

# ─── Simple in-memory cache ────────────────────────────────────────────

_CACHE: Dict[str, tuple] = {}          # key -> (expires_at, payload)
_CACHE_LOCK = threading.Lock()
_CACHE_TTL_SECONDS = 60


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Return a naive UTC datetime for consistent arithmetic."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class AnalyticsService:
    """Aggregated analytics for forms."""

    # ─── Cache helpers ─────────────────────────────────────────────

    @classmethod
    def _cache_key(cls, form_id: int) -> str:
        return f"form:{form_id}"

    @classmethod
    def invalidate(cls, form_id: int) -> None:
        """Invalidate the cached analytics for a single form."""
        with _CACHE_LOCK:
            _CACHE.pop(cls._cache_key(form_id), None)

    @classmethod
    def invalidate_all(cls) -> None:
        """Invalidate every cached analytics payload."""
        with _CACHE_LOCK:
            _CACHE.clear()

    @classmethod
    def _get_cached(cls, form_id: int) -> Optional[Dict[str, Any]]:
        key = cls._cache_key(form_id)
        with _CACHE_LOCK:
            entry = _CACHE.get(key)
            if entry is None:
                return None
            expires_at, payload = entry
            if datetime.now() > expires_at:
                _CACHE.pop(key, None)
                return None
            return payload

    @classmethod
    def _set_cached(cls, form_id: int, payload: Dict[str, Any]) -> None:
        from datetime import timedelta
        key = cls._cache_key(form_id)
        expires_at = datetime.now() + timedelta(seconds=_CACHE_TTL_SECONDS)
        with _CACHE_LOCK:
            _CACHE[key] = (expires_at, payload)

    # ─── Form helpers ──────────────────────────────────────────────

    @staticmethod
    def _get_form(db: Session, form_id: int) -> Form:
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")
        return form

    @staticmethod
    def _get_latest_version(db: Session, form_id: int) -> Optional[FormVersion]:
        return (
            db.query(FormVersion)
            .filter(FormVersion.form_id == form_id)
            .order_by(desc(FormVersion.version_number))
            .first()
        )

    # ─── Session tracking (Part 2) ─────────────────────────────────

    @classmethod
    def track_session(
        cls,
        db: Session,
        form_id: int,
        session_id: str,
        started_at: Optional[datetime] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Record that a public form was opened.

        Returns the persisted session row so callers can echo it back.
        Does not affect the submission flow — sessions are tracked
        independently and only used for completion-rate analytics.
        """
        cls._get_form(db, form_id)  # raises ValueError if form missing

        # Idempotency: never double-count a session id (e.g. a retry or a
        # StrictMode double-mount that bypassed the client-side dedup).
        existing = (
            db.query(FormSession)
            .filter(
                FormSession.form_id == form_id,
                FormSession.session_id == session_id,
            )
            .first()
        )
        if existing:
            return {
                "form_id": form_id,
                "session_id": existing.session_id,
                "started_at": (
                    existing.started_at.isoformat() if existing.started_at else None
                ),
            }

        session = FormSession(
            form_id=form_id,
            session_id=session_id,
            started_at=_to_naive_utc(started_at) or datetime.utcnow(),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # A new started session affects completion rate → invalidate cache.
        cls.invalidate(form_id)

        return {
            "form_id": form_id,
            "session_id": session.session_id,
            "started_at": session.started_at.isoformat() if session.started_at else None,
        }

    @classmethod
    def count_started_sessions(cls, db: Session, form_id: int) -> int:
        return (
            db.query(sql_func.count(FormSession.id))
            .filter(FormSession.form_id == form_id)
            .scalar()
            or 0
        )

    # ─── Per-field distributions (Day 17) ───────────────────────────

    # Field types for which a response distribution is meaningful.
    DISTRIBUTION_FIELD_TYPES = {"dropdown", "radio", "checkbox", "rating"}

    @staticmethod
    def _option_label_map(field: Field) -> Dict[str, str]:
        """
        Map stored option *values* to human-readable option *labels* using
        the field's configured options (fallback: the raw value itself).
        """
        label_map: Dict[str, str] = {}
        config = field.configuration or {}
        for opt in config.get("options", []) or []:
            if not isinstance(opt, dict):
                continue
            val = opt.get("value")
            if val is None:
                continue
            label_map[str(val)] = str(opt.get("label") or val)
        return label_map

    @classmethod
    def _single_select_distribution(cls, field: Field, raw: List[tuple]) -> Dict[str, Any]:
        """Dropdown / radio: one answer per response, counted directly."""
        total = sum(count for _, count in raw)
        label_map = cls._option_label_map(field)
        dist = []
        for value, count in raw:
            dist.append(
                {
                    "value": label_map.get(value, value),
                    "count": count,
                    "percentage": round((count / total) * 100, 1) if total else 0.0,
                }
            )
        # Most popular first, then alphabetical for stable ordering.
        dist.sort(key=lambda d: (-d["count"], d["value"].lower()))
        return {
            "field_id": field.id,
            "label": field.label,
            "type": field.field_type,
            "total_responses": total,
            "distribution": dist,
        }

    @classmethod
    def _checkbox_distribution(cls, field: Field, raw: List[tuple]) -> Dict[str, Any]:
        """
        Checkbox: each response may contain multiple selections (stored as a
        JSON array string). Each selected option is counted independently;
        percentages are relative to the number of responses (respondents).
        """
        label_map = cls._option_label_map(field)
        counts: Dict[str, int] = {}
        total_responses = 0
        for value, count in raw:
            total_responses += count
            try:
                selections = json.loads(value)
                if not isinstance(selections, list):
                    selections = [value]
            except (ValueError, TypeError):
                selections = [value]
            for sel in selections:
                if sel is None or str(sel).strip() == "":
                    continue
                key = label_map.get(str(sel), str(sel))
                counts[key] = counts.get(key, 0) + count

        dist = [
            {
                "value": value,
                "count": count,
                "percentage": round((count / total_responses) * 100, 1)
                if total_responses
                else 0.0,
            }
            for value, count in sorted(
                counts.items(), key=lambda kv: (-kv[1], kv[0].lower())
            )
        ]
        return {
            "field_id": field.id,
            "label": field.label,
            "type": field.field_type,
            "total_responses": total_responses,
            "distribution": dist,
        }

    @classmethod
    def _rating_distribution(cls, field: Field, raw: List[tuple]) -> Dict[str, Any]:
        """
        Rating: counts for every level in the configured scale (incl. zero
        counts) plus the average rating across responses.
        """
        config = field.configuration or {}
        try:
            min_stars = int(config.get("minimumStars", 1))
        except (ValueError, TypeError):
            min_stars = 1
        try:
            max_stars = int(config.get("maximumStars", 5))
        except (ValueError, TypeError):
            max_stars = 5
        if max_stars < min_stars:
            max_stars = min_stars

        counts: Dict[int, int] = {}
        total = 0
        weighted = 0
        for value, count in raw:
            try:
                rating = int(float(value))
            except (ValueError, TypeError):
                continue
            counts[rating] = counts.get(rating, 0) + count
            total += count
            weighted += rating * count

        dist = []
        for level in range(min_stars, max_stars + 1):
            count = counts.get(level, 0)
            dist.append(
                {
                    "value": str(level),
                    "count": count,
                    "percentage": round((count / total) * 100, 1) if total else 0.0,
                }
            )

        return {
            "field_id": field.id,
            "label": field.label,
            "type": field.field_type,
            "total_responses": total,
            "average": round(weighted / total, 2) if total else None,
            "distribution": dist,
        }

    @classmethod
    def get_field_distributions(cls, db: Session, form_id: int) -> List[Dict[str, Any]]:
        """
        Response distributions for every supported question on the form's
        latest version. Aggregated in SQL (one grouped query, no N+1).

        Note: like the rest of the analytics payload, only the **latest**
        version's fields are aggregated — responses on fields removed in
        newer versions are not included in the distributions.
        """
        version = cls._get_latest_version(db, form_id)
        if not version:
            return []

        fields = (
            db.query(Field)
            .filter(
                Field.form_version_id == version.id,
                Field.field_type.in_(cls.DISTRIBUTION_FIELD_TYPES),
            )
            .order_by(Field.order)
            .all()
        )
        if not fields:
            return []

        field_ids = [f.id for f in fields]

        # Single grouped query for every supported field — no per-field queries.
        # Archived submissions (Day 19) are excluded from active distributions.
        rows = (
            db.query(
                ResponseValue.field_id,
                ResponseValue.value,
                sql_func.count(ResponseValue.id),
            )
            .filter(
                ResponseValue.field_id.in_(field_ids),
                ~exists().where(
                    and_(
                        Submission.id == ResponseValue.submission_id,
                        Submission.status == "archived",
                    )
                ),
            )
            .group_by(ResponseValue.field_id, ResponseValue.value)
            .all()
        )

        raw_by_field: Dict[int, List[tuple]] = {}
        for field_id, value, count in rows:
            if value is None or str(value).strip() == "":
                continue
            raw_by_field.setdefault(field_id, []).append((str(value), count))

        distributions: List[Dict[str, Any]] = []
        for field in fields:
            raw = raw_by_field.get(field.id, [])
            if field.field_type == "rating":
                distributions.append(cls._rating_distribution(field, raw))
            elif field.field_type == "checkbox":
                distributions.append(cls._checkbox_distribution(field, raw))
            else:
                distributions.append(cls._single_select_distribution(field, raw))
        return distributions

    @classmethod
    def get_submissions_over_time(cls, db: Session, form_id: int) -> List[Dict[str, Any]]:
        """
        Daily submissions-over-time buckets, zero-filled between the first and
        last submission so the frontend can render a contiguous trend line.

        One grouped SQL query (`DATE(submitted_at)` + count) — no per-row work.
        Returns `[]` when the form has no submissions.
        """
        from datetime import timedelta

        rows = (
            db.query(
                sql_func.date(Submission.submitted_at),
                sql_func.count(Submission.id),
            )
            .filter(
                Submission.form_id == form_id,
                Submission.submitted_at.isnot(None),
                # Archived submissions (Day 19) are excluded from the active trend.
                Submission.status != "archived",
            )
            .group_by(sql_func.date(Submission.submitted_at))
            .order_by(sql_func.date(Submission.submitted_at))
            .all()
        )
        if not rows:
            return []

        counts = {str(day)[:10]: count for day, count in rows}
        start = datetime.strptime(str(rows[0][0])[:10], "%Y-%m-%d").date()
        end = datetime.strptime(str(rows[-1][0])[:10], "%Y-%m-%d").date()

        points: List[Dict[str, Any]] = []
        current = start
        while current <= end:
            points.append(
                {"date": current.isoformat(), "count": counts.get(current.isoformat(), 0)}
            )
            current += timedelta(days=1)
        return points

    # ─── Analytics calculations (Part 1) ───────────────────────────

    @staticmethod
    def format_duration(total_seconds: int) -> str:
        """
        Format a number of seconds as a compact human-readable string.

        Examples:
            45    -> "45s"
            138   -> "2m 18s"
            840   -> "14m"       (no seconds when exactly N minutes)
            3661  -> "1h 1m"
            3900  -> "1h 5m"
        """
        total_seconds = max(0, int(total_seconds))
        hours, rem = divmod(total_seconds, 3600)
        minutes, seconds = divmod(rem, 60)
        if hours:
            # "1h", "1h 5m" — omit the zero-minutes suffix
            return f"{hours}h {minutes}m" if minutes else f"{hours}h"
        if minutes:
            return f"{minutes}m {seconds}s" if seconds else f"{minutes}m"
        return f"{seconds}s"

    @classmethod
    def _effective_started(cls, started_sessions: int, total_submissions: int) -> int:
        """
        Derive the number of sessions that actually started.

        Every stored submission implies at least one started session. When
        session tracking was added after some submissions already existed
        (legacy data), the tracked count can be lower than the submission
        count — or even zero. Flooring at the submission count keeps the
        completion rate meaningful for those forms instead of producing 0%
        or >100% values.
        """
        return max(started_sessions, total_submissions)

    @classmethod
    def _completion_rate(
        cls, completed_submissions: int, started_sessions: int, total_submissions: int
    ) -> float:
        """
        completion_rate = completed / started * 100

        Rules:
        - Never exceed 100% (legacy data can have completed > started).
        - Never divide by zero (started == 0 and no submissions -> 0%).
        - Rounded to one decimal place.
        """
        effective_started = cls._effective_started(started_sessions, total_submissions)
        if effective_started <= 0:
            return 0.0
        rate = (completed_submissions / effective_started) * 100.0
        return round(min(100.0, rate), 1)

    @classmethod
    def calculate_average_completion_time(
        cls, db: Session, form_id: int
    ) -> Dict[str, Any]:
        """
        Average completion time across **completed** submissions that
        recorded both a started_at and a submitted_at timestamp.

        - Only `status == "completed"` responses are averaged.
        - Invalid timestamps (missing, or started_at > submitted_at) are ignored.
        - If no valid durations exist, returns "0s" (never fake values).
        """
        submissions = (
            db.query(Submission)
            .filter(
                Submission.form_id == form_id,
                Submission.status == "completed",
                Submission.started_at.isnot(None),
                Submission.submitted_at.isnot(None),
            )
            .all()
        )

        durations: list = []
        for sub in submissions:
            started = _to_naive_utc(sub.started_at)
            submitted = _to_naive_utc(sub.submitted_at)
            if started and submitted:
                delta = (submitted - started).total_seconds()
                if delta >= 0:
                    durations.append(delta)

        if not durations:
            return {
                "average_completion_time_seconds": 0,
                "average_completion_time": "0s",
            }

        avg_seconds = int(round(sum(durations) / len(durations)))
        return {
            "average_completion_time_seconds": avg_seconds,
            "average_completion_time": cls.format_duration(avg_seconds),
        }

    @classmethod
    def get_form_analytics(cls, db: Session, form_id: int) -> Dict[str, Any]:
        """
        Aggregated analytics for a single form (cached).
        """
        cached = cls._get_cached(form_id)
        if cached is not None:
            return cached

        form = cls._get_form(db, form_id)

        # Active analytics exclude archived submissions (Day 19): archived
        # responses remain stored/viewable but are not counted as active.
        total_submissions = (
            db.query(sql_func.count(Submission.id))
            .filter(
                Submission.form_id == form_id,
                Submission.status != "archived",
            )
            .scalar()
            or 0
        )

        completed_submissions = (
            db.query(sql_func.count(Submission.id))
            .filter(
                Submission.form_id == form_id,
                Submission.status == "completed",
            )
            .scalar()
            or 0
        )

        started_sessions = cls.count_started_sessions(db, form_id)

        completion_rate = cls._completion_rate(
            completed_submissions=completed_submissions,
            started_sessions=started_sessions,
            total_submissions=total_submissions,
        )

        time_stats = cls.calculate_average_completion_time(db, form_id)

        last_sub = (
            db.query(Submission)
            .filter(
                Submission.form_id == form_id,
                Submission.status != "archived",
            )
            .order_by(desc(Submission.submitted_at))
            .first()
        )
        last_submission = (
            _to_naive_utc(last_sub.submitted_at).isoformat() if last_sub and last_sub.submitted_at else None
        )

        latest_version = cls._get_latest_version(db, form_id)

        payload = {
            "form_id": form.id,
            "form_name": form.title,
            "total_submissions": total_submissions,
            "started_sessions": started_sessions,
            "completed_submissions": completed_submissions,
            "completion_rate": completion_rate,
            "average_completion_time_seconds": time_stats["average_completion_time_seconds"],
            "average_completion_time": time_stats["average_completion_time"],
            "last_submission": last_submission,
            "last_updated": _now_utc().isoformat(),
            # Future-ready extras (charts / field analytics / export will build on these)
            "form_status": latest_version.status if latest_version else "draft",
            "version_number": latest_version.version_number if latest_version else None,
            # Per-field response distributions (Day 17)
            "field_distributions": cls.get_field_distributions(db, form_id),
            # Daily submissions-over-time trend (Day 18 follow-up)
            "submissions_over_time": cls.get_submissions_over_time(db, form_id),
        }

        cls._set_cached(form_id, payload)
        return payload

    # ─── Cross-form summary (Part 5 – admin dashboard) ─────────────

    @classmethod
    def get_summary(cls, db: Session) -> Dict[str, Any]:
        """
        Aggregate analytics across all forms for the admin Analytics page.

        Returns total forms, total submissions, overall completion rate
        and overall average completion time.
        """
        forms = db.query(Form).order_by(desc(Form.updated_at)).all()

        total_forms = len(forms)
        total_submissions = 0
        total_started_sessions = 0
        total_completed = 0
        all_durations: list = []

        for form in forms:
            analytics = cls.get_form_analytics(db, form.id)
            total_submissions += analytics["total_submissions"]
            total_started_sessions += analytics["started_sessions"]
            total_completed += analytics["completed_submissions"]

            # Gather raw durations for overall average (completed only)
            submissions = (
                db.query(Submission)
                .filter(
                    Submission.form_id == form.id,
                    Submission.status == "completed",
                    Submission.started_at.isnot(None),
                    Submission.submitted_at.isnot(None),
                )
                .all()
            )
            for sub in submissions:
                started = _to_naive_utc(sub.started_at)
                submitted = _to_naive_utc(sub.submitted_at)
                if started and submitted:
                    delta = (submitted - started).total_seconds()
                    if delta >= 0:
                        all_durations.append(delta)

        completion_rate = cls._completion_rate(
            completed_submissions=total_completed,
            started_sessions=total_started_sessions,
            total_submissions=total_submissions,
        )

        avg_seconds = int(round(sum(all_durations) / len(all_durations))) if all_durations else 0

        return {
            "total_forms": total_forms,
            "total_submissions": total_submissions,
            "total_started_sessions": total_started_sessions,
            "completion_rate": completion_rate,
            "average_completion_time_seconds": avg_seconds,
            "average_completion_time": cls.format_duration(avg_seconds),
        }
