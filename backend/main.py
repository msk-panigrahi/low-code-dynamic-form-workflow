#!/usr/bin/env python
"""
Backend entry point for the Dynamic Form Workflow Platform
Handles both direct execution and module imports
"""
import sys
import os

# Get the absolute path of this script's directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Add the backend directory to the Python path
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

# Import the FastAPI app
try:
    from app.main import app
except ImportError as e:
    print(f"Error importing app: {e}")
    sys.exit(1)

if __name__ == "__main__":
    import uvicorn 
    print("Starting Dynamic Form Workflow Backend...")
    print("API Documentation: http://localhost:8000/docs")
    print("Press Ctrl+C to stop")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
