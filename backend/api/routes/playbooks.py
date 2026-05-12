"""Playbook management routes — list, create (upload), get."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from google.cloud import firestore
from tools.playbook_tools import list_playbooks
from tools.gcs_tools import gcs_upload
from api.deps import get_optional_user
from config import settings

router = APIRouter()


def _db():
    return firestore.AsyncClient(
        project=settings.GCP_PROJECT,
        database=settings.FIRESTORE_DATABASE,
    )


@router.get("/playbooks")
async def get_playbooks(user: dict = Depends(get_optional_user)):
    """Return built-in and custom playbooks for the organisation."""
    return {"playbooks": list_playbooks()}


@router.post("/playbooks")
async def create_playbook(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
    contract_type: str = Form("GENERIC"),
    user: dict = Depends(get_optional_user),
):
    """Upload a custom playbook PDF/DOCX and index it in Firestore."""
    playbook_id = f"pb_{uuid.uuid4().hex[:12]}"
    content = await file.read()
    gcs_uri = gcs_upload(content, file.filename or "playbook.pdf", prefix="playbooks")

    # Register with Gemini Files API for future use as grounding source
    from google import genai
    import tempfile, os
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    with tempfile.NamedTemporaryFile(suffix=f"_{file.filename}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        upload_resp = client.files.upload(
            path=tmp_path,
            config={"mime_type": file.content_type or "application/pdf",
                    "display_name": name},
        )
        file_uri = upload_resp.uri
    finally:
        os.unlink(tmp_path)

    now = datetime.now(timezone.utc).isoformat()
    db = _db()
    await db.collection("playbooks").document(playbook_id).set({
        "id": playbook_id,
        "name": name,
        "description": description,
        "contract_type": contract_type.upper(),
        "gcs_uri": gcs_uri,
        "file_uri": file_uri,
        "org_id": user.get("uid"),
        "builtin": False,
        "created_at": now,
    })

    return {
        "playbook_id": playbook_id,
        "name": name,
        "file_uri": file_uri,
        "created_at": now,
    }


@router.get("/playbooks/{playbook_id}")
async def get_playbook(playbook_id: str, user: dict = Depends(get_optional_user)):
    from tools.playbook_tools import load_playbook
    try:
        return load_playbook(playbook_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
