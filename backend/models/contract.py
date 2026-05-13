from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from enum import Enum


class RiskLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ExtractedClause(BaseModel):
    clause_type: str
    original_text: str
    page_ref: List[int] = []
    is_standard: bool
    deviation_summary: Optional[str] = None


class ClauseBundle(BaseModel):
    contract_id: str
    contract_type: str
    parties: List[str] = []
    effective_date: Optional[str] = None
    clauses: List[ExtractedClause] = []
    missing_clauses: List[str] = []  # Expected clause types not found in doc


class ClauseRisk(BaseModel):
    clause_type: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    risk_category: Literal["legal", "commercial", "operational", "regulatory"]
    explanation: str
    recommended_action: Literal["ACCEPT", "NEGOTIATE", "ESCALATE", "BLOCK"]


class RiskReport(BaseModel):
    contract_id: str
    contract_risk_score: int = Field(ge=0, le=100)
    clause_risks: List[ClauseRisk] = []
    critical_flags: List[str] = []
    executive_summary: str
    recommended_action: Literal["APPROVE", "NEGOTIATE", "REJECT"]


class Redline(BaseModel):
    clause_type: str
    original_text: str
    proposed_text: str
    rationale: str


class RedlineSet(BaseModel):
    contract_id: str
    redlines: List[Redline] = []


class ReviewOverride(BaseModel):
    clause_type: str
    original_risk_level: RiskLevel
    overridden_to: RiskLevel
    rationale: str


class ReviewDecision(BaseModel):
    job_id: Optional[str] = None
    contract_id: Optional[str] = None
    action: Literal["APPROVE", "OVERRIDE", "ESCALATE"]
    reviewer_id: Optional[str] = None
    notes: Optional[str] = None
    overrides: List[ReviewOverride] = []


class ContractMetadata(BaseModel):
    filename: str
    page_count: int = 0
    contract_type: str = "UNKNOWN"
    parties: List[str] = []
    effective_date: Optional[str] = None
    detected_language: str = "en"
    file_uri: Optional[str] = None   # Gemini Files API URI
    gcs_uri: Optional[str] = None


class ExportUris(BaseModel):
    json_uri: Optional[str] = None
    docx_uri: Optional[str] = None
    pdf_uri: Optional[str] = None
