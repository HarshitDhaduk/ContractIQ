"""Stage 2 — Clause Extraction.

Calls Gemini Pro per-contract to extract 40 clause types as structured JSON.
"""
import json
from google.genai import types
from pipeline_utils import set_contract_status, save_clause_bundle_to_firestore, set_job_status
from workers.helpers import gemini_client, parse_json_response
from config import settings


async def stage_extract(db, job_id: str, contracts: list[dict], playbook_context: str) -> list[dict]:
    """Run clause extraction on each contract. Saves ClauseBundle to Firestore."""
    await set_job_status(db, job_id, "EXTRACTING")

    for idx, contract in enumerate(contracts):
        cid = contract["contract_id"]
        if not contract.get("file_uri"):
            print(f"[EXTRACT] Skipping {cid} — no file_uri")
            continue
        try:
            await set_contract_status(db, job_id, cid, "EXTRACTING")
            print(f"[EXTRACT] [{idx + 1}/{len(contracts)}]: {contract.get('filename')}")

            bundle = await _run_extraction(contract, playbook_context)
            bundle["contract_id"] = cid

            await save_clause_bundle_to_firestore(db, job_id, cid, bundle)
            contract["clause_bundle"] = bundle

        except Exception as e:
            print(f"[EXTRACT] ✗ {cid}: {e}")
            await set_contract_status(db, job_id, cid, "FAILED_EXTRACTION", extra={"error": str(e)})

    return contracts


async def _run_extraction(contract: dict, playbook_context: str) -> dict:
    """Call Gemini Pro to extract clauses from a single contract."""
    client = gemini_client()

    prompt = f"""You are a senior contract lawyer specialising in clause extraction.

PLAYBOOK (firm standards):
{playbook_context}

CONTRACT METADATA:
- Filename: {contract.get('filename')}
- Type: {contract.get('contract_type')}
- Parties: {contract.get('parties')}

CLAUSE TYPES TO EXTRACT:
indemnity, limitation_of_liability, ip_ownership, ip_assignment,
payment_terms, payment_schedule, late_payment, termination_for_cause,
termination_for_convenience, termination_notice, governing_law,
dispute_resolution, arbitration, confidentiality, non_compete,
non_solicit, data_protection, security_requirements, audit_rights,
force_majeure, assignment, subcontracting, change_control,
warranties, representations, conditions_precedent, insurance,
liability_cap, exclusion_of_consequential_loss, most_favoured_nation,
benchmarking, step_in_rights, liquidated_damages, sla_terms,
service_credits, renewal_auto, renewal_notice, price_escalation,
entire_agreement, severability

For each clause found, return:
- clause_type: one of the types above
- original_text: exact verbatim text from the contract
- page_ref: list of page numbers (e.g. [3, 4])
- is_standard: true if matches playbook, false if deviates
- deviation_summary: brief note if is_standard is false, null otherwise

Return JSON:
{{
  "contract_id": "{contract['contract_id']}",
  "contract_type": "{contract.get('contract_type', 'UNKNOWN')}",
  "parties": {json.dumps(contract.get('parties', []))},
  "effective_date": {json.dumps(contract.get('effective_date'))},
  "clauses": [...],
  "missing_clauses": ["clause_types_not_found"]
}}

Return ONLY valid JSON. No explanation outside the JSON object."""

    parts = []
    file_uri = contract.get("file_uri")
    mime_type = contract.get("mime_type", "application/pdf")
    if file_uri:
        parts.append(types.Part.from_uri(file_uri=file_uri, mime_type=mime_type))
    parts.append(types.Part(text=prompt))

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL_PRO,
        contents=[types.Content(role="user", parts=parts)],
    )
    return parse_json_response(response.text)
