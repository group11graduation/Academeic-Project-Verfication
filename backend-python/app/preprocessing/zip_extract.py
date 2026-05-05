"""
Safe ZIP extraction with dependency/build-folder skips and byte limits.

Use when the Python service unpacks archives (Node preview sandbox has parallel logic).
Ignored path segments: node_modules, .git, dist (case-insensitive match on segment names).
"""

from __future__ import annotations

import logging
import zipfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Optimization: never traverse bulky or non-source trees inside student archives.
SKIP_DIR_NAMES = frozenset(
    {
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        "__pycache__",
        ".venv",
        "venv",
        "target",
    }
)


class ZipExtractLimitsExceeded(Exception):
    pass


def should_skip_zip_member(name: str) -> bool:
    """Return True if any path segment is in SKIP_DIR_NAMES."""
    parts = Path(name.replace("\\", "/")).parts
    for p in parts:
        if p.lower() in SKIP_DIR_NAMES:
            return True
    return False


def safe_extract_zip(
    zip_path: str | Path,
    dest_dir: str | Path,
    *,
    max_total_bytes: int = 52_428_800,
    max_file_count: int = 500,
) -> int:
    """
    Extract members under dest_dir; returns number of files written.

    Raises ZipExtractLimitsExceeded if archive exceeds configured limits.
    """
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    n_files = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        members = zf.infolist()
        if len(members) > max_file_count:
            raise ZipExtractLimitsExceeded(f"Too many zip entries: {len(members)} > {max_file_count}")

        for info in members:
            if info.is_dir():
                continue
            name = info.filename
            if should_skip_zip_member(name):
                logger.debug("skip zip member (ignored path): %s", name)
                continue

            target = (dest / name).resolve()
            if not str(target).startswith(str(dest.resolve())):
                continue

            data = zf.read(info)
            total_bytes += len(data)
            if total_bytes > max_total_bytes:
                raise ZipExtractLimitsExceeded(f"Zip uncompressed size exceeds {max_total_bytes} bytes")

            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            n_files += 1

    return n_files
