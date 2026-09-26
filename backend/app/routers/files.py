import os
import traceback
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.file_storage_service import FileStorageService

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get(
    "/download/{token}",
    summary="Download a file via secure token",
    description="""
    Download an uploaded file using a signed download token.
    Tokens expire after 24 hours (configurable).
    Returns the file with its original filename for download.
    """,
    responses={
        200: {
            "description": "File downloaded successfully",
            "content": {"application/octet-stream": {}},
        },
        404: {"description": "Invalid or expired download token"},
    },
)
async def download_file(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Download a file using its secure download token.
    The token is a random URL-safe string generated during upload.
    Tokens expire after the configured expiry time.
    """
    try:
        # Look up file metadata by token (automatically checks expiry)
        file_meta = FileStorageService.get_file_by_token(token=token, db=db)
        if not file_meta:
            raise HTTPException(
                status_code=404,
                detail="Invalid or expired download link.",
            )

        # Get the absolute filesystem path
        file_path = FileStorageService.get_absolute_path(file_meta)

        # Verify the file still exists on disk
        if not os.path.isfile(file_path):
            raise HTTPException(
                status_code=404,
                detail="File not found on server.",
            )

        # Return the file with original filename for download
        return FileResponse(
            path=file_path,
            media_type=file_meta.content_type,
            filename=file_meta.original_filename,
            headers={
                "Content-Disposition": f'attachment; filename="{file_meta.original_filename}"',
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download file: {str(e)}",
        )
