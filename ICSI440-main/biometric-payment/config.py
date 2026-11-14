"""Runtime settings, read from environment variables (or a local .env file).

Every threshold used by the face pipeline lives here so the team can tune it
in one place and explain it in the report. Values were calibrated with
``python evaluate.py`` on the enrolment photos in ``faces/``.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _float(name: str, default: float) -> float:
    return float(os.getenv(name, default))


def _int(name: str, default: int) -> int:
    return int(os.getenv(name, default))


# ---------------------------------------------------------------- database
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "biometric_pay")

# ------------------------------------------------------------------- server
HOST = os.getenv("HOST", "127.0.0.1")
PORT = _int("PORT", 5000)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
MAX_UPLOAD_MB = _int("MAX_UPLOAD_MB", 16)
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://localhost:8443").rstrip("/")

# ------------------------------------------------------------------ models
# ONNX weights are downloaded once into this folder (see download_models.py).
MODEL_DIR = Path(os.getenv("MODEL_DIR", BASE_DIR / "models"))
# Recogniser: adaface_ir50 (default) | adaface_ir101 | arcface_r50
RECOGNIZER = os.getenv("RECOGNIZER", "adaface_ir50")

# --------------------------------------------------------- recognition (1:N)
# Cosine similarity between L2-normalised 512-D embeddings.
MATCH_THRESHOLD = _float("MATCH_THRESHOLD", 0.45)
# Best identity must beat the runner-up by this much (open-set safety margin).
MATCH_MARGIN = _float("MATCH_MARGIN", 0.08)
# A new enrolment that matches a *different* user above this is rejected.
DUPLICATE_THRESHOLD = _float("DUPLICATE_THRESHOLD", 0.55)
# All frames in one capture session must look like the same person.
SESSION_CONSISTENCY = _float("SESSION_CONSISTENCY", 0.40)

# ------------------------------------------------------------ face quality
MIN_DET_SCORE = _float("MIN_DET_SCORE", 0.60)
MIN_FACE_PX = _int("MIN_FACE_PX", 80)  # shortest side of the face box, pixels
MIN_SHARPNESS = _float("MIN_SHARPNESS", 25.0)  # variance of Laplacian on the face crop
MIN_QUALITY = _float("MIN_QUALITY", 0.35)  # eDifFIQA score of the frontal frame
# A second face this large (relative to the main face) makes the frame ambiguous.
SECOND_FACE_RATIO = _float("SECOND_FACE_RATIO", 0.60)

# ---------------------------------------------------------------- liveness
# Passive: MiniFASNet V2 + V1SE ensemble, mean probability of class "real".
LIVENESS_THRESHOLD = _float("LIVENESS_THRESHOLD", 0.70)
# Active: head-pose and blink checks on the challenge frames.
TURN_MIN_DEG = _float("TURN_MIN_DEG", 12.0)  # yaw change vs. the frontal frame
NOD_MIN_DEG = _float("NOD_MIN_DEG", 8.0)  # pitch change vs. the frontal frame
NOSE_SHIFT_MIN = _float("NOSE_SHIFT_MIN", 0.04)  # nod direction: nose moves towards eyes/mouth
EYES_CLOSED_MAX = _float("EYES_CLOSED_MAX", 0.55)  # eye-open prob. in the blink frame
EYES_OPEN_MIN = _float("EYES_OPEN_MIN", 0.50)  # eye-open prob. in the frontal frame
CHALLENGE_TTL_S = _int("CHALLENGE_TTL_S", 90)

# ------------------------------------------------------------- payments/PIN
PIN_LENGTH = _int("PIN_LENGTH", 4)
PIN_MAX_ATTEMPTS = _int("PIN_MAX_ATTEMPTS", 5)  # wrong PINs before the lock
PIN_LOCK_MINUTES = _int("PIN_LOCK_MINUTES", 15)
PAYMENT_SESSION_TTL_S = _int("PAYMENT_SESSION_TTL_S", 120)
ENROLL_SESSION_TTL_S = _int("ENROLL_SESSION_TTL_S", 600)
DEFAULT_BALANCE = _int("DEFAULT_BALANCE", 500_000)  # ₮ for auto-created demo users
