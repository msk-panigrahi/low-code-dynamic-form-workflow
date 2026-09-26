from typing import Dict, Any, List
from .field_type_service import FieldTypeService


class FieldValidationService:
    """Validates field configuration against the field type library"""

    @staticmethod
    def validate_config(field_type: str, config: Dict[str, Any]) -> List[str]:
        """
        Validate config for a given field type.
        Returns a list of error messages (empty list means valid).
        """
        field_types_data = FieldTypeService.get_field_types()
        ft = next(
            (ft for ft in field_types_data["fieldTypes"] if ft["id"] == field_type),
            None
        )
        if not ft:
            return [f"Unknown field type: '{field_type}'"]

        errors: List[str] = []
        valid_properties = {
            p["name"]: p for p in ft["configurableProperties"]
        }

        for key, value in config.items():
            if key not in valid_properties:
                errors.append(
                    f"Unknown config property '{key}' for field type '{field_type}'"
                )
                continue

            prop = valid_properties[key]
            prop_type = prop["type"]

            # Validate value type
            if prop_type == "number" and value is not None:
                if not isinstance(value, (int, float)):
                    errors.append(f"'{key}' must be a number")
                elif prop.get("itemType") == "integer" and isinstance(value, float):
                    # Check if it's effectively a whole number
                    pass

            elif prop_type == "string" and value is not None:
                if not isinstance(value, str):
                    errors.append(f"'{key}' must be a string")

            elif prop_type == "boolean":
                if not isinstance(value, bool):
                    errors.append(f"'{key}' must be a boolean")

            elif prop_type == "date" and value is not None:
                if not isinstance(value, str):
                    errors.append(f"'{key}' must be a date string")

            elif prop_type == "array":
                if not isinstance(value, list):
                    errors.append(f"'{key}' must be an array")
                elif prop.get("itemType") == "option":
                    for option in value:
                        if not isinstance(option, dict) or "label" not in option or "value" not in option:
                            errors.append(f"'{key}' items must have 'label' and 'value' fields")
                elif prop.get("itemType") == "string":
                    for item in value:
                        if not isinstance(item, str):
                            errors.append(f"'{key}' items must be strings")

        return errors
