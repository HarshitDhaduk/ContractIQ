from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from tools.notification_tools import update_job_status, create_contract_records
from config import settings

INGESTION_INSTRUCTION = """
You are a document ingestion specialist. Your job is to prepare contracts for analysis.

You will receive a session state containing:
- job_id: the current job identifier
- document_uris: list of gs:// URIs to contract files in Cloud Storage
- playbook_id: the playbook to use for this review

CRITICAL STARTING STEP:
1. Immediately call update_job_status(job_id, "INGESTING") so the user knows the process has started.

For EACH document URI:
1. Call register_document(gcs_uri) to upload it to Gemini Files API and get a file_uri
2. Extract basic metadata: party names (look for "between X and Y"), contract type, effective date
3. Estimate page count
4. After processing ALL documents, call create_contract_records(job_id, document_manifest) to save the records to the database.

Return a JSON object as the document_manifest with this structure:
{
  "documents": [
    {
      "gcs_uri": "gs://...",
      "file_uri": "files/...",
      "filename": "contract.pdf",
      "contract_type": "NDA | MSA | VENDOR | EMPLOYMENT | OTHER",
      "parties": ["Party A", "Party B"],
      "effective_date": "YYYY-MM-DD or null",
      "page_count": 12,
      "detected_language": "en"
    }
  ]
}

Be thorough. If you cannot determine a field, use null. Always extract parties if visible.
"""


def register_document(gcs_uri: str) -> dict:
    """
    Download a file from GCS and register it with Gemini Files API.
    Returns {file_uri, filename, mime_type}.
    """
    import os
    import tempfile
    from google import genai
    from tools.gcs_tools import gcs_download

    filename = gcs_uri.split("/")[-1]
    mime_type = "application/pdf" if filename.endswith(".pdf") else \
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    file_bytes = gcs_download(gcs_uri)

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

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


ingestion_agent = Agent(
    name="ingestion_agent",
    model=settings.GEMINI_MODEL_FLASH,
    description="Downloads contracts from GCS, registers with Gemini Files API, extracts metadata.",
    instruction=INGESTION_INSTRUCTION,
    tools=[
        FunctionTool(register_document),
        FunctionTool(update_job_status),
        FunctionTool(create_contract_records),
    ],
    output_key="document_manifest",
)
