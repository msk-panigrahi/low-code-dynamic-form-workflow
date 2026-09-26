from typing import Dict, Any, List


class FieldTypeService:
    """Service for managing field types and their configurations"""
    
    @staticmethod
    def get_field_types() -> Dict[str, Any]:
        """
        Get all available field types with their configurations
        Returns JSON metadata describing every field type and all configurable properties
        """
        return {
            "fieldTypes": [
                {
                    "id": "text",
                    "name": "Text",
                    "description": "Single line text input",
                    "icon": "text",
                    "category": "input",
                    "configurableProperties": [
                        {
                            "name": "minimumLength",
                            "type": "number",
                            "label": "Minimum Length",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "maximumLength",
                            "type": "number",
                            "label": "Maximum Length",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "placeholder",
                            "type": "string",
                            "label": "Placeholder Text",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                },
                {
                    "id": "number",
                    "name": "Number",
                    "description": "Numeric input",
                    "icon": "numbers",
                    "category": "input",
                    "configurableProperties": [
                        {
                            "name": "minimum",
                            "type": "number",
                            "label": "Minimum Value",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "maximum",
                            "type": "number",
                            "label": "Maximum Value",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "allowDecimal",
                            "type": "boolean",
                            "label": "Allow Decimal",
                            "required": False,
                            "default": False
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                },
                {
                    "id": "email",
                    "name": "Email",
                    "description": "Email input with validation",
                    "icon": "mail",
                    "category": "input",
                    "configurableProperties": [
                        {
                            "name": "placeholder",
                            "type": "string",
                            "label": "Placeholder Text",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                },
                {
                    "id": "dropdown",
                    "name": "Dropdown",
                    "description": "Dropdown select menu",
                    "icon": "menu",
                    "category": "selection",
                    "configurableProperties": [
                        {
                            "name": "options",
                            "type": "array",
                            "label": "Options",
                            "itemType": "option",
                            "required": True,
                            "default": []
                        },
                        {
                            "name": "defaultOption",
                            "type": "string",
                            "label": "Default Option",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                },
                {
                    "id": "checkbox",
                    "name": "Multi Checkbox",
                    "description": "Multiple checkboxes",
                    "icon": "checkmark",
                    "category": "selection",
                    "configurableProperties": [
                        {
                            "name": "options",
                            "type": "array",
                            "label": "Options",
                            "itemType": "option",
                            "required": True,
                            "default": []
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                },
                {
                    "id": "date",
                    "name": "Date",
                    "description": "Date picker",
                    "icon": "calendar",
                    "category": "input",
                    "configurableProperties": [
                        {
                            "name": "minimumDate",
                            "type": "date",
                            "label": "Minimum Date",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "maximumDate",
                            "type": "date",
                            "label": "Maximum Date",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                },
                {
                    "id": "file",
                    "name": "File Upload",
                    "description": "File upload input",
                    "icon": "upload",
                    "category": "input",
                    "configurableProperties": [
                        {
                            "name": "allowedTypes",
                            "type": "array",
                            "label": "Allowed File Types",
                            "itemType": "string",
                            "required": False,
                            "default": []
                        },
                        {
                            "name": "maximumSize",
                            "type": "number",
                            "label": "Maximum File Size (bytes)",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                },
                {
                    "id": "rating",
                    "name": "Rating",
                    "description": "Star rating input",
                    "icon": "star",
                    "category": "input",
                    "configurableProperties": [
                        {
                            "name": "minimumStars",
                            "type": "number",
                            "label": "Minimum Stars",
                            "required": False,
                            "default": 1
                        },
                        {
                            "name": "maximumStars",
                            "type": "number",
                            "label": "Maximum Stars",
                            "required": False,
                            "default": 5
                        },
                        {
                            "name": "defaultRating",
                            "type": "number",
                            "label": "Default Rating",
                            "required": False,
                            "default": None
                        }
                    ]
                },
                {
                    "id": "textarea",
                    "name": "Textarea",
                    "description": "Multi-line text input",
                    "icon": "textarea",
                    "category": "input",
                    "configurableProperties": [
                        {
                            "name": "minimumLength",
                            "type": "number",
                            "label": "Minimum Length",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "maximumLength",
                            "type": "number",
                            "label": "Maximum Length",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "placeholder",
                            "type": "string",
                            "label": "Placeholder Text",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                },
                {
                    "id": "radio",
                    "name": "Radio",
                    "description": "Radio button group for single selection",
                    "icon": "radio",
                    "category": "selection",
                    "configurableProperties": [
                        {
                            "name": "options",
                            "type": "array",
                            "label": "Options",
                            "itemType": "option",
                            "required": True,
                            "default": []
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                },
                {
                    "id": "password",
                    "name": "Password",
                    "description": "Masked password input",
                    "icon": "password",
                    "category": "input",
                    "configurableProperties": [
                        {
                            "name": "minimumLength",
                            "type": "number",
                            "label": "Minimum Length",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "maximumLength",
                            "type": "number",
                            "label": "Maximum Length",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "placeholder",
                            "type": "string",
                            "label": "Placeholder Text",
                            "required": False,
                            "default": None
                        },
                        {
                            "name": "required",
                            "type": "boolean",
                            "label": "Required",
                            "required": False,
                            "default": False
                        }
                    ]
                }
            ]
        }
