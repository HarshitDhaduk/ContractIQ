"""POST /v1/upload — accept 1–100 contract files and store to GCS."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from google.cloud import firestore
from tools.gcs_tools import gcs_upload
from api.deps import get_optional_user
from config import settings

router = APIRouter()


def _db():
    return firestore.AsyncClient(
        project=settings.GCP_PROJECT,
        database=settings.FIRESTORE_DATABASE,
    )


@router.post("/upload")
async def upload_contracts(
    files: list[UploadFile] = File(...),
    user: dict = Depends(get_optional_user),
):
    """Upload 1–100 contract files (PDF/DOCX). Returns upload_id and gcs_uris."""
    if len(files) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 files per upload")

    allowed_types = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    upload_id = f"upl_{uuid.uuid4().hex[:12]}"
    gcs_uris = []
    file_meta = []

    for f in files:
        if f.content_type not in allowed_types and not f.filename.endswith((".pdf", ".docx")):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {f.filename}. Use PDF or DOCX.",
            )
        content = await f.read()
        uri = gcs_upload(content, f.filename or "contract.pdf", prefix=f"raw-docs/{upload_id}")
        gcs_uris.append(uri)
        file_meta.append({"filename": f.filename, "size_bytes": len(content), "gcs_uri": uri})

    # Store upload record in Firestore
    db = _db()
    now = datetime.now(timezone.utc).isoformat()
    await db.collection("uploads").document(upload_id).set({
        "upload_id": upload_id,
        "user_id": user["uid"],
        "file_count": len(files),
        "files": file_meta,
        "gcs_uris": gcs_uris,
        "created_at": now,
    })

    return {
        "upload_id": upload_id,
        "file_count": len(files),
        "gcs_uris": gcs_uris,
        "files": file_meta,
    }
