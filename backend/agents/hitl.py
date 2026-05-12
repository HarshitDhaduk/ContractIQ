"""
HITL (Human-in-the-Loop) agent.
No model inference — pure orchestration node.
Pauses the pipeline, writes PENDING_REVIEW to Firestore,
optionally pings Slack, then polls for the reviewer's decision.
"""
import asyncio
from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from tools.notification_tools import (
    send_review_notification,
    check_review_decision,
    update_job_status,
)
from config import settings

HITL_INSTRUCTION = """
You are the human-in-the-loop checkpoint agent.

Check the session state:
- risk_reports: list of RiskReport objects
- job_id: the current job ID
- reviewer_email: the assigned reviewer's email

For each contract in risk_reports:
- If contract_risk_score > AUTO_APPROVE_THRESHOLD OR critical_flags is non-empty:
  → Call request_human_review(job_id, contract_id, risk_score, critical_flags, reviewer_email)
  → Wait for the result (it will poll Firestore)
  → Set review_decision for that contract

- If contract_risk_score <= AUTO_APPROVE_THRESHOLD AND critical_flags is empty:
  → Set review_decision to {"action": "APPROVE", "notes": "Auto-approved: low risk score"}

Store all decisions as a list under output_key "review_decisions".
Format: [{"contract_id": "...", "decision": {...}}, ...]
"""

AUTO_APPROVE_THRESHOLD = settings.AUTO_APPROVE_THRESHOLD


async def request_human_review(
    job_id: str,
    contract_id: str,
    risk_score: int,
    critical_flags: list[str],
    reviewer_email: str,
    sla_hours: int = 24,
    slack_webhook_url: str = "",
) -> dict:
    """
    Sends review notification, then polls Firestore for the decision.
    Returns the reviewer's decision dict or auto-escalates after SLA.
    """
    review_url = f"https://contractiq.app/contracts/{contract_id}"

    await send_review_notification(
        job_id=job_id,
        review_url=review_url,
        risk_score=risk_score,
        critical_flags=critical_flags,
        reviewer_email=reviewer_email,
        slack_webhook_url=slack_webhook_url,
    )

    # Poll Firestore every 30s up to the SLA deadline
    deadline = asyncio.get_event_loop().time() + (sla_hours * 3600)
    while asyncio.get_event_loop().time() < deadline:
        decision = await check_review_decision(job_id)
        if decision:
            return decision
        await asyncio.sleep(30)

    # SLA exceeded → auto-escalate
    escalation = {
        "action": "ESCALATE",
        "notes": f"SLA exceeded: {sla_hours}h — auto-escalated",
        "auto": True,
    }
    await update_job_status(job_id, "AUTO_ESCALATED", contract_id=contract_id)
    return escalation


hitl_agent = Agent(
    name="hitl_review_agent",
    model=settings.GEMINI_MODEL_FLASH,
    description="Pauses pipeline for human lawyer review; auto-approves low-risk contracts.",
    instruction=HITL_INSTRUCTION,
    tools=[FunctionTool(request_human_review)],
    output_key="review_decisions",
)
