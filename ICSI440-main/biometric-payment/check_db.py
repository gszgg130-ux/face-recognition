"""Check the MongoDB connection in .env and explain what is wrong.

    python check_db.py
"""

from __future__ import annotations

import re

import config
import db


def main() -> None:
    masked = re.sub(r"://([^:/@]+):[^@]*@", r"://\1:****@", config.MONGODB_URI)
    print(f"MONGODB_URI = {masked}")
    print(f"MONGODB_DB  = {config.MONGODB_DB}")
    if "<" in config.MONGODB_URI or ">" in config.MONGODB_URI:
        print("✗ The URI still contains < >. Replace <db_password> with the real password.")
        return
    print("Connecting (up to 8 s)…")
    if db.ping():
        names = db.get_db().list_collection_names()
        print(f"✓ Connected. Collections: {', '.join(names) or '(none yet)'}")
    else:
        print(f"✗ {db.last_error()}")


if __name__ == "__main__":
    main()
