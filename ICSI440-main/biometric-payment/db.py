"""MongoDB access (replaces the PostgreSQL/SQLAlchemy models of the old branch).

Collections
-----------
users             one document per customer: balance, Face Pay template, PIN hash
transactions      every payment attempt (success and failure) for the audit trail
challenges        single-use liveness challenges            (TTL index, auto-expire)
enrollments       face scans waiting for the PIN step       (TTL index, auto-expire)
payment_sessions  identified faces waiting for PIN confirm  (TTL index, auto-expire)

Only embeddings (512 numbers per pose) are stored - never the camera images.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import certifi
from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument
from pymongo.database import Database
from pymongo.errors import ConfigurationError, OperationFailure, ServerSelectionTimeoutError

import config
from security import mask_name

_client: MongoClient | None = None
_db: Database | None = None
_last_error: str | None = None


def now() -> datetime:
    return datetime.now(UTC)


def get_db() -> Database:
    global _client, _db
    if _db is None:
        options = {"serverSelectionTimeoutMS": 8000, "tz_aware": True}
        if config.MONGODB_URI.startswith("mongodb+srv://") or "tls=true" in config.MONGODB_URI.lower():
            # Atlas uses TLS. python.org builds on macOS ship without root certificates,
            # which fails with CERTIFICATE_VERIFY_FAILED, so use certifi's CA bundle.
            options["tlsCAFile"] = certifi.where()
        _client = MongoClient(config.MONGODB_URI, **options)
        _db = _client[config.MONGODB_DB]
    return _db


def use_db(database: Database) -> None:
    """Inject a database (used by the tests with mongomock)."""
    global _db
    _db = database


def ensure_indexes() -> None:
    db = get_db()
    db.users.create_index([("name_lower", ASCENDING)], unique=True)
    db.transactions.create_index([("created_at", DESCENDING)])
    db.transactions.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    for name in ("challenges", "enrollments", "payment_sessions"):
        db[name].create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)


def explain(exc: Exception) -> str:
    """Turn a PyMongo exception into a short, actionable message."""
    text = str(exc)
    low = text.lower()
    if isinstance(exc, OperationFailure) and (exc.code in (8000, 18) or "auth" in low):
        return (
            "Username or password is wrong. In Atlas open Database Access, reset the user's "
            "password, and paste it into MONGODB_URI in .env (without < >)."
        )
    if isinstance(exc, ConfigurationError) or "dns" in low or "resolution" in low or "srv" in low:
        return (
            "Could not resolve the cluster address (DNS SRV lookup failed). Check the host in "
            "MONGODB_URI. If it is correct, your network may block SRV lookups: in Atlas choose "
            "Drivers -> Python -> an older driver version to get the mongodb:// (non-srv) string."
        )
    if "certificate_verify_failed" in low:
        return "SSL certificate check failed. Run: pip install --upgrade certifi"
    if isinstance(exc, ServerSelectionTimeoutError):
        return (
            "Cannot reach the cluster. Most likely your IP is not allowed: in Atlas open "
            "Network Access -> Add IP Address -> Add current IP (or 0.0.0.0/0 for the demo). "
            "University/office Wi-Fi may also block port 27017; try a phone hotspot."
        )
    return text[:300]


def ping() -> bool:
    global _last_error
    try:
        get_db().command("ping")
        _last_error = None
        return True
    except Exception as exc:  # noqa: BLE001
        _last_error = explain(exc)
        return False


def last_error() -> str | None:
    return _last_error


# --------------------------------------------------------------------- users
def find_user(name: str) -> dict | None:
    return get_db().users.find_one({"name_lower": name.strip().lower()})


def get_user(user_id: ObjectId | str) -> dict | None:
    return get_db().users.find_one({"_id": ObjectId(user_id)})


def create_user(name: str, balance: int) -> dict:
    doc = {
        "name": name.strip(),
        "name_lower": name.strip().lower(),
        "balance": int(balance),
        "faceid": None,
        "pin": None,
        "created_at": now(),
    }
    doc["_id"] = get_db().users.insert_one(doc).inserted_id
    return doc


def ensure_user(name: str) -> dict:
    return find_user(name) or create_user(name, config.DEFAULT_BALANCE)


def list_users() -> list[dict]:
    return list(get_db().users.find().sort("created_at", ASCENDING))


def enrolled_users() -> list[dict]:
    return list(get_db().users.find({"faceid.enabled": True}, {"name": 1, "faceid": 1, "pin": 1}))


def public_user(user: dict) -> dict:
    face = user.get("faceid") or {}
    pin = user.get("pin") or {}
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "masked_name": mask_name(user["name"]),
        "balance": user.get("balance", 0),
        "faceid": {
            "enabled": bool(face.get("enabled")),
            "enrolled_at": face.get("enrolled_at").isoformat() if face.get("enrolled_at") else None,
            "poses": face.get("poses", []),
            "model": face.get("model"),
            "source": face.get("source"),
        },
        "pin_set": bool(pin.get("hash")),
        "pin_locked": bool(pin.get("locked_until") and pin["locked_until"] > now()),
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
    }


def save_faceid(user_id: ObjectId, faceid: dict, pin_hash: str) -> None:
    get_db().users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "faceid": faceid,
                "pin": {"hash": pin_hash, "set_at": now(), "failed_attempts": 0, "locked_until": None},
            }
        },
    )


def disable_faceid(user_id: ObjectId) -> None:
    get_db().users.update_one({"_id": user_id}, {"$set": {"faceid": None, "pin": None}})


def debit(user_id: ObjectId, amount: int) -> dict | None:
    """Atomically subtract ``amount`` if the balance covers it; returns the updated user or None."""
    return get_db().users.find_one_and_update(
        {"_id": user_id, "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}},
        return_document=ReturnDocument.AFTER,
    )


def register_pin_failure(user_id: ObjectId) -> tuple[int, datetime | None]:
    """Count a wrong PIN; lock Face Pay after PIN_MAX_ATTEMPTS. Returns (attempts_left, locked_until)."""
    user = get_db().users.find_one_and_update(
        {"_id": user_id}, {"$inc": {"pin.failed_attempts": 1}}, return_document=ReturnDocument.AFTER
    )
    failed = (user.get("pin") or {}).get("failed_attempts", 0)
    if failed >= config.PIN_MAX_ATTEMPTS:
        until = now() + timedelta(minutes=config.PIN_LOCK_MINUTES)
        get_db().users.update_one({"_id": user_id}, {"$set": {"pin.locked_until": until, "pin.failed_attempts": 0}})
        return 0, until
    return config.PIN_MAX_ATTEMPTS - failed, None


def reset_pin_failures(user_id: ObjectId) -> None:
    get_db().users.update_one({"_id": user_id}, {"$set": {"pin.failed_attempts": 0, "pin.locked_until": None}})


# -------------------------------------------------------------- transactions
def add_transaction(user: dict | None, amount: int, status: str, **extra) -> dict:
    doc = {
        "user_id": user["_id"] if user else None,
        "user_name": user["name"] if user else None,
        "amount": int(amount),
        "status": status,
        "created_at": now(),
        **extra,
    }
    doc["_id"] = get_db().transactions.insert_one(doc).inserted_id
    return doc


def list_transactions(user_id: ObjectId | None = None, limit: int = 50) -> list[dict]:
    query = {"user_id": user_id} if user_id else {}
    return list(get_db().transactions.find(query).sort("created_at", DESCENDING).limit(limit))


def public_transaction(tx: dict) -> dict:
    return {
        "id": str(tx["_id"]),
        "user_name": tx.get("user_name"),
        "amount": tx["amount"],
        "status": tx["status"],
        "method": tx.get("method", "manual"),
        "merchant": tx.get("merchant"),
        "reason": tx.get("reason"),
        "approval_code": tx.get("approval_code"),
        "match_score": tx.get("match_score"),
        "liveness": tx.get("liveness"),
        "balance_after": tx.get("balance_after"),
        "created_at": tx["created_at"].isoformat(),
    }


# ------------------------------------------------------- short-lived sessions
def put_session(collection: str, doc: dict, ttl_seconds: int) -> str:
    doc = {**doc, "created_at": now(), "expires_at": now() + timedelta(seconds=ttl_seconds)}
    return str(get_db()[collection].insert_one(doc).inserted_id)


def take_session(collection: str, session_id: str, *, consume: bool, **match) -> dict | None:
    """Fetch a live session (and optionally delete it so it can only be used once)."""
    try:
        query = {"_id": ObjectId(session_id), "expires_at": {"$gt": now()}, **match}
    except Exception:  # noqa: BLE001 - malformed id
        return None
    coll = get_db()[collection]
    return coll.find_one_and_delete(query) if consume else coll.find_one(query)


def update_session(collection: str, session_id: str, update: dict) -> None:
    get_db()[collection].update_one({"_id": ObjectId(session_id)}, update)


def drop_session(collection: str, session_id: str) -> None:
    try:
        get_db()[collection].delete_one({"_id": ObjectId(session_id)})
    except Exception:  # noqa: BLE001
        pass
