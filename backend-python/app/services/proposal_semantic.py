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

SAME_SEMESTER_REJECT = float(os.getenv("AI_SAME_SEMESTER_REJECT", "0.85"))
# Below hard-reject but above this → teacher review (do not block the student).
# Common topics (library / hostel / school CRUD) often land in 0.55–0.80 without being copies.
SAME_SEMESTER_FLAG = float(os.getenv("AI_SAME_SEMESTER_FLAG", "0.72"))
PREVIOUS_SEMESTER_WARN = float(os.getenv("AI_PREVIOUS_SEMESTER_WARN", "0.50"))
# Previous-semester flags must also clear this MiniLM floor so generic CRUD/auth
# wording (login, admin, dashboard) cannot alone match unrelated domains
# (e.g. Employee Management vs LPG "Has Gas").
PREVIOUS_SEMESTER_SBERT_FLOOR = float(
    os.getenv("AI_PREVIOUS_SEMESTER_SBERT_FLOOR", "0.48")
)
# Meaningful title-token overlap required before flagging similar ideas.
# Without this, MiniLM often pairs unrelated CRUD apps (Hostel vs Library,
# Finance Org vs Building Mgmt) because both say "management system / PHP / MySQL".
LEGACY_DOMAIN_TITLE_MIN = float(os.getenv("AI_LEGACY_DOMAIN_TITLE_MIN", "0.18"))
# Same-semester hard reject also requires domain overlap (unless near-verbatim copy).
SAME_SEMESTER_DOMAIN_MIN = float(
    os.getenv("AI_SAME_SEMESTER_DOMAIN_MIN", str(LEGACY_DOMAIN_TITLE_MIN))
)
# Lexical floor that still rejects even when titles use different domain words
# (student renames title but pastes the same description).
SAME_SEMESTER_NEAR_COPY_LEX = float(os.getenv("AI_SAME_SEMESTER_NEAR_COPY_LEX", "0.82"))
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
    r"database[-\s]?driven|web(?:\s*[- ]?\s*based)?\s+application|layered\s+architecture|"
    r"controller,?\s*service,?\s*repository|maven\s+dependency|"
    r"password\s+encryption|session\s+invalidation|"
    r"centralized\s+platform|information\s+system"
    r")\b",
    re.IGNORECASE,
)

# Tech stack lists pollute embeddings when every MERN project lists the same stack.
_TECH_STACK_NOISE = re.compile(
    r"\b("
    r"node\.?js|nodejs|express(?:\.?js)?|mongodb|mongo\s*db|mongoose|react(?:\.?js)?|"
    r"next\.?js|vue(?:\.?js)?|angular|laravel|django|flask|fastapi|spring\s*boot|"
    r"hibernate|mysql|mariadb|postgres(?:ql)?|sqlite|redis|docker|kubernetes|"
    r"tailwind|bootstrap|material\s*ui|helmet|cors|jwt|oauth|rest(?:ful)?\s*api|"
    r"graphql|typescript|javascript|html5?|css3?|php|python|java\b"
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
    "systems",
    "application",
    "applications",
    "platform",
    "project",
    "secure",
    "web",
    "management",
    "managing",
    "information",
    "comprehensive",
    "complete",
    "advanced",
    "simple",
    "api",
    "app",
    "apps",
    "software",
    "tool",
    "tools",
    "service",
    "services",
    "portal",
    "dashboard",
    # Tech stack in titles must NOT count as domain overlap
    # (Hostel PHP/MySQL ≠ Library PHP/MySQL).
    "php",
    "mysql",
    "mariadb",
    "mongodb",
    "mongo",
    "postgres",
    "postgresql",
    "sqlite",
    "react",
    "nodejs",
    "node",
    "express",
    "laravel",
    "django",
    "flask",
    "python",
    "java",
    "javascript",
    "typescript",
    "html",
    "css",
    "bootstrap",
    "tailwind",
    "mern",
    "mean",
    "jwt",
    "rest",
    "restful",
    "fullstack",
    "full",
    "stack",
    "frontend",
    "backend",
    "database",
    "db",
    "sql",
    "nosql",
}

_st_model = None


def _strip_generic_webapp_noise(text: str) -> str:
    """Remove shared CRUD/auth/tech boilerplate so scoring focuses on domain words."""
    if not text:
        return ""
    cleaned = _GENERIC_WEBAPP_NOISE.sub(" ", text)
    cleaned = _TECH_STACK_NOISE.sub(" ", cleaned)
    return " ".join(cleaned.split())


def _title_tokens(text: str) -> set[str]:
    """Domain tokens from the proposal title line only (not description/features)."""
    first_line = (text or "").split("\n", 1)[0]
    # Drop trailing tech slogans: "… Using PHP and MySQL"
    first_line = re.sub(
        r"\b(?:using|with|built\s+with|based\s+on)\b.*$",
        " ",
        first_line,
        flags=re.IGNORECASE,
    )
    head = " ".join(first_line.split()[:24])
    toks = re.findall(r"[a-z0-9]+", head.lower())
    return {t for t in toks if len(t) > 2 and t not in _STOP_TITLE}


def _domain_title_overlap(query: str, doc: str) -> float:
    a = _title_tokens(query)
    b = _title_tokens(doc)
    if not a or not b:
        return 0.0
    return len(a & b) / float(max(len(a), len(b)))


def _pick_peer_with_domain(
    query: str,
    peer_texts: list[str],
    peer_sims: np.ndarray,
    *,
    domain_min: float,
    score_floor: float,
    suppress_below: float,
    label: str,
) -> tuple[float, int | None]:
    """
    Prefer a peer that is both semantically close AND shares domain title tokens.
    Unrelated topics (Hostel vs Library / BookNest) are suppressed even if MiniLM
    scores them high due to shared "management system" boilerplate.
    """
    if peer_sims.size == 0:
        return 0.0, None

    order = list(np.argsort(-peer_sims))
    for idx in order:
        score = float(peer_sims[idx])
        if score < score_floor:
            break
        domain = _domain_title_overlap(query, peer_texts[int(idx)])
        if domain >= domain_min:
            return score, int(idx)

    # Soft pass: allow slightly lower domain only when scores are clearly high
    # AND at least one real domain token overlaps (not empty intersection).
    soft_min = max(0.12, domain_min * 0.65)
    for idx in order[:8]:
        score = float(peer_sims[idx])
        if score < max(score_floor, suppress_below):
            continue
        domain = _domain_title_overlap(query, peer_texts[int(idx)])
        a = _title_tokens(query)
        b = _title_tokens(peer_texts[int(idx)])
        if domain >= soft_min and (a & b):
            return score, int(idx)

    top_i = int(order[0])
    top_score = float(peer_sims[top_i])
    top_domain = _domain_title_overlap(query, peer_texts[top_i])
    logger.info(
        "%s domain_reject top_score=%.3f top_domain=%.3f (min=%.3f) — unrelated topic",
        label,
        top_score,
        top_domain,
        domain_min,
    )
    return min(top_score, suppress_below - 0.02), None


def _pick_legacy_with_domain(
    query: str,
    leg_texts: list[str],
    leg_sims: np.ndarray,
    *,
    domain_min: float,
    score_floor: float,
) -> tuple[float, int | None]:
    return _pick_peer_with_domain(
        query,
        leg_texts,
        leg_sims,
        domain_min=domain_min,
        score_floor=score_floor,
        suppress_below=PREVIOUS_SEMESTER_WARN,
        label="legacy",
    )


def _same_semester_sims_from_rows(
    score_rows: list[tuple[float, int | None, float, int | None]],
    n_same: int,
) -> np.ndarray:
    """Build per-peer max score vector across SBERT / TF-IDF / lexical rows."""
    sims = np.zeros(n_same, dtype=np.float64)
    if n_same <= 0:
        return sims
    for same_max, same_i, _, _ in score_rows:
        if same_i is None:
            continue
        i = int(same_i)
        if 0 <= i < n_same:
            sims[i] = max(sims[i], float(same_max))
    return sims


def _lexical_score_for_index(
    lex_row: tuple[float, int | None, float, int | None] | None,
    idx: int | None,
) -> float:
    if lex_row is None or idx is None:
        return 0.0
    if lex_row[1] == idx:
        return float(lex_row[0])
    return 0.0


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
) -> tuple[float, int | None, float, int | None, np.ndarray]:
    all_docs = [*same_docs, *legacy_docs]
    empty = np.zeros((0,), dtype=np.float64)
    if not all_docs:
        return 0.0, None, 0.0, None, empty

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
    legacy_slice = np.asarray(sims[same_len:], dtype=np.float64)

    if same_len:
        same_i = int(np.argmax(same_slice))
        same_max = float(same_slice[same_i])
    else:
        same_i = None
        same_max = 0.0

    if legacy_slice.size:
        leg_i = int(np.argmax(legacy_slice))
        leg_max = float(legacy_slice[leg_i])
    else:
        leg_i = None
        leg_max = 0.0

    return same_max, same_i, leg_max, leg_i, legacy_slice


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

    # Lexical/TF-IDF + SBERT on noise-stripped text so shared login/admin/CRUD/tech
    # stack wording does not dominate unrelated domains.
    text_lex = _strip_generic_webapp_noise(text)
    same_lex = [_strip_generic_webapp_noise(t) for t in same_texts]
    leg_lex = [_strip_generic_webapp_noise(t) for t in leg_texts]
    # Keep a bit of original title signal for embeddings (title is first line).
    text_embed = text_lex or text
    same_embed = [t or orig for t, orig in zip(same_lex, same_texts)]
    leg_embed = [t or orig for t, orig in zip(leg_lex, leg_texts)]

    backend = "sentence_transformers"
    use_tfidf_only = USE_TFIDF_FALLBACK
    sbert_row: tuple[float, int | None, float, int | None] | None = None
    tfidf_row: tuple[float, int | None, float, int | None] | None = None
    lex_row: tuple[float, int | None, float, int | None] | None = None
    legacy_sims: np.ndarray | None = None

    if not use_tfidf_only:
        try:
            same_max_s, same_i_s, leg_max_s, leg_i_s, legacy_sims = _max_cosine_semantic_dual(
                text_embed, same_embed, leg_embed
            )
            sbert_row = (same_max_s, same_i_s, leg_max_s, leg_i_s)
        except Exception as e:
            logger.warning("sentence-transformers failed (%s); using TF-IDF fallback", e)
            use_tfidf_only = True
            backend = "tfidf"
            legacy_sims = None

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
        # Same-semester: require domain title overlap so Hostel ≠ Library / BookNest.
        # Near-verbatim copies (lexical) still reject even if the title was lightly edited.
        raw_same_max, raw_same_i, _, _ = _pick_best_dual(score_rows)
        same_max, same_i = raw_same_max, raw_same_i
        if same_texts and raw_same_i is not None and raw_same_i < len(same_texts):
            from difflib import SequenceMatcher

            known = _same_semester_sims_from_rows(score_rows, len(same_texts))
            best_dom_score = -1.0
            best_dom_i: int | None = None
            for i, peer in enumerate(same_texts):
                if _domain_title_overlap(text, peer) < SAME_SEMESTER_DOMAIN_MIN:
                    continue
                sc = float(known[i]) if i < known.size and known[i] > 0 else 0.0
                if sc <= 0:
                    peer_lex = same_lex[i] if i < len(same_lex) else peer
                    sc = float(SequenceMatcher(None, text_lex or text, peer_lex or peer).ratio())
                # Prefer the hybrid raw score when this peer was the top hit
                if i == raw_same_i:
                    sc = max(sc, float(raw_same_max))
                if sc > best_dom_score:
                    best_dom_score = sc
                    best_dom_i = i

            lex_at_raw = _lexical_score_for_index(lex_row, raw_same_i)
            if best_dom_i is not None:
                same_max, same_i = best_dom_score, best_dom_i
            elif lex_at_raw >= SAME_SEMESTER_NEAR_COPY_LEX:
                logger.info(
                    "same_semester near_copy lex=%.3f keeps reject despite domain gate",
                    lex_at_raw,
                )
                same_max, same_i = raw_same_max, raw_same_i
            else:
                top_domain = _domain_title_overlap(text, same_texts[raw_same_i])
                logger.info(
                    "same_semester domain_reject top_score=%.3f top_domain=%.3f (min=%.3f)",
                    raw_same_max,
                    top_domain,
                    SAME_SEMESTER_DOMAIN_MIN,
                )
                same_max = min(float(raw_same_max), SAME_SEMESTER_REJECT - 0.02)
                same_i = None

        # Previous-semester: require domain title overlap so Finance ≠ Building Mgmt.
        if legacy_sims is not None and legacy_sims.size:
            leg_max, leg_i = _pick_legacy_with_domain(
                text,
                leg_texts,
                legacy_sims,
                domain_min=LEGACY_DOMAIN_TITLE_MIN,
                score_floor=PREVIOUS_SEMESTER_SBERT_FLOOR * 0.85,
            )
            if leg_i is not None and tfidf_row is not None:
                # Small hybrid lift only for the domain-aligned peer
                tfidf_leg = float(tfidf_row[2]) if tfidf_row[3] == leg_i else 0.0
                lex_leg = float(lex_row[2]) if lex_row and lex_row[3] == leg_i else 0.0
                if leg_max >= PREVIOUS_SEMESTER_SBERT_FLOOR * 0.9:
                    hybrid_leg = max(leg_max, tfidf_leg, lex_leg)
                    leg_max = min(hybrid_leg, max(leg_max, leg_max * 0.5 + hybrid_leg * 0.5))
        elif sbert_row is not None:
            _, _, sbert_leg, sbert_leg_i = sbert_row
            leg_i = sbert_leg_i
            leg_max = float(sbert_leg)
            if leg_i is not None and leg_i < len(leg_texts):
                domain = _domain_title_overlap(text, leg_texts[leg_i])
                if domain < LEGACY_DOMAIN_TITLE_MIN:
                    logger.info(
                        "legacy domain_gate overlap=%.3f suppressed legacy_max %.3f",
                        domain,
                        leg_max,
                    )
                    leg_max = min(leg_max, PREVIOUS_SEMESTER_WARN - 0.02)
                    leg_i = None
        else:
            _, _, leg_max, leg_i = _pick_best_dual(score_rows)
            if leg_i is not None and leg_i < len(leg_texts):
                domain = _domain_title_overlap(text, leg_texts[leg_i])
                if domain < LEGACY_DOMAIN_TITLE_MIN:
                    leg_max = min(leg_max, PREVIOUS_SEMESTER_WARN - 0.02)
                    leg_i = None

    matched_proposal_id = (
        same_items[same_i].id if same_i is not None and same_i < len(same_items) else None
    )
    matched_legacy_id = leg_items[leg_i].id if leg_i is not None and leg_i < len(leg_items) else None

    sbert_leg_floor_ok = True
    if sbert_row is not None and leg_i is not None and legacy_sims is not None and leg_i < legacy_sims.size:
        sbert_leg_floor_ok = float(legacy_sims[leg_i]) >= PREVIOUS_SEMESTER_SBERT_FLOOR
    elif sbert_row is not None:
        sbert_leg_floor_ok = float(sbert_row[2]) >= PREVIOUS_SEMESTER_SBERT_FLOOR

    if same_max >= SAME_SEMESTER_REJECT:
        verdict = "reject_same_semester"
    elif same_max >= SAME_SEMESTER_FLAG and same_i is not None:
        # Similar topic / wording — teacher decides; student is not auto-blocked.
        verdict = "flag_same_semester"
    elif leg_max >= PREVIOUS_SEMESTER_WARN and (sbert_row is None or sbert_leg_floor_ok) and leg_i is not None:
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
            f"reject_at={SAME_SEMESTER_REJECT:.2f}, flag_at={SAME_SEMESTER_FLAG:.2f}, "
            f"warn_at={PREVIOUS_SEMESTER_WARN:.2f}, "
            f"sbert_floor={PREVIOUS_SEMESTER_SBERT_FLOOR:.2f}, "
            f"domain_min={LEGACY_DOMAIN_TITLE_MIN:.2f}, same_domain_min={SAME_SEMESTER_DOMAIN_MIN:.2f}"
        ),
        "backend": backend,
    }
