"""
Deterministic pipeline worker — processes contracts stage-by-stage.

This replaces the old monolithic _run_pipeline that relied on agents
to call status update tools. Now Python code wraps each agent call
and guarantees status transitions happen in order.

Flow per job:
  QUEUED → INGESTING → EXTRACTING → SCORING → REDLINING → PENDING_REVIEW → COMPLETE
"""
import asyncio
import json
import uuid
import os
import tempfile
from datetime import datetime, timezone

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from google import genai

from api.db import get_db, get_db_sync
from config import settings
from pipeline_utils import (
    set_job_status,
    set_contract_status,
    increment_completed,
    fail_job,
    save_clause_bundle_to_firestore,
    save_risk_report_to_firestore,
    save_redlines_to_firestore,
)

# Ensure Google SDK can find the API key
os.environ["GOOGLE_API_KEY"] = settings.GEMINI_API_KEY


# ─── Gemini Client (for direct API calls) ───────────────────────────────────
def _gemini_client() -> genai.Client:
    return genai.Client(api_key=settings.GEMINI_API_KEY)


# ─── File Registration ──────────────────────────────────────────────────────
def register_document_with_gemini(gcs_uri: str) -> dict:
    """Download from GCS and register with Gemini Files API. Returns file metadata."""
    from tools.gcs_tools import gcs_download

    filename = gcs_uri.split("/")[-1]
    mime_type = "application/pdf" if filename.lower().endswith(".pdf") else \
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    file_bytes = gcs_download(gcs_uri)
    client = _gemini_client()

    with tempfile.NamedTemporaryFile(suffix=f"_{filename}", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        upload_response = client.files.upload(
            file=tmp_path,
            config={"mime_type": mime_type, "display_name": filename},
        )
        return {
            "file_uri": upload_response.uri,
            "filename": filename,
            "mime_type": mime_type,
        }
    finally:
        os.unlink(tmp_path)


# ─── Playbook Loading ───────────────────────────────────────────────────────
def load_playbook_context(playbook_id: str | None) -> str:
    """Load playbook content as a string for inclusion in prompts."""
    if not playbook_id:
        return "No playbook specified. Use general best-practice legal standards."

    try:
        from tools.playbook_tools import load_playbook
        pb = load_playbook(playbook_id)
        return json.dumps(pb, indent=2)
    except Exception as e:
        print(f"[WORKER] Failed to load playbook {playbook_id}: {e}")
        return f"Playbook '{playbook_id}' could not be loaded. Use general standards."


# ─── Stage 1: INGESTION ─────────────────────────────────────────────────────
async def stage_ingest(db, job_id: str, gcs_uris: list[str], filenames: list[str]) -> list[dict]:
    """
    Register each document with Gemini Files API, create contract records.
    Returns list of contract dicts: [{contract_id, gcs_uri, file_uri, filename, ...}]
    """
    await set_job_status(db, job_id, "INGESTING")
    now = datetime.now(timezone.utc).isoformat()
    contracts = []

    for idx, gcs_uri in enumerate(gcs_uris):
        filename = filenames[idx] if idx < len(filenames) else gcs_uri.split("/")[-1]
        contract_id = f"cont_{uuid.uuid4().hex[:10]}"

        try:
            # Register with Gemini Files API
            print(f"[WORKER] Ingesting [{idx + 1}/{len(gcs_uris)}]: {filename}")
            file_info = register_document_with_gemini(gcs_uri)

            # Detect contract type via a quick Gemini call
            metadata = await _extract_metadata(file_info["file_uri"], filename)

            contract_data = {
                "contract_id": contract_id,
                "job_id": job_id,
                "filename": filename,
                "gcs_uri": gcs_uri,
                "file_uri": file_info["file_uri"],
                "mime_type": file_info["mime_type"],
                "contract_type": metadata.get("contract_type", "UNKNOWN"),
                "parties": metadata.get("parties", []),
                "effective_date": metadata.get("effective_date"),
                "page_count": metadata.get("page_count", 0),
                "status": "INGESTED",
                "created_at": now,
                "updated_at": now,
            }

            # Write to Firestore
            ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
            await ref.set(contract_data)
            contracts.append(contract_data)

            print(f"[WORKER] ✓ Ingested {filename} → {contract_id} (type={metadata.get('contract_type')})")

        except Exception as e:
            print(f"[WORKER] ✗ Failed to ingest {filename}: {e}")
            # Create a failed record so the UI can show it
            failed_data = {
                "contract_id": contract_id,
                "job_id": job_id,
                "filename": filename,
                "gcs_uri": gcs_uri,
                "status": "FAILED_INGESTION",
                "error": str(e),
                "created_at": now,
                "updated_at": now,
            }
            ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
            await ref.set(failed_data)
            # Continue with remaining contracts — don't fail the whole job

    if not contracts:
        raise RuntimeError("All documents failed ingestion — no contracts to process.")

    return contracts


async def _extract_metadata(file_uri: str, filename: str) -> dict:
    """Quick Gemini Flash call to extract basic metadata from a document."""
    client = _gemini_client()

    prompt = f"""Analyze this document and return JSON with these fields:
- contract_type: one of NDA, MSA, VENDOR, EMPLOYMENT, LEASE, SERVICES, PARTNERSHIP, OTHER
- parties: list of party names (e.g. ["Company A", "Company B"])
- effective_date: date string YYYY-MM-DD or null
- page_count: estimated number of pages (integer)

Document filename: {filename}

Return ONLY valid JSON. No explanation."""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL_FLASH,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_uri(file_uri=file_uri, mime_type="application/pdf"),
                        types.Part(text=prompt),
                    ],
                )
            ],
        )
        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(text)
    except Exception as e:
        print(f"[WORKER] Metadata extraction failed: {e}")
        return {"contract_type": "UNKNOWN", "parties": [], "effective_date": None, "page_count": 0}


# ─── Stage 2: EXTRACTION ────────────────────────────────────────────────────
async def stage_extract(db, job_id: str, contracts: list[dict], playbook_id: str | None) -> list[dict]:
    """
    Run clause extraction on each contract using Gemini Pro.
    Saves ClauseBundle to Firestore for each contract.
    Returns list of contracts with clause_bundle attached.
    """
    await set_job_status(db, job_id, "EXTRACTING")
    playbook_context = load_playbook_context(playbook_id)

    for idx, contract in enumerate(contracts):
        contract_id = contract["contract_id"]
        file_uri = contract.get("file_uri")
        if not file_uri:
            print(f"[WORKER] Skipping extraction for {contract_id} — no file_uri")
            continue

        try:
            await set_contract_status(db, job_id, contract_id, "EXTRACTING")
            print(f"[WORKER] Extracting [{idx + 1}/{len(contracts)}]: {contract.get('filename')}")

            clause_bundle = await _run_extraction(contract, playbook_context)

            # Ensure contract_id is set
            clause_bundle["contract_id"] = contract_id

            # Save to Firestore (the key fix — this was never happening before)
            await save_clause_bundle_to_firestore(db, job_id, contract_id, clause_bundle)
            contract["clause_bundle"] = clause_bundle

        except Exception as e:
            print(f"[WORKER] ✗ Extraction failed for {contract_id}: {e}")
            await set_contract_status(db, job_id, contract_id, "FAILED_EXTRACTION",
                                      extra={"error": str(e)})

    return contracts


async def _run_extraction(contract: dict, playbook_context: str) -> dict:
    """Call Gemini Pro to extract clauses from a single contract."""
    client = _gemini_client()

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
  "clauses": [{{...}}],
  "missing_clauses": ["clause_types_not_found_in_document"]
}}

Return ONLY valid JSON. No explanation outside the JSON object."""

    # Build content parts — include the document file
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

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


# ─── Stage 3: SCORING ───────────────────────────────────────────────────────
async def stage_score(db, job_id: str, contracts: list[dict], playbook_id: str | None) -> list[dict]:
    """
    Score each contract's clauses for risk.
    Saves RiskReport to Firestore for each contract.
    """
    await set_job_status(db, job_id, "SCORING")
    playbook_context = load_playbook_context(playbook_id)

    for idx, contract in enumerate(contracts):
        contract_id = contract["contract_id"]
        clause_bundle = contract.get("clause_bundle")
        if not clause_bundle:
            print(f"[WORKER] Skipping scoring for {contract_id} — no clause_bundle")
            continue

        try:
            await set_contract_status(db, job_id, contract_id, "SCORING")
            print(f"[WORKER] Scoring [{idx + 1}/{len(contracts)}]: {contract.get('filename')}")

            risk_report = await _run_scoring(contract, clause_bundle, playbook_context)
            risk_report["contract_id"] = contract_id

            await save_risk_report_to_firestore(db, job_id, contract_id, risk_report)
            contract["risk_report"] = risk_report
            await increment_completed(db, job_id)

        except Exception as e:
            print(f"[WORKER] ✗ Scoring failed for {contract_id}: {e}")
            await set_contract_status(db, job_id, contract_id, "FAILED_SCORING",
                                      extra={"error": str(e)})

    return contracts


async def _run_scoring(contract: dict, clause_bundle: dict, playbook_context: str) -> dict:
    """Call Gemini Pro to score risk for a single contract."""
    client = _gemini_client()

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
- recommended_action: APPROVE (score≤30) | NEGOTIATE (30-70) | REJECT (>70)

Return JSON:
{{
  "contract_id": "{contract['contract_id']}",
  "contract_risk_score": 45,
  "clause_risks": [{{...}}],
  "critical_flags": [],
  "executive_summary": "...",
  "recommended_action": "NEGOTIATE"
}}

Return ONLY valid JSON. No explanation."""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL_PRO,
        contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
    )

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


# ─── Stage 4: REDLINING ─────────────────────────────────────────────────────
async def stage_redline(db, job_id: str, contracts: list[dict]) -> list[dict]:
    """
    Generate redline rewrites for HIGH/MEDIUM risk clauses.
    Only processes contracts with elevated risk.
    """
    await set_job_status(db, job_id, "REDLINING")

    for idx, contract in enumerate(contracts):
        contract_id = contract["contract_id"]
        risk_report = contract.get("risk_report")
        clause_bundle = contract.get("clause_bundle")

        if not risk_report or not clause_bundle:
            print(f"[WORKER] Skipping redlining for {contract_id} — missing data")
            continue

        # Only redline contracts with HIGH or MEDIUM risk clauses
        flagged = [cr for cr in risk_report.get("clause_risks", [])
                   if cr.get("risk_level") in ("HIGH", "MEDIUM")]
        if not flagged:
            print(f"[WORKER] No HIGH/MEDIUM clauses for {contract_id} — skipping redlines")
            await save_redlines_to_firestore(db, job_id, contract_id, [])
            continue

        try:
            await set_contract_status(db, job_id, contract_id, "REDLINING")
            print(f"[WORKER] Redlining [{idx + 1}/{len(contracts)}]: {contract.get('filename')} ({len(flagged)} clauses)")

            redlines = await _run_redlining(contract, clause_bundle, flagged)
            await save_redlines_to_firestore(db, job_id, contract_id, redlines)
            contract["redlines"] = redlines

        except Exception as e:
            print(f"[WORKER] ✗ Redlining failed for {contract_id}: {e}")
            await save_redlines_to_firestore(db, job_id, contract_id, [])

    return contracts


async def _run_redlining(contract: dict, clause_bundle: dict, flagged_risks: list[dict]) -> list[dict]:
    """Call Gemini Pro to generate redline rewrites for flagged clauses."""
    client = _gemini_client()

    # Build a focused payload of just the flagged clauses + their original text
    flagged_detail = []
    clauses_lookup = {c["clause_type"]: c for c in clause_bundle.get("clauses", [])}
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
[
  {{
    "clause_type": "indemnity",
    "original_text": "...",
    "proposed_text": "...",
    "rationale": "..."
  }}
]

Return ONLY valid JSON. No explanation."""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL_PRO,
        contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
    )

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    result = json.loads(text)
    return result if isinstance(result, list) else result.get("redlines", [])


# ─── Stage 5: REVIEW DECISION ───────────────────────────────────────────────
async def stage_review(db, job_id: str, contracts: list[dict], auto_approve_threshold: int) -> list[dict]:
    """
    Evaluate each contract for auto-approval.
    Low-risk contracts are auto-approved. High-risk ones go to PENDING_REVIEW.
    """
    any_pending = False

    for contract in contracts:
        contract_id = contract["contract_id"]
        risk_report = contract.get("risk_report", {})
        score = risk_report.get("contract_risk_score", 0)
        flags = risk_report.get("critical_flags", [])

        if score <= auto_approve_threshold and not flags:
            # Auto-approve
            decision = {
                "action": "APPROVE",
                "notes": f"Auto-approved: risk score {score} ≤ threshold {auto_approve_threshold}",
                "auto": True,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            }
            await set_contract_status(db, job_id, contract_id, "APPROVED",
                                      extra={"review_decision": decision})
            contract["review_decision"] = decision
            print(f"[WORKER] ✓ Auto-approved {contract_id} (score={score})")
        else:
            # Needs human review
            await set_contract_status(db, job_id, contract_id, "PENDING_REVIEW")
            contract["review_decision"] = None
            any_pending = True
            print(f"[WORKER] ⏸ {contract_id} needs human review (score={score}, flags={flags})")

    if any_pending:
        await set_job_status(db, job_id, "PENDING_REVIEW")
    else:
        # All auto-approved — skip straight to formatting
        await _run_formatting_stage(db, job_id, contracts)

    return contracts


# ─── Stage 6: OUTPUT FORMATTING ─────────────────────────────────────────────
async def _run_formatting_stage(db, job_id: str, contracts: list[dict]) -> None:
    """Generate exports for all approved/reviewed contracts."""
    await set_job_status(db, job_id, "FORMATTING")

    for contract in contracts:
        contract_id = contract["contract_id"]
        decision = contract.get("review_decision")
        if not decision:
            continue

        try:
            from agents.output_formatter import generate_outputs
            export_data = generate_outputs(
                contract_id=contract_id,
                clause_bundle=contract.get("clause_bundle", {}),
                risk_report=contract.get("risk_report", {}),
                redlines=contract.get("redlines", []),
                review_decision=decision,
            )
            await set_contract_status(db, job_id, contract_id, "COMPLETE",
                                      extra={"exports": export_data})
            print(f"[WORKER] ✓ Generated exports for {contract_id}")
        except Exception as e:
            print(f"[WORKER] ✗ Export generation failed for {contract_id}: {e}")

    # Aggregate final job stats
    scores = []
    for c in contracts:
        rr = c.get("risk_report", {})
        if "contract_risk_score" in rr:
            scores.append(rr["contract_risk_score"])

    avg_score = sum(scores) / len(scores) if scores else 0
    await set_job_status(db, job_id, "COMPLETE", extra={
        "overall_risk_score": round(avg_score, 1),
        "completed_count": len(contracts),
    })
    print(f"[WORKER] ══════ Job {job_id} COMPLETE (avg risk={avg_score:.1f}) ══════")


# ─── Main Entry Point ───────────────────────────────────────────────────────
async def run_pipeline(job_id: str, job_record: dict, user_id: str) -> None:
    """
    Run the full contract review pipeline for a job.
    Each stage updates Firestore deterministically.
    If any stage fails catastrophically, the job is marked with the appropriate error state.
    """
    db = get_db()
    gcs_uris = job_record.get("gcs_uris", [])
    filenames = job_record.get("filenames", [])
    playbook_id = job_record.get("playbook_id")
    auto_threshold = job_record.get("auto_approve_threshold", settings.AUTO_APPROVE_THRESHOLD)

    print(f"\n[WORKER] ══════ Starting pipeline for job {job_id} ({len(gcs_uris)} docs) ══════")

    try:
        # Stage 1: Ingest
        contracts = await stage_ingest(db, job_id, gcs_uris, filenames)

        # Stage 2: Extract clauses
        contracts = await stage_extract(db, job_id, contracts, playbook_id)

        # Stage 3: Score risk
        contracts = await stage_score(db, job_id, contracts, playbook_id)

        # Stage 4: Generate redlines
        contracts = await stage_redline(db, job_id, contracts)

        # Stage 5: Review + auto-approve
        contracts = await stage_review(db, job_id, contracts, auto_threshold)

        # Stage 6 happens inside stage_review if all auto-approved,
        # or is triggered by the review API endpoint for human-reviewed contracts.

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[WORKER] ══════ Pipeline FAILED for job {job_id}: {e} ══════")
        await fail_job(db, job_id, "pipeline", e)


# ─── Resume After Human Review ──────────────────────────────────────────────
async def resume_after_review(job_id: str) -> None:
    """
    Called by the review API after a human submits their decision.
    Checks if ALL contracts in the job have been reviewed.
    If so, triggers the formatting stage.
    """
    db = get_db()

    # Fetch all contracts in this job
    docs = db.collection("jobs").document(job_id).collection("contracts").stream()
    contracts = []
    all_reviewed = True

    async for d in docs:
        data = d.to_dict()
        contracts.append(data)
        if data.get("status") == "PENDING_REVIEW":
            all_reviewed = False

    if not all_reviewed:
        print(f"[WORKER] Job {job_id} still has contracts pending review")
        return

    print(f"[WORKER] All contracts reviewed for job {job_id} — triggering formatting")
    await _run_formatting_stage(db, job_id, contracts)
