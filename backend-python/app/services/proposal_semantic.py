"""
Proposal semantic similarity: sentence-transformers embeddings + cosine similarity.

Implements:
- Same-semester conflict detection (high similarity → reject_same_semester)
- Previous-semester warning (moderate similarity to legacy → warn_previous_semester)

Falls back to TF-IDF if `USE_TFIDF_FALLBACK=true` or if sentence-transformers cannot load.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import numpy as np

from app.models.schemas import ProposalAnalyzeIn
from app.preprocessing.text import normalize_proposal_text

logger = logging.getLogger(__name__)

SAME_SEMESTER_REJECT = float(os.getenv("AI_SAME_SEMESTER_REJECT", "0.72"))
PREVIOUS_SEMESTER_WARN = float(os.getenv("AI_PREVIOUS_SEMESTER_WARN", "0.58"))
USE_TFIDF_FALLBACK = os.getenv("USE_TFIDF_FALLBACK", "false").lower() in ("1", "true", "yes")
MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER_MODEL", "all-MiniLM-L6-v2")
MODELS_CACHE = os.getenv("MODELS_CACHE_DIR", "/tmp/academic-ai-models")

_st_model = None


def _get_sentence_transformer():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer

        _st_model = SentenceTransformer(MODEL_NAME, cache_folder=MODELS_CACHE)
    return _st_model


def _max_cosine_tfidf(query: str, docs: list[str]) -> tuple[float, int | None]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    if not docs:
        return 0.0, None
    vec = TfidfVectorizer(min_df=1)
    mat = vec.fit_transform([query] + docs)
    sims = cosine_similarity(mat[0:1], mat[1:])[0]
    idx = int(np.argmax(sims))
    return float(sims[idx]), idx


def _max_cosine_semantic(query: str, docs: list[str]) -> tuple[float, int | None]:
    from sklearn.metrics.pairwise import cosine_similarity

    if not docs:
        return 0.0, None
    model = _get_sentence_transformer()
    emb = model.encode([query] + docs, normalize_embeddings=True, show_progress_bar=False)
    sims = cosine_similarity(emb[0:1], emb[1:])[0]
    idx = int(np.argmax(sims))
    return float(sims[idx]), idx


def analyze_proposal_semantic(payload: ProposalAnalyzeIn) -> dict[str, Any]:
    """
    Core analysis used by `/analyze/proposal`.

    Returns a dict so Node `fetch().json()` shape stays compatible with the legacy TF-IDF service.
    """
    text = normalize_proposal_text(payload.text.strip())
    same_items = list(payload.same_semester)
    leg_items = list(payload.legacy)

    same_texts = [normalize_proposal_text(s.text) for s in same_items]
    leg_texts = [normalize_proposal_text(s.text) for s in leg_items]

    backend = "sentence_transformers"
    use_tfidf = USE_TFIDF_FALLBACK

    if not use_tfidf:
        try:
            same_max, same_i = _max_cosine_semantic(text, same_texts)
            leg_max, leg_i = _max_cosine_semantic(text, leg_texts)
        except Exception as e:
            logger.warning("sentence-transformers failed (%s); using TF-IDF fallback", e)
            use_tfidf = True

    if use_tfidf:
        backend = "tfidf"
        same_max, same_i = _max_cosine_tfidf(text, same_texts)
        leg_max, leg_i = _max_cosine_tfidf(text, leg_texts)

    matched_proposal_id = (
        same_items[same_i].id if same_i is not None and same_i < len(same_items) else None
    )
    matched_legacy_id = leg_items[leg_i].id if leg_i is not None and leg_i < len(leg_items) else None

    if same_max >= SAME_SEMESTER_REJECT:
        verdict = "reject_same_semester"
    elif leg_max >= PREVIOUS_SEMESTER_WARN:
        verdict = "warn_previous_semester"
    else:
        verdict = "ok"

    return {
        "same_semester_max": same_max,
        "legacy_max": leg_max,
        "matched_proposal_id": matched_proposal_id,
        "matched_legacy_id": matched_legacy_id,
        "verdict": verdict,
        "summary": f"backend={backend}, same_semester={same_max:.3f}, legacy={leg_max:.3f}",
        "backend": backend,
    }
