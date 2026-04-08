"""Compatibility shim — prefer `app.preprocessing.text` for new code."""

from app.preprocessing.text import normalize_proposal_text as normalize_text

__all__ = ["normalize_text"]
