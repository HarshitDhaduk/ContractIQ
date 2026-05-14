"""Contract detail routes — clauses, risk, redlines."""
from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from api.db import get_db
from api.deps import get_optional_user
from config import settings

router = APIRouter()


def _db():
    return get_db()


@router.get("/contracts/{contract_id}")
async def get_contract(contract_id: str, user: dict = Depends(get_optional_user)):
    """Get full contract details (metadata + reports)."""
    db = _db()
    
    # Use collection_group to find contract across all jobs
    query = db.collection_group("contracts").where(filter=FieldFilter("contract_id", "==", contract_id)).limit(1)
    docs = [d async for d in query.stream()]
    
    if not docs:
        raise HTTPException(status_code=404, detail="Contract not found")
        
    data = docs[0].to_dict()
    
    # Generate signed URL if gcs_uri exists
    if "gcs_uri" in data and data["gcs_uri"]:
        from tools.gcs_tools import gcs_signed_url
        try:
            data["signed_url"] = gcs_signed_url(data["gcs_uri"])
        except Exception as e:
            print(f"[API] Signed URL failed ({e}), using public URL fallback")
            # Fallback: construct a public storage URL
            try:
                uri = data["gcs_uri"].replace("gs://", "")
                bucket = uri.split("/", 1)[0]
                path = uri.split("/", 1)[1]
                data["signed_url"] = f"https://storage.googleapis.com/{bucket}/{path}"
            except Exception:
                data["signed_url"] = None

    return data


@router.get("/contracts/{contract_id}/clauses")
async def get_clauses(contract_id: str, user: dict = Depends(get_optional_user)):
    db = _db()

    # 1. Try top-level standalone collection first
    doc = await db.collection("clause_bundles").document(contract_id).get()
    if doc.exists:
        return doc.to_dict()

    # 2. Fallback: Search in any job's contracts subcollection
    print(f"[API] ClauseBundle {contract_id} not in top-level, searching subcollections...")
    query = db.collection_group("contracts").where(filter=FieldFilter("contract_id", "==", contract_id)).limit(1)
    docs = [d async for d in query.stream()]

    if docs:
        data = docs[0].to_dict()
        if "clause_bundle" in data:
            return data["clause_bundle"]

    raise HTTPException(status_code=404, detail="ClauseBundle not found")


@router.get("/contracts/{contract_id}/risk")
async def get_risk(contract_id: str, user: dict = Depends(get_optional_user)):
    db = _db()
    
    # 1. Try top-level standalone collection first
    doc = await db.collection("risk_reports").document(contract_id).get()
    if doc.exists:
        return doc.to_dict()
    
    # 2. Fallback: Search in any job's contracts subcollection
    print(f"[API] RiskReport {contract_id} not in top-level, searching subcollections...")
    query = db.collection_group("contracts").where(filter=FieldFilter("contract_id", "==", contract_id)).limit(1)
    docs = [d async for d in query.stream()]
    
    if docs:
        data = docs[0].to_dict()
        if "risk_report" in data:
            return data["risk_report"]
            
    raise HTTPException(status_code=404, detail="RiskReport not found")


@router.get("/contracts/{contract_id}/redlines")
async def get_redlines(contract_id: str, user: dict = Depends(get_optional_user)):
    db = _db()
    
    # 1. Try top-level standalone collection
    doc = await db.collection("redline_sets").document(contract_id).get()
    if doc.exists:
        return doc.to_dict()
    
    # 2. Fallback: Search in subcollections
    query = db.collection_group("contracts").where(filter=FieldFilter("contract_id", "==", contract_id)).limit(1)
    docs = [d async for d in query.stream()]
    
    if docs:
        data = docs[0].to_dict()
        if "redlines" in data:
            return {"contract_id": contract_id, "redlines": data["redlines"]}

    return {"contract_id": contract_id, "redlines": []}


@router.get("/contracts/{contract_id}/download")
async def download_contract(contract_id: str, doc_type: str = "original", user: dict = Depends(get_optional_user)):
    """Stream the contract file from GCS through the backend (avoids signed URL issues)."""
    from fastapi.responses import Response
    db = _db()

    query = db.collection_group("contracts").where(filter=FieldFilter("contract_id", "==", contract_id)).limit(1)
    docs = [d async for d in query.stream()]
    if not docs:
        raise HTTPException(status_code=404, detail="Contract not found")

    data = docs[0].to_dict()
    
    if doc_type == "redline":
        gcs_uri = data.get("exports", {}).get("docx_uri")
        if not gcs_uri:
            raise HTTPException(status_code=404, detail="Redlined document not generated yet")
        filename = f"{data.get('filename', 'document').rsplit('.', 1)[0]}_redlined.docx"
    else:
        gcs_uri = data.get("gcs_uri")
        if not gcs_uri:
            raise HTTPException(status_code=404, detail="No original file attached to this contract")
        filename = data.get("filename", "document")

    from tools.gcs_tools import gcs_download_uri
    try:
        file_bytes = gcs_download_uri(gcs_uri)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch file from storage: {e}")

    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    content_type = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword",
    }.get(ext, "application/octet-stream")

    return Response(
        content=file_bytes,
        media_type=content_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "private, max-age=3600",
        },
    )
