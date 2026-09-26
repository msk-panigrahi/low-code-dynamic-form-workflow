#!/usr/bin/env python
"""Quick test script to verify backend components without database"""

import sys
import os

# Test imports
try:
    from app.config import settings
    print("✓ Config module loaded")
except Exception as e:
    print(f"✗ Config error: {e}")
    sys.exit(1)

try:
    from app.models import Form, FormVersion, Field, FieldOption
    print("✓ Models module loaded")
except Exception as e:
    print(f"✗ Models error: {e}")
    sys.exit(1)

try:
    from app.schemas import FormSchema, FieldSchema
    print("✓ Schemas module loaded")
except Exception as e:
    print(f"✗ Schemas error: {e}")
    sys.exit(1)

try:
    from app.services import FieldTypeService
    print("✓ Services module loaded")
except Exception as e:
    print(f"✗ Services error: {e}")
    sys.exit(1)

# Test FieldTypeService
try:
    ft = FieldTypeService.get_field_types()
    field_count = len(ft.get("fieldTypes", []))
    print(f"✓ Field types service working: {field_count} types")
    
    print("\nAvailable field types:")
    for field in ft.get("fieldTypes", []):
        config_count = len(field.get("configurableProperties", []))
        print(f"  - {field['name']} ({field['id']}) - {config_count} configurable properties")
except Exception as e:
    print(f"✗ FieldTypeService error: {e}")
    sys.exit(1)

try:
    from app.routers import health_router, field_types_router
    print("\n✓ All routers loaded successfully")
except Exception as e:
    print(f"✗ Routers error: {e}")
    sys.exit(1)

print("\n✅ Backend setup verification PASSED!")
print("\nNote: Database connection not tested (PostgreSQL might not be running)")
print("To start the server, run: python main.py")
