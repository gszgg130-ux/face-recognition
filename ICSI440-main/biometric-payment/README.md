# TDB Face Pay — backend (Flask + MongoDB + ONNX face models)

Pay-by-face backend for the ICSI440 HCI project. It serves the JSON API used by
the React app in `../bank` (bank **Face Pay setup** + **POS terminal**) and a
small admin site.

## Run it

Requires Python 3.11+ and MongoDB.

```bash
cd biometric-payment
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # edit MONGODB_URI if you use Atlas

docker compose up -d          # local MongoDB 8 on :27017 (or use MongoDB Atlas / Homebrew mongod)
python download_models.py     # one-time, ~280 MB of ONNX weights into ./models
python seed_faces.py          # optional: enrol the photos in faces/<Name>/ (PIN 1357)
python app.py                 # API + admin on http://127.0.0.1:5000
```

Then in another terminal start the web app (`cd ../bank && pnpm dev`) and open
<https://localhost:8443>. The certificate is self-signed, so accept the browser
warning once. Vite proxies `/api` to Flask, so no CORS setup is needed, and other
devices on the same Wi-Fi can use `https://<this-computer's-IP>:8443`.

If the database doesn't connect, run `python check_db.py`. It prints the exact
reason (wrong password, IP not allowed in Atlas Network Access, DNS, SSL) and how to fix it.

Admin pages: `/` users and Face Pay status · `/register` · `/payment` (manual) · `/transactions`.

## What changed from the `add-biometric-payment` branch

| Before (branch) | Now |
|---|---|
| PostgreSQL via SQLAlchemy | **MongoDB** via PyMongo (`db.py`), TTL indexes for short-lived sessions |
| DeepFace, OpenCV Haar detector, Facenet512 | **SCRFD-10G** detector + **AdaFace IR-50** embeddings (ONNX, via `uniface`) |
| Re-ran `DeepFace.verify` against every JPG in `faces/` per request | Embeddings computed once at enrolment and stored. A payment is 1 forward pass per frame + vector compare |
| No liveness (a printed photo worked) | 3-layer liveness: **MiniFASNet** anti-spoofing, random **head-turn/blink challenge** checked server-side, cross-frame identity + motion check |
| Face only | Face **+ 4-digit PIN** (scrypt-hashed, lockout after 5 wrong tries) |
| 1 frontal photo | **5 head poses** (front, left, right, up, down) + blink, quality-gated with **eDifFIQA** |
| Stored face photos | Stores **only embeddings**, never images |

`camera.py`, `recognize_gerelmaa.py`, `test_face.py`, `models.py` and
`face_utils.py` were replaced by `face_engine.py`. `register_face.py` and
`recognize_all.py` still work as webcam CLI tools on the new engine.
`templates/biometric_payment.html` is replaced by the React POS view.

## The ML pipeline (`face_engine.py`, `liveness.py`)

```
browser                                    server (per frame)
MediaPipe Face Landmarker  ──JPEG──▶  SCRFD-10G  ─▶ quality gate ─▶ MiniFASNet V2+V1SE ─▶ HeadPose ─▶ FaceAttribNet ─▶ AdaFace IR-50
(478 pts, pose, blink:                (box + 5     (size, blur,     (P(real))            (yaw/pitch)  (eyes open,      (512-D, cosine
 guidance + auto-capture)              landmarks)   light, eDifFIQA)                                  mask, sunglasses) vs. MongoDB)
```

* **Detection:** SCRFD-10G-KPS (InsightFace), the largest face is the customer. A second face of similar size is rejected.
* **Recognition:** AdaFace IR-50 (CVPR 2022, WebFace4M). Its quality-adaptive margin keeps it robust on webcam-quality frames. Set `RECOGNIZER=adaface_ir101` (most accurate, slower) or `arcface_r50` in `.env`.
* **1:N identification:** best cosine similarity ≥ `MATCH_THRESHOLD` (0.45), and the best identity must beat the runner-up by `MATCH_MARGIN` (0.08). This is an open-set check, so a stranger is not matched to the nearest customer.
* **Passive liveness:** MiniFASNet V2 (crop scale 2.7) + V1SE (scale 4.0), mean P(real) ≥ 0.70.
* **Active liveness:** the server issues a random, single-use challenge (expires after 90 s). It re-measures head pose (yaw from the 6D-rotation network; pitch direction from landmark geometry) and eye state (FaceAttribNet) on the returned frames. It does not trust the browser's own measurements.
* **Consistency:** every frame must match the frontal frame (≥ 0.40), and the frames must not be one still image sent several times.
* **Second factor:** PIN, scrypt-hashed with werkzeug. 5 wrong PINs lock Face Pay for 15 minutes. Payment sessions are single-use, so a double tap cannot charge twice.

All thresholds are in `config.py` and can be overridden from `.env`.

### Measured on `faces/` (4 people × 3 photos, `python evaluate.py`)

| | AdaFace IR-50 |
|---|---|
| genuine similarity (same person) | mean 0.872, min 0.798 |
| impostor similarity (different people) | mean 0.100, max 0.288 |
| separation (min genuine − max impostor) | +0.51 |
| FAR / FRR at threshold 0.45 | 0% / 0% |
| leave-one-out 1:N accuracy | 12 / 12 |

This set is small, so add more people and photos for numbers you can put in
the report. `python evaluate.py --all` compares all three recognisers.

## API

| Method | Path | Body |
|---|---|---|
| GET | `/api/health` | — |
| GET/POST | `/api/users` | `{name, balance}` |
| GET | `/api/users/<name>` · `/api/users/<name>/transactions` | — |
| DELETE | `/api/users/<name>/faceid` | turns Face Pay off and deletes the template + PIN |
| POST | `/api/liveness/challenge` | `{purpose: "enroll" \| "pay"}` → `{challenge_id, steps}` |
| POST | `/api/enroll/faces` | `{name, challenge_id, frames: [{step, image}]}` → `{enrollment_id}` |
| POST | `/api/enroll/pin` | `{enrollment_id, pin}` |
| POST | `/api/pay/identify` | `{challenge_id, frames, amount, merchant}` → `{payment_id, user: {masked_name}}` |
| POST | `/api/pay/confirm` | `{payment_id, pin}` → `{transaction}` |
| POST | `/api/pay/cancel` | `{payment_id}` |

Errors return `{success: false, code, message}`. `message` is in Mongolian and
is shown in the UI as-is. Liveness and recognition responses include a
`report` with every measured value; the POS "ML дэлгэрэнгүй" panel displays it.

## Tests

```bash
pytest              # API logic against MongoDB (database biometric_pay_test), stubbed camera
pytest -m models    # + real ONNX models on faces/
```

## Notes

* Model licences: the InsightFace weights (SCRFD, ArcFace) are released for
  non-commercial research only. Check each model's licence before using it
  outside the class.
* `faces/` holds teammates' photos. They are biometric data, so keep the repo private.
