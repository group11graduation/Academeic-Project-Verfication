"""
Serialize heavyweight neural inference (SentenceTransformer, CodeBERT) across threads.

asyncio.gather + ThreadPoolExecutor can otherwise overlap torch forwards unsafely on shared weights.
"""

from __future__ import annotations

import threading

TORCH_MODEL_LOCK = threading.Lock()
