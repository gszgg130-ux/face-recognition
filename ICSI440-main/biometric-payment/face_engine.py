"""Face analysis pipeline used by enrolment and Face Pay.

Every camera frame goes through the same stages:

    decode -> detect (SCRFD-10G, 5 landmarks) -> quality gate (size, sharpness,
    light, eDifFIQA) -> passive liveness (MiniFASNet V2 + V1SE ensemble)
    -> head pose (6D-rotation ResNet) -> face state (eyes open, mask,
    sunglasses) -> 512-D embedding (AdaFace IR-50 on a 112x112 aligned crop)

All models are ONNX files run with onnxruntime through the ``uniface`` library,
so no PyTorch/TensorFlow install is needed. Compared with the previous DeepFace
version (Haar-cascade detector + Facenet512, re-run against every reference JPG
on every request), embeddings are computed once at enrolment and stored in
MongoDB, so a payment costs one forward pass per frame plus a vector compare.
"""

from __future__ import annotations

import base64
import threading
import time
from dataclasses import asdict, dataclass, field

import cv2
import numpy as np

import config

# --------------------------------------------------------------------------
# User-facing error messages (Mongolian, shown directly in the UI)
# --------------------------------------------------------------------------
MESSAGES = {
    "bad_image": "Зургийг уншиж чадсангүй.",
    "no_face": "Нүүр илэрсэнгүй. Камер руу эгц харна уу.",
    "multiple_faces": "Кадрт зөвхөн нэг хүн байх ёстой.",
    "face_too_small": "Камерт арай ойртоно уу.",
    "low_confidence": "Нүүр тод харагдахгүй байна. Гэрэлтэй газар оролдоно уу.",
    "blurry": "Зураг бүдэг байна. Хөдөлгөөнгүй байгаарай.",
    "too_dark": "Гэрэл хангалтгүй байна.",
    "too_bright": "Хэт гэрэлтэй байна. Арын гэрлээс зайлсхийнэ үү.",
    "sunglasses": "Нарны шилээ авна уу.",
    "mask": "Амны хаалтаа авна уу.",
}


class FaceError(Exception):
    """A frame that cannot be used, with a code the UI can react to."""

    def __init__(self, code: str, message: str | None = None):
        super().__init__(message or MESSAGES.get(code, code))
        self.code = code
        self.message = message or MESSAGES.get(code, code)


@dataclass
class FrameAnalysis:
    bbox: list[float]
    det_score: float
    face_px: int
    sharpness: float
    brightness: float
    liveness: float | None = None
    yaw: float | None = None
    pitch: float | None = None
    roll: float | None = None
    eyes_open: float | None = None
    # 5-point geometry: nose position between the eyes (0) and the mouth (1),
    # and sideways offset in inter-ocular units. Sign-unambiguous pose cues.
    nose_ratio: float | None = None
    nose_offset: float | None = None
    sunglasses: float | None = None
    mask: float | None = None
    quality: float | None = None
    embedding: np.ndarray | None = field(default=None, repr=False)
    ms: dict[str, float] = field(default_factory=dict)

    def report(self) -> dict:
        """JSON-safe summary (no embedding) for the UI's ML details panel."""
        data = asdict(self)
        data.pop("embedding", None)
        return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in data.items()}


# --------------------------------------------------------------------------
# Image helpers
# --------------------------------------------------------------------------
MAX_SIDE = 1280


def decode_image(data: str | bytes) -> np.ndarray:
    """Decode a data URL / base64 string / raw bytes into a BGR image."""
    try:
        if isinstance(data, str):
            if "," in data and data.strip().startswith("data:"):
                data = data.split(",", 1)[1]
            data = base64.b64decode(data)
        image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception as exc:  # noqa: BLE001 - any decode failure is a bad image
        raise FaceError("bad_image") from exc
    if image is None:
        raise FaceError("bad_image")
    h, w = image.shape[:2]
    scale = MAX_SIDE / max(h, w)
    if scale < 1:
        image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return image


def l2_normalize(vec: np.ndarray) -> np.ndarray:
    vec = np.asarray(vec, dtype=np.float32).ravel()
    return vec / (np.linalg.norm(vec) + 1e-12)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(l2_normalize(a), l2_normalize(b)))


def build_template(embeddings: list[np.ndarray], weights: list[float] | None = None) -> np.ndarray:
    """Quality-weighted mean of normalised embeddings, re-normalised."""
    mat = np.stack([l2_normalize(e) for e in embeddings])
    w = np.ones(len(mat), dtype=np.float32) if weights is None else np.asarray(weights, dtype=np.float32)
    w = np.clip(w, 0.05, None)
    return l2_normalize((mat * w[:, None]).sum(axis=0))


def match_score(probe: np.ndarray, samples: list[list[float]], centroid: list[float] | None) -> float:
    """Similarity of a probe to one enrolled identity.

    We take the best of (a) the closest enrolled pose and (b) the template
    centroid. The nearest pose handles a turned head; the centroid is robust
    to one bad enrolment frame.
    """
    probe = l2_normalize(probe)
    sims = [float(np.dot(probe, l2_normalize(s))) for s in samples]
    if centroid is not None:
        sims.append(float(np.dot(probe, l2_normalize(centroid))))
    return max(sims) if sims else -1.0


# --------------------------------------------------------------------------
# The engine
# --------------------------------------------------------------------------
class FaceEngine:
    """Lazily loads the ONNX models once and analyses frames."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ready = False
        self.info: dict[str, str] = {}

    # -- model loading -----------------------------------------------------
    def load(self) -> None:
        if self._ready:
            return
        with self._lock:
            if self._ready:
                return
            from uniface import SCRFD, AdaFace, ArcFace, EDifFIQA, FaceAttribNet, HeadPose, MiniFASNet, set_cache_dir
            from uniface.constants import (
                AdaFaceWeights,
                ArcFaceWeights,
                EDifFIQAWeights,
                MiniFASNetWeights,
                SCRFDWeights,
            )

            config.MODEL_DIR.mkdir(parents=True, exist_ok=True)
            set_cache_dir(str(config.MODEL_DIR))

            recognizers = {
                "adaface_ir50": lambda: AdaFace(model_name=AdaFaceWeights.IR_50),
                "adaface_ir101": lambda: AdaFace(model_name=AdaFaceWeights.IR_101),
                "arcface_r50": lambda: ArcFace(model_name=ArcFaceWeights.RESNET),
            }
            if config.RECOGNIZER not in recognizers:
                raise ValueError(f"Unknown RECOGNIZER={config.RECOGNIZER!r}; choose one of {list(recognizers)}")

            self.detector = SCRFD(model_name=SCRFDWeights.SCRFD_10G_KPS, confidence_threshold=0.5)
            self.recognizer = recognizers[config.RECOGNIZER]()
            self.spoofers = [
                MiniFASNet(model_name=MiniFASNetWeights.V2),  # crop scale 2.7
                MiniFASNet(model_name=MiniFASNetWeights.V1SE),  # crop scale 4.0
            ]
            self.quality_model = EDifFIQA(model_name=EDifFIQAWeights.T)
            self.headpose = HeadPose()
            self.face_state = FaceAttribNet()
            self.info = {
                "detector": "SCRFD-10G-KPS (InsightFace)",
                "recognizer": {
                    "adaface_ir50": "AdaFace IR-50 / WebFace4M",
                    "adaface_ir101": "AdaFace IR-101 / WebFace12M",
                    "arcface_r50": "ArcFace R50 / WebFace600K",
                }[config.RECOGNIZER],
                "liveness": "MiniFASNet V2 + V1SE ensemble (Silent-Face)",
                "quality": "eDifFIQA-T",
                "headpose": "6DRepNet-style ResNet18 (300W-LP)",
                "face_state": "FaceAttribNet (eyes / mask / sunglasses)",
            }
            self._ready = True

    @property
    def ready(self) -> bool:
        return self._ready

    def warmup(self) -> None:
        self.load()
        dummy = np.full((480, 640, 3), 127, dtype=np.uint8)
        try:
            self.detector.detect(dummy)
        except Exception:  # noqa: BLE001 - warm-up must never crash the server
            pass

    # -- stages --------------------------------------------------------------
    def _liveness(self, image: np.ndarray, bbox: np.ndarray) -> float:
        """Mean P(real) of the two MiniFASNet variants (3-class softmax, class 1 = real)."""
        probs = []
        for spoofer in self.spoofers:
            logits = spoofer.session.run([spoofer.output_name], {spoofer.input_name: spoofer.preprocess(image, bbox)})[0]
            e = np.exp(logits - logits.max())
            probs.append(float((e / e.sum())[0, 1]))
        return float(np.mean(probs))

    def analyze(
        self,
        image: np.ndarray,
        *,
        embedding: bool = True,
        liveness: bool = True,
        pose: bool = True,
        state: bool = True,
        quality: bool = False,
        enforce_quality: bool = True,
    ) -> FrameAnalysis:
        self.load()
        ms: dict[str, float] = {}
        t0 = time.perf_counter()
        faces = self.detector.detect(image)
        ms["detect"] = (time.perf_counter() - t0) * 1000
        if not faces:
            raise FaceError("no_face")

        def area(f):
            x1, y1, x2, y2 = f.bbox[:4]
            return max(0.0, x2 - x1) * max(0.0, y2 - y1)

        faces = sorted(faces, key=area, reverse=True)
        face = faces[0]
        if len(faces) > 1 and area(faces[1]) > config.SECOND_FACE_RATIO * area(face):
            raise FaceError("multiple_faces")

        h, w = image.shape[:2]
        x1, y1, x2, y2 = (int(round(v)) for v in face.bbox[:4])
        x1, y1, x2, y2 = max(0, x1), max(0, y1), min(w, x2), min(h, y2)
        crop = image[y1:y2, x1:x2]
        face_px = int(min(x2 - x1, y2 - y1))
        gray = cv2.cvtColor(cv2.resize(crop, (160, 160)), cv2.COLOR_BGR2GRAY) if crop.size else None
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var()) if gray is not None else 0.0
        brightness = float(gray.mean()) if gray is not None else 0.0

        result = FrameAnalysis(
            bbox=[float(v) for v in face.bbox[:4]],
            det_score=float(face.confidence),
            face_px=face_px,
            sharpness=sharpness,
            brightness=brightness,
            ms=ms,
        )
        lm = np.asarray(face.landmarks, dtype=np.float32)  # eye(img-left), eye(img-right), nose, mouth L, mouth R
        if lm.shape == (5, 2):
            eye_mid, mouth_mid = (lm[0] + lm[1]) / 2, (lm[3] + lm[4]) / 2
            iod = float(np.linalg.norm(lm[1] - lm[0])) or 1.0
            span = float(mouth_mid[1] - eye_mid[1]) or 1.0
            result.nose_ratio = float((lm[2][1] - eye_mid[1]) / span)
            result.nose_offset = float((lm[2][0] - eye_mid[0]) / iod)

        if enforce_quality:
            if face_px < config.MIN_FACE_PX:
                raise FaceError("face_too_small")
            if result.det_score < config.MIN_DET_SCORE:
                raise FaceError("low_confidence")
            if brightness < 45:
                raise FaceError("too_dark")
            if brightness > 225:
                raise FaceError("too_bright")
            if sharpness < config.MIN_SHARPNESS:
                raise FaceError("blurry")

        if state:
            t = time.perf_counter()
            fs = self.face_state.predict(image, face)
            ms["state"] = (time.perf_counter() - t) * 1000
            result.eyes_open = float((fs.left_eye_open + fs.right_eye_open) / 2)
            result.sunglasses = float(fs.sunglasses)
            result.mask = float(fs.mask)
            if enforce_quality and fs.sunglasses > 0.6:
                raise FaceError("sunglasses")
            if enforce_quality and fs.mask > 0.6:
                raise FaceError("mask")

        if liveness:
            t = time.perf_counter()
            result.liveness = self._liveness(image, face.bbox)
            ms["liveness"] = (time.perf_counter() - t) * 1000

        if pose and crop.size:
            t = time.perf_counter()
            hp = self.headpose.estimate(crop)
            ms["pose"] = (time.perf_counter() - t) * 1000
            result.yaw, result.pitch, result.roll = float(hp.yaw), float(hp.pitch), float(hp.roll)

        if quality:
            t = time.perf_counter()
            result.quality = float(self.quality_model.predict(image, face.landmarks).score)
            ms["quality"] = (time.perf_counter() - t) * 1000

        if embedding:
            t = time.perf_counter()
            result.embedding = l2_normalize(self.recognizer.get_normalized_embedding(image, face.landmarks))
            ms["embed"] = (time.perf_counter() - t) * 1000

        result.ms = {k: round(v, 1) for k, v in ms.items()}
        return result


engine = FaceEngine()
