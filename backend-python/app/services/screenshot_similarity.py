"""
Screenshot / UI duplicate warning using perceptual hashing (Pillow + ImageHash).

Compares a new screenshot’s phash to previously stored hex hashes (e.g. from last year’s reports).
Low Hamming distance ⇒ visually similar ⇒ optional academic-integrity flag.
"""

from __future__ import annotations

import logging
from typing import Any

import imagehash

from app.models.schemas import ScreenshotAnalyzeIn
from app.preprocessing.image_prep import load_image_from_base64

logger = logging.getLogger(__name__)


def analyze_screenshot_similarity(body: ScreenshotAnalyzeIn) -> dict[str, Any]:
    im = load_image_from_base64(body.image_base64)
    cur = imagehash.phash(im)
    hex_str = str(cur)

    best_match: str | None = None
    min_dist: int | None = None

    for ref_hex in body.reference_hashes:
        if not ref_hex or not ref_hex.strip():
            continue
        try:
            try:
                other = imagehash.hex_to_hash(ref_hex.strip(), hash_size=8)
            except TypeError:
                other = imagehash.hex_to_hash(ref_hex.strip())
            dist = cur - other
            if min_dist is None or dist < min_dist:
                min_dist = dist
                best_match = ref_hex.strip()
        except Exception as e:
            logger.debug("skip bad reference hash: %s", e)
            continue

    warn = min_dist is not None and min_dist <= body.hamming_threshold
    msg = (
        f"Closest prior screenshot Hamming distance={min_dist} (threshold={body.hamming_threshold})"
        if min_dist is not None
        else "No reference hashes to compare"
    )

    return {
        "phash_hex": hex_str,
        "best_match_hash": best_match,
        "min_hamming_distance": min_dist,
        "warning": warn,
        "message": msg,
    }
