import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.getcwd())

from api.routes.jobs import _run_pipeline
from google.cloud import firestore
from config import settings

async def test_manual_trigger(job_id):
    from config import settings
    print(f"DEBUG: GEMINI_MODEL_PRO={settings.GEMINI_MODEL_PRO}")
    print(f"DEBUG: GEMINI_MODEL_FLASH={settings.GEMINI_MODEL_FLASH}")
    print(f"Manually triggering pipeline for {job_id}...")
    db = firestore.AsyncClient(project=settings.GCP_PROJECT, database=settings.FIRESTORE_DATABASE)
    doc = await db.collection("jobs").document(job_id).get()
    if not doc.exists:
        print("Job not found")
        return
    
    job_record = doc.to_dict()
    try:
        await _run_pipeline(job_id, job_record, job_record.get("user_id", "demo_user"))
    except Exception:
        import traceback
        traceback.print_exc()
    print("Manual trigger finished.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_trigger.py <job_id>")
    else:
        asyncio.run(test_manual_trigger(sys.argv[1]))
