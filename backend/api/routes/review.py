"""HITL review submission — lawyers approve/override/escalate."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from api.db import get_db
from models.contract import ReviewDecision
from api.deps import get_optional_user
from config import settings

router = APIRouter()


def _db():
    return get_db()


@router.post("/contracts/{contract_id}/review")
async def submit_review(
    contract_id: str,
    decision: ReviewDecision,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_optional_user),
):
    """Submit a human review decision. Triggers formatting if all contracts reviewed."""
    db = _db()
    now = datetime.now(timezone.utc).isoformat()

    target_job_id = decision.job_id
    target_contract_id = decision.contract_id or contract_id

    if not target_job_id:
        print(f"[API] Review: job_id missing, searching for contract {contract_id}...")
        query = db.collection_group("contracts").where(filter=FieldFilter("contract_id", "==", contract_id)).limit(1)
        docs = [d async for d in query.stream()]
        if not docs:
            raise HTTPException(status_code=404, detail="Contract not found in any job")
        target_job_id = docs[0].reference.parent.parent.id
        print(f"[API] Review: Inferred job_id {target_job_id}")

    decision_data = decision.model_dump()
    decision_data["reviewer_id"] = user.get("uid", "unknown")
    decision_data["reviewed_at"] = now
    decision_data["job_id"] = target_job_id
    decision_data["contract_id"] = target_contract_id

    # Write decision to contract subcollection
    contract_ref = db.collection("jobs").document(target_job_id).collection("contracts").document(target_contract_id)
    await contract_ref.update({
        "review_decision": decision_data,
        "status": decision.action,
        "updated_at": now,
    })

    # Write to job doc for backward compatibility
    job_ref = db.collection("jobs").document(target_job_id)
    await job_ref.update({
        "review_decision": decision_data,
        "updated_at": now,
    })

    # Check if all contracts are now reviewed — trigger formatting if so
    background_tasks.add_task(_trigger_resume, target_job_id)

    return {
        "ok": True,
        "job_id": target_job_id,
        "contract_id": target_contract_id,
        "action": decision.action,
        "reviewed_at": now,
    }


async def _trigger_resume(job_id: str):
    """Background task to resume the pipeline after review."""
    try:
        from workers import resume_after_review
        await resume_after_review(job_id)
    except Exception as e:
        print(f"[API] Resume after review failed for {job_id}: {e}")


@router.get("/jobs/{job_id}/pending-reviews")
async def get_pending_reviews(job_id: str, user: dict = Depends(get_optional_user)):
    """Return all contracts in a job that are awaiting human review."""
    db = _db()
    docs = (
        db.collection("jobs")
        .document(job_id)
        .collection("contracts")
        .where(filter=FieldFilter("status", "==", "PENDING_REVIEW"))
        .stream()
    )
    pending = []
    async for d in docs:
        pending.append(d.to_dict())
    return {"job_id": job_id, "pending_count": len(pending), "contracts": pending}


@router.get("/review-queue")
async def get_review_queue(user: dict = Depends(get_optional_user)):
    """Return ALL pending review items across all jobs for the current user."""
    db = _db()
    jobs_docs = (
        db.collection("jobs")
        .where(filter=FieldFilter("user_id", "==", user["uid"]))
        .where(filter=FieldFilter("status", "==", "PENDING_REVIEW"))
        .stream()
    )
    queue = []
    async for job_doc in jobs_docs:
        job = job_doc.to_dict()
        queue.append({
            "job_id": job.get("job_id"),
            "reviewer_email": job.get("reviewer_email"),
            "created_at": job.get("created_at"),
        })
    return {"queue": queue, "total": len(queue)}
