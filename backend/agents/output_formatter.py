from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from config import settings


OUTPUT_INSTRUCTION = """
You are the output formatter. You will receive from session state:
- clause_bundles, risk_reports, redline_sets, review_decisions
- job_id

For EACH contract, call generate_outputs(contract_id, clause_bundle, risk_report, redlines, decision)
to produce all three export formats and store them.

After processing all contracts, return a summary:
{
  "job_id": "...",
  "contracts_processed": N,
  "export_summary": [
    {"contract_id": "...", "json_uri": "gs://...", "docx_uri": "gs://...", "pdf_uri": "gs://..."}
  ]
}
"""


def generate_outputs(
    contract_id: str,
    clause_bundle: dict,
    risk_report: dict,
    redlines: list[dict],
    review_decision: dict,
) -> dict:
    """Generate JSON, DOCX, PDF for one contract and upload to GCS."""
    import json
    from tools.gcs_tools import gcs_upload_export
    from tools.docx_tools import generate_redline_docx, generate_pdf_summary

    # 1. JSON export
    export_payload = {
        "contract_id": contract_id,
        "clause_bundle": clause_bundle,
        "risk_report": risk_report,
        "redlines": redlines,
        "review_decision": review_decision,
    }
    json_bytes = json.dumps(export_payload, indent=2).encode()
    json_uri = gcs_upload_export(json_bytes, f"{contract_id}.json", contract_id)

    # 2. DOCX redlines
    docx_bytes = generate_redline_docx(contract_id, redlines)
    docx_uri = gcs_upload_export(docx_bytes, f"{contract_id}_redlines.docx", contract_id)

    # 3. PDF summary
    pdf_bytes = generate_pdf_summary(risk_report, clause_bundle)
    pdf_uri = gcs_upload_export(pdf_bytes, f"{contract_id}_summary.pdf", contract_id)

    # Persist URIs to Firestore
    from google.cloud import firestore
    from config import settings as cfg
    db = firestore.Client(project=cfg.GCP_PROJECT, database=cfg.FIRESTORE_DATABASE)
    # Extract job_id from contract_id prefix (job_xxx__contract_yyy)
    export_data = {"json_uri": json_uri, "docx_uri": docx_uri, "pdf_uri": pdf_uri}
    # Store at a known location — the API will look this up
    db.collection("exports").document(contract_id).set(export_data)

    return export_data


output_formatter_agent = Agent(
    name="output_formatter_agent",
    model=settings.GEMINI_MODEL_FLASH,
    description="Generates JSON/DOCX/PDF exports for each reviewed contract and uploads to GCS.",
    instruction=OUTPUT_INSTRUCTION,
    tools=[FunctionTool(generate_outputs)],
    output_key="export_summary",
)
