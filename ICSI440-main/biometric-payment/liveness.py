"""Challenge-response liveness.

Liveness is checked in three independent layers, so defeating one is not
enough:

1. **Passive** - every frame is scored by the MiniFASNet ensemble, which
   looks for print/screen artefacts (moire, glare, paper texture, bezels).
2. **Active** - the server picks a random sequence of actions (turn left or
   right, blink, nod). The browser guides the user with MediaPipe Face
   Landmarker and sends one frame per action. The server re-measures head
   pose and eye state itself, so a tampered client cannot fake the result.
   Because the order is random and the challenge expires after
   ``CHALLENGE_TTL_S`` seconds and is single-use, a pre-recorded video
   will not match it.
3. **Consistency** - all frames must belong to the same person and must not
   be pixel-identical copies of one picture.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

import cv2
import numpy as np

import config
from face_engine import FrameAnalysis, cosine

STEP_LABELS = {
    "center": "Камер руу эгц харна уу",
    "turn_left": "Толгойгоо зүүн тийш эргүүлнэ үү",
    "turn_right": "Толгойгоо баруун тийш эргүүлнэ үү",
    "look_up": "Дээшээ бага зэрэг харна уу",
    "look_down": "Доошоо бага зэрэг харна уу",
    "blink": "Нүдээ анивчина уу",
}
ALL_STEPS = tuple(STEP_LABELS)


def new_steps(purpose: str) -> list[str]:
    """Enrolment scans five head poses (plus a blink); payment is short and random."""
    if purpose == "enroll":
        return ["center", "turn_left", "turn_right", "look_up", "look_down", "blink"]
    tail = [random.choice(["turn_left", "turn_right"]), "blink"]
    random.shuffle(tail)
    return ["center", *tail]


@dataclass
class StepCheck:
    step: str
    passed: bool
    measured: float | None
    required: str

    def as_dict(self) -> dict:
        return {
            "step": self.step,
            "passed": self.passed,
            "measured": None if self.measured is None else round(self.measured, 2),
            "required": self.required,
        }


def _thumb(image: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(cv2.resize(image, (64, 64), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32)


def verify(steps: list[str], images: list[np.ndarray], frames: list[FrameAnalysis]) -> dict:
    """Run all three layers. ``frames[i]`` is the analysis of ``images[i]`` for ``steps[i]``."""
    by_step = dict(zip(steps, frames, strict=True))
    center = by_step["center"]
    checks: list[StepCheck] = []

    # Layer 2 - active challenge, measured server-side relative to the frontal frame.
    # HeadPose yaw on a raw (un-mirrored) camera frame: yaw > 0 = user turns to their right
    # (verified on faces/: the nose moves to the image-left as yaw grows).
    for step, f in by_step.items():
        if step == "center":
            ok = abs(f.yaw or 0) <= 20 and abs(f.pitch or 0) <= 25
            checks.append(StepCheck(step, ok, f.yaw, "|yaw| ≤ 20°"))
        elif step == "turn_left":
            d = (center.yaw or 0) - (f.yaw or 0)
            checks.append(StepCheck(step, d >= config.TURN_MIN_DEG, d, f"Δyaw ≥ {config.TURN_MIN_DEG:.0f}°"))
        elif step == "turn_right":
            d = (f.yaw or 0) - (center.yaw or 0)
            checks.append(StepCheck(step, d >= config.TURN_MIN_DEG, d, f"Δyaw ≥ {config.TURN_MIN_DEG:.0f}°"))
        elif step in ("look_up", "look_down"):
            # Magnitude from the head-pose network, direction from landmark geometry:
            # looking up moves the nose tip towards the eyes (nose_ratio shrinks).
            d = abs((f.pitch or 0) - (center.pitch or 0))
            shift = (f.nose_ratio or 0) - (center.nose_ratio or 0)
            direction_ok = shift <= -config.NOSE_SHIFT_MIN if step == "look_up" else shift >= config.NOSE_SHIFT_MIN
            checks.append(
                StepCheck(step, d >= config.NOD_MIN_DEG and direction_ok, d, f"|Δpitch| ≥ {config.NOD_MIN_DEG:.0f}°")
            )
        elif step == "blink":
            # Eyes must be open in the frontal frame and closed in the blink frame.
            # A clear drop from the frontal frame also counts (half-closed eyes, glasses).
            closed = f.eyes_open is not None and (
                f.eyes_open <= config.EYES_CLOSED_MAX
                or (center.eyes_open is not None and center.eyes_open - f.eyes_open >= 0.35)
            )
            opened = center.eyes_open is None or center.eyes_open >= config.EYES_OPEN_MIN
            checks.append(StepCheck(step, closed and opened, f.eyes_open, f"eyes-open ≤ {config.EYES_CLOSED_MAX}"))

    # Layer 1 - passive anti-spoofing on every frame.
    scores = [f.liveness for f in frames if f.liveness is not None]
    passive = float(np.mean(scores)) if scores else 0.0
    passive_min = float(np.min(scores)) if scores else 0.0
    passive_ok = passive >= config.LIVENESS_THRESHOLD and passive_min >= config.LIVENESS_THRESHOLD - 0.2

    # Layer 3 - same person in every frame, and not one still image sent N times.
    consistency = [cosine(center.embedding, f.embedding) for f in frames if f.embedding is not None]
    consistency_min = float(min(consistency)) if consistency else 0.0
    consistent = consistency_min >= config.SESSION_CONSISTENCY
    thumbs = [_thumb(img) for img in images]
    motion = float(max(np.abs(thumbs[0] - t).mean() for t in thumbs[1:])) if len(thumbs) > 1 else 0.0
    not_static = motion >= 1.5

    active_ok = all(c.passed for c in checks)
    passed = active_ok and passive_ok and consistent and not_static

    reason = None
    if not passive_ok:
        reason = "spoof"
    elif not not_static:
        reason = "static"
    elif not consistent:
        reason = "inconsistent"
    elif not active_ok:
        reason = "challenge:" + next(c.step for c in checks if not c.passed)

    return {
        "passed": passed,
        "reason": reason,
        "passive": round(passive, 4),
        "passive_min": round(passive_min, 4),
        "consistency_min": round(consistency_min, 4),
        "motion": round(motion, 2),
        "checks": [c.as_dict() for c in checks],
    }


REASON_MESSAGES = {
    "spoof": "Амьд хүн гэдгийг баталгаажуулж чадсангүй. Зураг эсвэл дэлгэц ашиглах боломжгүй.",
    "static": "Хөдөлгөөн илэрсэнгүй. Зааврын дагуу толгойгоо хөдөлгөнө үү.",
    "inconsistent": "Шалгалтын явцад өөр хүн илэрлээ. Дахин оролдоно уу.",
    "challenge:center": "Камер руу эгц харна уу.",
    "challenge:turn_left": "Толгойгоо зүүн тийш илүү эргүүлнэ үү.",
    "challenge:turn_right": "Толгойгоо баруун тийш илүү эргүүлнэ үү.",
    "challenge:look_up": "Дээшээ илүү харна уу.",
    "challenge:look_down": "Доошоо илүү харна уу.",
    "challenge:blink": "Нүд анивчих хөдөлгөөн илэрсэнгүй. Дахин оролдоно уу.",
}
