import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import settings
from .errors import APIError
from .routers import health_router, field_types_router, forms_router, rules_router, rule_evaluator_router, files_router, auth_router, analytics_router, export_router, responses_router, retention_router, audit_router
from .database import Base, engine
from .scheduler import start_retention_scheduler, stop_retention_scheduler

logger = logging.getLogger("dynamic_form_workflow")

# Create FastAPI app
app = FastAPI(
    title="Dynamic Form Workflow API",
    description="Low-Code Dynamic Form Workflow & Data Collection Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Exception handlers ────────────────────────────────────


@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    """Structured error responses for authentication endpoints."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "error_code": exc.error_code,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Return friendly 400s for auth validation failures, keep 422 elsewhere."""
    if request.url.path.startswith("/api/auth"):
        errors = exc.errors()
        message = "Validation failed."
        if errors:
            raw = str(errors[0].get("msg", ""))
            # Pydantic v2 prefixes custom value errors with "Value error, "
            if raw.startswith("Value error, "):
                raw = raw[len("Value error, "):]
            # Show the specific message when it is meaningful (e.g. "Invalid email format")
            if raw and "required" not in raw.lower():
                message = raw
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": message,
                "error_code": "VALIDATION_ERROR",
            },
        )
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Never leak stack traces or database errors to the client."""
    logger.error(
        "Unhandled server error on %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Something went wrong. Please try again later.",
            "error_code": "INTERNAL_ERROR",
        },
    )


# Include routers
app.include_router(health_router)
app.include_router(field_types_router)
app.include_router(forms_router)
app.include_router(rules_router)
app.include_router(rule_evaluator_router)
app.include_router(files_router)
app.include_router(auth_router)
app.include_router(analytics_router)
app.include_router(export_router)
app.include_router(responses_router)
app.include_router(retention_router)
app.include_router(audit_router)


@app.on_event("startup")
async def startup_event():
    """Startup event handler"""
    print("Application started")
    # Create tables on startup
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables initialized")
    except Exception as e:
        print(f"Database initialization skipped: {str(e)[:100]}")

    # Start the retention archival scheduler (Day 19) — guarded by a lock
    # file so multiple workers / the dev-reloader never double-schedule.
    try:
        start_retention_scheduler()
    except Exception as e:
        print(f"Retention scheduler start skipped: {str(e)[:100]}")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler"""
    print("[SHUTDOWN] Application shutdown")
    try:
        stop_retention_scheduler()
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=settings.debug)
