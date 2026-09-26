import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime


class ValidationService:
    """Service for validating form field values against field configuration."""

    # ─── Email Regex ──────────────────────────────────────────────
    # RFC 5322 simplified – covers the vast majority of real-world email addresses
    _EMAIL_REGEX = re.compile(
        r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9]"
        r"(?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9]"
        r"(?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
    )

    # ─── Date Format Regex ────────────────────────────────────────
    _DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    # ─── Public API ────────────────────────────────────────────────

    @staticmethod
    def validate_form_submission(
        fields: List[Dict[str, Any]],
        form_values: Dict[str, Any],
        field_states: Dict[int, Dict[str, bool]],
    ) -> Dict[str, List[str]]:
        """
        Validate all visible fields in a form submission.

        Performs two passes:
        1. Reject hidden fields that contain data (security check)
        2. Validate all visible fields against their configuration

        Args:
            fields: List of field dicts with keys: id, type, config, is_required
            form_values: Dict mapping field_id -> submitted value
            field_states: Dict mapping field_id -> {visible, required, disabled}

        Returns:
            Dict mapping field_id (as string) -> list of error messages
        """
        errors: Dict[str, List[str]] = {}

        # PASS 1: Reject hidden fields that contain data
        for field in fields:
            field_id = field["id"]
            state = field_states.get(field_id, {"visible": True, "required": False, "disabled": False})

            if state.get("visible") is False:
                # Hidden field should not have any value
                value = form_values.get(field_id)
                if value is None:
                    value = form_values.get(str(field_id))
                if not _is_empty(value):
                    errors[str(field_id)] = ["Hidden fields cannot contain values."]

        # PASS 2: Validate visible fields
        for field in fields:
            field_id = field["id"]
            state = field_states.get(field_id, {"visible": True, "required": False, "disabled": False})

            # Skip hidden fields (already rejected in pass 1)
            if state.get("visible") is False:
                continue

            value = form_values.get(field_id)
            if value is None:
                value = form_values.get(str(field_id))

            # Determine effective required: field's static is_required OR rule-required
            is_required = state.get("required", False) or field.get("is_required", False)

            field_type = field.get("type", "")
            config = field.get("config", {})

            field_errors = ValidationService._validate_field(
                field_type=field_type,
                value=value,
                config=config,
                is_required=is_required,
                label=field.get("label", ""),
            )

            if field_errors:
                if str(field_id) not in errors:
                    errors[str(field_id)] = field_errors

        return errors

    @staticmethod
    def _validate_field(
        field_type: str,
        value: Any,
        config: Dict[str, Any],
        is_required: bool,
        label: str,
    ) -> List[str]:
        """Route validation to the appropriate field-type validator."""
        validator_map = {
            "text": ValidationService._validate_text,
            "number": ValidationService._validate_number,
            "email": ValidationService._validate_email,
            "dropdown": ValidationService._validate_dropdown,
            "checkbox": ValidationService._validate_checkbox,
            "date": ValidationService._validate_date,
            "file": ValidationService._validate_file,
            "rating": ValidationService._validate_rating,
            "textarea": ValidationService._validate_text,
            "radio": ValidationService._validate_dropdown,
        }

        validator = validator_map.get(field_type)
        if not validator:
            return [f"Unknown field type '{field_type}'"]

        return validator(value=value, config=config, is_required=is_required, label=label)

    # ─── Individual Validators ─────────────────────────────────────

    @staticmethod
    def _validate_text(
        value: Any,
        config: Dict[str, Any],
        is_required: bool,
        label: str,
    ) -> List[str]:
        errors: List[str] = []
        str_value = _get_str(value)

        # Required check
        if is_required and _is_empty(str_value):
            errors.append("This field is required")
            return errors  # No further checks on empty required

        if _is_empty(str_value):
            return errors  # Not required and empty – valid

        # Reject whitespace-only
        if str_value.strip() == "":
            errors.append("This field is required")
            return errors

        # Minimum Length
        min_len = config.get("minimumLength")
        if min_len is not None and len(str_value) < int(min_len):
            errors.append(f"Minimum {int(min_len)} characters required")

        # Maximum Length
        max_len = config.get("maximumLength")
        if max_len is not None and len(str_value) > int(max_len):
            errors.append(f"Maximum length exceeded ({int(max_len)} characters)")

        return errors

    @staticmethod
    def _validate_number(
        value: Any,
        config: Dict[str, Any],
        is_required: bool,
        label: str,
    ) -> List[str]:
        errors: List[str] = []

        # Required check
        if is_required and _is_empty(value):
            errors.append("This field is required")
            return errors

        if _is_empty(value):
            return errors

        # Try to parse as number
        try:
            str_val = str(value).strip()
            if str_val == "":
                if is_required:
                    errors.append("This field is required")
                return errors

            # Check for valid number format
            allow_decimal = config.get("allowDecimal", False)

            if allow_decimal:
                # Allow decimal numbers
                num = float(str_val)
                if "." in str_val:
                    pass  # decimal is allowed
            else:
                # Must be integer
                if "." in str_val:
                    errors.append("Decimal values are not allowed")
                    return errors
                num = int(float(str_val))

            # Minimum Value
            min_val = config.get("minimum")
            if min_val is not None and num < int(min_val):
                errors.append(f"Value must be at least {int(min_val)}")

            # Maximum Value
            max_val = config.get("maximum")
            if max_val is not None and num > int(max_val):
                errors.append(f"Value cannot exceed {int(max_val)}")

        except (ValueError, TypeError):
            errors.append("Please enter a valid number")

        return errors

    @staticmethod
    def _validate_email(
        value: Any,
        config: Dict[str, Any],
        is_required: bool,
        label: str,
    ) -> List[str]:
        errors: List[str] = []
        str_value = _get_str(value)

        # Required check
        if is_required and _is_empty(str_value):
            errors.append("This field is required")
            return errors

        if _is_empty(str_value):
            return errors

        # Validate email format
        if not ValidationService._EMAIL_REGEX.match(str_value.strip()):
            errors.append("Please enter a valid email address")

        return errors

    @staticmethod
    def _validate_dropdown(
        value: Any,
        config: Dict[str, Any],
        is_required: bool,
        label: str,
    ) -> List[str]:
        errors: List[str] = []
        str_value = _get_str(value)

        # Required check
        if is_required and _is_empty(str_value):
            errors.append("This field is required")
            return errors

        if _is_empty(str_value):
            return errors

        # Value must exist in configured options
        options = config.get("options", [])
        valid_values = {opt.get("value") for opt in options}

        if str_value not in valid_values:
            errors.append("Invalid option selected")

        return errors

    @staticmethod
    def _validate_checkbox(
        value: Any,
        config: Dict[str, Any],
        is_required: bool,
        label: str,
    ) -> List[str]:
        errors: List[str] = []

        # Checkbox can be a single boolean or an array of selected values
        if isinstance(value, bool):
            # Single checkbox
            if is_required and not value:
                errors.append("This field is required")
            return errors

        if not isinstance(value, list):
            value = [] if _is_empty(value) else [str(value)]

        # Required check – at least one checkbox must be checked
        if is_required and len(value) == 0:
            errors.append("This field is required")
            return errors

        if len(value) == 0:
            return errors

        # Minimum selections
        min_sel = config.get("minimumSelections")
        if min_sel is not None and len(value) < int(min_sel):
            errors.append(f"Please select at least {int(min_sel)} option{'s' if int(min_sel) > 1 else ''}")

        # Maximum selections
        max_sel = config.get("maximumSelections")
        if max_sel is not None and len(value) > int(max_sel):
            errors.append(f"Maximum {int(max_sel)} option{'s' if int(max_sel) > 1 else ''} allowed")

        # Selected options must exist in configured options
        options = config.get("options", [])
        if options:
            valid_values = {opt.get("value") for opt in options}
            invalid = [v for v in value if v not in valid_values]
            if invalid:
                errors.append("Please select a valid option")

        return errors

    @staticmethod
    def _validate_date(
        value: Any,
        config: Dict[str, Any],
        is_required: bool,
        label: str,
    ) -> List[str]:
        errors: List[str] = []
        str_value = _get_str(value)

        # Required check
        if is_required and _is_empty(str_value):
            errors.append("This field is required")
            return errors

        if _is_empty(str_value):
            return errors

        # Validate date format (YYYY-MM-DD)
        str_value = str_value.strip()
        if not ValidationService._DATE_REGEX.match(str_value):
            errors.append("Invalid date (use YYYY-MM-DD format)")
            return errors

        # Validate it's a real date
        try:
            parts = str_value.split("-")
            parsed_date = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
        except (ValueError, IndexError):
            errors.append("Invalid date")
            return errors

        # Minimum Date
        min_date_str = config.get("minimumDate")
        if min_date_str:
            try:
                min_date = datetime.strptime(min_date_str[:10], "%Y-%m-%d")
                if parsed_date < min_date:
                    min_formatted = min_date.strftime("%m/%d/%Y")
                    errors.append(f"Date must be after {min_formatted}")
            except (ValueError, TypeError):
                pass

        # Maximum Date
        max_date_str = config.get("maximumDate")
        if max_date_str:
            try:
                max_date = datetime.strptime(max_date_str[:10], "%Y-%m-%d")
                if parsed_date > max_date:
                    max_formatted = max_date.strftime("%m/%d/%Y")
                    errors.append(f"Date cannot be after {max_formatted}")
            except (ValueError, TypeError):
                pass

        return errors

    @staticmethod
    def _validate_file(
        value: Any,
        config: Dict[str, Any],
        is_required: bool,
        label: str,
    ) -> List[str]:
        errors: List[str] = []

        # Required check
        if is_required and _is_empty(value):
            errors.append("This field is required")
            return errors

        if _is_empty(value):
            return errors

        str_value = _get_str(value)

        # Parse the filename and optional size from format "filename.ext||size"
        file_name = str_value
        file_size = None
        if "||" in str_value:
            parts = str_value.split("||", 1)
            file_name = parts[0]
            try:
                file_size = int(parts[1]) if len(parts) == 2 else None
            except (ValueError, TypeError):
                file_size = None

        # Allowed extensions / types (check against filename only, not the ||size suffix)
        allowed_types = config.get("allowedTypes", [])
        if allowed_types and file_name:
            ext = (file_name.split(".")[-1] if "." in file_name else file_name).lower()
            # Strip leading dots from allowed types for consistent comparison
            allowed_lower = [t.lower().lstrip('.') for t in allowed_types]
            if ext not in allowed_lower:
                errors.append("Unsupported file type")

        # Maximum size check (requires size information to be passed in value)
        max_size = config.get("maximumSize")
        if max_size is not None and file_size is not None:
            if file_size > int(max_size):
                errors.append("Maximum file size exceeded")

        return errors

    @staticmethod
    def _validate_rating(
        value: Any,
        config: Dict[str, Any],
        is_required: bool,
        label: str,
    ) -> List[str]:
        errors: List[str] = []

        # Required check
        if is_required and _is_empty(value):
            errors.append("This field is required")
            return errors

        if _is_empty(value):
            return errors

        # Must be a valid number
        try:
            rating = int(float(str(value).strip()))
        except (ValueError, TypeError):
            errors.append("Please provide a valid rating")
            return errors

        # Minimum stars
        min_stars = config.get("minimumStars", 1)
        if rating < int(min_stars):
            errors.append(f"Minimum rating is {int(min_stars)} star{'s' if int(min_stars) > 1 else ''}")

        # Maximum stars
        max_stars = config.get("maximumStars", 5)
        if rating > int(max_stars):
            errors.append(f"Maximum rating is {int(max_stars)} star{'s' if int(max_stars) > 1 else ''}")

        return errors


# ─── Helper Functions ─────────────────────────────────────────


def _get_str(value: Any) -> str:
    """Convert value to string safely."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _is_empty(value: Any) -> bool:
    """Check if a value is empty."""
    if value is None:
        return True
    if isinstance(value, bool):
        return False  # False is a valid value (unchecked checkbox)
    if isinstance(value, (int, float)):
        return False  # 0 is a valid number
    if isinstance(value, list):
        return len(value) == 0
    if isinstance(value, str):
        return value.strip() == ""
    return str(value).strip() == ""
