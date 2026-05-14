"""Job management routes — create, status, list contracts."""
import uuid
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from api.db import get_db
from models.job import JobCreateRequest, Job, JobStatus
from api.deps import get_optional_user
from config import settings

router = APIRouter()


def _db():
    return get_db()


@router.post("/jobs")
async def create_job(
    body: JobCreateRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_optional_user),
):
    """Create a contract review job and kick off the ADK pipeline."""
    db = _db()
    
    all_gcs_uris = []
    all_filenames = []
    total_contract_count = 0

    for upload_id in body.upload_ids:
        # Fetch upload record
        upload_doc = await db.collection("uploads").document(upload_id).get()
        if not upload_doc.exists:
            raise HTTPException(status_code=404, detail=f"Upload {upload_id} not found")
        
        upload_data = upload_doc.to_dict()
        if upload_data.get("user_id") != user["uid"]:
             raise HTTPException(status_code=403, detail=f"Unauthorized access to upload {upload_id}")
        
        all_gcs_uris.extend(upload_data.get("gcs_uris", []))
        # Collect filenames from the upload record
        for f in upload_data.get("files", []):
            all_filenames.append(f.get("filename", "unknown_contract"))
        total_contract_count += upload_data.get("file_count", 0)

    job_id = f"job_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    job_record = {
        "job_id": job_id,
        "status": JobStatus.QUEUED.value,
        "user_id": user["uid"],
        "playbook_id": body.playbook_id,
        "reviewer_email": body.reviewer_email,
        "sla_hours": body.sla_hours,
        "contract_count": total_contract_count,
        "contracts_complete": 0,
        "generate_redlines": body.generate_redlines,
        "auto_approve_threshold": body.auto_approve_threshold,
        "export_formats": body.export_formats,
        "slack_webhook_url": body.slack_webhook_url or "",
        "gcs_uris": all_gcs_uris,
        "filenames": all_filenames, # Store filenames here
        "created_at": now,
        "updated_at": now,
    }

    await db.collection("jobs").document(job_id).set(job_record)
    print(f"[API] Created job {job_id}, triggering pipeline...")

    # Trigger the ADK pipeline asynchronously
    background_tasks.add_task(_run_pipeline, job_id, job_record, user["uid"])

    return {
        "job_id": job_id,
        "status": JobStatus.QUEUED.value,
        "contract_count": total_contract_count,
        "estimated_completion_minutes": max(2, total_contract_count * 2),
        "created_at": now,
    }


async def _run_pipeline(job_id: str, job_record: dict, user_id: str):
    """Background task that invokes the deterministic pipeline worker."""
    from workers import run_pipeline
    await run_pipeline(job_id, job_record, user_id)


@router.get("/jobs")
async def list_jobs(
    page: int = 1,
    page_size: int = 10,
    user: dict = Depends(get_optional_user)
):
    """List all jobs for the current user, newest first, with pagination."""
    db = _db()
    
    # 1. Get total count
    count_query = db.collection("jobs").where(filter=FieldFilter("user_id", "==", user["uid"])).count()
    count_snapshot = await count_query.get()
    total_count = count_snapshot[0][0].value

    # 2. Get paginated docs
    docs = (
        db.collection("jobs")
        .where(filter=FieldFilter("user_id", "==", user["uid"]))
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(page_size)
        .offset((page - 1) * page_size)
        .stream()
    )
    
    jobs = [d.to_dict() async for d in docs]
    
    return {
        "jobs": jobs,
        "total": total_count,
        "page": page,
        "page_size": page_size
    }


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
    """List all contracts in a job. Returns placeholders if ingestion is still pending."""
    db = _db()
    job_doc = await db.collection("jobs").document(job_id).get()
    if not job_doc.exists:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = job_doc.to_dict()
    docs = db.collection("jobs").document(job_id).collection("contracts").stream()
    contracts = []
    async for d in docs:
        data = d.to_dict()
        # Return a curated set of fields — keep response lightweight
        contracts.append({
            "contract_id": data.get("contract_id"),
            "job_id": data.get("job_id", job_id),
            "filename": data.get("filename"),
            "status": data.get("status"),
            "contract_type": data.get("contract_type"),
            "parties": data.get("parties", []),
            "page_count": data.get("page_count"),
            "effective_date": data.get("effective_date"),
            "risk_score": data.get("risk_score"),
            "risk_level": data.get("risk_level"),
            "critical_flags": data.get("critical_flags", []),
            "executive_summary": data.get("executive_summary"),
            "redline_count": len(data.get("redlines", [])),
            "review_decision": data.get("review_decision"),
            "error": data.get("error"),
            "is_placeholder": False,
            "created_at": data.get("created_at"),
            "updated_at": data.get("updated_at"),
        })
    
    # If no contracts found but job is in progress, return placeholders from filenames/URIs
    if not contracts and job_data.get("status") not in [JobStatus.COMPLETE.value, JobStatus.FAILED.value]:
        filenames = job_data.get("filenames", [])
        if not filenames and "gcs_uris" in job_data:
            filenames = [uri.split("/")[-1] for uri in job_data["gcs_uris"]]
            
        for i, name in enumerate(filenames):
            contracts.append({
                "contract_id": f"pending_{i}",
                "job_id": job_id,
                "filename": name,
                "status": job_data.get("status", "QUEUED"),
                "contract_type": None,
                "parties": [],
                "page_count": None,
                "effective_date": None,
                "risk_score": None,
                "risk_level": None,
                "critical_flags": [],
                "executive_summary": None,
                "redline_count": 0,
                "review_decision": None,
                "error": None,
                "is_placeholder": True,
                "created_at": job_data.get("created_at"),
                "updated_at": job_data.get("updated_at"),
            })

    return {"job_id": job_id, "contracts": contracts}


@router.post("/jobs/{job_id}/rerun")
async def rerun_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_optional_user),
):
    """Manually re-trigger the ADK pipeline for an existing job."""
    db = _db()
    doc = await db.collection("jobs").document(job_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_record = doc.to_dict()
    if job_record.get("user_id") != user["uid"]:
         raise HTTPException(status_code=403, detail="Not authorized")

    print(f"[API] Rerunning job {job_id}...")
    # Reset status
    await db.collection("jobs").document(job_id).update({
        "status": JobStatus.QUEUED.value,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "error": None
    })
    
    background_tasks.add_task(_run_pipeline, job_id, job_record, user["uid"])
    return {"ok": True, "job_id": job_id, "status": "RERUN_TRIGGERED"}
