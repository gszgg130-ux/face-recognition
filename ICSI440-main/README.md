# ICSI440 — TDB Face Pay (HCI project: ML & face recognition)

A TDB-style mobile bank app with **Face Pay**: the customer sets up pay-by-face
in the bank app, then pays at a store's **POS terminal** by looking at the
camera and entering a 4-digit PIN. The terminal flow follows the Korean
face-pay terminals in convenience stores (e.g. Toss FacePay at CU, GS25 and
7-Eleven): the cashier rings up the order, and the customer-facing screen
offers "pay with face", runs the camera check, and confirms.

```
bank/                React + Vite + Tailwind web app  (Bank app ⇄ POS terminal switch at the top)
biometric-payment/   Flask API + MongoDB + ONNX face models (detection, recognition, liveness)
```

## Quick start

```bash
# 1) backend
cd biometric-payment
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
docker compose up -d            # MongoDB (or set MONGODB_URI in .env for Atlas)
python download_models.py       # one-time model download
python app.py                   # http://127.0.0.1:5000

# 2) web app (new terminal)
cd bank
pnpm install                    # or npm install
pnpm fetch-models               # optional: offline copy of the MediaPipe face model
pnpm dev                        # https://localhost:8443
```

## Using it from a phone or another laptop (same Wi-Fi)

The dev server runs on HTTPS, because browsers only allow the camera on secure pages.

1. Start both servers on one computer as above. `npm run dev` prints a line like
   `Network: https://192.168.1.23:8443/`.
2. On the other device, open that `https://…:8443` address. It must be on the same Wi-Fi.
3. The certificate is self-signed, so the browser shows a warning once. Chrome: **Advanced → Proceed**. Safari/iPhone: **Show Details → visit this website**.
4. If macOS asks whether `node` may accept incoming connections, click **Allow**.

Only the website needs to be reachable. Flask stays on `127.0.0.1` and is
reached through the website's `/api` proxy. To turn HTTPS off: `HTTPS=0 npm run dev`.

## Demo script

1. **Банк апп** → tap **Face Pay тохируулах** (also under Үйлчилгээ → Face Pay).
2. Read the guidelines. *Үргэлжлүүлэх* stays disabled until you scroll to the end and tick the consent box.
3. Scan your face: look straight → left → right → up → down → blink. The ring fills automatically when the pose is right.
4. Create a 4-digit PIN and confirm it. Weak PINs such as 1234 or 0000 are rejected.
5. Switch to **POS терминал** at the top. On the cashier panel, add items → *Терминал руу төлбөр илгээх*.
6. On the terminal, tap **Нүүрээр төлөх** → follow the random challenge → "E\*\*\*\*\*\*n, та мөн үү?" → enter the PIN on the scrambled keypad → approved.
7. Switch back to the bank app. The Face Pay purchase shows in Сүүлийн гүйлгээ, and the eye button reveals the new balance.

The **ML дэлгэрэнгүй** panel next to the terminal shows each model's scores
(P(real), head pose, eye state, quality, similarity vs. threshold, latency). Use it to explain the system in the presentation.

See [`biometric-payment/README.md`](biometric-payment/README.md) for the models, thresholds, API and evaluation.
