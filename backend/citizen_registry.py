"""
Plain-JSON registry of citizens who opt in (name, phone number, address +
their location) to receive real SMS/WhatsApp alerts, once, at registration
time - not a database, matching the rest of this repo's data/processed/*
pattern, and this registry only ever needs to hold a handful of real
registrations for a live pitch demo.

Feeds the admin-side "testing controls" flow (backend/app.py's
/api/citizens/test-alert): pick one or more registered citizens ("that
area" - each carries the address/location they registered with), bump the
rainfall number, and fire a real (or dry-run, see alerts.py) Twilio
message referencing it, so the notification pipeline can be demonstrated
live instead of only described.
"""
import json
import os
import uuid
from datetime import datetime, timezone

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REGISTRY_PATH = os.path.join(REPO_ROOT, "data", "processed", "registered_citizens.json")


def _load() -> list[dict]:
    if not os.path.exists(REGISTRY_PATH):
        return []
    with open(REGISTRY_PATH, encoding="utf-8") as f:
        return json.load(f)


def _save(citizens: list[dict]) -> None:
    os.makedirs(os.path.dirname(REGISTRY_PATH), exist_ok=True)
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(citizens, f, indent=2)


def list_citizens() -> list[dict]:
    return _load()


def register_citizen(name: str, phone_number: str, address: str, lat: float, lon: float) -> dict:
    citizens = _load()
    record = {
        "id": uuid.uuid4().hex[:10],
        "name": name,
        "phone_number": phone_number,
        "address": address,
        "lat": lat,
        "lon": lon,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }
    citizens.append(record)
    _save(citizens)
    return record


def delete_citizen(citizen_id: str) -> bool:
    citizens = _load()
    remaining = [c for c in citizens if c["id"] != citizen_id]
    if len(remaining) == len(citizens):
        return False
    _save(remaining)
    return True


def get_citizens(citizen_ids: list[str] | None) -> list[dict]:
    citizens = _load()
    if citizen_ids is None:
        return citizens
    wanted = set(citizen_ids)
    return [c for c in citizens if c["id"] in wanted]
