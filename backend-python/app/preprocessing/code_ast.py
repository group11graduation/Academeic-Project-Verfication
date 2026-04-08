"""
Extract structure-preserving text from source code using tree-sitter.

Falls back to whitespace-tokenized source if grammars are unavailable.

Output is a normalized token string suitable for TF-IDF or embedding models.
"""

from __future__ import annotations

import re
from typing import Callable

# Lazy parser factory: set on first successful import
_get_parser: Callable[[str], object] | None = None


def _init_tree_sitter() -> Callable[[str], object] | None:
    """Try tree-sitter-languages (bundles many grammars)."""
    global _get_parser
    if _get_parser is not None:
        return _get_parser
    try:
        from tree_sitter_languages import get_parser  # type: ignore

        def factory(lang: str):
            return get_parser(lang)

        _get_parser = factory
        return factory
    except ImportError:
        return None


def _walk_collect_identifiers(node, source: bytes, out: list[str]) -> None:
    """DFS: collect identifier and string literal leaf text."""
    if node.child_count == 0:
        t = node.type
        if t in ("identifier", "property_identifier", "shorthand_property_identifier"):
            txt = source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")
            if txt.strip():
                out.append(txt)
        elif "string" in t or t in ("string", "string_fragment"):
            raw = source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")
            if len(raw) > 2 and len(raw) < 500:
                out.append(raw[:200])
    else:
        for i in range(node.child_count):
            _walk_collect_identifiers(node.child(i), source, out)


def extract_code_fingerprint(source: str, language: str = "python") -> str:
    """
    Build a whitespace-separated fingerprint of identifiers/strings from AST.

    `language` is passed to tree-sitter-languages (e.g. python, javascript, java).
    """
    src = source.replace("\r\n", "\n")
    data = src.encode("utf-8")
    init = _init_tree_sitter()
    if init:
        try:
            parser = init(language)
            tree = parser.parse(data)
            tokens: list[str] = []
            _walk_collect_identifiers(tree.root_node, data, tokens)
            if tokens:
                return " ".join(tokens).lower()
        except Exception:
            pass
    # Fallback: alnum + underscore tokens
    return " ".join(re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", src)).lower()
