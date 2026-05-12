"""Notification helpers — Firestore job-status updates + optional Slack webhook."""
import json
import httpx
from datetime import datetime, timezone
from google.cloud import firestore
from config import settings


def _db() -> firestore.AsyncClient:
    return firestore.AsyncClient(
        project=settings.GCP_PROJECT,
        database=settings.FIRESTORE_DATABASE,
    )


async def update_job_status(
    job_id: str,
    status: str,
    contract_id: str | None = None,
    extra: dict | None = None,
) -> dict:
    """Write job (and optional contract) status to Firestore. Called by agents."""
    db = _db()
    now = datetime.now(timezone.utc).isoformat()
    job_ref = db.collection("jobs").document(job_id)
    payload: dict = {"status": status, "updated_at": now}
    if extra:
        payload.update(extra)
    await job_ref.update(payload)

    if contract_id:
        contract_ref = job_ref.collection("contracts").document(contract_id)
        await contract_ref.update({"status": status, "updated_at": now})

    return {"ok": True, "job_id": job_id, "status": status}


async def notify_slack(
    job_id: str,
    review_url: str,
    risk_score: int,
    critical_flags: list[str],
    reviewer_email: str,
    webhook_url: str = "",
) -> dict:
    """POST a Slack message if a webhook URL is configured."""
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

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=message, timeout=10)
    return {"ok": resp.status_code == 200, "status_code": resp.status_code}


async def send_review_notification(
    job_id: str,
    review_url: str,
    risk_score: int,
    critical_flags: list[str],
    reviewer_email: str,
    slack_webhook_url: str = "",
) -> dict:
    """Mark job as PENDING_REVIEW and optionally ping Slack."""
    await update_job_status(job_id, "PENDING_REVIEW")
    slack_result = await notify_slack(
        job_id, review_url, risk_score, critical_flags, reviewer_email, slack_webhook_url
    )
    return {"firestore": "updated", "slack": slack_result}


async def check_review_decision(job_id: str) -> dict | None:
    """Poll Firestore for a reviewer's decision. Returns None if not yet set."""
    db = _db()
    doc = await db.collection("jobs").document(job_id).get()
    if doc.exists:
        data = doc.to_dict() or {}
        return data.get("review_decision")
    return None
