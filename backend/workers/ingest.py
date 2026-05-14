"""Stage 1 — Document Ingestion.

Registers each document with Gemini Files API and extracts basic metadata.
"""
import os
import json
import uuid
import tempfile
from datetime import datetime, timezone

from google.genai import types
from pipeline_utils import set_job_status, set_contract_status
from workers.helpers import gemini_client, parse_json_response
from config import settings


async def stage_ingest(db, job_id: str, gcs_uris: list[str], filenames: list[str]) -> list[dict]:
    """
    Register each document with Gemini Files API, create contract records.
    Returns list of contract dicts with file_uri, metadata, etc.
    """
    await set_job_status(db, job_id, "INGESTING")
    now = datetime.now(timezone.utc).isoformat()
    contracts = []

    for idx, gcs_uri in enumerate(gcs_uris):
        filename = filenames[idx] if idx < len(filenames) else gcs_uri.split("/")[-1]
        contract_id = f"cont_{uuid.uuid4().hex[:10]}"

        try:
            print(f"[INGEST] [{idx + 1}/{len(gcs_uris)}]: {filename}")
            file_info = _register_with_gemini(gcs_uri)
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

            ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
            await ref.set(contract_data)
            contracts.append(contract_data)
            print(f"[INGEST] ✓ {filename} → {contract_id} (type={metadata.get('contract_type')})")

        except Exception as e:
            print(f"[INGEST] ✗ Failed: {filename}: {e}")
            failed_data = {
                "contract_id": contract_id, "job_id": job_id,
                "filename": filename, "gcs_uri": gcs_uri,
                "status": "FAILED_INGESTION", "error": str(e),
                "created_at": now, "updated_at": now,
            }
            ref = db.collection("jobs").document(job_id).collection("contracts").document(contract_id)
            await ref.set(failed_data)

    if not contracts:
        raise RuntimeError("All documents failed ingestion — no contracts to process.")
    return contracts


def _register_with_gemini(gcs_uri: str) -> dict:
    """Download from GCS and register with Gemini Files API."""
    from tools.gcs_tools import gcs_download

    filename = gcs_uri.split("/")[-1]
    mime = "application/pdf" if filename.lower().endswith(".pdf") else \
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    file_bytes = gcs_download(gcs_uri)
    client = gemini_client()

    with tempfile.NamedTemporaryFile(suffix=f"_{filename}", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        resp = client.files.upload(file=tmp_path, config={"mime_type": mime, "display_name": filename})
        return {"file_uri": resp.uri, "filename": filename, "mime_type": mime}
    finally:
        os.unlink(tmp_path)


async def _extract_metadata(file_uri: str, filename: str) -> dict:
    """Quick Gemini Flash call to extract basic metadata."""
    client = gemini_client()
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
            contents=[types.Content(role="user", parts=[
                types.Part.from_uri(file_uri=file_uri, mime_type="application/pdf"),
                types.Part(text=prompt),
            ])],
        )
        return parse_json_response(response.text)
    except Exception as e:
        print(f"[INGEST] Metadata extraction failed: {e}")
        return {"contract_type": "UNKNOWN", "parties": [], "effective_date": None, "page_count": 0}
