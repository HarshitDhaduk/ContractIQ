from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from tools.playbook_tools import load_precedents
from config import settings

REDLINE_INSTRUCTION = """
You are a contract redlining specialist. You will receive from session state:
- clause_bundles: extracted clauses per contract
- risk_reports: risk analysis per contract

For each contract, identify clauses with risk_level HIGH or MEDIUM.
For EACH flagged clause:
1. Call load_precedents(contract_type) to find the firm's preferred standard language
2. Generate a proposed rewrite that:
   - Fixes the specific risk identified
   - Matches the style and tone of the firm's precedent language
   - Is legally sound and commercially reasonable
3. Provide a concise rationale (1–2 sentences explaining what changed and why)

DO NOT redline LOW risk clauses (cost control).
DO NOT redline if recommended_action is ACCEPT.

Output: JSON array of RedlineSet objects:
[
  {
    "contract_id": "...",
    "redlines": [
      {
        "clause_type": "indemnity",
        "original_text": "exact original...",
        "proposed_text": "revised text...",
        "rationale": "why this change..."
      }
    ]
  }
]

Return ONLY valid JSON. No explanation outside the JSON array.
"""


redline_agent = Agent(
    name="redline_agent",
    model=settings.GEMINI_MODEL_PRO,
    description="Generates clause rewrites for HIGH/MEDIUM risk clauses using firm precedent style.",
    instruction=REDLINE_INSTRUCTION,
    tools=[FunctionTool(load_precedents)],
    output_key="redline_sets",
    generate_content_config={
        "response_mime_type": "application/json",
    },
)
