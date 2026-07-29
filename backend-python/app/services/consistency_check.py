"""
Pre-upload consistency: Jaccard tech overlap + MiniLM description vs ZIP evidence.

Reuses the same sentence-transformers encode path as proposal_semantic / requirement_semantic,
with TF-IDF cosine fallback when SBERT is unavailable.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import numpy as np

from app.config.settings import settings
from app.models.schemas import ConsistencyAnalyzeIn
from app.preprocessing.text import normalize_proposal_text
from app.services.embedding_cache import get_embeddings_batched
from app.services.ml_threading import TORCH_MODEL_LOCK

logger = logging.getLogger(__name__)

MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER_MODEL", "all-MiniLM-L6-v2")
MODELS_CACHE = settings.models_cache_dir
USE_TFIDF_FALLBACK = os.getenv("USE_TFIDF_FALLBACK", "false").lower() in ("1", "true", "yes")
MAX_TEXT_CHARS = int(os.getenv("AI_MAX_TEXT_CHARS", "3500"))

_st_model = None


def _norm_tech(items: list[str]) -> set[str]:
    out: set[str] = set()
    for raw in items or []:
        t = " ".join(str(raw or "").strip().lower().split())
        if t:
            out.add(t)
    return out


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return float(len(a & b) / len(a | b))


def _clip(text: str) -> str:
    t = normalize_proposal_text(text or "")
    if len(t) > MAX_TEXT_CHARS:
        return t[:MAX_TEXT_CHARS]
    return t


def _build_composite_text(readme_text: str, routes: list[str], models: list[str]) -> str:
    """
    README weighted heaviest (repeated), then routes + models as phrases.
    Graceful degradation when README is empty.
    """
    readme = (readme_text or "").strip()
    route_phrase = " ".join(str(r).strip() for r in (routes or []) if str(r).strip())
    model_phrase = " ".join(str(m).strip() for m in (models or []) if str(m).strip())

    parts: list[str] = []
    if readme:
        # Weight README more heavily by repeating it in the composite document.
        parts.extend([readme, readme, readme])
    if route_phrase:
        parts.append(f"Routes: {route_phrase}")
    if model_phrase:
        parts.append(f"Models: {model_phrase}")
    return _clip("\n".join(parts))


def _get_sentence_transformer():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer

        _st_model = SentenceTransformer(MODEL_NAME, cache_folder=MODELS_CACHE)
    return _st_model


def _embedding_dim_hint() -> int | None:
    try:
        return int(_get_sentence_transformer().get_sentence_embedding_dimension())
    except Exception:
        return None


def _tfidf_cosine(a: str, b: str) -> float:
    if not a.strip() or not b.strip():
        return 0.0
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        vec = TfidfVectorizer(min_df=1)
        mat = vec.fit_transform([a, b])
        return float(cosine_similarity(mat[0:1], mat[1:2])[0][0])
    except Exception:
        return 0.0


def _description_similarity(proposal_description: str, composite_text: str) -> tuple[float, str]:
    left = _clip(proposal_description)
    right = _clip(composite_text)
    if not left.strip() or not right.strip():
        return 0.0, "tfidf"

    try:
        model = _get_sentence_transformer()

        def _encode(miss: list[str]) -> np.ndarray:
            with TORCH_MODEL_LOCK:
                return model.encode(
                    miss,
                    normalize_embeddings=True,
                    show_progress_bar=False,
                    convert_to_numpy=True,
                )

        emb = get_embeddings_batched(
            [left, right],
            MODEL_NAME,
            _encode,
            dim_hint=_embedding_dim_hint(),
        )
        if emb is None or len(emb) < 2:
            raise RuntimeError("empty embeddings")
        score = float(np.dot(emb[0], emb[1]))
        return max(0.0, min(1.0, score)), "sentence_transformers"
    except Exception as e:
        logger.warning("consistency SBERT failed, TF-IDF fallback: %s", e)
        if USE_TFIDF_FALLBACK or True:
            # Always allow TF-IDF fallback for this gate so uploads are not blocked on model load.
            return max(0.0, min(1.0, _tfidf_cosine(left, right))), "tfidf"
        raise


def analyze_consistency(body: ConsistencyAnalyzeIn) -> dict[str, Any]:
    tech_thr = float(settings.tech_mismatch_threshold)
    desc_thr = float(settings.description_mismatch_threshold)

    declared = _norm_tech(list(body.declared_tech or []))
    detected = _norm_tech(list(body.detected_tech or []))

    if not declared:
        tech_score = 1.0
        tech_verdict = "skipped"
    else:
        tech_score = _jaccard(declared, detected)
        tech_verdict = "mismatch" if tech_score < tech_thr else "match"

    composite = _build_composite_text(body.readme_text or "", list(body.routes or []), list(body.models or []))
    proposal_text = (body.proposal_description or "").strip()

    backend: str = "tfidf"
    if not proposal_text.strip():
        desc_score = 1.0
        desc_verdict = "skipped"
    elif not composite.strip():
        # Proposal has a description but ZIP has no README/routes/models — fail closed.
        desc_score = 0.0
        desc_verdict = "mismatch"
    else:
        desc_score, backend = _description_similarity(proposal_text, composite)
        desc_verdict = "mismatch" if desc_score < desc_thr else "match"

    # Tech or description mismatch both reject the upload (not only flag for review).
    if tech_verdict == "mismatch" or desc_verdict == "mismatch":
        overall = "reject"
    else:
        overall = "consistent"

    summary_parts = [
        f"tech={tech_score:.3f}({tech_verdict})",
        f"description={desc_score:.3f}({desc_verdict})",
        f"overall={overall}",
    ]

    return {
        "tech_match_score": round(float(tech_score), 4),
        "description_match_score": round(float(desc_score), 4),
        "tech_verdict": tech_verdict,
        "description_verdict": desc_verdict,
        "overall_verdict": overall,
        "summary": "; ".join(summary_parts),
        "backend": backend,
        "thresholds": {
            "tech_mismatch": tech_thr,
            "description_mismatch": desc_thr,
        },
    }
