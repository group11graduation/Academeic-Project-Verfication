"""
Text preprocessing for proposal embedding and TF-IDF fallback.

Steps: unicode normalize → lowercase → collapse whitespace → optional strip of boilerplate lines.
"""

from __future__ import annotations

import re
import unicodedata


# Lines that add little semantic signal for similarity (tweak per institution)
_BOILERPLATE_PATTERNS = re.compile(
    r"^(table of contents|references|bibliography|appendix)\s*:?\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def normalize_proposal_text(text: str) -> str:
    """
    Normalize proposal body before embedding.

    - NFC unicode normalization (stable comparison across OS)
    - Lowercase
    - Collapse repeated whitespace
    """
    if not text:
        return ""
    t = unicodedata.normalize("NFC", text)
    t = t.lower()
    t = " ".join(t.split())
    return t


def strip_boilerplate_sections(text: str) -> str:
    """
    Remove obvious non-content headings (best-effort; does not parse Markdown AST).
    """
    if not text:
        return ""
    return _BOILERPLATE_PATTERNS.sub("", text)


def build_embedding_input(title: str, description: str, features: list[str] | None) -> str:
    """
    Single string for semantic models: title weighted by repetition (importance signal).

    Format mirrors Node `buildProposalText`: title, description, comma-separated features.
    """
    parts = [normalize_proposal_text(title or "")]
    parts.append(normalize_proposal_text(description or ""))
    if features:
        feat = ", ".join(normalize_proposal_text(f) for f in features if f)
        parts.append(f"features: {feat}")
    # Repeat title once at end to emphasize topic in mean pooling
    parts.append(parts[0])
    return strip_boilerplate_sections("\n".join(p for p in parts if p))
