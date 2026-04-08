"""
Legacy module path: re-exports the semantic proposal analyzer.

Node and older imports may use `app.services.proposal_similarity.analyze_proposal`;
new code should import `analyze_proposal_semantic` from `proposal_semantic` directly.
"""

from __future__ import annotations

from app.models.schemas import ProposalAnalyzeIn
from app.services.proposal_semantic import analyze_proposal_semantic


def analyze_proposal(payload: ProposalAnalyzeIn) -> dict:
    """Delegate to sentence-transformer (or TF-IDF fallback) pipeline."""
    return analyze_proposal_semantic(payload)
