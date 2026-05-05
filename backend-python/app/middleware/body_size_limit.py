"""Reject oversized JSON uploads early using Content-Length."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config.settings import settings


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        limit = settings.max_request_body_bytes
        cl = request.headers.get("content-length")
        if cl:
            try:
                if int(cl) > limit:
                    return JSONResponse(
                        {"detail": f"Request body exceeds max size ({limit} bytes)"},
                        status_code=413,
                    )
            except ValueError:
                pass
        return await call_next(request)
