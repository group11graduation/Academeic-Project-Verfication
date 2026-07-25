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
import re
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

SAME_SEMESTER_REJECT = float(os.getenv("AI_SAME_SEMESTER_REJECT", "0.55"))
PREVIOUS_SEMESTER_WARN = float(os.getenv("AI_PREVIOUS_SEMESTER_WARN", "0.50"))
# Previous-semester flags must also clear this MiniLM floor so generic CRUD/auth
# wording (login, admin, dashboard) cannot alone match unrelated domains
# (e.g. Employee Management vs LPG "Has Gas").
PREVIOUS_SEMESTER_SBERT_FLOOR = float(
    os.getenv("AI_PREVIOUS_SEMESTER_SBERT_FLOOR", "0.48")
)
USE_TFIDF_FALLBACK = os.getenv("USE_TFIDF_FALLBACK", "false").lower() in ("1", "true", "yes")
# Always blend TF-IDF / lexical with embeddings so near-copy proposals are caught
# (MiniLM alone often scored ~0.50–0.55 on near-identical TaskFlow texts).
USE_HYBRID_OVERLAP = os.getenv("AI_SAME_SEMESTER_HYBRID", "true").lower() in ("1", "true", "yes")
MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER_MODEL", "all-MiniLM-L6-v2")
MODELS_CACHE = settings.models_cache_dir
SAME_SEMESTER_MAX_DOCS = int(os.getenv("AI_SAME_SEMESTER_MAX_DOCS", "40"))
LEGACY_MAX_DOCS = int(os.getenv("AI_LEGACY_MAX_DOCS", "40"))
MAX_TEXT_CHARS = int(os.getenv("AI_MAX_TEXT_CHARS", "3500"))

# Shared by almost every student web app — inflate TF-IDF/lexical across unrelated topics.
_GENERIC_WEBAPP_NOISE = re.compile(
    r"\b("
    r"secure(?:\s+user)?\s+login|role[-\s]?based\s+access(?:\s+control)?|bcrypt|"
    r"administrator|standard\s+user|crud(?:\s+operations?)?|"
    r"create,?\s*read,?\s*update(?:,?\s*and\s*delete)?|"
    r"access[-\s]?denied|spring\s+security|responsive(?:\s+user)?\s+interface|"
    r"database[-\s]?driven|web\s+application|layered\s+architecture|"
    r"controller,?\s*service,?\s*repository|maven\s+dependency|"
    r"password\s+encryption|session\s+invalidation"
    r")\b",
    re.IGNORECASE,
)

_STOP_TITLE = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "of",
    "for",
    "to",
    "in",
    "on",
    "with",
    "based",
    "using",
    "system",
    "application",
    "platform",
    "project",
    "secure",
    "web",
    "management",
}

_st_model = None


def _strip_generic_webapp_noise(text: str) -> str:
    """Remove shared CRUD/auth boilerplate so TF-IDF/lexical focus on domain words."""
    if not text:
        return ""
    cleaned = _GENERIC_WEBAPP_NOISE.sub(" ", text)
    return " ".join(cleaned.split())


def _title_tokens(text: str) -> set[str]:
    """Rough title tokens from the start of proposal text (title is usually first)."""
    head = " ".join((text or "").split()[:16])
    toks = re.findall(r"[a-z0-9]+", head.lower())
    return {t for t in toks if len(t) > 2 and t not in _STOP_TITLE}


def _domain_title_overlap(query: str, doc: str) -> float:
    a = _title_tokens(query)
    b = _title_tokens(doc)
    if not a or not b:
        return 0.0
    return len(a & b) / float(max(len(a), len(b)))


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


def _max_lexical_ratio_dual(
    query: str, same_docs: list[str], legacy_docs: list[str]
) -> tuple[float, int | None, float, int | None]:
    """SequenceMatcher ratio — catches near-verbatim copies MiniLM under-scores."""
    from difflib import SequenceMatcher

    def best(docs: list[str]) -> tuple[float, int | None]:
        if not docs:
            return 0.0, None
        scores = [SequenceMatcher(None, query, d).ratio() for d in docs]
        idx = int(np.argmax(scores))
        return float(scores[idx]), idx

    same_max, same_i = best(same_docs)
    leg_max, leg_i = best(legacy_docs)
    return same_max, same_i, leg_max, leg_i


def _pick_best_dual(
    scores: list[tuple[float, int | None, float, int | None]],
) -> tuple[float, int | None, float, int | None]:
    """Pick same/legacy maxima across multiple scorers; keep the matching index."""
    best_same = -1.0
    best_same_i: int | None = None
    best_leg = -1.0
    best_leg_i: int | None = None
    for same_max, same_i, leg_max, leg_i in scores:
        if same_max > best_same:
            best_same = same_max
            best_same_i = same_i
        if leg_max > best_leg:
            best_leg = leg_max
            best_leg_i = leg_i
    return (
        max(0.0, best_same),
        best_same_i,
        max(0.0, best_leg),
        best_leg_i,
    )


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

    # Lexical/TF-IDF on noise-stripped text so shared "login/admin/CRUD" does not dominate.
    text_lex = _strip_generic_webapp_noise(text)
    same_lex = [_strip_generic_webapp_noise(t) for t in same_texts]
    leg_lex = [_strip_generic_webapp_noise(t) for t in leg_texts]

    backend = "sentence_transformers"
    use_tfidf_only = USE_TFIDF_FALLBACK
    sbert_row: tuple[float, int | None, float, int | None] | None = None
    tfidf_row: tuple[float, int | None, float, int | None] | None = None
    lex_row: tuple[float, int | None, float, int | None] | None = None

    if not use_tfidf_only:
        try:
            sbert_row = _max_cosine_semantic_dual(text, same_texts, leg_texts)
        except Exception as e:
            logger.warning("sentence-transformers failed (%s); using TF-IDF fallback", e)
            use_tfidf_only = True
            backend = "tfidf"

    if use_tfidf_only or USE_HYBRID_OVERLAP:
        t_tf = time.perf_counter()
        tfidf_row = _max_cosine_tfidf_dual(text_lex, same_lex, leg_lex)
        logger.info("proposal embedding_path=tfidf dual_ms=%.1f", (time.perf_counter() - t_tf) * 1000)
        if USE_HYBRID_OVERLAP:
            lex_row = _max_lexical_ratio_dual(text_lex, same_lex, leg_lex)
            backend = "hybrid_sbert_tfidf_lexical" if not use_tfidf_only else "hybrid_tfidf_lexical"
        elif use_tfidf_only:
            backend = "tfidf"

    score_rows = [r for r in (sbert_row, tfidf_row, lex_row) if r is not None]
    if not score_rows:
        same_max, same_i, leg_max, leg_i = 0.0, None, 0.0, None
    else:
        # Same-semester: keep max across scorers (catch near-copies).
        same_max, same_i, _, _ = _pick_best_dual(score_rows)

        # Previous-semester: prefer the peer MiniLM picks; do not let TF-IDF/lexical alone
        # flag unrelated domains that only share generic web-app wording.
        if sbert_row is not None:
            _, _, sbert_leg, sbert_leg_i = sbert_row
            leg_i = sbert_leg_i
            leg_max = float(sbert_leg)
            # Allow a small hybrid lift only when embeddings already see real similarity.
            if sbert_leg >= PREVIOUS_SEMESTER_SBERT_FLOOR * 0.9:
                hybrid_leg = max(
                    sbert_leg,
                    (tfidf_row[2] if tfidf_row else 0.0),
                    (lex_row[2] if lex_row else 0.0),
                )
                # Blend toward hybrid, but never far above SBERT for unrelated topics.
                leg_max = min(hybrid_leg, max(sbert_leg, sbert_leg * 0.5 + hybrid_leg * 0.5))
        else:
            _, _, leg_max, leg_i = _pick_best_dual(score_rows)

        # Domain gate: Employee Management vs HAS GAS / LPG should not warn.
        if leg_i is not None and leg_i < len(leg_texts):
            domain = _domain_title_overlap(text, leg_texts[leg_i])
            if domain < 0.12 and leg_max < (PREVIOUS_SEMESTER_WARN + 0.12):
                reasons_cap = min(leg_max, PREVIOUS_SEMESTER_WARN - 0.02)
                logger.info(
                    "legacy domain_gate overlap=%.3f capped legacy_max %.3f→%.3f",
                    domain,
                    leg_max,
                    reasons_cap,
                )
                leg_max = reasons_cap

    matched_proposal_id = (
        same_items[same_i].id if same_i is not None and same_i < len(same_items) else None
    )
    matched_legacy_id = leg_items[leg_i].id if leg_i is not None and leg_i < len(leg_items) else None

    if same_max >= SAME_SEMESTER_REJECT:
        verdict = "reject_same_semester"
    elif leg_max >= PREVIOUS_SEMESTER_WARN and (
        sbert_row is None or float(sbert_row[2]) >= PREVIOUS_SEMESTER_SBERT_FLOOR
    ):
        verdict = "warn_previous_semester"
    else:
        verdict = "ok"

    total_ms = (time.perf_counter() - t_req) * 1000
    logger.info(
        "proposal_request total_ms=%.1f verdict=%s same_max=%.3f legacy_max=%.3f backend=%s peers_same=%s peers_legacy=%s",
        total_ms,
        verdict,
        same_max,
        leg_max,
        backend,
        len(same_items),
        len(leg_items),
    )

    return {
        "same_semester_max": same_max,
        "legacy_max": leg_max,
        "matched_proposal_id": matched_proposal_id,
        "matched_legacy_id": matched_legacy_id,
        "verdict": verdict,
        "summary": (
            f"backend={backend}, same_semester={same_max:.3f}, legacy={leg_max:.3f}, "
            f"reject_at={SAME_SEMESTER_REJECT:.2f}, warn_at={PREVIOUS_SEMESTER_WARN:.2f}, "
            f"sbert_floor={PREVIOUS_SEMESTER_SBERT_FLOOR:.2f}"
        ),
        "backend": backend,
    }
