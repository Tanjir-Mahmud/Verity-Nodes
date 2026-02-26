"""
Verity-Nodes: LangGraph Compiled Audit Graph (v2)
DeepAuditor → RegulatoryShield → ActionAgent with self-healing loop.

Graph topology:
  START → deep_auditor → regulatory_shield → action_agent → {RESOLVED | RE_AUDIT loop | ESCALATE → END}
"""

from __future__ import annotations
from typing import Literal
import logging

from langgraph.graph import StateGraph, END
from langgraph.graph.state import CompiledStateGraph

from .state import AuditState
from .auditor import deep_auditor_node
from .regulatory import regulatory_shield_node
from .resolver import action_agent_node

logger = logging.getLogger("verity.agents.graph")


def _route_after_action(state: AuditState) -> Literal["deep_auditor", "__end__"]:
    """
    Conditional edge after ActionAgent.
    Routes:
    - CONTINUE → loop back to DeepAuditor (re-audit with corrected docs)
    - RESOLVED → end (compliance achieved)
    - ESCALATE_TO_HUMAN → end (human takeover)
    """
    decision = state.get("loop_decision", "ESCALATE_TO_HUMAN")

    if decision == "CONTINUE":
        loop_count = state.get("loop_count", 0)
        max_loops = state.get("max_loops", 3)
        if loop_count < max_loops:
            logger.info(f"Self-healing re-audit cycle {loop_count}/{max_loops}")
            return "deep_auditor"
        else:
            logger.info(f"Max loops reached ({max_loops})")
            return "__end__"
    else:
        logger.info(f"Graph ending: {decision}")
        return "__end__"


def build_audit_graph() -> CompiledStateGraph:
    """
    Build and compile the LangGraph audit pipeline.

    Returns:
        Compiled StateGraph: DeepAuditor → RegulatoryShield → ActionAgent
    """
    workflow = StateGraph(AuditState)

    # Add nodes with new agent names
    workflow.add_node("deep_auditor", deep_auditor_node)
    workflow.add_node("regulatory_shield", regulatory_shield_node)
    workflow.add_node("action_agent", action_agent_node)

    # Entry point
    workflow.set_entry_point("deep_auditor")

    # Linear edges
    workflow.add_edge("deep_auditor", "regulatory_shield")
    workflow.add_edge("regulatory_shield", "action_agent")

    # Conditional self-healing loop
    workflow.add_conditional_edges(
        "action_agent",
        _route_after_action,
        {
            "deep_auditor": "deep_auditor",
            END: END,
        },
    )

    compiled = workflow.compile()
    logger.info("Verity-Nodes audit graph compiled (v2: DeepAuditor → RegulatoryShield → ActionAgent)")
    return compiled


def get_initial_state(
    batch_id: str = "BATCH-2026-0402",
    supplier_id: str = "SUP-4821",
    supplier_name: str = "GreenTextile GmbH",
    documents: list[str] | None = None,
    extracted_data: list[dict] | None = None,
    max_loops: int = 3,
) -> AuditState:
    """Create the initial state for a new audit run."""
    from datetime import datetime

    return AuditState(
        audit_id=f"AUDIT-{batch_id}",
        batch_id=batch_id,
        supplier_id=supplier_id,
        supplier_name=supplier_name,
        started_at=datetime.utcnow().isoformat(),
        documents=documents or [
            "INV-2026-0402-003.pdf",
            "BOL-SH-2026-0402.pdf",
            "CERT-ECO-2026-091.pdf",
        ],
        extracted_data=extracted_data or [],
        findings=[],
        overall_risk_score=0.0,
        compliance_status="PENDING",
        violations=[],
        total_financial_exposure_eur=0.0,
        corrective_actions=[],
        supplier_email=None,
        resolution_status="PENDING",
        loop_count=0,
        max_loops=max_loops,
        loop_decision="PENDING",
        agent_log=[],
        emissions_data=None,
        gleif_verification=None,
        live_intelligence=None,
        total_input_tokens=0,
        total_output_tokens=0,
    )
