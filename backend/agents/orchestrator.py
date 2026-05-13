"""Root SequentialAgent — orchestrates the full ContractIQ pipeline."""
from google.adk.agents import SequentialAgent
from google.adk.tools import FunctionTool
from agents.ingestion import ingestion_agent
from agents.extractor import extractor_agent
from agents.risk_scorer import risk_scorer_agent
from agents.redline import redline_agent
from agents.hitl import hitl_agent
from agents.output_formatter import output_formatter_agent

root_agent = SequentialAgent(
    name="contractiq_orchestrator",
    description=(
        "Orchestrates the full ContractIQ pipeline: ingest → extract → score "
        "→ redline → human review → format outputs."
    ),
    sub_agents=[
        ingestion_agent,
        extractor_agent,
        risk_scorer_agent,
        redline_agent,
        hitl_agent,
        output_formatter_agent,
    ],
)
