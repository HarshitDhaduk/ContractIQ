"""
Pipeline utilities — deterministic Firestore status management.

These functions are called by the worker (NOT by agents) to guarantee
that job/contract status is always accurate regardless of agent behavior.
"""
import traceback
from datetime import datetime, timezone
from google.cloud.firestore_v1 import AsyncClient
from google.cloud import firestore


async def set_job_status(
    db: AsyncClient,
    job_id: str,
    status: str,
    extra: dict | None = None,
) -> None:
    """Deterministically set job status in Firestore."""
    payload = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        payload.update(extra)
    await db.collection("jobs").document(job_id).update(payload)
    print(f"[WORKER] Job {job_id} → {status}")


async def set_contract_status(
    db: AsyncClient,
    job_id: str,
    contract_id: str,
    status: str,
    extra: dict | None = None,
) -> None:
    """Set per-contract status inside the job's subcollection."""
    payload = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        payload.update(extra)
    ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
    await ref.update(payload)
    print(f"[WORKER] Contract {contract_id} → {status}")


async def increment_completed(db: AsyncClient, job_id: str) -> None:
    """Atomically increment the completed contract count."""
    await db.collection("jobs").document(job_id).update({
        "contracts_complete": firestore.Increment(1),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })


async def fail_job(
    db: AsyncClient,
    job_id: str,
    stage: str,
    error: Exception,
    contract_id: str | None = None,
) -> None:
    """Mark a job (and optionally a contract) as failed with stage context."""
    error_detail = {
        "stage": stage,
        "error": str(error),
        "traceback": traceback.format_exc(),
    }
    status = f"FAILED_{stage.upper()}" if stage in ("ingestion", "extraction", "scoring") else "FAILED"

    await set_job_status(db, job_id, status, extra={"error_detail": error_detail})

    if contract_id:
        await set_contract_status(db, job_id, contract_id, "FAILED", extra={"error_detail": error_detail})


async def save_clause_bundle_to_firestore(
    db: AsyncClient,
    job_id: str,
    contract_id: str,
    bundle: dict,
) -> None:
    """
    Persist a ClauseBundle to Firestore in both:
    1. The contract subcollection (for job-level queries)
    2. The top-level clause_bundles collection (for the /clauses API endpoint)
    """
    now = datetime.now(timezone.utc).isoformat()

    # 1. Update contract in subcollection
    contract_ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
    await contract_ref.update({
        "clause_bundle": bundle,
        "status": "EXTRACTING_COMPLETE",
        "updated_at": now,
    })

    # 2. Save to standalone top-level collection for direct lookup by contract_id
    bundle_data = {**bundle, "contract_id": contract_id, "job_id": job_id, "updated_at": now}
    await db.collection("clause_bundles").document(contract_id).set(bundle_data)

    print(f"[WORKER] Saved ClauseBundle for {contract_id} ({len(bundle.get('clauses', []))} clauses)")


async def save_risk_report_to_firestore(
    db: AsyncClient,
    job_id: str,
    contract_id: str,
    report: dict,
) -> None:
    """Persist a RiskReport to Firestore (same dual-write pattern)."""
    now = datetime.now(timezone.utc).isoformat()

    contract_ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
    await contract_ref.update({
        "risk_score": report.get("contract_risk_score", 0),
        "risk_level": _level_from_score(report.get("contract_risk_score", 0)),
        "critical_flags": report.get("critical_flags", []),
        "executive_summary": report.get("executive_summary", ""),
        "risk_report": report,
        "status": "SCORING_COMPLETE",
        "updated_at": now,
    })

    await db.collection("risk_reports").document(contract_id).set(
        {**report, "contract_id": contract_id, "job_id": job_id, "updated_at": now}
    )
    print(f"[WORKER] Saved RiskReport for {contract_id} (score={report.get('contract_risk_score')})")


async def save_redlines_to_firestore(
    db: AsyncClient,
    job_id: str,
    contract_id: str,
    redlines: list[dict],
) -> None:
    """Persist redlines to Firestore (same dual-write pattern)."""
    now = datetime.now(timezone.utc).isoformat()

    contract_ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
    await contract_ref.update({
        "redlines": redlines,
        "status": "REDLINING_COMPLETE",
        "updated_at": now,
    })

    await db.collection("redline_sets").document(contract_id).set({
        "contract_id": contract_id,
        "job_id": job_id,
        "redlines": redlines,
        "updated_at": now,
    })
    print(f"[WORKER] Saved {len(redlines)} redlines for {contract_id}")


def _level_from_score(score: int) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"
