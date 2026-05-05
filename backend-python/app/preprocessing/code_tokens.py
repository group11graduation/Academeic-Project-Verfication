"""
Fast token-level code fingerprint (regex identifiers) — stage-1 gate before tree-sitter AST work.

Optimization: skip expensive AST parsing when token overlap with a reference is already low.
"""

from __future__ import annotations

import re


_TOKEN_RE = re.compile(r"[a-zA-Z_][a-zA-Z0-9_]*")


def extract_code_token_fingerprint(source: str) -> str:
    """Whitespace-separated lowercased identifiers — aligns with AST fallback tokenization style."""
    src = source.replace("\r\n", "\n")
    return " ".join(_TOKEN_RE.findall(src)).lower()
