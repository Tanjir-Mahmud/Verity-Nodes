"""
Verity-Nodes: LangGraph Audit State Definition (v2)
Updated for DeepAuditor → RegulatoryShield → ActionAgent pipeline.
"""

from __future__ import annotations
from typing import TypedDict, List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# ---------------------------------------------------------------------------
# Sub-Models (Pydantic for validation)
# ---------------------------------------------------------------------------

class AuditFinding(BaseModel):
    """A single discrepancy found by DeepAuditor."""
    finding_id: str
    finding_type: Literal[
        "DATE_ANOMALY", "SOURCE_MISMATCH", "QUANTITY_DRIFT",
        "DUPLICATE_REFERENCE", "CERTIFICATE_EXPIRED", "EMISSIONS_EXCESS", "ENTITY_VALIDATION"
    ]
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    confidence: float = Field(..., ge=0.0, le=1.0)
    description: str
    evidence: dict = Field(default_factory=dict)
    source_document: str = ""
    claude_reasoning: str = ""


class ComplianceViolation(BaseModel):
    """A confirmed regulatory violation from RegulatoryShield."""
    violation_id: str
    finding_ref: str
    regulation: str
    violation_type: Literal["CRITICAL", "MAJOR", "MINOR", "OBSERVATION"]
    description: str
    cited_text: str = ""
    penalty_risk_pct: float = Field(0.0, ge=0.0, le=4.0)
    penalty_risk_eur: float = 0.0
    remediation_deadline: Optional[str] = None
    claude_legal_reasoning: str = ""


class CorrectiveAction(BaseModel):
    """A corrective action drafted by ActionAgent."""
    action_id: str
    violation_ref: str
    action: str
    deadline: str
    responsible_party: str
    verification_method: str
    status: Literal[
        "DRAFTED", "SENT", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "ESCALATED"
    ] = "DRAFTED"


class SupplierEmail(BaseModel):
    """An auto-drafted supplier notification email."""
    to: str
    subject: str
    body: str
    status: Literal["PENDING_HUMAN_APPROVAL", "APPROVED", "SENT"] = "PENDING_HUMAN_APPROVAL"


class AgentLogEntry(BaseModel):
    """A single entry in the Live Agent Orchestration Feed."""
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    agent: Literal["DEEP_AUDITOR", "REGULATORY_SHIELD", "ACTION_AGENT", "SYSTEM", "HUMAN"]
    action: str
    details: str
    severity: Literal["INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"


# ---------------------------------------------------------------------------
# LangGraph State
# ---------------------------------------------------------------------------

class AuditState(TypedDict, total=False):
    """Shared state for the DeepAuditor → RegulatoryShield → ActionAgent graph."""

    # --- Identity ---
    audit_id: str
    batch_id: str
    supplier_id: str
    supplier_name: str
    started_at: str

    # --- Documents ---
    documents: List[str]
    extracted_data: List[dict]

    # --- DeepAuditor Output ---
    findings: List[dict]
    overall_risk_score: float

    # --- RegulatoryShield Output ---
    compliance_status: str
    violations: List[dict]
    total_financial_exposure_eur: float

    # --- ActionAgent Output ---
    corrective_actions: List[dict]
    supplier_email: Optional[dict]
    resolution_status: str

    # --- Loop Control ---
    loop_count: int
    max_loops: int
    loop_decision: str

    # --- Live Agent Feed ---
    agent_log: List[dict]

    # --- External Intelligence ---
    emissions_data: Optional[dict]
    gleif_verification: Optional[dict]
    live_intelligence: Optional[dict]

    # --- Claude Token Usage ---
    total_input_tokens: int
    total_output_tokens: int
