"""Import the team's reference photos (faces/<Name>/*.jpg) into MongoDB.

    python seed_faces.py               # every folder, PIN 1357
    python seed_faces.py --pin 2580 --balance 300000
    python seed_faces.py --only Enkhluun

Each folder becomes a user with Face Pay enabled. The photos are only read to
compute embeddings; the images themselves are not stored in the database.
These photos are frontal only, so the template is weaker than one made in the
bank app's setup flow (5 head poses + liveness). Re-enrol in the app for the demo.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import config
import db
from face_engine import FaceError, build_template, decode_image, engine
from security import hash_pin, pin_problem


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--faces", default=str(config.BASE_DIR / "faces"))
    parser.add_argument("--pin", default="1357", help="PIN given to every seeded user")
    parser.add_argument("--balance", type=int, default=config.DEFAULT_BALANCE)
    parser.add_argument("--only", nargs="*", help="limit to these folder names")
    args = parser.parse_args()

    if problem := pin_problem(args.pin):
        raise SystemExit(problem)
    db.ensure_indexes()

    for folder in sorted(p for p in Path(args.faces).iterdir() if p.is_dir()):
        if args.only and folder.name not in args.only:
            continue
        embeddings, weights = [], []
        for image_path in sorted(folder.glob("*")):
            if image_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                continue
            try:
                frame = engine.analyze(decode_image(image_path.read_bytes()), quality=True, liveness=False, pose=False)
            except FaceError as err:
                print(f"  ✗ {image_path.name}: {err.message}")
                continue
            embeddings.append(frame.embedding)
            weights.append(frame.quality or 0.5)
            print(f"  ✓ {image_path.name}: quality={frame.quality:.2f}")
        if not embeddings:
            print(f"✗ {folder.name}: no usable photo, skipped")
            continue

        user = db.find_user(folder.name) or db.create_user(folder.name, args.balance)
        faceid = {
            "enabled": True,
            "model": config.RECOGNIZER,
            "embeddings": [e.tolist() for e in embeddings],
            "centroid": build_template(embeddings, weights).tolist(),
            "poses": ["center"] * len(embeddings),
            "quality": [round(w, 4) for w in weights],
            "source": "seed",
            "enrolled_at": db.now(),
        }
        db.save_faceid(user["_id"], faceid, hash_pin(args.pin))
        print(f"✓ {folder.name}: {len(embeddings)} photo(s) enrolled, PIN {args.pin}")


if __name__ == "__main__":
    main()
