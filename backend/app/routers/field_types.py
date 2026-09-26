from fastapi import APIRouter
from ..services import FieldTypeService

router = APIRouter(prefix="/api", tags=["field-types"])


@router.get("/field-types")
async def get_field_types():
    """
    Get all available field types with their configurations
    Returns JSON metadata describing every field type and all configurable properties
    """
    return FieldTypeService.get_field_types()
