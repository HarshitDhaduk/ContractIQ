from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from tools.playbook_tools import load_playbook, load_precedents
from models.contract import ClauseBundle
from config import settings

EXTRACTOR_INSTRUCTION = """
You are a senior contract lawyer specialising in clause extraction.

You will receive from session state:
- document_manifest: the list of documents with their file_uri values
- playbook_id: ID of the firm's standard playbook

For each document in the manifest:
1. Call load_playbook(playbook_id) to get the firm's standard clause language
2. Using the full document content (via its file_uri) + the playbook, extract ALL of the following clause types
3. For each found clause, set is_standard=true if it matches the playbook expectation, false if it deviates

CLAUSE TYPES TO EXTRACT:
indemnity, limitation_of_liability, ip_ownership, ip_assignment,
payment_terms, payment_schedule, late_payment, termination_for_cause,
termination_for_convenience, termination_notice, governing_law,
dispute_resolution, arbitration, confidentiality, non_compete,
non_solicit, data_protection, security_requirements, audit_rights,
force_majeure, assignment, subcontracting, change_control,
warranties, representations, conditions_precedent, insurance,
liability_cap, exclusion_of_consequential_loss, most_favoured_nation,
benchmarking, step_in_rights, liquidated_damages, sla_terms,
service_credits, renewal_auto, renewal_notice, price_escalation,
entire_agreement, severability

For each found clause return:
- clause_type: one of the types above
- original_text: exact verbatim text from the contract
- page_ref: list of page numbers (e.g. [3, 4])
- is_standard: true/false
- deviation_summary: brief note if is_standard is false, null otherwise

Also note which expected clause types are MISSING from the document.

Return ONLY valid JSON matching the ClauseBundle schema for EACH document.
Produce one ClauseBundle per document. Output as a JSON array: [ClauseBundle, ...].
Do NOT add any explanation outside the JSON.
"""


extractor_agent = Agent(
    name="extractor_agent",
    model=settings.GEMINI_MODEL_PRO,
    description="Extracts all contract clauses as structured JSON using Gemini 2M context.",
    instruction=EXTRACTOR_INSTRUCTION,
    tools=[
        FunctionTool(load_playbook),
        FunctionTool(load_precedents),
    ],
    output_key="clause_bundles",
    generate_content_config={
        "response_mime_type": "application/json",
    },
)
