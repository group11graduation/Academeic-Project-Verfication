"""
SQLite-backed job records for async analysis (BackgroundTasks worker completion).

Keeps API responsive while SBERT / AST work finishes; clients poll GET /analysis-result/{id}.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Literal

from app.config.settings import settings

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None

JobKind = Literal["proposal", "code", "screenshot", "full"]
JobStatus = Literal["processing", "completed", "failed"]


def _connect() -> sqlite3.Connection:
    path = Path(settings.analysis_jobs_db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(path), check_same_thread=False)
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS analysis_jobs (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            status TEXT NOT NULL,
            result_json TEXT,
            error TEXT,
            created REAL NOT NULL,
            updated REAL NOT NULL
        )
        """
    )
    return c


def conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = _connect()
    return _conn


def create_job(kind: JobKind) -> str:
    jid = str(uuid.uuid4())
    now = time.time()
    with _lock:
        conn().execute(
            """
            INSERT INTO analysis_jobs (id, kind, status, result_json, error, created, updated)
            VALUES (?, ?, 'processing', NULL, NULL, ?, ?)
            """,
            (jid, kind, now, now),
        )
        conn().commit()
    return jid


def mark_completed(job_id: str, result: dict[str, Any]) -> None:
    now = time.time()
    payload = json.dumps(result)
    with _lock:
        conn().execute(
            """
            UPDATE analysis_jobs SET status = 'completed', result_json = ?, error = NULL, updated = ?
            WHERE id = ?
            """,
            (payload, now, job_id),
        )
        conn().commit()


def mark_failed(job_id: str, message: str) -> None:
    now = time.time()
    with _lock:
        conn().execute(
            """
            UPDATE analysis_jobs SET status = 'failed', error = ?, updated = ?
            WHERE id = ?
            """,
            (message[:8000], now, job_id),
        )
        conn().commit()


def get_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        row = conn().execute(
            "SELECT id, kind, status, result_json, error FROM analysis_jobs WHERE id = ?",
            (job_id,),
        ).fetchone()
    if not row:
        return None
    _id, kind, status, result_json, error = row
    out: dict[str, Any] = {"id": _id, "kind": kind, "status": status, "error": error}
    if result_json:
        try:
            out["result"] = json.loads(result_json)
        except json.JSONDecodeError:
            out["result"] = None
    else:
        out["result"] = None
    return out
