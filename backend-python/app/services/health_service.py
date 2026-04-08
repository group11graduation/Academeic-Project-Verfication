from app.models.schemas import HealthResponse


def get_health() -> HealthResponse:
    return HealthResponse(ok=True, service="ai-analytical")
