"""Measure recognition accuracy on faces/<Name>/*.jpg - numbers for the report.

    python evaluate.py                       # current RECOGNIZER from .env
    python evaluate.py --all                 # compare AdaFace IR-50/IR-101, ArcFace R50

Prints genuine (same person) vs impostor (different people) cosine
similarities, FAR/FRR at several thresholds, the equal error rate, and
leave-one-out 1:N identification accuracy. Add more people/photos to
faces/ for more meaningful numbers.
"""

from __future__ import annotations

import argparse
import itertools
from pathlib import Path

import numpy as np

import config


def load(faces_dir: Path):
    from face_engine import FaceError, decode_image, engine

    items = []
    for path in sorted(faces_dir.glob("*/*")):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        try:
            frame = engine.analyze(decode_image(path.read_bytes()), quality=True, pose=False, state=False)
        except FaceError as err:
            print(f"skip {path}: {err.message}")
            continue
        items.append((path.parent.name, path.name, frame))
    return items


def evaluate(items) -> None:
    genuine, impostor = [], []
    for (n1, _, f1), (n2, _, f2) in itertools.combinations(items, 2):
        s = float(np.dot(f1.embedding, f2.embedding))
        (genuine if n1 == n2 else impostor).append(s)
    genuine, impostor = np.array(genuine), np.array(impostor)
    print(f"  people={len({i[0] for i in items})} photos={len(items)} genuine pairs={len(genuine)} impostor pairs={len(impostor)}")
    print(f"  genuine  similarity: mean {genuine.mean():.3f}  min {genuine.min():.3f}")
    print(f"  impostor similarity: mean {impostor.mean():.3f}  max {impostor.max():.3f}")
    print(f"  separation (min genuine - max impostor): {genuine.min() - impostor.max():+.3f}")
    print("  threshold    FAR      FRR")
    best = (1.0, 0.0)
    for t in np.arange(0.20, 0.81, 0.05):
        far = float((impostor >= t).mean())
        frr = float((genuine < t).mean())
        mark = "  <- MATCH_THRESHOLD" if abs(t - config.MATCH_THRESHOLD) < 0.025 else ""
        print(f"    {t:.2f}     {far:6.2%}   {frr:6.2%}{mark}")
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), t)
    print(f"  ~EER threshold: {best[1]:.2f}")

    # Leave-one-out 1:N identification: each photo vs. everyone's other photos.
    correct = 0
    for i, (name, _, probe) in enumerate(items):
        scores: dict[str, float] = {}
        for j, (other, _, ref) in enumerate(items):
            if i != j:
                scores[other] = max(scores.get(other, -1.0), float(np.dot(probe.embedding, ref.embedding)))
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        ok = ranked[0][0] == name and ranked[0][1] >= config.MATCH_THRESHOLD
        correct += ok
    print(f"  1:N leave-one-out accuracy @ {config.MATCH_THRESHOLD}: {correct}/{len(items)} = {correct / len(items):.1%}")
    q = [i[2].quality for i in items]
    live = [i[2].liveness for i in items]
    print(f"  eDifFIQA quality: mean {np.mean(q):.3f}  min {np.min(q):.3f}")
    print(f"  MiniFASNet P(real): mean {np.mean(live):.3f}  min {np.min(live):.3f}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--faces", default=str(config.BASE_DIR / "faces"))
    parser.add_argument("--all", action="store_true", help="compare every supported recogniser")
    args = parser.parse_args()
    names = ["adaface_ir50", "adaface_ir101", "arcface_r50"] if args.all else [config.RECOGNIZER]
    for name in names:
        config.RECOGNIZER = name
        import face_engine

        face_engine.engine = face_engine.FaceEngine()
        print(f"\n== {name}")
        evaluate(load(Path(args.faces)))


if __name__ == "__main__":
    main()
