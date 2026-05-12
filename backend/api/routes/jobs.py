"""Job management routes — create, status, list contracts."""
import uuid
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore
from models.job import JobCreateRequest, Job, JobStatus
from api.deps import get_optional_user
from config import settings

router = APIRouter()


def _db():
    return firestore.AsyncClient(
        project=settings.GCP_PROJECT,
        database=settings.FIRESTORE_DATABASE,
    )


@router.post("/jobs")
async def create_job(
    body: JobCreateRequest,
    user: dict = Depends(get_optional_user),
):
    """Create a contract review job and kick off the ADK pipeline."""
    db = _db()

    # Fetch upload record
    upload_doc = await db.collection("uploads").document(body.upload_id).get()
    if not upload_doc.exists:
        raise HTTPException(status_code=404, detail="Upload not found")
    upload_data = upload_doc.to_dict()

    job_id = f"job_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    contract_count = upload_data.get("file_count", 0)

    job_record = {
        "job_id": job_id,
        "status": JobStatus.QUEUED.value,
        "user_id": user["uid"],
        "playbook_id": body.playbook_id,
        "reviewer_email": body.reviewer_email,
        "sla_hours": body.sla_hours,
        "contract_count": contract_count,
        "contracts_complete": 0,
        "generate_redlines": body.generate_redlines,
        "auto_approve_threshold": body.auto_approve_threshold,
        "export_formats": body.export_formats,
        "slack_webhook_url": body.slack_webhook_url or "",
        "gcs_uris": upload_data.get("gcs_uris", []),
        "created_at": now,
        "updated_at": now,
    }

    await db.collection("jobs").document(job_id).set(job_record)

    # Trigger the ADK pipeline asynchronously (local: asyncio.create_task)
    asyncio.create_task(_run_pipeline(job_id, job_record, user["uid"]))

    return {
        "job_id": job_id,
        "status": JobStatus.QUEUED.value,
        "contract_count": contract_count,
        "estimated_completion_minutes": max(2, contract_count * 2),
        "created_at": now,
    }


async def _run_pipeline(job_id: str, job_record: dict, user_id: str):
    """Background task that invokes the ADK runner."""
    from main import run_contract_review
    try:
        await run_contract_review({
            "job_id": job_id,
            "user_id": user_id,
            "document_uris": job_record.get("gcs_uris", []),
            "playbook_id": job_record["playbook_id"],
            "reviewer_email": job_record["reviewer_email"],
            "sla_hours": job_record["sla_hours"],
            "auto_approve_threshold": job_record["auto_approve_threshold"],
            "slack_webhook_url": job_record.get("slack_webhook_url", ""),
        })
    except Exception as e:
        db = _db()
        await db.collection("jobs").document(job_id).update({
            "status": JobStatus.FAILED.value,
            "error": str(e),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })


@router.get("/jobs")
async def list_jobs(user: dict = Depends(get_optional_user)):
    """List all jobs for the current user, newest first."""
    db = _db()
    docs = (
        db.collection("jobs")
        .where("user_id", "==", user["uid"])
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(50)
        .stream()
    )
    return {"jobs": [d.async_to_dict() async for d in docs]}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_optional_user)):
    """Get job status and summary."""
    db = _db()
    doc = await db.collection("jobs").document(job_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Job not found")
    return doc.to_dict()


@router.get("/jobs/{job_id}/contracts")
async def list_job_contracts(job_id: str, user: dict = Depends(get_optional_user)):
    """List all contracts in a job with their individual risk scores."""
    db = _db()
    docs = db.collection("jobs").document(job_id).collection("contracts").stream()
    contracts = [d.async_to_dict() async for d in docs]
    return {"job_id": job_id, "contracts": contracts}
