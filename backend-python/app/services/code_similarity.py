"""Backward-compatible export for `/analyze/code` (implementation in code_analysis)."""

from app.services.code_analysis import analyze_code_similarity

__all__ = ["analyze_code_similarity"]
