from enum import Enum
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    INGESTING = "INGESTING"
    EXTRACTING = "EXTRACTING"
    SCORING = "SCORING"
    REDLINING = "REDLINING"
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    OVERRIDDEN = "OVERRIDDEN"
    ESCALATED = "ESCALATED"
    AUTO_ESCALATED = "AUTO_ESCALATED"
    FORMATTING = "FORMATTING"
    COMPLETE = "COMPLETE"
    # Error states
    FAILED_INGESTION = "FAILED_INGESTION"
    FAILED_EXTRACTION = "FAILED_EXTRACTION"
    FAILED_SCORING = "FAILED_SCORING"
    FAILED = "FAILED"


class ContractStatus(str, Enum):
    QUEUED = "QUEUED"
    INGESTING = "INGESTING"
    EXTRACTING = "EXTRACTING"
    SCORING = "SCORING"
    REDLINING = "REDLINING"
    PENDING_REVIEW = "PENDING_REVIEW"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class JobCreateRequest(BaseModel):
    upload_ids: List[str]
    playbook_id: Optional[str] = None
    reviewer_email: str
    sla_hours: int = 24
    generate_redlines: bool = True
    auto_approve_threshold: int = 30
    export_formats: List[str] = ["json", "docx", "pdf"]
    slack_webhook_url: Optional[str] = None  # per-job override


class Job(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.QUEUED
    user_id: str
    org_id: Optional[str] = None
    playbook_id: str
    reviewer_email: str
    sla_hours: int = 24
    contract_count: int = 0
    contracts_complete: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    estimated_completion_minutes: Optional[int] = None


class ContractSummary(BaseModel):
    contract_id: str
    job_id: str
    filename: str
    status: ContractStatus = ContractStatus.QUEUED
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    critical_flags: List[str] = []
    review_action: Optional[str] = None
    created_at: Optional[str] = None
