import os
import uuid
import secrets
import shutil
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from fastapi import UploadFile
from sqlalchemy.orm import Session
from ..models import FileMetadata
from ..config import settings

# ─── Default allowed extensions ──────────────────────────────────
DEFAULT_ALLOWED_EXTENSIONS = [
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".png", ".jpg", ".jpeg", ".gif", ".txt", ".csv", ".zip",
]

# ─── MIME type to extension mapping (used for validation) ────────
MIME_TO_EXT = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/zip": ".zip",
    "application/x-zip-compressed": ".zip",
}

# ─── Allowed MIME types ─────────────────────────────────────────
DEFAULT_ALLOWED_MIME_TYPES = set(MIME_TO_EXT.keys())


class FileStorageService:
    """Service for storing, validating, and retrieving uploaded files."""

    @staticmethod
    def get_upload_dir() -> str:
        """Get the upload directory path, creating it if necessary."""
        upload_dir = os.path.abspath(settings.upload_dir)
        os.makedirs(upload_dir, exist_ok=True)
        return upload_dir

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize a filename to prevent path traversal and remove dangerous chars.
        """
        # Remove any path components
        filename = os.path.basename(filename)
        # Remove null bytes
        filename = filename.replace("\x00", "")
        # Replace potentially dangerous characters
        safe = "".join(c if c.isalnum() or c in "._- " else "_" for c in filename)
        # Limit length
        if len(safe) > 200:
            name, ext = os.path.splitext(safe)
            safe = name[:196] + ext
        return safe or "untitled"

    @staticmethod
    def generate_stored_filename(original_filename: str) -> str:
        """
        Generate a unique stored filename: UUID_originalfilename.ext
        Never overwrites existing files.
        """
        safe_name = FileStorageService.sanitize_filename(original_filename)
        name, ext = os.path.splitext(safe_name)
        unique_id = str(uuid.uuid4())
        # Truncate the original name to prevent overly long filenames
        short_name = name[:80]
        return f"{unique_id}_{short_name}{ext}"

    @staticmethod
    def validate_upload_file(
        upload_file: UploadFile,
        config: Dict[str, Any],
    ) -> List[str]:
        """
        Server-side validation of an uploaded file.
        Returns a list of error messages (empty = valid).
        """
        errors: List[str] = []

        # ── Check file exists ────────────────────────────────────
        if not upload_file.filename:
            errors.append("No file selected")
            return errors

        # ── Extract extension ────────────────────────────────────
        filename = upload_file.filename
        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        # ── Allowed extensions from config or defaults ────────────
        allowed_exts = config.get("allowedTypes", [])
        if allowed_exts:
            # Normalize: strip leading dots from config values
            allowed_normalized = [e.lower().lstrip(".") for e in allowed_exts]
            ext_clean = ext.lstrip(".")
            if ext_clean not in allowed_normalized:
                errors.append("Unsupported file type")
        else:
            # Use default list
            if ext not in DEFAULT_ALLOWED_EXTENSIONS:
                errors.append("Unsupported file type")

        # ── MIME type validation ─────────────────────────────────
        if upload_file.content_type and ext:
            # Map the file's extension to its expected MIME type
            ext_clean = ext.lstrip(".")
            # If we configured allowed types, only check against those
            if allowed_exts:
                # Check if extension matches the expected MIME for that extension
                # Reverse lookup: get extensions for this MIME type
                mime_ext = MIME_TO_EXT.get(upload_file.content_type, "")
                if mime_ext and mime_ext.lstrip(".") != ext_clean:
                    # MIME/extension mismatch - file might be mislabeled
                    errors.append("Unsupported file type")

        # ── File size validation ─────────────────────────────────
        max_size = config.get("maximumSize")
        if max_size is not None:
            max_size = int(max_size)
        else:
            max_size = settings.max_file_size

        # Seek to end to check size, then seek back
        upload_file.file.seek(0, 2)  # Seek to end
        file_size = upload_file.file.tell()
        upload_file.file.seek(0)  # Seek back to beginning

        if file_size > max_size:
            max_size_mb = max_size / (1024 * 1024)
            errors.append(f"Maximum file size is {max_size_mb:.0f}MB")

        return errors

    @staticmethod
    def save_upload_file(
        upload_file: UploadFile,
        field_id: int,
        submission_id: int,
        db: Session,
    ) -> FileMetadata:
        """
        Save an uploaded file to disk and create a FileMetadata record.

        Args:
            upload_file: The uploaded file from FastAPI
            field_id: The form field ID this file belongs to
            submission_id: The submission ID this file belongs to
            db: Database session

        Returns:
            FileMetadata record
        """
        upload_dir = FileStorageService.get_upload_dir()
        original_filename = upload_file.filename or "untitled"
        stored_filename = FileStorageService.generate_stored_filename(original_filename)
        content_type = upload_file.content_type or "application/octet-stream"
        relative_path = stored_filename  # Flat structure in upload_dir
        absolute_path = os.path.join(upload_dir, stored_filename)

        # Get file size
        upload_file.file.seek(0, 2)
        file_size = upload_file.file.tell()
        upload_file.file.seek(0)

        # Save file to disk
        with open(absolute_path, "wb") as f:
            shutil.copyfileobj(upload_file.file, f)

        # Generate download token
        download_token = secrets.token_urlsafe(32)
        token_expires_at = datetime.utcnow() + timedelta(
            hours=settings.download_token_expiry_hours
        )

        # Create metadata record
        file_meta = FileMetadata(
            submission_id=submission_id,
            field_id=field_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            content_type=content_type,
            size=file_size,
            relative_path=relative_path,
            download_token=download_token,
            token_expires_at=token_expires_at,
            upload_timestamp=datetime.utcnow(),
        )
        db.add(file_meta)
        db.flush()

        return file_meta

    @staticmethod
    def get_file_by_id(file_id: int, db: Session) -> Optional[FileMetadata]:
        """Get file metadata by ID."""
        return db.query(FileMetadata).filter(FileMetadata.id == file_id).first()

    @staticmethod
    def get_file_by_token(token: str, db: Session) -> Optional[FileMetadata]:
        """Get file metadata by download token."""
        return (
            db.query(FileMetadata)
            .filter(
                FileMetadata.download_token == token,
                FileMetadata.token_expires_at >= datetime.utcnow(),
            )
            .first()
        )

    @staticmethod
    def get_absolute_path(file_meta: FileMetadata) -> str:
        """Get the absolute filesystem path for a file metadata record."""
        return os.path.join(FileStorageService.get_upload_dir(), file_meta.relative_path)

    @staticmethod
    def delete_physical_file(absolute_path: str) -> bool:
        """
        Best-effort removal of a file's physical bytes from disk.

        Called **after** the owning DB transaction commits so a failed commit
        never leaves DB rows pointing at files that are already gone. A missing
        or unreadable file is not an error — orphans on disk are harmless.

        Returns True if a physical file was removed.
        """
        try:
            if os.path.exists(absolute_path):
                os.remove(absolute_path)
                return True
        except OSError:
            pass
        return False

    @staticmethod
    def get_file_info_response(file_meta: FileMetadata, base_url: str = "") -> Dict[str, Any]:
        """Build a file info dict for API responses.

        Args:
            file_meta: FileMetadata record
            base_url: Optional base URL (e.g. http://localhost:8000) to prepend to download path.
                      If empty, returns a relative path (suitable for same-origin requests).
        """
        download_path = f"/api/files/download/{file_meta.download_token}"
        if base_url:
            download_url = f"{base_url.rstrip('/')}{download_path}"
        else:
            download_url = download_path
        return {
            "field_id": file_meta.field_id,
            "original_filename": file_meta.original_filename,
            "stored_filename": file_meta.stored_filename,
            "content_type": file_meta.content_type,
            "size": file_meta.size,
            "download_url": download_url,
        }

    @staticmethod
    def get_allowed_extensions_display(config: Dict[str, Any]) -> str:
        """Get a human-readable string of allowed extensions."""
        allowed = config.get("allowedTypes", [])
        if allowed:
            return ", ".join(allowed)
        return ", ".join(DEFAULT_ALLOWED_EXTENSIONS)
