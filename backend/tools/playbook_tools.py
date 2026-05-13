"""Playbook loading and risk threshold helpers for ADK agents."""
import json
import os
from pathlib import Path
from google.cloud import firestore
from config import settings

# Pre-defined playbook IDs mapped to local JSON files
BUILTIN_PLAYBOOKS = {
    "nda_standard_2026": "nda_standard.json",
    "msa_standard_2026": "msa_standard.json",
    "vendor_compliance_2026": "vendor_compliance.json",
}

PLAYBOOKS_DIR = Path(__file__).parent.parent.parent / "playbooks"


def _db() -> firestore.Client:
    return firestore.Client(
        project=settings.GCP_PROJECT,
        database=settings.FIRESTORE_DATABASE,
    )


def load_playbook(playbook_id: str) -> dict:
    """
    Load playbook by ID.
    - Built-in IDs → local JSON file in /playbooks/
    - Custom IDs   → fetch from Firestore playbooks collection
    Returns: {name, description, contract_type, critical_clauses, risk_thresholds, file_uri?}
    """
    if playbook_id in BUILTIN_PLAYBOOKS:
        path = PLAYBOOKS_DIR / BUILTIN_PLAYBOOKS[playbook_id]
        if path.exists():
            return json.loads(path.read_text())
        raise FileNotFoundError(f"Built-in playbook file not found: {path}")

    # Custom playbook from Firestore
    db = _db()
    doc = db.collection("playbooks").document(playbook_id).get()
    if not doc.exists:
        raise ValueError(f"Playbook '{playbook_id}' not found in Firestore")
    return doc.to_dict()


def load_precedents(contract_type: str) -> list[dict]:
    """
    Load precedent clauses for a given contract type from Firestore.
    Returns a list of {clause_type, standard_text, source} dicts.
    """
    db = _db()
    docs = (
        db.collection("precedents")
        .where("contract_type", "==", contract_type.upper())
        .limit(20)
        .stream()
    )
    return [d.to_dict() for d in docs]


def get_risk_thresholds(playbook_id: str) -> dict:
    """Return just the risk_thresholds section of the playbook."""
    playbook = load_playbook(playbook_id)
    return playbook.get("risk_thresholds", {})


def list_playbooks() -> list[dict]:
    """Return all available playbooks: built-ins + custom Firestore ones."""
    result = []
    for pb_id, filename in BUILTIN_PLAYBOOKS.items():
        path = PLAYBOOKS_DIR / filename
        if path.exists():
            data = json.loads(path.read_text())
            result.append({"playbook_id": pb_id, "name": data.get("name"), "builtin": True})

    db = _db()
    for doc in db.collection("playbooks").stream():
        result.append({"playbook_id": doc.id, "name": doc.to_dict().get("name"), "builtin": False})

    return result
