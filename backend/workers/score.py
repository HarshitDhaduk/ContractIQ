"""Stage 3 — Risk Scoring.

Scores each clause 0-100, generates executive summary and critical flags.
"""
import json
from google.genai import types
from pipeline_utils import (
    set_job_status, set_contract_status, increment_completed,
    save_risk_report_to_firestore,
)
from workers.helpers import gemini_client, parse_json_response
from config import settings


async def stage_score(db, job_id: str, contracts: list[dict], playbook_context: str) -> list[dict]:
    """Score each contract's clauses for risk. Saves RiskReport per contract."""
    await set_job_status(db, job_id, "SCORING")

    for idx, contract in enumerate(contracts):
        cid = contract["contract_id"]
        bundle = contract.get("clause_bundle")
        if not bundle:
            print(f"[SCORE] Skipping {cid} — no clause_bundle")
            continue
        try:
            await set_contract_status(db, job_id, cid, "SCORING")
            print(f"[SCORE] [{idx + 1}/{len(contracts)}]: {contract.get('filename')}")

            report = await _run_scoring(contract, bundle, playbook_context)
            report["contract_id"] = cid

            await save_risk_report_to_firestore(db, job_id, cid, report)
            contract["risk_report"] = report
            await increment_completed(db, job_id)

        except Exception as e:
            print(f"[SCORE] ✗ {cid}: {e}")
            await set_contract_status(db, job_id, cid, "FAILED_SCORING", extra={"error": str(e)})

    return contracts


async def _run_scoring(contract: dict, clause_bundle: dict, playbook_context: str) -> dict:
    client = gemini_client()
    clauses_text = json.dumps(clause_bundle.get("clauses", []), indent=2)

    prompt = f"""You are a contract risk analyst. Score the following extracted clauses.

PLAYBOOK THRESHOLDS:
{playbook_context}

CONTRACT: {contract.get('filename')} ({contract.get('contract_type')})
PARTIES: {contract.get('parties')}

EXTRACTED CLAUSES:
{clauses_text}

Score each clause 0-100:
- HIGH (70-100): Significant legal/commercial risk
- MEDIUM (40-69): Non-standard but negotiable
- LOW (0-39): Acceptable

For each clause provide:
- clause_type, risk_score, risk_level (HIGH/MEDIUM/LOW)
- risk_category: legal | commercial | operational | regulatory
- explanation: 1-2 sentence plain English
- recommended_action: ACCEPT | NEGOTIATE | ESCALATE | BLOCK

Also produce:
- contract_risk_score: weighted average 0-100 (weight HIGH at 3x)
- critical_flags: list of clause_types with HIGH risk
- executive_summary: 3-sentence summary for non-lawyers
- recommended_action: APPROVE (score<=30) | NEGOTIATE (30-70) | REJECT (>70)

Return JSON:
{{
  "contract_id": "{contract['contract_id']}",
  "contract_risk_score": 45,
  "clause_risks": [...],
  "critical_flags": [],
  "executive_summary": "...",
  "recommended_action": "NEGOTIATE"
}}

Return ONLY valid JSON. No explanation."""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL_PRO,
        contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
    )
    return parse_json_response(response.text)
