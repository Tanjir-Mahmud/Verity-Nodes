"""
Verity-Nodes: ActionAgent Node (v2)
Uses Claude 3.5 to draft self-healing corrective actions and supplier emails.
Implements the loop decision engine (resolve / re-audit / escalate).
"""

from __future__ import annotations
from typing import Any
import uuid
import logging
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()

from .state import AuditState, CorrectiveAction, SupplierEmail, AgentLogEntry
from integrations.claude_brain import ClaudeClient

logger = logging.getLogger("verity.agents.action_agent")


# ---------------------------------------------------------------------------
# Corrective Action Templates
# ---------------------------------------------------------------------------
ACTION_TEMPLATES = {
    "DATE_ANOMALY": {
        "action": "Provide corrected invoice with accurate manufacturing and issue dates, supported by production batch records from the factory floor system",
        "verification": "Re-scan corrected documents through DeepAuditor",
    },
    "SOURCE_MISMATCH": {
        "action": "Submit verified Certificate of Origin from an accredited customs authority matching actual port of loading and shipper details",
        "verification": "Cross-reference new certificate against bill of lading and GLEIF entity registration",
    },
    "QUANTITY_DRIFT": {
        "action": "Reconcile quantity discrepancies between invoice and bill of lading; provide packing list with item-level counts and weigh-bridge receipts",
        "verification": "Re-audit with reconciled documents; verify quantities within 0.5% tolerance",
    },
    "CERTIFICATE_EXPIRED": {
        "action": "Obtain renewed certification from accredited EU conformity assessment body (Notified Body per ESPR Art. 48); submit proof of re-certification application",
        "verification": "Validate new certificate against EU EcoLabel registry and verify scope coverage",
    },
    "EMISSIONS_EXCESS": {
        "action": "Submit carbon footprint recalculation using GLEC Framework v3.0 methodology; propose alternative low-emission logistics routes",
        "verification": "Re-calculate emissions via Climatiq API with updated data; verify GLEC compliance",
    },
}


async def action_agent_node(state: AuditState) -> dict[str, Any]:
    """
    ActionAgent: Self-healing corrective actions + escalation logic.

    Pipeline:
    1. Generate corrective action plans for each violation
    2. Use Claude 3.5 to draft professional supplier notification emails
    3. Implement the self-healing loop decision (resolve/continue/escalate)
    """
    violations = state.get("violations", [])
    findings = state.get("findings", [])
    agent_log = list(state.get("agent_log", []))
    loop_count = state.get("loop_count", 0)
    max_loops = state.get("max_loops", 3)
    total_input_tokens = state.get("total_input_tokens", 0)
    total_output_tokens = state.get("total_output_tokens", 0)
    overall_risk_score = state.get("overall_risk_score", 0.0)

    supplier_name = state.get("supplier_name", "Unknown Supplier")
    supplier_id = state.get("supplier_id", "SUP-UNKNOWN")
    batch_id = state.get("batch_id", "BATCH-UNKNOWN")
    total_exposure = state.get("total_financial_exposure_eur", 0)

    claude = ClaudeClient()
    corrective_actions: list[dict] = []
    supplier_email_data: dict | None = None

    # --- Log: Agent Start ---
    agent_log.append(AgentLogEntry(
        agent="ACTION_AGENT",
        action="RESOLUTION_INITIATED",
        details=f"ActionAgent processing {len(violations)} violations (loop {loop_count + 1}/{max_loops}). Total exposure: €{total_exposure:,.0f}.",
        severity="INFO",
    ).model_dump())

    # --- Step 1: Generate Corrective Actions ---
    finding_lookup = {f.get("finding_id", ""): f for f in findings}

    for violation in violations:
        finding_ref = violation.get("finding_ref", "")
        finding = finding_lookup.get(finding_ref, {})
        finding_type = finding.get("finding_type", "")
        template = ACTION_TEMPLATES.get(finding_type, {
            "action": "Provide additional documentation to resolve the identified discrepancy",
            "verification": "Manual review by compliance officer",
        })

        deadline = (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d")

        ca = CorrectiveAction(
            action_id=f"CA-{uuid.uuid4().hex[:8].upper()}",
            violation_ref=violation.get("violation_id", ""),
            action=template["action"],
            deadline=deadline,
            responsible_party=f"Supplier {supplier_id}",
            verification_method=template["verification"],
            status="DRAFTED",
        )
        corrective_actions.append(ca.model_dump())

        agent_log.append(AgentLogEntry(
            agent="ACTION_AGENT",
            action="ACTION_DRAFTED",
            details=f"Corrective action for {finding_type}: {template['action'][:100]}...",
            severity="INFO",
        ).model_dump())

    # --- Step 2: Claude-Drafted Supplier Email (Self-Healing) ---
    if violations:
        try:
            email_body = await claude.draft_supplier_email(
                supplier_name=supplier_name,
                batch_id=batch_id,
                violations=violations,
                corrective_actions=corrective_actions,
            )
            total_input_tokens += 600
            total_output_tokens += 800

            email = SupplierEmail(
                to=f"compliance@{supplier_name.lower().replace(' ', '-')}.com",
                subject=f"URGENT: Non-Compliance Notice — Batch #{batch_id} | Verity-Nodes Audit",
                body=email_body,
                status="PENDING_HUMAN_APPROVAL",
            )
            supplier_email_data = email.model_dump()

            agent_log.append(AgentLogEntry(
                agent="ACTION_AGENT",
                action="SELF_HEALING_EMAIL",
                details=f"Self-healing email drafted by Claude → {email.to} (PENDING_HUMAN_APPROVAL). Cites {len(violations)} ESPR violations.",
                severity="INFO",
            ).model_dump())
        except Exception as e:
            logger.warning(f"Claude email drafting failed: {e}")
            # Fallback: simple email
            email = SupplierEmail(
                to=f"compliance@{supplier_name.lower().replace(' ', '-')}.com",
                subject=f"URGENT: Non-Compliance Notice — Batch #{batch_id}",
                body=f"Dear {supplier_name} Compliance Team,\n\nAudit Batch #{batch_id} has identified {len(violations)} violations. Please review and respond within 72 hours.\n\n— Verity-Nodes Autonomous Audit System",
                status="PENDING_HUMAN_APPROVAL",
            )
            supplier_email_data = email.model_dump()

            agent_log.append(AgentLogEntry(
                agent="ACTION_AGENT",
                action="EMAIL_FALLBACK",
                details=f"Claude unavailable for email draft. Using template fallback → {email.to}",
                severity="WARNING",
            ).model_dump())

    # --- Step 2.5: Trust Bonus Logistics ---
    gleif_data = state.get("gleif_verification") or {}
    intel_data = state.get("live_intelligence") or {}

    is_gleif_clean = gleif_data.get("verification_status") == "VERIFIED"
    is_intel_clean = intel_data.get("overall_risk") == "LOW"

    if is_gleif_clean and is_intel_clean and overall_risk_score > 0:
        bonus = 0.15  # 15 percentage points reduction
        overall_risk_score = round(max(0.0, overall_risk_score - bonus), 2)
        
        agent_log.append(AgentLogEntry(
            agent="ACTION_AGENT",
            action="TRUST_BONUS_APPLIED",
            details=f"Supplier verified on GLEIF and live intelligence is clean. Applying {int(bonus*100)}% Trust Bonus reduction to risk score. New score: {overall_risk_score}",
            severity="INFO",
        ).model_dump())

    # --- Step 3: Loop Decision Engine ---
    critical_violations = [v for v in violations if v.get("violation_type") == "CRITICAL"]
    has_critical = len(critical_violations) > 0

    if not violations:
        loop_decision = "RESOLVED"
        resolution_status = "RESOLVED"
        agent_log.append(AgentLogEntry(
            agent="ACTION_AGENT",
            action="AUDIT_RESOLVED",
            details="No violations found. Batch is COMPLIANT. Audit complete.",
            severity="INFO",
        ).model_dump())
    elif loop_count >= max_loops - 1:
        loop_decision = "ESCALATE_TO_HUMAN"
        resolution_status = "ESCALATED"
        agent_log.append(AgentLogEntry(
            agent="ACTION_AGENT",
            action="ESCALATION_TRIGGERED",
            details=f"Maximum audit loops ({max_loops}) reached. Escalating to human compliance officer. Total exposure: €{total_exposure:,.0f}.",
            severity="CRITICAL",
        ).model_dump())
    elif has_critical:
        loop_decision = "ESCALATE_TO_HUMAN"
        resolution_status = "ESCALATED"
        agent_log.append(AgentLogEntry(
            agent="ACTION_AGENT",
            action="ESCALATION_TRIGGERED",
            details=f"CRITICAL violations detected ({len(critical_violations)}). Immediate human review required. Self-healing email drafted pending approval.",
            severity="CRITICAL",
        ).model_dump())
    else:
        loop_decision = "CONTINUE"
        resolution_status = "ACTION_PLAN_DRAFTED"
        agent_log.append(AgentLogEntry(
            agent="ACTION_AGENT",
            action="RE_AUDIT_SCHEDULED",
            details="Non-critical violations. Corrective actions drafted. Scheduling re-audit via DeepAuditor.",
            severity="INFO",
        ).model_dump())

    # --- Log: Complete ---
    agent_log.append(AgentLogEntry(
        agent="ACTION_AGENT",
        action="RESOLUTION_COMPLETE",
        details=f"Decision: {loop_decision} | Actions: {len(corrective_actions)} | Email: {'DRAFTED' if supplier_email_data else 'N/A'} | Status: {resolution_status}",
        severity="INFO",
    ).model_dump())

    return {
        "corrective_actions": corrective_actions,
        "supplier_email": supplier_email_data,
        "resolution_status": resolution_status,
        "loop_decision": loop_decision,
        "loop_count": loop_count + 1,
        "overall_risk_score": overall_risk_score,
        "agent_log": agent_log,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
    }
