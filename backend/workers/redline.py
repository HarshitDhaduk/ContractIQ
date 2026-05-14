"""Stage 4 — Redline Generation.

Generates clause rewrites for HIGH/MEDIUM risk clauses only.
"""
import json
from google.genai import types
from pipeline_utils import set_job_status, set_contract_status, save_redlines_to_firestore
from workers.helpers import gemini_client, parse_json_response
from config import settings


async def stage_redline(db, job_id: str, contracts: list[dict]) -> list[dict]:
    """Generate redline rewrites for flagged clauses."""
    await set_job_status(db, job_id, "REDLINING")

    for idx, contract in enumerate(contracts):
        cid = contract["contract_id"]
        risk_report = contract.get("risk_report")
        clause_bundle = contract.get("clause_bundle")

        if not risk_report or not clause_bundle:
            print(f"[REDLINE] Skipping {cid} — missing data")
            continue

        flagged = [cr for cr in risk_report.get("clause_risks", [])
                   if cr.get("risk_level") in ("HIGH", "MEDIUM")]

        if not flagged:
            print(f"[REDLINE] No HIGH/MEDIUM clauses for {cid} — skipping")
            await save_redlines_to_firestore(db, job_id, cid, [])
            continue

        try:
            await set_contract_status(db, job_id, cid, "REDLINING")
            print(f"[REDLINE] [{idx + 1}/{len(contracts)}]: {contract.get('filename')} ({len(flagged)} clauses)")

            redlines = await _run_redlining(contract, clause_bundle, flagged)
            await save_redlines_to_firestore(db, job_id, cid, redlines)
            contract["redlines"] = redlines

        except Exception as e:
            print(f"[REDLINE] ✗ {cid}: {e}")
            await save_redlines_to_firestore(db, job_id, cid, [])

    return contracts


async def _run_redlining(contract: dict, clause_bundle: dict, flagged_risks: list[dict]) -> list[dict]:
    client = gemini_client()

    clauses_lookup = {c["clause_type"]: c for c in clause_bundle.get("clauses", [])}
    flagged_detail = []
    for risk in flagged_risks:
        ct = risk["clause_type"]
        original = clauses_lookup.get(ct, {}).get("original_text", "")
        flagged_detail.append({
            "clause_type": ct,
            "original_text": original,
            "risk_score": risk.get("risk_score"),
            "risk_level": risk.get("risk_level"),
            "explanation": risk.get("explanation"),
        })

    prompt = f"""You are a contract redlining specialist.

CONTRACT: {contract.get('filename')} ({contract.get('contract_type')})

FLAGGED CLAUSES (HIGH or MEDIUM risk — need rewrites):
{json.dumps(flagged_detail, indent=2)}

For EACH flagged clause, generate:
- clause_type: the clause type
- original_text: the exact original text
- proposed_text: your revised text that fixes the risk while being legally sound
- rationale: 1-2 sentences explaining what changed and why

Return JSON array:
[{{"clause_type": "...", "original_text": "...", "proposed_text": "...", "rationale": "..."}}]

Return ONLY valid JSON. No explanation."""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL_PRO,
        contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
    )
    result = parse_json_response(response.text)
    return result if isinstance(result, list) else result.get("redlines", [])
