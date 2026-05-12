"""Contract detail routes — clauses, risk, redlines."""
from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore
from api.deps import get_optional_user
from config import settings

router = APIRouter()


def _db():
    return firestore.AsyncClient(
        project=settings.GCP_PROJECT,
        database=settings.FIRESTORE_DATABASE,
    )


@router.get("/contracts/{contract_id}/clauses")
async def get_clauses(contract_id: str, user: dict = Depends(get_optional_user)):
    db = _db()
    doc = await db.collection("clause_bundles").document(contract_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="ClauseBundle not found")
    return doc.to_dict()


@router.get("/contracts/{contract_id}/risk")
async def get_risk(contract_id: str, user: dict = Depends(get_optional_user)):
    db = _db()
    doc = await db.collection("risk_reports").document(contract_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="RiskReport not found")
    return doc.to_dict()


@router.get("/contracts/{contract_id}/redlines")
async def get_redlines(contract_id: str, user: dict = Depends(get_optional_user)):
    db = _db()
    doc = await db.collection("redline_sets").document(contract_id).get()
    if not doc.exists:
        return {"contract_id": contract_id, "redlines": []}
    return doc.to_dict()
