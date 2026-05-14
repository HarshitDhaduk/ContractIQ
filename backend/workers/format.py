"""Stage 6 — Output Formatting.

Generates JSON/DOCX/PDF exports and marks job as COMPLETE.
"""
from pipeline_utils import set_job_status, set_contract_status


async def run_formatting(db, job_id: str, contracts: list[dict]) -> None:
    """Generate exports for all approved/reviewed contracts."""
    await set_job_status(db, job_id, "FORMATTING")

    for contract in contracts:
        cid = contract["contract_id"]
        decision = contract.get("review_decision")
        if not decision:
            continue
        try:
            from agents.output_formatter import generate_outputs
            export_data = generate_outputs(
                contract_id=cid,
                clause_bundle=contract.get("clause_bundle", {}),
                risk_report=contract.get("risk_report", {}),
                redlines=contract.get("redlines", []),
                review_decision=decision,
            )
            await set_contract_status(db, job_id, cid, "COMPLETE", extra={"exports": export_data})
            print(f"[FORMAT] ✓ Exports generated for {cid}")
        except Exception as e:
            print(f"[FORMAT] ✗ {cid}: {e}")

    # Aggregate final stats
    scores = [c.get("risk_report", {}).get("contract_risk_score", 0)
              for c in contracts if c.get("risk_report")]
    avg = sum(scores) / len(scores) if scores else 0

    await set_job_status(db, job_id, "COMPLETE", extra={
        "overall_risk_score": round(avg, 1),
        "contracts_complete": len(contracts),
    })
    print(f"[FORMAT] ══════ Job {job_id} COMPLETE (avg risk={avg:.1f}) ══════")
