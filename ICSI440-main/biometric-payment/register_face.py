"""Webcam enrolment from the terminal (alternative to the bank app's setup flow).

    python register_face.py

SPACE = capture the requested pose, Q = quit. Captures 5 head poses, checks
each with the same quality + passive-liveness gates as the API, then asks for
a PIN and saves the template to MongoDB.
"""

from __future__ import annotations

import getpass

import cv2

import config
import db
from face_engine import FaceError, build_template, engine
from liveness import STEP_LABELS
from security import hash_pin, pin_problem

POSES = ["center", "turn_left", "turn_right", "look_up", "look_down"]
POSE_HINTS = {  # ASCII for cv2.putText
    "center": "Look straight at the camera",
    "turn_left": "Turn your head LEFT",
    "turn_right": "Turn your head RIGHT",
    "look_up": "Look slightly UP",
    "look_down": "Look slightly DOWN",
}


def main() -> None:
    name = input("Хэрэглэгчийн нэр: ").strip()
    if not name:
        raise SystemExit("Нэр хоосон байна.")
    db.ensure_indexes()
    engine.load()

    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        raise SystemExit("Камер нээгдсэнгүй.")

    samples, message, color = [], "", (0, 200, 0)
    while len(samples) < len(POSES):
        ok, frame = camera.read()
        if not ok:
            break
        pose = POSES[len(samples)]
        view = cv2.flip(frame, 1)
        cv2.putText(view, f"{len(samples)}/{len(POSES)}  {POSE_HINTS[pose]}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 200, 0), 2)
        cv2.putText(view, message, (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        cv2.imshow("Face Pay - Registration (SPACE capture, Q quit)", view)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        if key != ord(" "):
            continue
        try:
            result = engine.analyze(frame, quality=True)
        except FaceError as err:
            print("✗", err.message)
            message, color = err.code, (0, 0, 255)
            continue
        if (result.liveness or 0) < config.LIVENESS_THRESHOLD:
            print("✗ Амьд байдал баталгаажсангүй:", round(result.liveness or 0, 3))
            message, color = "liveness check failed", (0, 0, 255)
            continue
        samples.append(result)
        print(f"✓ {STEP_LABELS[pose]}  yaw={result.yaw:+.0f}° pitch={result.pitch:+.0f}° quality={result.quality:.2f}")
        message, color = "saved", (0, 200, 0)

    camera.release()
    cv2.destroyAllWindows()
    if len(samples) < len(POSES):
        raise SystemExit("Бүртгэл дуусаагүй.")

    while True:
        pin = getpass.getpass(f"{config.PIN_LENGTH} оронтой ПИН код: ")
        if problem := pin_problem(pin):
            print(problem)
            continue
        if getpass.getpass("ПИН кодоо давтана уу: ") != pin:
            print("ПИН код таарсангүй.")
            continue
        break

    user = db.ensure_user(name)
    template = build_template([s.embedding for s in samples], [s.quality or 0.5 for s in samples])
    db.save_faceid(
        user["_id"],
        {
            "enabled": True,
            "model": config.RECOGNIZER,
            "embeddings": [s.embedding.tolist() for s in samples],
            "centroid": template.tolist(),
            "poses": POSES,
            "quality": [round(s.quality or 0, 4) for s in samples],
            "source": "cli",
            "enrolled_at": db.now(),
        },
        hash_pin(pin),
    )
    print(f"{name} бүртгэгдлээ ✅")


if __name__ == "__main__":
    main()
