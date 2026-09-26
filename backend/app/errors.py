"""Custom API errors for consistent, structured JSON error responses.

Every error raised via :class:`APIError` is serialized to:

    {
        "success": false,
        "message": "<user friendly message>",
        "error_code": "<MACHINE_READABLE_CODE>"
    }
"""


class APIError(Exception):
    """An error that should be returned to the client as structured JSON."""

    def __init__(self, status_code: int, message: str, error_code: str = "ERROR"):
        self.status_code = status_code
        self.message = message
        self.error_code = error_code
        super().__init__(message)
