"""Download and verify (SHA-256) all ONNX models into ./models before the demo.

    python download_models.py

The server also downloads them lazily on first use, but doing it ahead of
time avoids a slow first payment (and a dead demo on bad Wi-Fi).
"""

from __future__ import annotations

import time

import config
from face_engine import engine

if __name__ == "__main__":
    t = time.perf_counter()
    engine.warmup()
    print(f"Models ready in {config.MODEL_DIR} ({time.perf_counter() - t:.1f}s)")
    for key, value in engine.info.items():
        print(f"  {key:11s} {value}")
