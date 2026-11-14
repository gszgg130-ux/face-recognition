"""API tests against a real MongoDB (database ``biometric_pay_test``, dropped first).

    pytest -q                      # API logic with a stubbed face engine (fast)
    pytest -q -m models            # + the real ONNX models on faces/ (slow)

The stub turns each "image" string into a fake frame so the enrolment,
liveness, PIN and balance logic can be tested without a camera.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["MONGODB_DB"] = "biometric_pay_test"

import app as app_module  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402
from face_engine import FaceError, FrameAnalysis, l2_normalize  # noqa: E402

POSES = {  # (yaw, pitch, eyes_open, nose_ratio) that a real person would produce for each step
    "center": (0.0, -4.0, 0.98, 0.56),
    "turn_left": (-25.0, -4.0, 0.97, 0.56),
    "turn_right": (25.0, -4.0, 0.97, 0.56),
    "look_up": (0.0, 12.0, 0.96, 0.45),
    "look_down": (0.0, -20.0, 0.9, 0.68),
    "blink": (0.0, -4.0, 0.05, 0.56),
}


def person_vector(name: str) -> np.ndarray:
    return l2_normalize(np.random.default_rng(abs(hash(name)) % 2**32).normal(size=512))


def fake_image(tag: str) -> np.ndarray:
    return np.random.default_rng(abs(hash(tag)) % 2**32).integers(0, 255, (120, 160, 3), dtype=np.uint8)


class FakeEngine:
    """Image strings look like 'person|step|liveness[|static]'."""

    info = {"recognizer": "stub"}
    ready = True

    def __init__(self):
        self.last_tag = {}

    def analyze(self, image, **_kw):
        tag = self.last_tag[id(image)]
        person, step, live, *_ = tag.split("|")
        if person == "noface":
            raise FaceError("no_face")
        yaw, pitch, eyes, nose_ratio = POSES[step]
        noise = np.random.default_rng(abs(hash(tag)) % 2**32).normal(scale=0.02, size=512)
        return FrameAnalysis(
            bbox=[0, 0, 100, 100], det_score=0.9, face_px=200, sharpness=200, brightness=120,
            liveness=float(live), yaw=yaw, pitch=pitch, roll=0, eyes_open=eyes, sunglasses=0, mask=0,
            quality=0.75, nose_ratio=nose_ratio, embedding=l2_normalize(person_vector(person) + noise),
        )


@pytest.fixture()
def client(monkeypatch):
    db.use_db(db.get_db().client["biometric_pay_test"])
    db.get_db().client.drop_database("biometric_pay_test")
    db.ensure_indexes()
    fake = FakeEngine()

    def fake_decode(tag):
        img = fake_image(tag.split("|")[0] if tag.endswith("|static") else tag)
        fake.last_tag[id(img)] = tag
        return img

    monkeypatch.setattr(app_module, "engine", fake)
    monkeypatch.setattr(app_module, "decode_image", fake_decode)
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


def challenge(client, purpose):
    res = client.post("/api/liveness/challenge", json={"purpose": purpose}).get_json()
    return res["challenge_id"], [s["id"] for s in res["steps"]]


def frames(person, steps, live=0.95, static=False):
    return [{"step": s, "image": f"{person}|{s}|{live}" + ("|static" if static else "")} for s in steps]


def enroll(client, name, person=None, pin="2580"):
    cid, steps = challenge(client, "enroll")
    res = client.post("/api/enroll/faces", json={"name": name, "challenge_id": cid, "frames": frames(person or name, steps)})
    assert res.status_code == 200, res.get_json()
    eid = res.get_json()["enrollment_id"]
    res = client.post("/api/enroll/pin", json={"enrollment_id": eid, "pin": pin})
    assert res.status_code == 200, res.get_json()
    return res.get_json()["user"]


def identify(client, person, amount=12500, **kw):
    cid, steps = challenge(client, "pay")
    return client.post(
        "/api/pay/identify",
        json={"challenge_id": cid, "frames": frames(person, steps, **kw), "amount": amount, "merchant": "CU-13 BAIGAL TUV"},
    )


# ------------------------------------------------------------------ tests
def test_enroll_requires_strong_pin(client):
    cid, steps = challenge(client, "enroll")
    assert steps == ["center", "turn_left", "turn_right", "look_up", "look_down", "blink"]
    res = client.post("/api/enroll/faces", json={"name": "Enkhluun", "challenge_id": cid, "frames": frames("Enkhluun", steps)})
    body = res.get_json()
    assert body["success"] and body["report"]["liveness"]["passed"]
    for weak in ("1234", "0000", "12", "abcd", "9876"):
        r = client.post("/api/enroll/pin", json={"enrollment_id": body["enrollment_id"], "pin": weak})
        assert r.status_code == 400 and r.get_json()["code"] == "weak_pin"
    r = client.post("/api/enroll/pin", json={"enrollment_id": body["enrollment_id"], "pin": "2580"})
    user = r.get_json()["user"]
    assert user["faceid"]["enabled"] and user["pin_set"] and len(user["faceid"]["poses"]) == 5
    stored = db.find_user("enkhluun")
    assert stored["pin"]["hash"] != "2580" and "image" not in str(stored["faceid"].keys())


def test_full_payment_flow(client):
    enroll(client, "Enkhluun")
    start = db.find_user("Enkhluun")["balance"]
    res = identify(client, "Enkhluun", amount=12500)
    body = res.get_json()
    assert res.status_code == 200, body
    assert body["user"]["masked_name"] == "E******n" and body["requires_pin"]
    assert body["report"]["match"]["score"] > config.MATCH_THRESHOLD

    wrong = client.post("/api/pay/confirm", json={"payment_id": body["payment_id"], "pin": "1111"})
    assert wrong.status_code == 401 and wrong.get_json()["attempts_left"] == config.PIN_MAX_ATTEMPTS - 1

    ok = client.post("/api/pay/confirm", json={"payment_id": body["payment_id"], "pin": "2580"})
    tx = ok.get_json()["transaction"]
    assert ok.status_code == 200 and tx["status"] == "SUCCESS" and tx["amount"] == 12500
    assert db.find_user("Enkhluun")["balance"] == start - 12500
    assert db.find_user("Enkhluun")["pin"]["failed_attempts"] == 0
    # The payment session is single-use: replaying the confirm must not charge again.
    again = client.post("/api/pay/confirm", json={"payment_id": body["payment_id"], "pin": "2580"})
    assert again.status_code == 410
    assert db.find_user("Enkhluun")["balance"] == start - 12500


def test_unknown_face_is_rejected(client):
    enroll(client, "Enkhluun")
    res = identify(client, "Stranger")
    assert res.status_code == 404 and res.get_json()["code"] == "no_match"


def test_spoof_is_rejected(client):
    enroll(client, "Enkhluun")
    res = identify(client, "Enkhluun", live=0.2)
    body = res.get_json()
    assert res.status_code == 422 and body["code"] == "liveness_failed"
    assert body["report"]["liveness"]["reason"] == "spoof"


def test_static_photo_replay_is_rejected(client):
    enroll(client, "Enkhluun")
    res = identify(client, "Enkhluun", static=True)
    assert res.status_code == 422 and res.get_json()["report"]["liveness"]["reason"] == "static"


def test_challenge_is_single_use_and_ordered(client):
    cid, steps = challenge(client, "pay")
    bad = client.post("/api/pay/identify", json={"challenge_id": cid, "frames": frames("x", steps[::-1]), "amount": 10})
    assert bad.get_json()["code"] in ("bad_frames", "challenge_expired")
    reuse = client.post("/api/pay/identify", json={"challenge_id": cid, "frames": frames("x", steps), "amount": 10})
    assert reuse.status_code == 410


def test_wrong_head_turn_fails_challenge(client):
    enroll(client, "Enkhluun")
    cid, steps = challenge(client, "pay")
    turn = next(s for s in steps if s.startswith("turn"))
    opposite = "turn_right" if turn == "turn_left" else "turn_left"
    fr = [{"step": s, "image": f"Enkhluun|{opposite if s == turn else s}|0.95"} for s in steps]
    res = client.post("/api/pay/identify", json={"challenge_id": cid, "frames": fr, "amount": 100})
    assert res.status_code == 422 and res.get_json()["report"]["liveness"]["reason"] == f"challenge:{turn}"


def test_duplicate_face_cannot_enroll_twice(client):
    enroll(client, "Enkhluun")
    cid, steps = challenge(client, "enroll")
    res = client.post("/api/enroll/faces", json={"name": "Impostor", "challenge_id": cid, "frames": frames("Enkhluun", steps)})
    assert res.status_code == 409 and res.get_json()["code"] == "duplicate_face"


def test_pin_lockout(client):
    enroll(client, "Enkhluun")
    pid = identify(client, "Enkhluun").get_json()["payment_id"]
    for _ in range(config.PIN_MAX_ATTEMPTS - 1):
        assert client.post("/api/pay/confirm", json={"payment_id": pid, "pin": "1111"}).status_code == 401
    last = client.post("/api/pay/confirm", json={"payment_id": pid, "pin": "1111"})
    assert last.status_code == 423
    assert identify(client, "Enkhluun").status_code == 423


def test_insufficient_funds(client):
    enroll(client, "Enkhluun")
    pid = identify(client, "Enkhluun", amount=config.DEFAULT_BALANCE + 1).get_json()["payment_id"]
    res = client.post("/api/pay/confirm", json={"payment_id": pid, "pin": "2580"})
    assert res.status_code == 402
    txs = client.get("/api/users/Enkhluun/transactions").get_json()
    assert txs[0]["status"] == "FAILED" and txs[0]["reason"] == "insufficient_funds"


def test_disable_faceid(client):
    enroll(client, "Enkhluun")
    res = client.delete("/api/users/Enkhluun/faceid").get_json()
    assert not res["user"]["faceid"]["enabled"] and not res["user"]["pin_set"]
    assert identify(client, "Enkhluun").status_code == 404


def test_admin_pages_render(client):
    enroll(client, "Enkhluun")
    for path in ("/", "/register", "/payment", "/transactions"):
        assert client.get(path).status_code == 200


# ------------------------------------------------------ real model (slow)
@pytest.mark.models
def test_real_models_identify_team_photos():
    """Enrol photo 1+2 of each person with the real models, identify with photo 3."""
    from face_engine import build_template, decode_image, engine

    db.use_db(db.get_db().client["biometric_pay_test"])
    db.get_db().client.drop_database("biometric_pay_test")
    db.ensure_indexes()
    people = sorted(p for p in (ROOT / "faces").iterdir() if p.is_dir())
    for folder in people:
        embs = [engine.analyze(decode_image((folder / f"{i}.jpg").read_bytes())).embedding for i in (1, 2)]
        user = db.create_user(folder.name, 1000)
        db.save_faceid(user["_id"], {"enabled": True, "model": config.RECOGNIZER, "embeddings": [e.tolist() for e in embs],
                                     "centroid": build_template(embs).tolist(), "poses": ["center"] * 2}, "x")
    for folder in people:
        probe = engine.analyze(decode_image((folder / "3.jpg").read_bytes()))
        user, score, margin, _ = app_module.identify(probe.embedding)
        assert user["name"] == folder.name and score >= config.MATCH_THRESHOLD and margin >= config.MATCH_MARGIN
        assert probe.liveness >= config.LIVENESS_THRESHOLD
