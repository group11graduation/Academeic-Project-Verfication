"""
Image loading and normalization before perceptual hashing.

Pillow decodes many formats; we resize large images to cap work for hashing.
"""

from __future__ import annotations

import base64
import io
from typing import BinaryIO

from PIL import Image


MAX_DIMENSION = 1024


def load_image_from_base64(b64: str) -> Image.Image:
    """Decode data URL or raw base64 into RGB image."""
    raw = b64.strip()
    if "," in raw and raw.lower().startswith("data:"):
        raw = raw.split(",", 1)[1]
    data = base64.b64decode(raw)
    return load_image_from_bytes(data)


def load_image_from_bytes(data: bytes) -> Image.Image:
    im = Image.open(io.BytesIO(data))
    im = im.convert("RGB")
    w, h = im.size
    if max(w, h) > MAX_DIMENSION:
        ratio = MAX_DIMENSION / max(w, h)
        im = im.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
    return im


def load_image_from_file(fp: BinaryIO) -> Image.Image:
    im = Image.open(fp)
    im = im.convert("RGB")
    w, h = im.size
    if max(w, h) > MAX_DIMENSION:
        ratio = MAX_DIMENSION / max(w, h)
        im = im.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
    return im
