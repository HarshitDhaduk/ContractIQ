"""Stage 5 — Review Decision.

Auto-approves low-risk contracts, marks high-risk for human review.
"""
from datetime import datetime, timezone
from pipeline_utils import set_job_status, set_contract_status


async def stage_review(db, job_id: str, contracts: list[dict], auto_approve_threshold: int) -> list[dict]:
    """
    Evaluate each contract for auto-approval.
    Low-risk → auto-approved. High-risk → PENDING_REVIEW.
    """
    any_pending = False

    for contract in contracts:
        cid = contract["contract_id"]
        risk_report = contract.get("risk_report", {})
        score = risk_report.get("contract_risk_score", 0)
        flags = risk_report.get("critical_flags", [])

        if score <= auto_approve_threshold and not flags:
            decision = {
                "action": "APPROVE",
                "notes": f"Auto-approved: risk score {score} ≤ threshold {auto_approve_threshold}",
                "auto": True,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            }
            await set_contract_status(db, job_id, cid, "APPROVED",
                                      extra={"review_decision": decision})
            contract["review_decision"] = decision
            print(f"[REVIEW] ✓ Auto-approved {cid} (score={score})")
        else:
            await set_contract_status(db, job_id, cid, "PENDING_REVIEW")
            contract["review_decision"] = None
            any_pending = True
            print(f"[REVIEW] ⏸ {cid} needs human review (score={score}, flags={flags})")

    if any_pending:
        await set_job_status(db, job_id, "PENDING_REVIEW")

    return contracts, any_pending
