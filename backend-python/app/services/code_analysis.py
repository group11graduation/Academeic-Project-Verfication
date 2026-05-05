"""
Code similarity: two-stage token gate + AST fingerprints; optional CodeBERT on gated refs.

Optimization: tree-sitter walks only run when lexical overlap suggests risk (token TF-IDF > gate).

Final score combines stages: 0.4 * token + 0.6 * ast when AST runs; otherwise token score alone.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import numpy as np

from app.config.settings import settings
from app.models.schemas import CodeAnalyzeIn, CodeReferenceItem
from app.preprocessing.code_ast import extract_code_fingerprint
from app.preprocessing.code_tokens import extract_code_token_fingerprint
from app.services.ml_threading import TORCH_MODEL_LOCK

logger = logging.getLogger(__name__)

CODE_WARN_THRESHOLD = float(os.getenv("CODE_SIMILARITY_WARN_THRESHOLD", "0.85"))
CODEBERT_ENABLED = os.getenv("CODEBERT_ENABLED", "false").lower() in ("1", "true", "yes")
CODEBERT_MODEL = os.getenv("CODEBERT_MODEL", "microsoft/codebert-base")

AST_GATE = settings.code_ast_gate_threshold
W_TOKEN = settings.code_token_weight
W_AST = settings.code_ast_weight

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

    with TORCH_MODEL_LOCK:
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


def _tfidf_cosine_row(query: str, corpus: list[str]) -> np.ndarray:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    if not corpus:
        return np.array([])
    vec = TfidfVectorizer(min_df=1)
    mat = vec.fit_transform([query] + corpus)
    sims = cosine_similarity(mat[0:1], mat[1:])[0]
    return np.asarray(sims, dtype=np.float64)


def _normalize_refs_tokens(body: CodeAnalyzeIn, lang: str) -> tuple[list[str], list[str], list[str]]:
    """token fingerprints, raw texts, ids (AST deferred until gate passes)."""
    t_fps, texts, ids = [], [], []
    for r in body.references:
        item = r if isinstance(r, CodeReferenceItem) else CodeReferenceItem.model_validate(r)
        texts.append(item.text)
        t_fps.append(extract_code_token_fingerprint(item.text))
        ids.append(item.id or "")
    return t_fps, texts, ids


def analyze_code_similarity(body: CodeAnalyzeIn) -> dict[str, Any]:
    t0 = time.perf_counter()
    lang = body.language or "python"
    q_tok = extract_code_token_fingerprint(body.source)

    if not body.references:
        return {
            "max_similarity": 0.0,
            "matched_id": None,
            "method": "fallback_char",
            "warning": False,
            "detail": "no reference snippets provided",
        }

    ref_tok, ref_texts, ref_ids = _normalize_refs_tokens(body, lang)
    token_sims = _tfidf_cosine_row(q_tok, ref_tok)

    gated_indices = [i for i in range(len(ref_texts)) if float(token_sims[i]) > AST_GATE]
    ast_sims_partial: dict[int, float] = {}
    if gated_indices:
        q_ast = extract_code_fingerprint(body.source, language=lang)
        gated_fps = [extract_code_fingerprint(ref_texts[i], language=lang) for i in gated_indices]
        row = _tfidf_cosine_row(q_ast, gated_fps)
        for j, idx in enumerate(gated_indices):
            ast_sims_partial[idx] = float(row[j])
        fp_len = len(q_ast)
    else:
        q_ast = ""
        fp_len = 0

    combined = np.zeros_like(token_sims)
    ast_ran = 0
    for i in range(len(ref_tok)):
        ts = float(token_sims[i])
        if i in ast_sims_partial:
            combined[i] = W_TOKEN * ts + W_AST * ast_sims_partial[i]
            ast_ran += 1
        else:
            combined[i] = ts

    max_sim = float(np.max(combined)) if combined.size else 0.0
    matched_idx = int(np.argmax(combined)) if combined.size else None

    method = "two_stage_token_ast"
    t_codebert_start = time.perf_counter()

    if CODEBERT_ENABLED:
        try:
            cb_targets = gated_indices if gated_indices else list(range(len(ref_texts)))
            qv = _embed_codebert(body.source[:12000])
            sims_cb = []
            for i in cb_targets:
                rv = _embed_codebert(ref_texts[i][:12000])
                sims_cb.append((i, float(np.dot(qv, rv))))
            best_i, best_v = max(sims_cb, key=lambda x: x[1])
            if best_v >= max_sim:
                max_sim = best_v
                matched_idx = best_i
            method = "codebert"
        except Exception as e:
            logger.warning("CodeBERT path failed (%s); keeping two-stage TF-IDF scores", e)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    cb_ms = (time.perf_counter() - t_codebert_start) * 1000 if CODEBERT_ENABLED else 0.0
    logger.info(
        "code_analysis timing total_ms=%.1f codebert_ms=%.1f refs=%s ast_gate=%s ast_ran=%s combined_max=%.4f",
        elapsed_ms,
        cb_ms,
        len(ref_texts),
        AST_GATE,
        ast_ran,
        max_sim,
    )

    matched_id = ref_ids[matched_idx] if matched_idx is not None and matched_idx < len(ref_ids) else None
    if matched_id == "":
        matched_id = None

    warning = max_sim >= CODE_WARN_THRESHOLD

    return {
        "max_similarity": max_sim,
        "matched_id": matched_id,
        "method": method,
        "warning": warning,
        "detail": (
            f"threshold_warn={CODE_WARN_THRESHOLD}, ast_gate={AST_GATE}, "
            f"ast_comparisons={ast_ran}/{len(ref_tok)}, fingerprint_len={fp_len}"
        ),
    }
