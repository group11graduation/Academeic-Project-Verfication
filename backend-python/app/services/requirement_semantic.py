"""
Semantic requirement check: teacher requirement paragraphs vs student proposal text.

Uses the same MiniLM sentence-transformer + cosine similarity as plagiarism detection.
Rejects casual / conversational text and any insufficient match (including former
"borderline" scores). Only a clear pass continues; mismatches are never sent as review-pass.
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
# MiniLM alone often scores ~0.25–0.45 for good paraphrases of requirements.
# Scores below PASS_AT (or missing required tech context): hard reject.
# Scores at/above PASS_AT with required tech clearly described: pass.
# Scores at/above PASS: automatic clear for requirements.
REQUIREMENT_REJECT_BELOW = float(os.getenv("AI_REQUIREMENT_REJECT_BELOW", "0.28"))
REQUIREMENT_PASS_AT = float(os.getenv("AI_REQUIREMENT_PASS_AT", "0.45"))
MIN_PROPOSAL_CHARS = int(os.getenv("AI_REQUIREMENT_MIN_PROPOSAL_CHARS", "80"))
MIN_REQUIREMENT_CHARS = int(os.getenv("AI_REQUIREMENT_MIN_REQ_CHARS", "20"))
MAX_TEXT_CHARS = int(os.getenv("AI_MAX_TEXT_CHARS", "3500"))
TECH_CONTEXT_PASS = float(os.getenv("AI_REQUIREMENT_TECH_CONTEXT_PASS", "0.42"))
# When all required techs appear in real project sentences, lift the floor so
# MiniLM paraphrase gaps do not auto-reject otherwise solid proposals.
TECH_CLEAR_SCORE_FLOOR = float(os.getenv("AI_REQUIREMENT_TECH_CLEAR_FLOOR", "0.40"))
USE_REQUIREMENT_HYBRID = os.getenv("AI_REQUIREMENT_HYBRID", "true").lower() in ("1", "true", "yes")

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
    "php": (
        "This project is implemented with native PHP on the server side, "
        "using procedural or object-oriented PHP for the backend."
    ),
    "mysql": (
        "This project stores data in a MySQL relational database "
        "accessed with PDO or SQL queries."
    ),
    "postgresql": "This project uses PostgreSQL as its database.",
    "mongodb": "This project uses MongoDB as a NoSQL database.",
    "node.js": "This project uses Node.js for the backend runtime.",
    "react": "This project builds the user interface with React.",
    "flutter": "This project is a Flutter mobile application.",
    "java": "This project is written in Java.",
    "python": "This project is implemented in Python.",
    "laravel": "This project uses the Laravel PHP framework.",
    "spring boot": "This project uses Spring Boot for the Java backend.",
    "thymeleaf": "This project renders server-side HTML pages with the Thymeleaf template engine.",
    "django": "This project uses the Django Python framework.",
}

# Alternate spellings / stack tokens that count as mentioning a required technology.
_TECH_ALIASES: dict[str, list[str]] = {
    "php": [r"\bphp\b", r"\bpdo\b", r"\blaravel\b"],
    "mysql": [r"\bmysql\b", r"\bmariadb\b", r"\bpdo\b"],
    "postgresql": [r"\bpostgresql\b", r"\bpostgres\b"],
    "mongodb": [r"\bmongodb\b", r"\bmongo\b"],
    "node.js": [r"\bnode\.?js\b", r"\bnodejs\b", r"\bexpress\b"],
    "react": [r"\breact\b", r"\breact\.?js\b"],
    "flutter": [r"\bflutter\b", r"\bdart\b"],
    "java": [r"\bjava\b", r"\bspring\b"],
    "python": [r"\bpython\b", r"\bdjango\b", r"\bflask\b"],
    "laravel": [r"\blaravel\b", r"\bphp\b"],
    "spring boot": [r"\bspring\s*boot\b", r"\bspring\b"],
    "thymeleaf": [r"\bthymeleaf\b"],
    "django": [r"\bdjango\b", r"\bpython\b"],
}

# Nearby wording that shows the tech is used in a real project (not a bare keyword list).
_TECH_CONTEXT_CUES = re.compile(
    r"\b("
    r"implement(?:ed|s|ing)?|built|build|using|uses|used|with|via|"
    r"database|server(?:-side)?|backend|frontend|application|engineered|"
    r"develop(?:ed|s|ing)?|stor(?:e|es|ed|ing)|relational|session|"
    r"api|framework|native|procedural|object-?oriented|multi-?tenant|"
    r"query|queries|pdo|orm|mvc"
    r")\b",
    re.IGNORECASE,
)

# Teacher wording like "PostgreSQL or MySQL" / "Java / Spring Boot" → any one satisfies.
_TECH_OR_GROUPS: list[frozenset[str]] = [
    frozenset({"mysql", "postgresql"}),
    frozenset({"java", "spring boot", "thymeleaf"}),
    frozenset({"php", "laravel"}),
    frozenset({"python", "django"}),
]


def _required_tech_groups(required_technologies: list[str]) -> list[list[str]]:
    required = {str(t).strip().lower() for t in (required_technologies or []) if str(t).strip()}
    if not required:
        return []
    groups: list[list[str]] = []
    consumed: set[str] = set()
    for or_group in _TECH_OR_GROUPS:
        hit = sorted(t for t in or_group if t in required)
        if hit:
            groups.append(hit)
            consumed.update(hit)
    for tech in sorted(required):
        if tech not in consumed:
            groups.append([tech])
    return groups


def _format_tech_group(group: list[str]) -> str:
    return " or ".join(group) if len(group) > 1 else (group[0] if group else "")


def _tech_alias_patterns(tech: str) -> list[re.Pattern[str]]:
    key = str(tech or "").strip().lower()
    raw = _TECH_ALIASES.get(key) or [rf"\b{re.escape(key)}\b"]
    return [re.compile(p, re.IGNORECASE) for p in raw]


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text or "")
    out = []
    for p in parts:
        s = " ".join(str(p).split()).strip()
        if len(s) >= 12:
            out.append(s)
    return out[:40]


def _tech_local_windows(proposal: str, tech: str) -> list[str]:
    """Sentences / short windows that mention the technology."""
    patterns = _tech_alias_patterns(tech)
    windows: list[str] = []
    for sent in _sentences(proposal):
        if any(p.search(sent) for p in patterns):
            windows.append(sent)
    if windows:
        return windows[:8]
    # Fallback: sliding character window around first alias hit.
    for pat in patterns:
        m = pat.search(proposal or "")
        if not m:
            continue
        start = max(0, m.start() - 80)
        end = min(len(proposal), m.end() + 120)
        chunk = " ".join(proposal[start:end].split()).strip()
        if chunk:
            windows.append(chunk)
            break
    return windows[:8]


def _lexical_tech_context_ok(proposal: str, tech: str) -> bool:
    """
    True when the tech appears with real project wording nearby
    (e.g. 'implemented with native PHP' / 'MySQL relational database').
    """
    windows = _tech_local_windows(proposal, tech)
    if not windows:
        return False
    for w in windows:
        if len(w) >= 28 and _TECH_CONTEXT_CUES.search(w):
            return True
    return False


def _local_tech_semantic_score(proposal: str, tech: str) -> float:
    """Cosine of the tech probe against local windows that mention the tech."""
    windows = _tech_local_windows(proposal, tech)
    if not windows:
        return 0.0
    probe = _TECH_PROBES.get(tech) or f"This project uses {tech} as a core technology."
    vectors = _encode_normalized([_clip(probe), *[_clip(w) for w in windows]])
    if vectors.size == 0:
        return 0.0
    probe_vec = vectors[0]
    best = 0.0
    for i in range(1, len(vectors)):
        best = max(best, _cosine(probe_vec, vectors[i]))
    return float(best)


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


_STOP = {
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "is", "are",
    "this", "that", "it", "as", "by", "be", "will", "can", "must", "should", "from",
}


def _tokens(text: str) -> set[str]:
    return {
        t
        for t in re.findall(r"[a-z0-9][a-z0-9.+#-]*", (text or "").lower())
        if len(t) > 1 and t not in _STOP
    }


def _token_jaccard(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    return float(len(ta & tb) / len(ta | tb))


def _max_tfidf_cosine(query: str, docs: list[str]) -> float:
    if not docs:
        return 0.0
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except Exception:
        return 0.0
    try:
        vec = TfidfVectorizer(min_df=1)
        mat = vec.fit_transform([query, *docs])
        sims = cosine_similarity(mat[0:1], mat[1:])[0]
        return float(np.max(sims)) if len(sims) else 0.0
    except Exception:
        return 0.0


def _hybrid_requirement_overlap(proposal: str, teacher_chunks: list[str]) -> float:
    """
    Max of MiniLM cosine, TF-IDF, and token Jaccard so paraphrased but on-topic
    proposals are not crushed by embedding-only scores (~0.18 false rejects).
    """
    if not teacher_chunks:
        return 0.0
    scores: list[float] = []
    for chunk in teacher_chunks:
        scores.append(_token_jaccard(proposal, chunk))
    if USE_REQUIREMENT_HYBRID:
        scores.append(_max_tfidf_cosine(proposal, teacher_chunks))
        # Also TF-IDF of proposal vs each chunk individually already covered above.
    return float(max(scores)) if scores else 0.0


def analyze_requirement_semantic(body: Any) -> dict[str, Any]:
    """
    Compare full teacher requirement text to full student proposal text.

    Verdicts:
      - reject: does not meet requirements (low similarity, missing tech, or borderline)
      - pass: clearly addresses the requirements in meaning (and required tech in context)
      - review: unused for mismatches (Node also maps any non-pass to reject)
    """
    requirement_text = _clip(getattr(body, "requirement_text", "") or "")
    proposal_text = _clip(getattr(body, "proposal_text", "") or "")
    required_technologies = [
        str(t).strip().lower()
        for t in (getattr(body, "required_technologies", None) or [])
        if str(t).strip()
    ]
    strict_tech = bool(getattr(body, "strict_tech_requirements", False))
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

    # Hybrid lexical/TF-IDF lift — MiniLM alone often under-scores valid paraphrases.
    hybrid = _hybrid_requirement_overlap(proposal_text, teacher_chunks)
    if hybrid > combined:
        reasons.append(f"hybrid_overlap_lift:{hybrid:.3f}")
    combined = max(combined, hybrid)

    # Technology-in-context: lexical cues + local semantic probes (not full-doc only).
    # Full-document probe alone often missed clear lines like "native PHP" / "MySQL via PDO".
    # OR-groups: "PostgreSQL or MySQL" / "Java or Spring Boot" — any member is enough.
    tech_context_score = 1.0
    missing_tech_context: list[str] = []
    all_tech_lexical_ok = True
    tech_ok: dict[str, bool] = {}
    if required_technologies:
        tech_scores = []
        for tech in required_technologies:
            probe = _TECH_PROBES.get(tech) or f"This project uses {tech} as a core technology."
            probe_vec = _encode_normalized([_clip(probe)])[0]
            full_score = _cosine(probe_vec, proposal_full_vec)
            local_score = _local_tech_semantic_score(proposal_text, tech)
            lexical_ok = _lexical_tech_context_ok(proposal_text, tech)
            score = max(full_score, local_score)
            if lexical_ok:
                # Clear in-context mention → treat as meeting the tech-context bar.
                score = max(score, TECH_CONTEXT_PASS)
            ok = score >= TECH_CONTEXT_PASS or lexical_ok
            tech_ok[tech] = ok
            tech_scores.append(score)
            if not ok:
                all_tech_lexical_ok = False
        tech_context_score = float(min(tech_scores)) if tech_scores else 1.0

        for group in _required_tech_groups(list(required_technologies)):
            if any(tech_ok.get(t, False) for t in group):
                continue
            missing_tech_context.append(_format_tech_group(group))

        if missing_tech_context:
            reasons.append("missing_tech_context:" + ",".join(missing_tech_context))
            all_tech_lexical_ok = False
        else:
            reasons.append("tech_context_clear")
            all_tech_lexical_ok = True
            # Substantial proposal + clear required stack → do not auto-reject on MiniLM paraphrase gap.
            if len(proposal_text) >= 120:
                if combined < TECH_CLEAR_SCORE_FLOOR:
                    reasons.append("tech_clear_score_floor")
                combined = max(combined, TECH_CLEAR_SCORE_FLOOR)
    else:
        all_tech_lexical_ok = True

    if "conversational_filler" in reasons and combined < REQUIREMENT_PASS_AT:
        combined = min(combined, REQUIREMENT_REJECT_BELOW - 0.01)
        reasons.append("casual_english_not_addressing_requirements")

    # Policy:
    # - Missing a required tech *family* (e.g. React, or Spring Boot/Java) → reject
    # - Required stack clearly present + real write-up → pass (even if MiniLM is a bit low)
    # - Otherwise use similarity thresholds
    substantial = len(proposal_text) >= 160 and not _is_keyword_only_shell(
        proposal_text, required_technologies or []
    )
    if missing_tech_context and combined < REQUIREMENT_PASS_AT and not substantial:
        combined = min(combined, REQUIREMENT_REJECT_BELOW - 0.01)

    stack_clear = bool(required_technologies) and not missing_tech_context and all_tech_lexical_ok
    force_pass_stack = stack_clear and substantial and combined >= TECH_CLEAR_SCORE_FLOOR

    if missing_tech_context and not force_pass_stack:
        verdict = "reject"
        summary = (
            f"Rejected automatically: the proposal does not clearly use the required technology stack "
            f"(similarity {combined:.2f}). Missing clear use of: {', '.join(missing_tech_context)}. "
            f"Rewrite the proposal so it names and explains each required technology from the teacher file."
        )
        reasons.append("missing_tech_context_reject")
    elif force_pass_stack or combined >= REQUIREMENT_PASS_AT:
        verdict = "pass"
        summary = (
            f"Proposal meaningfully addresses teacher requirements (similarity {combined:.2f})."
        )
        if required_technologies:
            summary = (
                f"Proposal meaningfully addresses teacher requirements (similarity {combined:.2f}) "
                f"and clearly describes required technologies: {', '.join(required_technologies)}."
            )
    elif combined < REQUIREMENT_REJECT_BELOW:
        verdict = "reject"
        summary = (
            f"Rejected automatically: the proposal does not meaningfully match the teacher requirements "
            f"(similarity {combined:.2f}). Casual English, unrelated text, or only naming technologies "
            f"without explaining the project is not accepted. Rewrite the proposal so it clearly addresses "
            f"the assignment requirements in your own words."
        )
    else:
        # Borderline similarity but stack not clearly evidenced → reject
        verdict = "reject"
        summary = (
            f"Rejected automatically: requirement match is insufficient (similarity {combined:.2f}). "
            f"The proposal must clearly and fully meet the teacher requirements."
        )
        reasons.append("insufficient_similarity")

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
