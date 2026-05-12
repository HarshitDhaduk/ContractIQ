"""ADK Runner entrypoint — used by `adk web` and Cloud Tasks workers."""
import asyncio
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from agents.orchestrator import root_agent
from config import settings


async def run_contract_review(job: dict) -> dict:
    """
    Launch the full pipeline for a job.
    job dict keys: job_id, user_id, document_uris, playbook_id,
                   reviewer_email, sla_hours, slack_webhook_url
    """
    session_service = InMemorySessionService()

    runner = Runner(
        agent=root_agent,
        app_name="contractiq",
        session_service=session_service,
    )

    initial_state = {
        "job_id": job["job_id"],
        "document_uris": job["document_uris"],
        "playbook_id": job["playbook_id"],
        "reviewer_email": job.get("reviewer_email", ""),
        "sla_hours": job.get("sla_hours", settings.HITL_SLA_HOURS),
        "auto_approve_threshold": job.get(
            "auto_approve_threshold", settings.AUTO_APPROVE_THRESHOLD
        ),
        "slack_webhook_url": job.get("slack_webhook_url", settings.SLACK_WEBHOOK_URL),
    }

    session = await session_service.create_session(
        app_name="contractiq",
        user_id=job["user_id"],
        state=initial_state,
    )

    user_message = types.Content(
        role="user",
        parts=[
            types.Part(
                text=(
                    f"Process job {job['job_id']}. "
                    f"Documents: {job['document_uris']}. "
                    f"Playbook: {job['playbook_id']}. "
                    f"Execute the full pipeline: ingest, extract, score, redline, review, output."
                )
            )
        ],
    )

    result = await runner.run_async(
        user_id=job["user_id"],
        session_id=session.id,
        new_message=user_message,
    )
    return {"job_id": job["job_id"], "result": str(result)}


if __name__ == "__main__":
    # Quick local test
    asyncio.run(
        run_contract_review({
            "job_id": "test_001",
            "user_id": "dev",
            "document_uris": [],
            "playbook_id": "nda_standard_2026",
            "reviewer_email": "dev@example.com",
        })
    )
