"""
Entrypoint for `uvicorn main:app` (local and Docker).
Application lives in `app.main` for a package-style layout.
"""
from app.main import app

__all__ = ["app"]
