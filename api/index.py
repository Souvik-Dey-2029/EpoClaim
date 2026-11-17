"""Vercel Serverless Function entry point for EpoClaim FastAPI backend.

This ASGI entrypoint is discovered by Vercel's Python runtime and routes
all `/api/*` and `/health` requests to the unified EpoClaim FastAPI application.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Resolve project root and backend directory
_current_file = Path(__file__).resolve()
_project_root = _current_file.parent.parent
_backend_dir = _project_root / "backend"

# Ensure backend and project root directories are in sys.path
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))
if str(_project_root) not in sys.path:
    sys.path.insert(1, str(_project_root))

# Signal to backend services that we are running in a serverless environment
if "VERCEL" not in os.environ and "AWS_LAMBDA_FUNCTION_NAME" in os.environ:
    os.environ["VERCEL"] = "1"

# Import the existing FastAPI application
from app.main import app  # noqa: E402

# Export for ASGI serverless handlers
__all__ = ["app"]
