from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from tools.playbook_tools import get_risk_thresholds
from tools.notification_tools import save_risk_report
from models.contract import RiskReport
from config import settings

RISK_INSTRUCTION = """
You are a contract risk analyst. You will receive from session state:
- clause_bundles: array of ClauseBundle JSON objects (one per contract)
- playbook_id: the firm's playbook ID

For EACH ClauseBundle:
1. Call get_risk_thresholds(playbook_id) to load the firm's acceptable standards
2. Score each extracted clause on a 0–100 risk scale:
   - HIGH (70–100): Poses significant legal or commercial risk.
     Examples: uncapped indemnity, IP assigned to counterparty, no liability cap
   - MEDIUM (40–69): Non-standard but negotiable.
     Examples: payment >30 days, auto-renewal without adequate notice
   - LOW (0–39): Minor deviation or fully acceptable.
3. For each clause also provide:
   - risk_category: legal | commercial | operational | regulatory
   - explanation: 1–2 sentence plain English explanation
   - recommended_action: ACCEPT | NEGOTIATE | ESCALATE | BLOCK
4. Produce:
   - contract_risk_score: weighted average (0–100), weight HIGH clauses at 3x
   - critical_flags: list of clause_types with HIGH risk
   - executive_summary: 3-sentence plain English summary for non-lawyers
   - recommended_action: APPROVE (score≤30) | NEGOTIATE (30–70) | REJECT (>70)
3. After scoring EACH RiskReport, call save_risk_report(job_id, contract_id, report) to persist the results.

Output: a JSON array of RiskReport objects, one per contract. No explanation outside JSON.
"""


risk_scorer_agent = Agent(
    name="risk_scorer_agent",
    model=settings.GEMINI_MODEL_PRO,
    description="Scores each contract clause against playbook thresholds, produces RiskReports.",
    instruction=RISK_INSTRUCTION,
    tools=[
        FunctionTool(get_risk_thresholds),
        FunctionTool(save_risk_report),
    ],
    output_key="risk_reports",
)
