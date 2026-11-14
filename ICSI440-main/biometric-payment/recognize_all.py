"""Webcam Face Pay from the terminal (quick test without the React POS).

    python recognize_all.py

SPACE = recognise the face in front of the camera, Q = quit. Uses the same
1:N matching and PIN check as the API. Only passive liveness runs here; the
React POS adds the randomised head-turn/blink challenge on top.
"""

from __future__ import annotations

import getpass
import secrets

import cv2

import config
import db
from app import identify
from face_engine import FaceError, engine
from security import check_pin


def pay(user: dict, score: float, live: float) -> None:
    print("-----------------------------")
    print(f"{user['name']} танигдлаа ✅  (similarity {score:.3f}, P(real) {live:.3f})")
    print(f"Үлдэгдэл: {user['balance']:,} ₮")
    try:
        amount = int(float(input("Төлбөрийн дүн: ")))
    except ValueError:
        print("Төлбөрийн дүн буруу байна.")
        return
    if amount <= 0:
        print("Төлбөрийн дүн 0-ээс их байх ёстой.")
        return
    pin = getpass.getpass("ПИН код: ")
    if not check_pin((user.get("pin") or {}).get("hash", ""), pin):
        left, locked = db.register_pin_failure(user["_id"])
        print("ПИН код буруу ❌", "Түгжигдлээ." if locked else f"{left} оролдлого үлдлээ.")
        return
    db.reset_pin_failures(user["_id"])
    updated = db.debit(user["_id"], amount)
    extra = {"method": "face", "merchant": "CLI", "match_score": round(score, 4), "liveness": round(live, 4)}
    if updated is None:
        db.add_transaction(user, amount, "FAILED", reason="insufficient_funds", **extra)
        print("Үлдэгдэл хүрэлцэхгүй байна ❌")
        return
    db.add_transaction(user, amount, "SUCCESS", approval_code=f"{secrets.randbelow(10**8):08d}", balance_after=updated["balance"], **extra)
    print(f"ТӨЛБӨР АМЖИЛТТАЙ ✅  Үлдэгдэл: {updated['balance']:,} ₮")


def main() -> None:
    db.ensure_indexes()
    engine.load()
    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        raise SystemExit("Камер нээгдсэнгүй.")
    print("SPACE = нүүр таних, Q = гарах")
    while True:
        ok, frame = camera.read()
        if not ok:
            break
        cv2.imshow("Face Pay (SPACE recognise, Q quit)", cv2.flip(frame, 1))
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        if key != ord(" "):
            continue
        try:
            result = engine.analyze(frame)
        except FaceError as err:
            print("✗", err.message)
            continue
        if (result.liveness or 0) < config.LIVENESS_THRESHOLD:
            print(f"✗ Амьд хүн биш байж магадгүй (P(real) {result.liveness:.3f})")
            continue
        user, score, margin, _ = identify(result.embedding)
        if user is None or score < config.MATCH_THRESHOLD or margin < config.MATCH_MARGIN:
            print(f"Танигдсангүй ❌ (best {score:.3f})")
            continue
        pay(db.get_user(user["_id"]), score, result.liveness or 0)
    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
