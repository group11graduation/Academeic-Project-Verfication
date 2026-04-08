"""
FastAPI application factory.
Routers live in `app/routers`; business logic in `app/services`.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.middleware.request_id import RequestIdMiddleware
from app.routers.analyze import router as analyze_router
from app.routers.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0")

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if origins == ["*"]:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.add_middleware(RequestIdMiddleware)

    app.include_router(health_router)
    app.include_router(analyze_router)

    @app.get("/")
    def root():
        return {"message": "AI service — use /health", "docs": "/docs"}

    return app


app = create_app()
