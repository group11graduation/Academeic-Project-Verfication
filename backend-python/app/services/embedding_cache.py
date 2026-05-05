"""
Persistent embedding cache — SQLite (+ optional Redis) so SBERT encode skips repeated texts.

Optimization: proposals/reference docs repeat across submissions; hashing normalized text + model id
gives a stable key; vectors are stored as raw float32 bytes for compact IO.
"""

from __future__ import annotations

import hashlib
import logging
import sqlite3
import threading
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np

from app.config.settings import settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_redis = None
_redis_warned = False
_sqlite_lock = threading.Lock()


def _redis_client():
    global _redis, _redis_warned
    url = (settings.redis_url or "").strip()
    if not url:
        return None
    if _redis is False:
        return None
    if _redis is not None:
        return _redis
    try:
        import redis as redis_lib

        _redis = redis_lib.Redis.from_url(url, decode_responses=False)
        _redis.ping()
        logger.info("Embedding Redis cache enabled")
        return _redis
    except Exception as e:
        if not _redis_warned:
            logger.warning("Redis unavailable (%s); SQLite embedding cache only", e)
            _redis_warned = True
        _redis = False
        return None


def _sqlite_conn() -> sqlite3.Connection:
    db_path = Path(settings.embedding_cache_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS embeddings (
            key TEXT PRIMARY KEY,
            dim INTEGER NOT NULL,
            data BLOB NOT NULL,
            model TEXT NOT NULL
        )
        """
    )
    return conn


_sqlite: sqlite3.Connection | None = None


def _conn() -> sqlite3.Connection:
    global _sqlite
    if _sqlite is None:
        _sqlite = _sqlite_conn()
    return _sqlite


def embedding_cache_key(normalized_text: str, model_name: str) -> str:
    """Stable hash over model + normalized payload (same logical doc ⇒ same key)."""
    h = hashlib.sha256()
    h.update(model_name.encode("utf-8"))
    h.update(b"\0")
    h.update(normalized_text.encode("utf-8"))
    return h.hexdigest()


def get_embedding(normalized_text: str, model_name: str, dim_expected: int | None = None) -> np.ndarray | None:
    """
    Return cached vector float32 shape (dim,) or None.
    dim_expected: if set, mismatched rows are ignored (model upgrade safety).
    """
    key = embedding_cache_key(normalized_text, model_name)
    rc = _redis_client()
    if rc:
        try:
            blob = rc.get(f"emb:{key}")
            if blob:
                arr = np.frombuffer(blob, dtype=np.float32)
                if dim_expected is not None and arr.shape[0] != dim_expected:
                    return None
                return arr.copy()
        except Exception as e:
            logger.debug("redis get_embedding failed: %s", e)

    with _sqlite_lock:
        row = _conn().execute(
            "SELECT dim, data, model FROM embeddings WHERE key = ?", (key,)
        ).fetchone()
    if not row:
        return None
    dim, blob, _stored_model = row
    arr = np.frombuffer(blob, dtype=np.float32)
    if arr.shape[0] != dim:
        return None
    if dim_expected is not None and dim != dim_expected:
        return None
    return arr.copy()


def save_embedding(normalized_text: str, model_name: str, embedding: np.ndarray) -> None:
    """Persist float32 vector; normalized embedding recommended (cosine-ready)."""
    vec = np.asarray(embedding, dtype=np.float32).reshape(-1)
    key = embedding_cache_key(normalized_text, model_name)
    blob = vec.tobytes()
    dim = vec.shape[0]

    rc = _redis_client()
    if rc:
        try:
            rc.set(f"emb:{key}", blob)
        except Exception as e:
            logger.debug("redis save_embedding failed: %s", e)

    with _sqlite_lock:
        _conn().execute(
            """
            INSERT INTO embeddings(key, dim, data, model)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET dim = excluded.dim, data = excluded.data, model = excluded.model
            """,
            (key, dim, blob, model_name),
        )
        _conn().commit()


def get_embeddings_batched(
    normalized_texts: list[str],
    model_name: str,
    encode_fn,
    *,
    dim_hint: int | None = None,
) -> np.ndarray:
    """
    Assemble an embedding matrix in row order, calling encode_fn( missing_texts ) once per batch.

    encode_fn: callable(list[str]) -> np.ndarray with shape (k, dim)
    Thread-safe when encode_fn holds the model lock internally.
    """
    if not normalized_texts:
        return np.zeros((0, dim_hint or 0), dtype=np.float32)

    cached: list[np.ndarray | None] = []
    missing_idx: list[int] = []
    missing_texts: list[str] = []

    for i, t in enumerate(normalized_texts):
        hit = get_embedding(t, model_name, dim_expected=dim_hint)
        cached.append(hit)
        if hit is None:
            missing_idx.append(i)
            missing_texts.append(t)

    if not missing_idx:
        return np.stack(cached, axis=0).astype(np.float32, copy=False)

    fresh = encode_fn(missing_texts)
    fresh = np.asarray(fresh, dtype=np.float32)
    for row_i, orig_i in enumerate(missing_idx):
        vec = fresh[row_i]
        txt = missing_texts[row_i]
        save_embedding(txt, model_name, vec)
        cached[orig_i] = vec

    return np.stack(cached, axis=0).astype(np.float32, copy=False)
