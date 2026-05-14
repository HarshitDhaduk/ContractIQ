"""Pipeline runner — orchestrates all worker stages in sequence.

This is the main entry point called by the API routes.
Each stage is imported from its own module for clarity.
"""
import json
from api.db import get_db
from config import settings
from pipeline_utils import set_job_status, fail_job
from workers.ingest import stage_ingest
from workers.extract import stage_extract
from workers.score import stage_score
from workers.redline import stage_redline
from workers.review import stage_review
from workers.format import run_formatting


def _load_playbook_context(playbook_id: str | None) -> str:
    """Load playbook content as string for inclusion in prompts."""
    if not playbook_id:
        return "No playbook specified. Use general best-practice legal standards."
    try:
        from tools.playbook_tools import load_playbook
        pb = load_playbook(playbook_id)
        return json.dumps(pb, indent=2)
    except Exception as e:
        print(f"[RUNNER] Failed to load playbook {playbook_id}: {e}")
        return f"Playbook '{playbook_id}' could not be loaded. Use general standards."


async def run_pipeline(job_id: str, job_record: dict, user_id: str) -> None:
    """
    Run the full contract review pipeline for a job.
    Each stage updates Firestore deterministically.
    """
    db = get_db()
    gcs_uris = job_record.get("gcs_uris", [])
    filenames = job_record.get("filenames", [])
    playbook_id = job_record.get("playbook_id")
    auto_threshold = job_record.get("auto_approve_threshold", settings.AUTO_APPROVE_THRESHOLD)
    playbook_ctx = _load_playbook_context(playbook_id)

    print(f"\n[RUNNER] ══════ Starting pipeline for job {job_id} ({len(gcs_uris)} docs) ══════")

    try:
        # Stage 1: Ingest documents
        contracts = await stage_ingest(db, job_id, gcs_uris, filenames)

        # Stage 2: Extract clauses
        contracts = await stage_extract(db, job_id, contracts, playbook_ctx)

        # Stage 3: Score risk
        contracts = await stage_score(db, job_id, contracts, playbook_ctx)

        # Stage 4: Generate redlines
        contracts = await stage_redline(db, job_id, contracts)

        # Stage 5: Review + auto-approve
        contracts, any_pending = await stage_review(db, job_id, contracts, auto_threshold)

        # Stage 6: If all auto-approved, format immediately
        if not any_pending:
            await run_formatting(db, job_id, contracts)

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[RUNNER] ══════ Pipeline FAILED for job {job_id}: {e} ══════")
        await fail_job(db, job_id, "pipeline", e)


async def resume_after_review(job_id: str) -> None:
    """
    Called by the review API after a human submits their decision.
    Checks if ALL contracts in the job have been reviewed.
    If so, triggers the formatting stage.
    """
    db = get_db()

    docs = db.collection("jobs").document(job_id).collection("contracts").stream()
    contracts = []
    all_reviewed = True

    async for d in docs:
        data = d.to_dict()
        contracts.append(data)
        if data.get("status") == "PENDING_REVIEW":
            all_reviewed = False

    if not all_reviewed:
        print(f"[RUNNER] Job {job_id} still has contracts pending review")
        return

    print(f"[RUNNER] All contracts reviewed for job {job_id} — triggering formatting")
    await run_formatting(db, job_id, contracts)
