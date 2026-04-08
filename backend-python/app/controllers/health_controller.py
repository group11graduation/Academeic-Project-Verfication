from app.models.schemas import HealthResponse
from app.services.health_service import get_health


def health_check() -> HealthResponse:
    return get_health()
