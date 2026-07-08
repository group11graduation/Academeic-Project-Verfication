"""
Proposal semantic similarity: sentence-transformers embeddings + cosine similarity.

Optimizations:
- Peer filtering (subject / assignment / legacy semester) before any ML work.
- SQLite/Redis embedding cache keyed by normalized text + model id.
- Thread-safe batched encode; optional Faiss IndexFlatIP for large corpus matmul packaging.
- Structured timing logs for embeddings vs total request.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import numpy as np

from app.config.settings import settings
from app.models.schemas import ProposalAnalyzeIn
from app.preprocessing.text import normalize_proposal_text
from app.services.embedding_cache import get_embeddings_batched
from app.services.ml_threading import TORCH_MODEL_LOCK
from app.services.proposal_service import filter_proposal_peers

logger = logging.getLogger(__name__)

SAME_SEMESTER_REJECT = float(os.getenv("AI_SAME_SEMESTER_REJECT", "0.72"))
PREVIOUS_SEMESTER_WARN = float(os.getenv("AI_PREVIOUS_SEMESTER_WARN", "0.58"))
USE_TFIDF_FALLBACK = os.getenv("USE_TFIDF_FALLBACK", "false").lower() in ("1", "true", "yes")
MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER_MODEL", "all-MiniLM-L6-v2")
MODELS_CACHE = settings.models_cache_dir
SAME_SEMESTER_MAX_DOCS = int(os.getenv("AI_SAME_SEMESTER_MAX_DOCS", "40"))
LEGACY_MAX_DOCS = int(os.getenv("AI_LEGACY_MAX_DOCS", "40"))
MAX_TEXT_CHARS = int(os.getenv("AI_MAX_TEXT_CHARS", "3500"))

_st_model = None


def _get_sentence_transformer():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer

        _st_model = SentenceTransformer(MODEL_NAME, cache_folder=MODELS_CACHE)
    return _st_model


def _encode_batch_normalized(texts: list[str]) -> np.ndarray:
    """sentence-transformers is not asyncio-safe; serialize GPU/CPU model usage."""
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


def _embedding_dim_hint() -> int | None:
    try:
        if _st_model is not None:
            return int(_st_model.get_sentence_embedding_dimension())
    except Exception:
        pass
    return None


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


def _max_cosine_tfidf_dual(
    query: str, same_docs: list[str], legacy_docs: list[str]
) -> tuple[float, int | None, float, int | None]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    all_docs = [*same_docs, *legacy_docs]
    if not all_docs:
        return 0.0, None, 0.0, None

    vec = TfidfVectorizer(min_df=1)
    mat = vec.fit_transform([query] + all_docs)
    sims = cosine_similarity(mat[0:1], mat[1:])[0]

    same_len = len(same_docs)
    same_slice = sims[:same_len]
    legacy_slice = sims[same_len:]

    if same_len:
        same_i = int(np.argmax(same_slice))
        same_max = float(same_slice[same_i])
    else:
        same_i = None
        same_max = 0.0

    if len(legacy_slice):
        leg_i = int(np.argmax(legacy_slice))
        leg_max = float(legacy_slice[leg_i])
    else:
        leg_i = None
        leg_max = 0.0

    return same_max, same_i, leg_max, leg_i


def _neighbor_scores_dot(query_vec: np.ndarray, corpus: np.ndarray) -> np.ndarray:
    """
    Inner product between normalized query and corpus rows (= cosine similarity).

    Faiss IndexFlatIP packages the same math; enabled only past faiss_min_vectors for scalability hooks.
    """
    corpus = np.asarray(corpus, dtype=np.float32)
    q = np.asarray(query_vec, dtype=np.float32).reshape(-1)
    nvec = corpus.shape[0]
    if settings.faiss_enabled and nvec >= settings.faiss_min_vectors:
        try:
            import faiss

            d = corpus.shape[1]
            index = faiss.IndexFlatIP(d)
            index.add(corpus)
            sims, _ = index.search(q.reshape(1, d), nvec)
            return sims[0].astype(np.float64)
        except Exception as e:
            logger.debug("faiss skipped, using numpy dot: %s", e)
    return np.dot(corpus, q)


def _max_cosine_semantic_dual(
    query: str, same_docs: list[str], legacy_docs: list[str]
) -> tuple[float, int | None, float, int | None]:
    all_docs = [*same_docs, *legacy_docs]
    if not all_docs:
        return 0.0, None, 0.0, None

    normalized = [query] + all_docs
    t_embed = time.perf_counter()
    emb = get_embeddings_batched(
        normalized,
        MODEL_NAME,
        lambda missing: _encode_batch_normalized(missing),
        dim_hint=_embedding_dim_hint(),
    )
    embed_ms = (time.perf_counter() - t_embed) * 1000
    logger.info(
        "proposal embedding_path=sbert texts=%s embed_batch_ms=%.1f cache_backend=sqlite|redis",
        len(normalized),
        embed_ms,
    )

    qv = emb[0]
    corpus = emb[1:]
    sims = _neighbor_scores_dot(qv, corpus)

    same_len = len(same_docs)
    same_slice = sims[:same_len]
    legacy_slice = sims[same_len:]

    if same_len:
        same_i = int(np.argmax(same_slice))
        same_max = float(same_slice[same_i])
    else:
        same_i = None
        same_max = 0.0

    if len(legacy_slice):
        leg_i = int(np.argmax(legacy_slice))
        leg_max = float(legacy_slice[leg_i])
    else:
        leg_i = None
        leg_max = 0.0

    return same_max, same_i, leg_max, leg_i


def _clip_text(text: str) -> str:
    t = normalize_proposal_text(str(text or ""))
    return t[:MAX_TEXT_CHARS]


def analyze_proposal_semantic(payload: ProposalAnalyzeIn) -> dict[str, Any]:
    """
    Core analysis used by `/analyze/proposal`.

    Returns a dict so Node `fetch().json()` shape stays compatible with the legacy TF-IDF service.
    """
    t_req = time.perf_counter()
    same_items_f, leg_items_f = filter_proposal_peers(payload)

    text = _clip_text(payload.text.strip())
    same_items = list(same_items_f)[: max(0, SAME_SEMESTER_MAX_DOCS)]
    leg_items = list(leg_items_f)[: max(0, LEGACY_MAX_DOCS)]

    same_texts = [_clip_text(s.text) for s in same_items]
    leg_texts = [_clip_text(s.text) for s in leg_items]

    backend = "sentence_transformers"
    use_tfidf = USE_TFIDF_FALLBACK

    if not use_tfidf:
        try:
            same_max, same_i, leg_max, leg_i = _max_cosine_semantic_dual(text, same_texts, leg_texts)
        except Exception as e:
            logger.warning("sentence-transformers failed (%s); using TF-IDF fallback", e)
            use_tfidf = True

    if use_tfidf:
        backend = "tfidf"
        t_tf = time.perf_counter()
        same_max, same_i, leg_max, leg_i = _max_cosine_tfidf_dual(text, same_texts, leg_texts)
        logger.info("proposal embedding_path=tfidf dual_ms=%.1f", (time.perf_counter() - t_tf) * 1000)

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

    total_ms = (time.perf_counter() - t_req) * 1000
    logger.info(
        "proposal_request total_ms=%.1f verdict=%s same_max=%.3f legacy_max=%.3f backend=%s",
        total_ms,
        verdict,
        same_max,
        leg_max,
        backend,
    )

    return {
        "same_semester_max": same_max,
        "legacy_max": leg_max,
        "matched_proposal_id": matched_proposal_id,
        "matched_legacy_id": matched_legacy_id,
        "verdict": verdict,
        "summary": f"backend={backend}, same_semester={same_max:.3f}, legacy={leg_max:.3f}",
        "backend": backend,
    }
