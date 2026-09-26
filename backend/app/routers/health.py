from fastapi import APIRouter

router = APIRouter(prefix="", tags=["health"])


@router.get("/")
async def root():
    """Root endpoint - verify project is running"""
    return {"message": "Project Running Successfully"}


@router.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}
