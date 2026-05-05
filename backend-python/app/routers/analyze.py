"""
AI analysis routes — thin handlers delegating to analyze_controller.
"""

from fastapi import APIRouter, BackgroundTasks

from app.controllers import analyze_controller as ac
from app.models.schemas import (
    AnalysisJobStatus,
    CodeAnalyzeIn,
    CodeAnalyzeOut,
    FullAnalyzeIn,
    FullAnalyzeOut,
    ProposalAnalyzeIn,
    ProposalJobAccepted,
    ScreenshotAnalyzeIn,
    ScreenshotAnalyzeOut,
)

router = APIRouter(prefix="/analyze", tags=["analyze"])

result_router = APIRouter(tags=["analyze"])


@router.post("/proposal")
def analyze_proposal_endpoint(body: ProposalAnalyzeIn):
    """Primary Node integration — synchronous semantic similarity (contract-stable)."""
    return ac.analyze_proposal_sync(body)


@router.post("/proposal/async", response_model=ProposalJobAccepted)
def analyze_proposal_async_endpoint(body: ProposalAnalyzeIn, background_tasks: BackgroundTasks):
    """Enqueue SBERT work; poll GET /analysis-result/{job_id} for ProposalAnalyzeOut."""
    return ac.analyze_proposal_async(body, background_tasks)


@router.post("/code", response_model=CodeAnalyzeOut)
def analyze_code_endpoint(body: CodeAnalyzeIn):
    return CodeAnalyzeOut.model_validate(ac.analyze_code_sync(body))


@router.post("/code/async", response_model=ProposalJobAccepted)
def analyze_code_async_endpoint(body: CodeAnalyzeIn, background_tasks: BackgroundTasks):
    return ac.analyze_code_async(body, background_tasks)


@router.post("/screenshot", response_model=ScreenshotAnalyzeOut)
def analyze_screenshot_endpoint(body: ScreenshotAnalyzeIn):
    return ScreenshotAnalyzeOut.model_validate(ac.analyze_screenshot_sync(body))


@router.post("/screenshot/async", response_model=ProposalJobAccepted)
def analyze_screenshot_async_endpoint(body: ScreenshotAnalyzeIn, background_tasks: BackgroundTasks):
    return ac.analyze_screenshot_async(body, background_tasks)


@router.post("/full", response_model=FullAnalyzeOut)
async def analyze_full_endpoint(body: FullAnalyzeIn):
    """Run text / code / image stacks concurrently (asyncio.gather + thread offload)."""
    return await ac.analyze_full(body)


@router.post("/full/async", response_model=ProposalJobAccepted)
def analyze_full_async_endpoint(body: FullAnalyzeIn, background_tasks: BackgroundTasks):
    """Non-blocking full stack analysis using background ThreadPoolExecutor."""
    return ac.analyze_full_async_submit(body, background_tasks)


@result_router.get("/analysis-result/{job_id}", response_model=AnalysisJobStatus)
def get_analysis_result_endpoint(job_id: str):
    """Poll async job status — completed payloads mirror synchronous endpoint bodies."""
    return ac.get_analysis_result(job_id)
