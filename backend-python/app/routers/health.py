from fastapi import APIRouter

from app.controllers.health_controller import health_check
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health():
    return health_check()
