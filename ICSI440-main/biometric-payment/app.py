"""TDB Face Pay - Flask API + small admin site, backed by MongoDB.

Run:  python app.py           (API on http://127.0.0.1:5000)

JSON API used by the React app (bank/):
  GET    /api/health
  GET    /api/users                      list customers
  POST   /api/users                      {name, balance}
  GET    /api/users/<name>               profile + Face Pay status
  GET    /api/users/<name>/transactions
  DELETE /api/users/<name>/faceid        turn Face Pay off (deletes template + PIN)
  POST   /api/liveness/challenge         {purpose: "enroll" | "pay"}
  POST   /api/enroll/faces               {name, challenge_id, frames:[{step, image}]}
  POST   /api/enroll/pin                 {enrollment_id, pin}
  POST   /api/pay/identify               {challenge_id, frames, amount, merchant}
  POST   /api/pay/confirm                {payment_id, pin}
  POST   /api/pay/cancel                 {payment_id}
  GET    /api/transactions

Admin pages (HTML): /  /register  /payment  /transactions
"""

from __future__ import annotations

import secrets
import threading
import time

from flask import Flask, jsonify, redirect, render_template, request, url_for
from flask_cors import CORS

import config
import db
import liveness
from face_engine import FaceError, build_template, decode_image, engine, match_score
from security import check_pin, hash_pin, mask_name, pin_problem

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = config.MAX_UPLOAD_MB * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS}})


# =====================================================================
# helpers
# =====================================================================
class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, **extra):
        super().__init__(message)
        self.code, self.message, self.status, self.extra = code, message, status, extra


@app.errorhandler(ApiError)
def _api_error(err: ApiError):
    return jsonify({"success": False, "code": err.code, "message": err.message, **err.extra}), err.status


@app.errorhandler(413)
def _too_large(_err):
    return jsonify({"success": False, "code": "too_large", "message": "Илгээсэн зураг хэт том байна."}), 413


def body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("bad_request", "JSON мэдээлэл ирсэнгүй.")
    return data


def parse_amount(value) -> int:
    try:
        amount = int(round(float(value)))
    except (TypeError, ValueError):
        raise ApiError("bad_amount", "Төлбөрийн дүн буруу байна.") from None
    if amount <= 0:
        raise ApiError("bad_amount", "Төлбөрийн дүн 0-ээс их байх ёстой.")
    return amount


def user_or_404(name: str) -> dict:
    user = db.find_user(name)
    if not user:
        raise ApiError("user_not_found", "Хэрэглэгч олдсонгүй.", 404)
    return user


def analyze_frames(challenge: dict, frames: list, *, quality_for: set[str]) -> tuple[list, list, list[str]]:
    """Decode + analyse the frames that answer a liveness challenge."""
    steps = challenge["steps"]
    if not isinstance(frames, list) or [f.get("step") for f in frames if isinstance(f, dict)] != steps:
        raise ApiError("bad_frames", "Шалгалтын алхмууд таарахгүй байна. Дахин эхлүүлнэ үү.")
    images, analyses = [], []
    for frame in frames:
        step = frame["step"]
        try:
            image = decode_image(frame.get("image") or "")
            analyses.append(
                engine.analyze(image, quality=step in quality_for, enforce_quality=step != "blink")
            )
        except FaceError as err:
            raise ApiError(err.code, err.message, 422, step=step, step_label=liveness.STEP_LABELS[step]) from None
        images.append(image)
    return images, analyses, steps


def take_challenge(challenge_id: str, purpose: str) -> dict:
    challenge = db.take_session("challenges", challenge_id or "", consume=True, purpose=purpose)
    if not challenge:
        raise ApiError("challenge_expired", "Шалгалтын хугацаа дууссан. Дахин эхлүүлнэ үү.", 410)
    return challenge


def report(steps, analyses, live) -> dict:
    return {
        "frames": [{"step": s, **a.report()} for s, a in zip(steps, analyses, strict=True)],
        "liveness": live,
        "models": engine.info,
    }


# =====================================================================
# API - system
# =====================================================================
@app.get("/api/health")
def health():
    return jsonify(
        {
            "ok": True,
            "db": db.ping(),
            "db_error": db.last_error(),
            "models_ready": engine.ready,
            "models": engine.info,
            "pin_length": config.PIN_LENGTH,
            "thresholds": {
                "match": config.MATCH_THRESHOLD,
                "margin": config.MATCH_MARGIN,
                "liveness": config.LIVENESS_THRESHOLD,
                "turn_deg": config.TURN_MIN_DEG,
                "nod_deg": config.NOD_MIN_DEG,
            },
        }
    )


# =====================================================================
# API - users
# =====================================================================
@app.get("/api/users")
def api_users():
    return jsonify([db.public_user(u) for u in db.list_users()])


@app.post("/api/users")
def api_create_user():
    data = body()
    name = str(data.get("name", "")).strip()
    if not name:
        raise ApiError("bad_name", "Хэрэглэгчийн нэр оруулна уу.")
    if db.find_user(name):
        raise ApiError("user_exists", "Энэ нэртэй хэрэглэгч бүртгэлтэй байна.", 409)
    balance = data.get("balance", config.DEFAULT_BALANCE)
    try:
        balance = int(balance)
    except (TypeError, ValueError):
        raise ApiError("bad_balance", "Үлдэгдлийн утга буруу байна.") from None
    if balance < 0:
        raise ApiError("bad_balance", "Үлдэгдэл сөрөг байж болохгүй.")
    return jsonify(db.public_user(db.create_user(name, balance))), 201


@app.get("/api/users/<name>")
def api_user(name):
    return jsonify(db.public_user(user_or_404(name)))


@app.get("/api/users/<name>/transactions")
def api_user_transactions(name):
    user = user_or_404(name)
    limit = min(int(request.args.get("limit", 20)), 100)
    return jsonify([db.public_transaction(t) for t in db.list_transactions(user["_id"], limit)])


@app.delete("/api/users/<name>/faceid")
def api_disable_faceid(name):
    user = user_or_404(name)
    db.disable_faceid(user["_id"])
    return jsonify({"success": True, "user": db.public_user(db.get_user(user["_id"]))})


@app.get("/api/transactions")
def api_transactions():
    limit = min(int(request.args.get("limit", 50)), 200)
    return jsonify([db.public_transaction(t) for t in db.list_transactions(limit=limit)])


# =====================================================================
# API - liveness challenge
# =====================================================================
@app.post("/api/liveness/challenge")
def api_challenge():
    purpose = (request.get_json(silent=True) or {}).get("purpose", "pay")
    if purpose not in ("enroll", "pay"):
        raise ApiError("bad_purpose", "purpose нь enroll эсвэл pay байна.")
    steps = liveness.new_steps(purpose)
    challenge_id = db.put_session("challenges", {"purpose": purpose, "steps": steps}, config.CHALLENGE_TTL_S)
    return jsonify(
        {
            "challenge_id": challenge_id,
            "steps": [{"id": s, "label": liveness.STEP_LABELS[s]} for s in steps],
            "expires_in": config.CHALLENGE_TTL_S,
        }
    )


# =====================================================================
# API - enrolment (bank app "Face Pay setup")
# =====================================================================
TEMPLATE_STEPS = ("center", "turn_left", "turn_right", "look_up", "look_down")


@app.post("/api/enroll/faces")
def api_enroll_faces():
    data = body()
    name = str(data.get("name", "")).strip()
    if not name:
        raise ApiError("bad_name", "Хэрэглэгчийн нэр оруулна уу.")
    challenge = take_challenge(data.get("challenge_id"), "enroll")
    started = time.perf_counter()
    images, analyses, steps = analyze_frames(challenge, data.get("frames"), quality_for=set(TEMPLATE_STEPS))
    live = liveness.verify(steps, images, analyses)
    rep = report(steps, analyses, live)

    if not live["passed"]:
        raise ApiError("liveness_failed", liveness.REASON_MESSAGES.get(live["reason"], "Шалгалт амжилтгүй."), 422, report=rep)

    by_step = dict(zip(steps, analyses, strict=True))
    center = by_step["center"]
    if (center.quality or 0) < config.MIN_QUALITY:
        raise ApiError("low_quality", "Нүүрний зургийн чанар муу байна. Гэрэлтэй газар дахин оролдоно уу.", 422, report=rep)

    user = db.ensure_user(name)
    # Refuse to enrol a face that already unlocks someone else's wallet.
    for other in db.enrolled_users():
        if other["_id"] == user["_id"]:
            continue
        face = other["faceid"]
        if match_score(center.embedding, face["embeddings"], face.get("centroid")) >= config.DUPLICATE_THRESHOLD:
            raise ApiError("duplicate_face", "Энэ царай өөр хэрэглэгч дээр бүртгэлтэй байна.", 409, report=rep)

    samples = [by_step[s] for s in TEMPLATE_STEPS]
    template = build_template([s.embedding for s in samples], [s.quality or 0.5 for s in samples])
    enrollment_id = db.put_session(
        "enrollments",
        {
            "user_id": user["_id"],
            "embeddings": [s.embedding.tolist() for s in samples],
            "centroid": template.tolist(),
            "poses": list(TEMPLATE_STEPS),
            "quality": [round(s.quality or 0, 4) for s in samples],
            "liveness": live["passive"],
        },
        config.ENROLL_SESSION_TTL_S,
    )
    rep["ms_total"] = round((time.perf_counter() - started) * 1000)
    return jsonify(
        {
            "success": True,
            "enrollment_id": enrollment_id,
            "pin_length": config.PIN_LENGTH,
            "user": db.public_user(user),
            "report": rep,
        }
    )


@app.post("/api/enroll/pin")
def api_enroll_pin():
    data = body()
    pin = str(data.get("pin", ""))
    problem = pin_problem(pin)
    if problem:
        raise ApiError("weak_pin", problem)
    enrollment = db.take_session("enrollments", data.get("enrollment_id") or "", consume=True)
    if not enrollment:
        raise ApiError("enrollment_expired", "Бүртгэлийн хугацаа дууссан. Нүүрээ дахин уншуулна уу.", 410)
    faceid = {
        "enabled": True,
        "model": config.RECOGNIZER,
        "embeddings": enrollment["embeddings"],
        "centroid": enrollment["centroid"],
        "poses": enrollment["poses"],
        "quality": enrollment["quality"],
        "liveness": enrollment["liveness"],
        "source": "app",
        "enrolled_at": db.now(),
    }
    db.save_faceid(enrollment["user_id"], faceid, hash_pin(pin))
    return jsonify({"success": True, "user": db.public_user(db.get_user(enrollment["user_id"]))})


# =====================================================================
# API - payment (POS terminal)
# =====================================================================
def identify(probe) -> tuple[dict | None, float, float, list[dict]]:
    """1:N search. Returns (best user, best score, margin to runner-up, top candidates)."""
    ranked = []
    for user in db.enrolled_users():
        face = user["faceid"]
        if face.get("model") != config.RECOGNIZER:
            continue  # template from another model - embeddings are not comparable
        ranked.append((match_score(probe, face["embeddings"], face.get("centroid")), user))
    ranked.sort(key=lambda r: r[0], reverse=True)
    if not ranked:
        return None, -1.0, 0.0, []
    best_score, best = ranked[0]
    margin = best_score - (max(ranked[1][0], 0.0) if len(ranked) > 1 else 0.0)
    top = [{"name": mask_name(u["name"]), "score": round(s, 4)} for s, u in ranked[:3]]
    return best, best_score, margin, top


@app.post("/api/pay/identify")
def api_pay_identify():
    data = body()
    amount = parse_amount(data.get("amount"))
    merchant = str(data.get("merchant") or "POS")[:80]
    challenge = take_challenge(data.get("challenge_id"), "pay")
    started = time.perf_counter()
    images, analyses, steps = analyze_frames(challenge, data.get("frames"), quality_for={"center"})
    live = liveness.verify(steps, images, analyses)
    rep = report(steps, analyses, live)

    if not live["passed"]:
        db.add_transaction(None, amount, "FAILED", method="face", merchant=merchant, reason=f"liveness:{live['reason']}")
        raise ApiError("liveness_failed", liveness.REASON_MESSAGES.get(live["reason"], "Шалгалт амжилтгүй."), 422, report=rep)

    center = dict(zip(steps, analyses, strict=True))["center"]
    user, score, margin, top = identify(center.embedding)
    rep["match"] = {
        "score": round(score, 4),
        "margin": round(margin, 4),
        "threshold": config.MATCH_THRESHOLD,
        "min_margin": config.MATCH_MARGIN,
        "top": top,
    }
    rep["ms_total"] = round((time.perf_counter() - started) * 1000)

    if user is None or score < config.MATCH_THRESHOLD or margin < config.MATCH_MARGIN:
        db.add_transaction(None, amount, "FAILED", method="face", merchant=merchant, reason="no_match", match_score=round(score, 4))
        raise ApiError("no_match", "Таны царай Face Pay-д бүртгэлгүй байна. Банкны апп-аас Face Pay тохируулна уу.", 404, report=rep)

    pin = user.get("pin") or {}
    if pin.get("locked_until") and pin["locked_until"] > db.now():
        raise ApiError("pin_locked", "ПИН код олон удаа буруу орсон тул Face Pay түр түгжигдсэн.", 423, report=rep)

    payment_id = db.put_session(
        "payment_sessions",
        {
            "user_id": user["_id"],
            "amount": amount,
            "merchant": merchant,
            "score": round(score, 4),
            "liveness": live["passive"],
        },
        config.PAYMENT_SESSION_TTL_S,
    )
    return jsonify(
        {
            "success": True,
            "payment_id": payment_id,
            "requires_pin": True,
            "pin_length": config.PIN_LENGTH,
            "amount": amount,
            "user": {"masked_name": mask_name(user["name"]), "initial": user["name"][:1].upper()},
            "expires_in": config.PAYMENT_SESSION_TTL_S,
            "report": rep,
        }
    )


@app.post("/api/pay/confirm")
def api_pay_confirm():
    data = body()
    payment_id = data.get("payment_id") or ""
    session = db.take_session("payment_sessions", payment_id, consume=False)
    if not session:
        raise ApiError("payment_expired", "Төлбөрийн хугацаа дууссан. Дахин оролдоно уу.", 410)
    user = db.get_user(session["user_id"])
    pin = (user or {}).get("pin") or {}
    if not user or not pin.get("hash"):
        db.drop_session("payment_sessions", payment_id)
        raise ApiError("no_pin", "Face Pay идэвхгүй байна.", 409)
    if pin.get("locked_until") and pin["locked_until"] > db.now():
        db.drop_session("payment_sessions", payment_id)
        raise ApiError("pin_locked", "ПИН код олон удаа буруу орсон тул Face Pay түр түгжигдсэн.", 423)

    if not check_pin(pin["hash"], str(data.get("pin", ""))):
        left, locked_until = db.register_pin_failure(user["_id"])
        if locked_until:
            db.drop_session("payment_sessions", payment_id)
            db.add_transaction(user, session["amount"], "FAILED", method="face", merchant=session["merchant"], reason="pin_locked")
            raise ApiError("pin_locked", f"ПИН код {config.PIN_MAX_ATTEMPTS} удаа буруу орлоо. Face Pay {config.PIN_LOCK_MINUTES} минут түгжигдлээ.", 423)
        raise ApiError("wrong_pin", f"ПИН код буруу байна. {left} оролдлого үлдлээ.", 401, attempts_left=left)

    # Consume the session so a double-tap cannot charge twice.
    if not db.take_session("payment_sessions", payment_id, consume=True):
        raise ApiError("payment_expired", "Төлбөрийн хугацаа дууссан. Дахин оролдоно уу.", 410)
    db.reset_pin_failures(user["_id"])
    common = {"method": "face", "merchant": session["merchant"], "match_score": session["score"], "liveness": session["liveness"]}
    updated = db.debit(user["_id"], session["amount"])
    if updated is None:
        db.add_transaction(user, session["amount"], "FAILED", reason="insufficient_funds", **common)
        raise ApiError("insufficient_funds", "Дансны үлдэгдэл хүрэлцэхгүй байна.", 402)

    tx = db.add_transaction(
        user,
        session["amount"],
        "SUCCESS",
        approval_code=f"{secrets.randbelow(10**8):08d}",
        balance_after=updated["balance"],
        **common,
    )
    return jsonify({"success": True, "transaction": db.public_transaction(tx), "user": {"masked_name": mask_name(user["name"])}})


@app.post("/api/pay/cancel")
def api_pay_cancel():
    db.drop_session("payment_sessions", (request.get_json(silent=True) or {}).get("payment_id") or "")
    return jsonify({"success": True})


# =====================================================================
# Admin pages (ported from the add-biometric-payment branch)
# =====================================================================
@app.before_request
def _lazy_indexes():
    # If MongoDB was down at start-up, create the indexes on the first request after it is back.
    if not getattr(app, "_indexes_ready", False) and request.path.startswith("/api") and db.ping():
        db.ensure_indexes()
        app._indexes_ready = True


@app.route("/")
def home():
    return render_template("index.html", users=[db.public_user(u) for u in db.list_users()], db_ok=db.ping())


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        try:
            balance = int(float(request.form.get("balance", "0")))
        except ValueError:
            return render_template("result.html", title="Алдаа", message="Үлдэгдлийн утга буруу байна.")
        if not name:
            return render_template("result.html", title="Алдаа", message="Хэрэглэгчийн нэр оруулна уу.")
        if balance < 0:
            return render_template("result.html", title="Алдаа", message="Үлдэгдэл сөрөг байж болохгүй.")
        if db.find_user(name):
            return render_template("result.html", title="Алдаа", message="Энэ нэртэй хэрэглэгч аль хэдийн бүртгэлтэй байна.")
        db.create_user(name, balance)
        return redirect(url_for("home"))
    return render_template("register.html")


@app.route("/payment", methods=["GET", "POST"])
def payment():
    users = [db.public_user(u) for u in db.list_users()]
    if request.method == "POST":
        user = db.get_user(request.form.get("user_id", ""))
        try:
            amount = int(float(request.form.get("amount", "0")))
        except ValueError:
            amount = 0
        if user is None:
            return render_template("result.html", title="Алдаа", message="Хэрэглэгч олдсонгүй.")
        if amount <= 0:
            return render_template("result.html", title="Алдаа", message="Төлбөрийн дүн 0-ээс их байх ёстой.")
        updated = db.debit(user["_id"], amount)
        if updated is None:
            db.add_transaction(user, amount, "FAILED", method="manual", reason="insufficient_funds")
            return render_template("result.html", title="Төлбөр амжилтгүй", message=f"{user['name']} хэрэглэгчийн үлдэгдэл хүрэлцэхгүй байна.")
        db.add_transaction(user, amount, "SUCCESS", method="manual", balance_after=updated["balance"])
        return render_template(
            "result.html",
            title="Төлбөр амжилттай",
            message=f"{user['name']} хэрэглэгчээс {amount:,} ₮ төлөгдлөө. Үлдэгдэл: {updated['balance']:,} ₮",
        )
    return render_template("payment.html", users=users)


@app.route("/transactions")
def transactions():
    return render_template("transactions.html", transactions=[db.public_transaction(t) for t in db.list_transactions(limit=200)])


@app.route("/biometric-payment")
def biometric_payment_page():
    # The camera payment page now lives in the React app's POS view.
    return redirect(f"{config.FRONTEND_URL}/#pos")


# =====================================================================
def init(warmup: bool = True) -> None:
    if db.ping():
        db.ensure_indexes()
        print(f"MongoDB connected ({config.MONGODB_DB})")
    else:
        # Keep serving so /api/health can report the problem instead of crashing.
        print(f"\n[!] MongoDB is not reachable: {db.last_error()}\n    Test it with: python check_db.py\n")
    if warmup:
        threading.Thread(target=engine.warmup, daemon=True).start()


if __name__ == "__main__":
    init()
    app.run(host=config.HOST, port=config.PORT, debug=False, threaded=True)
