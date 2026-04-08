"""
AI analysis routes: proposals (Node integration), optional code and screenshot checks.

Each handler delegates to a service module; schemas live in `app.models.schemas`.
"""

from fastapi import APIRouter

from app.models.schemas import (
    CodeAnalyzeIn,
    CodeAnalyzeOut,
    ProposalAnalyzeIn,
    ScreenshotAnalyzeIn,
    ScreenshotAnalyzeOut,
)
from app.services.code_similarity import analyze_code_similarity
from app.services.proposal_semantic import analyze_proposal_semantic
from app.services.screenshot_similarity import analyze_screenshot_similarity

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("/proposal")
def analyze_proposal_endpoint(body: ProposalAnalyzeIn):
    """
    Primary integration for Node `aiClient.analyzeProposalPayload`.

    Semantic similarity (sentence-transformers) with same-semester vs legacy thresholds.
    """
    return analyze_proposal_semantic(body)


@router.post("/code", response_model=CodeAnalyzeOut)
def analyze_code_endpoint(body: CodeAnalyzeIn):
    """Tree-sitter fingerprints + TF-IDF; optional CodeBERT when CODEBERT_ENABLED=true."""
    return CodeAnalyzeOut.model_validate(analyze_code_similarity(body))


@router.post("/screenshot", response_model=ScreenshotAnalyzeOut)
def analyze_screenshot_endpoint(body: ScreenshotAnalyzeIn):
    """Perceptual hash (phash) vs stored reference hashes — UI duplicate warning."""
    return ScreenshotAnalyzeOut.model_validate(analyze_screenshot_similarity(body))
