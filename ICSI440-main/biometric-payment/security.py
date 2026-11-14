"""PIN handling and small privacy helpers."""

from __future__ import annotations

from werkzeug.security import check_password_hash, generate_password_hash

import config


def pin_problem(pin: str) -> str | None:
    """Return a Mongolian error message if the PIN is not acceptable, else None."""
    if not isinstance(pin, str) or not pin.isdigit() or len(pin) != config.PIN_LENGTH:
        return f"ПИН код {config.PIN_LENGTH} оронтой тоо байх ёстой."
    if len(set(pin)) == 1:
        return "Бүх цифр ижил ПИН код ашиглах боломжгүй."
    digits = [int(c) for c in pin]
    steps = {b - a for a, b in zip(digits, digits[1:])}
    if steps in ({1}, {-1}):
        return "Дараалсан цифр (жишээ нь 1234) ашиглах боломжгүй."
    return None


def hash_pin(pin: str) -> str:
    # scrypt with a random salt (werkzeug default); the plain PIN is never stored.
    return generate_password_hash(pin)


def check_pin(pin_hash: str, pin: str) -> bool:
    return bool(pin_hash) and check_password_hash(pin_hash, pin)


def mask_name(name: str) -> str:
    """'Enkhluun' -> 'E******n' (what a POS terminal may show to bystanders)."""
    name = name.strip()
    if len(name) <= 2:
        return name[0] + "*" if name else ""
    return name[0] + "*" * (len(name) - 2) + name[-1]
