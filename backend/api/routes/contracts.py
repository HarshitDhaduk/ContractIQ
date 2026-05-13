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
        
    return docs[0].to_dict()


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
