"""
Semantic requirement check: teacher requirement paragraphs vs student proposal text.

Uses the same MiniLM sentence-transformer + cosine similarity as plagiarism detection.
Rejects casual / conversational text that does not address the assignment requirements,
accepts paraphrases with the same meaning, and routes borderline scores to teacher review.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import numpy as np

from app.config.settings import settings
from app.preprocessing.text import normalize_proposal_text
from app.services.ml_threading import TORCH_MODEL_LOCK

logger = logging.getLogger(__name__)

MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER_MODEL", "all-MiniLM-L6-v2")
MODELS_CACHE = settings.models_cache_dir

# Calibrated defaults — override via env after evaluating real pairs.
# Scores below REJECT: clear fail (casual chat, unrelated, bare keywords only).
# Scores between REJECT and PASS: teacher review.
# Scores at/above PASS: automatic clear for requirements.
REQUIREMENT_REJECT_BELOW = float(os.getenv("AI_REQUIREMENT_REJECT_BELOW", "0.42"))
REQUIREMENT_PASS_AT = float(os.getenv("AI_REQUIREMENT_PASS_AT", "0.58"))
MIN_PROPOSAL_CHARS = int(os.getenv("AI_REQUIREMENT_MIN_PROPOSAL_CHARS", "80"))
MIN_REQUIREMENT_CHARS = int(os.getenv("AI_REQUIREMENT_MIN_REQ_CHARS", "20"))
MAX_TEXT_CHARS = int(os.getenv("AI_MAX_TEXT_CHARS", "3500"))
TECH_CONTEXT_PASS = float(os.getenv("AI_REQUIREMENT_TECH_CONTEXT_PASS", "0.48"))

_st_model = None

# Phrases that look like empty conversational filler rather than a project proposal.
_CONVERSATIONAL_PATTERNS = re.compile(
    r"\b("
    r"how are you|what's up|whats up|hello teacher|hi teacher|good morning|"
    r"please accept|i hope you|thank you for reading|just testing|"
    r"this is a test|lorem ipsum|asdf|qwerty"
    r")\b",
    re.IGNORECASE,
)

_TECH_PROBES = {
    "php": "This project is implemented with PHP on the server side.",
    "mysql": "This project stores data in a MySQL relational database.",
    "postgresql": "This project uses PostgreSQL as its database.",
    "mongodb": "This project uses MongoDB as a NoSQL database.",
    "node.js": "This project uses Node.js for the backend runtime.",
    "react": "This project builds the user interface with React.",
    "flutter": "This project is a Flutter mobile application.",
    "java": "This project is written in Java.",
    "python": "This project is implemented in Python.",
    "laravel": "This project uses the Laravel PHP framework.",
    "spring boot": "This project uses Spring Boot for the Java backend.",
    "django": "This project uses the Django Python framework.",
}


def _get_sentence_transformer():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer

        _st_model = SentenceTransformer(MODEL_NAME, cache_folder=MODELS_CACHE)
    return _st_model


def _encode_normalized(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 0), dtype=np.float32)
    with TORCH_MODEL_LOCK:
        model = _get_sentence_transformer()
        return model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )


def _clip(text: str) -> str:
    t = normalize_proposal_text(text or "")
    if len(t) > MAX_TEXT_CHARS:
        return t[:MAX_TEXT_CHARS]
    return t


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    if a.size == 0 or b.size == 0:
        return 0.0
    return float(np.dot(a, b))


def _split_paragraphs(text: str) -> list[str]:
    raw = re.split(r"\n\s*\n+|[.!?]\s+(?=[A-Z])", text or "")
    parts = []
    for chunk in raw:
        c = " ".join(str(chunk).split()).strip()
        if len(c) >= 24:
            parts.append(c)
    if not parts and text.strip():
        parts = [text.strip()]
    return parts[:12]


def _is_keyword_only_shell(proposal: str, required_tech: list[str]) -> bool:
    """True when the proposal is basically just tech names with almost no prose."""
    cleaned = proposal
    for tech in required_tech:
        cleaned = re.sub(rf"\b{re.escape(tech)}\b", " ", cleaned, flags=re.IGNORECASE)
        for token in tech.replace(".", " ").split():
            cleaned = re.sub(rf"\b{re.escape(token)}\b", " ", cleaned, flags=re.IGNORECASE)
    leftover = " ".join(cleaned.split()).strip()
    return len(leftover) < 40


def analyze_requirement_semantic(body: Any) -> dict[str, Any]:
    """
    Compare full teacher requirement text to full student proposal text.

    Verdicts:
      - reject: clearly does not meet requirements (incl. casual English / bare keywords)
      - review: borderline — human teacher should decide
      - pass: clearly addresses the requirements in meaning
    """
    requirement_text = _clip(getattr(body, "requirement_text", "") or "")
    proposal_text = _clip(getattr(body, "proposal_text", "") or "")
    required_technologies = [
        str(t).strip().lower()
        for t in (getattr(body, "required_technologies", None) or [])
        if str(t).strip()
    ]
    requirement_sections = [
        _clip(s)
        for s in (getattr(body, "requirement_sections", None) or [])
        if str(s or "").strip()
    ]

    reasons: list[str] = []

    if len(proposal_text) < MIN_PROPOSAL_CHARS:
        return {
            "similarity": 0.0,
            "section_max_similarity": 0.0,
            "tech_context_score": 0.0,
            "verdict": "reject",
            "summary": (
                f"Proposal text is too short ({len(proposal_text)} characters). "
                "Write a real project description that explains how you meet the teacher requirements — "
                "casual chat or a couple of keywords is not enough."
            ),
            "reasons": ["proposal_too_short"],
            "backend": "sentence_transformers",
            "thresholds": {
                "reject_below": REQUIREMENT_REJECT_BELOW,
                "pass_at": REQUIREMENT_PASS_AT,
            },
        }

    if _CONVERSATIONAL_PATTERNS.search(proposal_text) and len(proposal_text) < 220:
        reasons.append("conversational_filler")

    if required_technologies and _is_keyword_only_shell(proposal_text, required_technologies):
        return {
            "similarity": 0.0,
            "section_max_similarity": 0.0,
            "tech_context_score": 0.0,
            "verdict": "reject",
            "summary": (
                "Rejected: listing technology names alone (for example “PHP MySQL”) is not enough. "
                "Explain in full sentences what you will build and how those technologies are used."
            ),
            "reasons": ["keyword_only_shell"],
            "backend": "sentence_transformers",
            "thresholds": {
                "reject_below": REQUIREMENT_REJECT_BELOW,
                "pass_at": REQUIREMENT_PASS_AT,
            },
        }

    # Build teacher corpus: full text + optional section paragraphs.
    teacher_chunks = []
    if requirement_text and len(requirement_text) >= MIN_REQUIREMENT_CHARS:
        teacher_chunks.append(requirement_text)
    for section in requirement_sections:
        if section and section not in teacher_chunks:
            teacher_chunks.append(section)
    if not teacher_chunks and required_technologies:
        teacher_chunks.append(
            "The student project must use these technologies and describe their role: "
            + ", ".join(required_technologies)
            + "."
        )
    if not teacher_chunks:
        # Nothing meaningful to compare — treat as pass for this gate.
        return {
            "similarity": 1.0,
            "section_max_similarity": 1.0,
            "tech_context_score": 1.0,
            "verdict": "pass",
            "summary": "No teacher requirement text configured; semantic requirement gate skipped.",
            "reasons": ["no_requirement_text"],
            "backend": "sentence_transformers",
            "thresholds": {
                "reject_below": REQUIREMENT_REJECT_BELOW,
                "pass_at": REQUIREMENT_PASS_AT,
            },
        }

    proposal_paragraphs = _split_paragraphs(proposal_text)
    encode_inputs = [*teacher_chunks, proposal_text, *proposal_paragraphs]
    vectors = _encode_normalized(encode_inputs)

    n_teacher = len(teacher_chunks)
    teacher_vecs = vectors[:n_teacher]
    proposal_full_vec = vectors[n_teacher]
    paragraph_vecs = vectors[n_teacher + 1 :]

    # Full-document similarity (primary signal).
    full_sims = [_cosine(tv, proposal_full_vec) for tv in teacher_vecs]
    similarity = float(max(full_sims)) if full_sims else 0.0

    # Best paragraph-vs-section similarity (helps when student rewords one section well).
    section_max = 0.0
    if paragraph_vecs.size:
        for tv in teacher_vecs:
            for pv in paragraph_vecs:
                section_max = max(section_max, _cosine(tv, pv))
    section_max_similarity = float(section_max)

    combined = max(similarity, section_max_similarity * 0.95)

    # Technology-in-context probes: require meaning around stack, not bare tokens.
    tech_context_score = 1.0
    missing_tech_context: list[str] = []
    if required_technologies:
        tech_scores = []
        for tech in required_technologies:
            probe = _TECH_PROBES.get(tech) or f"This project uses {tech} as a core technology."
            probe_vec = _encode_normalized([_clip(probe)])[0]
            score = _cosine(probe_vec, proposal_full_vec)
            tech_scores.append(score)
            if score < TECH_CONTEXT_PASS:
                missing_tech_context.append(tech)
        tech_context_score = float(min(tech_scores)) if tech_scores else 1.0
        if missing_tech_context:
            reasons.append("missing_tech_context:" + ",".join(missing_tech_context))

    if "conversational_filler" in reasons and combined < REQUIREMENT_PASS_AT:
        combined = min(combined, REQUIREMENT_REJECT_BELOW - 0.01)
        reasons.append("casual_english_not_addressing_requirements")

    if missing_tech_context and combined < REQUIREMENT_PASS_AT:
        # Weak tech context pulls borderline cases toward reject/review.
        combined = min(combined, (REQUIREMENT_REJECT_BELOW + REQUIREMENT_PASS_AT) / 2)

    if combined < REQUIREMENT_REJECT_BELOW or (
        missing_tech_context and tech_context_score < TECH_CONTEXT_PASS * 0.85 and combined < REQUIREMENT_PASS_AT
    ):
        verdict = "reject"
        summary = (
            f"Rejected automatically: the proposal does not meaningfully match the teacher requirements "
            f"(similarity {combined:.2f}). Casual English, unrelated text, or only naming technologies "
            f"without explaining the project is not accepted. Rewrite the proposal so it clearly addresses "
            f"the assignment requirements in your own words."
        )
        if missing_tech_context:
            summary += f" Missing clear use of: {', '.join(missing_tech_context)}."
    elif combined < REQUIREMENT_PASS_AT:
        verdict = "review"
        summary = (
            f"Borderline requirement match (similarity {combined:.2f}). "
            f"The AI is unsure whether the proposal fully meets the teacher requirements — "
            f"a teacher should review this manually."
        )
        reasons.append("borderline_similarity")
    else:
        verdict = "pass"
        summary = (
            f"Proposal meaningfully addresses teacher requirements (similarity {combined:.2f})."
        )
        if missing_tech_context:
            # High overall similarity but weak tech phrasing → still ask teacher.
            verdict = "review"
            summary = (
                f"Overall proposal is related to the requirements (similarity {combined:.2f}), "
                f"but technology context is unclear for: {', '.join(missing_tech_context)}. "
                f"Teacher review recommended."
            )
            reasons.append("tech_context_borderline")

    return {
        "similarity": round(float(combined), 4),
        "section_max_similarity": round(float(section_max_similarity), 4),
        "tech_context_score": round(float(tech_context_score), 4),
        "verdict": verdict,
        "summary": summary,
        "reasons": reasons,
        "backend": "sentence_transformers",
        "thresholds": {
            "reject_below": REQUIREMENT_REJECT_BELOW,
            "pass_at": REQUIREMENT_PASS_AT,
        },
    }
