"""Export download routes — JSON, DOCX, PDF."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from google.cloud import firestore
from tools.gcs_tools import gcs_download, gcs_signed_url
from api.deps import get_optional_user
from config import settings

router = APIRouter()


def _db():
    return firestore.AsyncClient(
        project=settings.GCP_PROJECT,
        database=settings.FIRESTORE_DATABASE,
    )


async def _get_export_uris(contract_id: str) -> dict:
    db = _db()
    doc = await db.collection("exports").document(contract_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Exports not ready yet")
    return doc.to_dict()


@router.get("/contracts/{contract_id}/export/json")
async def export_json(contract_id: str, user: dict = Depends(get_optional_user)):
    uris = await _get_export_uris(contract_id)
    data = gcs_download(uris["json_uri"])
    return Response(content=data, media_type="application/json",
                    headers={"Content-Disposition": f"attachment; filename={contract_id}.json"})


@router.get("/contracts/{contract_id}/export/docx")
async def export_docx(contract_id: str, user: dict = Depends(get_optional_user)):
    uris = await _get_export_uris(contract_id)
    data = gcs_download(uris["docx_uri"])
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={contract_id}_redlines.docx"},
    )


@router.get("/contracts/{contract_id}/export/pdf")
async def export_pdf(contract_id: str, user: dict = Depends(get_optional_user)):
    uris = await _get_export_uris(contract_id)
    data = gcs_download(uris["pdf_uri"])
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={contract_id}_summary.pdf"})


@router.get("/contracts/{contract_id}/export/links")
async def export_links(contract_id: str, user: dict = Depends(get_optional_user)):
    """Return signed download URLs for all export formats."""
    uris = await _get_export_uris(contract_id)
    return {
        "json_url": gcs_signed_url(uris["json_uri"]),
        "docx_url": gcs_signed_url(uris["docx_uri"]),
        "pdf_url": gcs_signed_url(uris["pdf_uri"]),
    }
