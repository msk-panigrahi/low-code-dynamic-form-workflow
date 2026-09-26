"""
Minimal retention-job scheduler (Day 19).

Runs the archival job periodically (default: every 24h) using an `asyncio`
background task started from the FastAPI startup event.

Why not a heavier scheduler? The project has no background-job infrastructure,
and the job is a single idempotent database operation — a task loop is the
smallest reliable mechanism.

Multiple-instance protection: a lock file in the system temp dir is acquired
before scheduling. If another process (e.g. a second uvicorn worker or the
dev-reloader child) already holds it, this process skips scheduling entirely,
so the job never runs twice concurrently.
"""
import asyncio
import logging
import os
import sys
import tempfile
import time

from .config import settings

logger = logging.getLogger("dynamic_form_workflow")

_LOCK_PATH = os.path.join(
    tempfile.gettempdir(), "formflow_retention_scheduler.lock"
)
_lock_fd: int | None = None
_task: asyncio.Task | None = None

# For test environments: allow disabling the scheduler via env var so the
# test suite never races the background loop against its own database.
_ENABLED = os.getenv("FORMFLOW_RETENTION_SCHEDULER", "1").lower() not in ("0", "false")


def _acquire_lock() -> bool:
    """Create the scheduler lock file exclusively. Returns True if acquired."""
    global _lock_fd
    try:
        fd = os.open(_LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        _lock_fd = fd
        return True
    except FileExistsError:
        # Stale lock? If the file is older than the job interval, assume the
        # owner crashed and take it over.
        try:
            age = time.time() - os.path.getmtime(_LOCK_PATH)
            if age > settings.retention_job_interval_hours * 3600:
                os.remove(_LOCK_PATH)
                return _acquire_lock()
        except OSError:
            pass
        logger.info("Retention scheduler: lock held by another process — skipping.")
        return False


def _release_lock() -> None:
    global _lock_fd
    if _lock_fd is not None:
        try:
            os.close(_lock_fd)
        except OSError:
            pass
        _lock_fd = None
    try:
        os.remove(_LOCK_PATH)
    except OSError:
        pass


def _run_job_once() -> None:
    """Run the retention archive job in its own DB session (synchronously)."""
    from .database import SessionLocal
    from .services.retention_service import RetentionService

    db = SessionLocal()
    try:
        result = RetentionService.run_archive_job(db)
        if result["archived_total"]:
            logger.info(
                "Retention job: archived %s submissions across %s forms (run %s).",
                result["archived_total"],
                len(result["affected_forms"]),
                result["run_id"],
            )
        else:
            logger.info("Retention job: nothing to archive (run %s).", result["run_id"])
    except Exception:
        logger.exception("Retention job failed.")
    finally:
        db.close()


async def _job_loop() -> None:
    """Run the job, then sleep for the configured interval, forever."""
    interval_seconds = settings.retention_job_interval_hours * 3600
    # First run shortly after startup so a freshly deployed policy archives
    # without waiting a full day.
    await asyncio.sleep(10)
    while True:
        try:
            await asyncio.to_thread(_run_job_once)
        except Exception:
            logger.exception("Unexpected error in retention job loop.")
        await asyncio.sleep(interval_seconds)


def start_retention_scheduler() -> None:
    """Start the background scheduler. No-op when disabled or already running."""
    global _task
    if not _ENABLED:
        logger.info("Retention scheduler disabled via env var.")
        return
    if _task is not None and not _task.done():
        return
    if not _acquire_lock():
        return
    _task = asyncio.get_running_loop().create_task(_job_loop())
    logger.info("Retention scheduler started (interval: %sh).", settings.retention_job_interval_hours)


def stop_retention_scheduler() -> None:
    """Cancel the background scheduler and release the lock."""
    global _task
    if _task is not None:
        _task.cancel()
        _task = None
    _release_lock()
    logger.info("Retention scheduler stopped.")
