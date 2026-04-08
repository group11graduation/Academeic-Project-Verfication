"""
Code similarity: structure-aware fingerprints via tree-sitter + cosine on token strings.

Optional: CodeBERT (microsoft/codebert-base) mean-pooled embeddings when CODEBERT_ENABLED=true.

Use cases: plagiarism-style checks between student submission and reference snippets.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import numpy as np

from app.models.schemas import CodeAnalyzeIn, CodeReferenceItem
from app.preprocessing.code_ast import extract_code_fingerprint

logger = logging.getLogger(__name__)

CODE_WARN_THRESHOLD = float(os.getenv("CODE_SIMILARITY_WARN_THRESHOLD", "0.85"))
CODEBERT_ENABLED = os.getenv("CODEBERT_ENABLED", "false").lower() in ("1", "true", "yes")
CODEBERT_MODEL = os.getenv("CODEBERT_MODEL", "microsoft/codebert-base")

_codebert_tokenizer = None
_codebert_model = None


def _get_codebert():
    global _codebert_tokenizer, _codebert_model
    if _codebert_model is None:
        from transformers import AutoModel, AutoTokenizer

        _codebert_tokenizer = AutoTokenizer.from_pretrained(CODEBERT_MODEL)
        _codebert_model = AutoModel.from_pretrained(CODEBERT_MODEL)
        _codebert_model.eval()
    return _codebert_tokenizer, _codebert_model


def _embed_codebert(text: str) -> np.ndarray:
    import torch

    tok, model = _get_codebert()
    inputs = tok(text, return_tensors="pt", truncation=True, max_length=512, padding=True)
    with torch.no_grad():
        out = model(**inputs)
        h = out.last_hidden_state
        mask = inputs["attention_mask"].unsqueeze(-1)
        summed = (h * mask).sum(dim=1)
        counts = mask.sum(dim=1).clamp(min=1e-9)
        vec = (summed / counts).squeeze(0).numpy()
    n = np.linalg.norm(vec) or 1.0
    return vec / n


def _tfidf_cosine_max(query_fp: str, refs: list[str]) -> tuple[float, int | None]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    if not refs:
        return 0.0, None
    vec = TfidfVectorizer(min_df=1)
    mat = vec.fit_transform([query_fp] + refs)
    sims = cosine_similarity(mat[0:1], mat[1:])[0]
    idx = int(np.argmax(sims))
    return float(sims[idx]), idx


def _normalize_refs(body: CodeAnalyzeIn, lang: str) -> tuple[list[str], list[str], list[str]]:
    """Fingerprints, raw texts, ids."""
    fps, texts, ids = [], [], []
    for r in body.references:
        item = r if isinstance(r, CodeReferenceItem) else CodeReferenceItem.model_validate(r)
        texts.append(item.text)
        fps.append(extract_code_fingerprint(item.text, language=item.language or lang))
        ids.append(item.id or "")
    return fps, texts, ids


def analyze_code_similarity(body: CodeAnalyzeIn) -> dict[str, Any]:
    lang = body.language or "python"
    q_fp = extract_code_fingerprint(body.source, language=lang)

    if not body.references:
        return {
            "max_similarity": 0.0,
            "matched_id": None,
            "method": "fallback_char",
            "warning": False,
            "detail": "no reference snippets provided",
        }

    ref_fps, ref_texts, ref_ids = _normalize_refs(body, lang)

    max_sim = 0.0
    matched_idx: int | None = None
    method = "tree_sitter_tfidf"

    if CODEBERT_ENABLED:
        try:
            qv = _embed_codebert(body.source[:12000])
            sims = []
            for t in ref_texts:
                rv = _embed_codebert(t[:12000])
                sims.append(float(np.dot(qv, rv)))
            sims_arr = np.array(sims)
            matched_idx = int(np.argmax(sims_arr))
            max_sim = float(sims_arr[matched_idx])
            method = "codebert"
        except Exception as e:
            logger.warning("CodeBERT path failed (%s); using tree-sitter + TF-IDF", e)

    if method != "codebert":
        max_sim, matched_idx = _tfidf_cosine_max(q_fp, ref_fps)

    matched_id = ref_ids[matched_idx] if matched_idx is not None and matched_idx < len(ref_ids) else None
    if matched_id == "":
        matched_id = None

    warning = max_sim >= CODE_WARN_THRESHOLD

    return {
        "max_similarity": max_sim,
        "matched_id": matched_id,
        "method": method,
        "warning": warning,
        "detail": f"threshold_warn={CODE_WARN_THRESHOLD}, fingerprint_len={len(q_fp)}",
    }
