# ICSI440 — TDB Face Pay (HCI project: ML & face recognition)

A TDB-style mobile bank app with Face Pay. The frontend runs as a standard Vite + React app and does not require pnpm.

## Quick start

```bash
# 1) backend
cd biometric-payment
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
docker compose up -d
python download_models.py
python app.py

# 2) frontend
cd ../bank
npm install
npm run fetch-models   # optional: copy the MediaPipe face model locally
npm run dev            # https://localhost:8443
```

The frontend works with plain Node/npm. If you prefer pnpm, it also works, but it is not required.
