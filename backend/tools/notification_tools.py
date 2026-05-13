"""Notification helpers — Firestore job-status updates + optional Slack webhook."""
import json
import httpx
from datetime import datetime, timezone
import typing
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from api.db import get_db, get_db_sync
from config import settings


def _db_async() -> firestore.AsyncClient:
    return get_db()


def _db_sync() -> firestore.Client:
    return get_db_sync()


def update_job_status(
    job_id: str,
    status: str,
    contract_id: str | None = None,
    extra: typing.Any = None,
) -> typing.Any:
    """Write job (and optional contract) status to Firestore. Called by agents."""
    print(f"[PIPELINE] Updating job {job_id} status to {status}")
    db = _db_sync()
    now = datetime.now(timezone.utc).isoformat()
    job_ref = db.collection("jobs").document(job_id)
    payload: dict = {"status": status, "updated_at": now}
    if extra:
        payload.update(extra)
    job_ref.update(payload)

    if contract_id:
        contract_ref = job_ref.collection("contracts").document(contract_id)
        contract_ref.update({"status": status, "updated_at": now})

    return {"ok": True, "job_id": job_id, "status": status}
def create_contract_records(
    job_id: str,
    manifest: typing.Any,
) -> typing.Any:
    """Initialize contract records in the job's subcollection. Called by ingestion agent."""
    print(f"[PIPELINE] Creating contract records for job {job_id}")
    db = _db_sync()
    now = datetime.now(timezone.utc).isoformat()
    job_ref = db.collection("jobs").document(job_id)
    
    contract_ids = []
    for doc in manifest.get("documents", []):
        gcs_uri = doc.get("gcs_uri")
        
        # Check if a contract for this GCS URI already exists in this job
        existing_docs = (
            db.collection("jobs")
            .document(job_id)
            .collection("contracts")
            .where(filter=FieldFilter("gcs_uri", "==", gcs_uri))
            .limit(1)
            .stream()
        )
        
        existing_contract = None
        for d in existing_docs:
            existing_contract = d.id
            break
            
        if existing_contract:
            print(f"[PIPELINE] Contract for {gcs_uri} already exists: {existing_contract}")
            contract_ids.append(existing_contract)
            continue

        import uuid
        contract_id = f"cont_{uuid.uuid4().hex[:10]}"
        contract_ref = job_ref.collection("contracts").document(contract_id)
        
        contract_data = {
            "contract_id": contract_id,
            "job_id": job_id,
            "filename": doc.get("filename"),
            "gcs_uri": gcs_uri,
            "file_uri": doc.get("file_uri"),
            "contract_type": doc.get("contract_type"),
            "parties": doc.get("parties", []),
            "effective_date": doc.get("effective_date"),
            "page_count": doc.get("page_count"),
            "status": "INGESTED",
            "created_at": now,
            "updated_at": now,
        }
        contract_ref.set(contract_data)
        contract_ids.append(contract_id)
    
    return {"ok": True, "contract_ids": contract_ids}


def save_risk_report(
    job_id: str,
    contract_id: str,
    report: typing.Any,
) -> typing.Any:
    """Save a RiskReport to a contract in Firestore. Called by risk scorer."""
    print(f"[PIPELINE] Saving risk report for contract {contract_id}")
    db = _db_sync()
    now = datetime.now(timezone.utc).isoformat()
    
    # 1. Update contract in subcollection
    contract_ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
    contract_ref.update({
        "risk_score": report.get("contract_risk_score", 0),
        "critical_flags": report.get("critical_flags", []),
        "risk_report": report,
        "status": "SCORING_COMPLETE",
        "updated_at": now,
    })

    # 2. Save to standalone top-level collection for easy lookup by ID
    db.collection("risk_reports").document(contract_id).set(report)
    
    return {"ok": True}


def save_redlines(
    job_id: str,
    contract_id: str,
    redlines: typing.Any,
) -> typing.Any:
    """Save proposed redlines to a contract in Firestore. Called by redline agent."""
    print(f"[PIPELINE] Saving redlines for contract {contract_id}")
    db = _db_sync()
    now = datetime.now(timezone.utc).isoformat()
    
    # 1. Update contract in subcollection
    contract_ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
    contract_ref.update({
        "redlines": redlines,
        "status": "REDLINING_COMPLETE",
        "updated_at": now,
    })

    # 2. Save to standalone top-level collection
    db.collection("redline_sets").document(contract_id).set({
        "contract_id": contract_id,
        "redlines": redlines,
        "updated_at": now
    })
    
    return {"ok": True}


def notify_slack_sync(
    job_id: str,
    review_url: str,
    risk_score: int,
    critical_flags: list[str],
    reviewer_email: str,
    webhook_url: str = "",
) -> dict:
    """POST a Slack message using a synchronous client."""
    url = webhook_url or settings.SLACK_WEBHOOK_URL
    if not url:
        return {"ok": False, "reason": "no_webhook_configured"}

    flags_text = ", ".join(critical_flags) if critical_flags else "None"
    message = {
        "text": f"🔴 *ContractIQ — High-Risk Contract Requires Review*",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*Job:* `{job_id}`\n"
                        f"*Risk Score:* {risk_score}/100\n"
                        f"*Critical Flags:* {flags_text}\n"
                        f"*Assigned:* {reviewer_email}"
                    ),
                },
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Review Now"},
                        "url": review_url,
                        "style": "primary",
                    }
                ],
            },
        ],
    }

    with httpx.Client() as client:
        resp = client.post(url, json=message, timeout=10)
    return {"ok": resp.status_code == 200, "status_code": resp.status_code}


def send_review_notification(
    job_id: str,
    review_url: str,
    risk_score: int,
    critical_flags: list[str],
    reviewer_email: str,
    slack_webhook_url: str = "",
) -> dict:
    """Mark job as PENDING_REVIEW and optionally ping Slack."""
    update_job_status(job_id, "PENDING_REVIEW")
    slack_result = notify_slack_sync(
        job_id, review_url, risk_score, critical_flags, reviewer_email, slack_webhook_url
    )
    return {"firestore": "updated", "slack": slack_result}


async def check_review_decision(job_id: str) -> dict | None:
    """Poll Firestore for a reviewer's decision. Returns None if not yet set."""
    db = _db_async()
    doc = await db.collection("jobs").document(job_id).get()
    if doc.exists:
        data = doc.to_dict() or {}
        return data.get("review_decision")
    return None
