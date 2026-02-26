---
name: Resolution Agent Skill
description: Drafts corrective action plans, generates automated supplier notification emails, and manages the remediation workflow until compliance gaps are resolved or escalated.
---

# Resolution Agent Skill

## Purpose
The Resolution Agent is the **action engine** of Verity-Nodes. It takes confirmed compliance violations from the Regulatory Agent and autonomously drafts remediation plans, generates supplier communications, and tracks resolution progress — closing the self-healing loop.

## Capabilities

### 1. Corrective Action Plan Generation
- For each violation, generate a structured Corrective Action Plan (CAP) containing:
  - Root cause analysis based on audit findings
  - Specific remediation steps with deadlines
  - Required documentation for re-verification
  - Estimated cost impact and timeline

### 2. Automated Supplier Communications
- Draft professional, regulation-cited emails to suppliers that include:
  - Specific violation details with evidence references
  - Required corrective actions and deadlines
  - Consequences of non-compliance (contract termination, regulatory penalties)
  - Re-audit scheduling information
- Tone: Firm but professional — the system drafts, humans approve before sending

### 3. Remediation Tracking
- Monitor the status of each corrective action:
  - `DRAFTED` → `SENT` → `ACKNOWLEDGED` → `IN_PROGRESS` → `RESOLVED` / `ESCALATED`
- Auto-trigger re-audit cycle when supplier submits corrective documentation
- Escalate to human compliance officer if:
  - Supplier does not respond within 72 hours
  - 3 consecutive re-audit cycles fail
  - Violation severity is `CRITICAL`

### 4. Emissions Recalculation
- After corrective actions are applied, re-query Carbon Interface API to:
  - Recalculate Scope 3 emissions with updated logistics data
  - Verify that proposed supply chain changes actually reduce carbon footprint
  - Generate before/after emissions comparison report

### 5. Output Format
```json
{
  "batch_id": "BATCH-2026-0102",
  "resolution_status": "ACTION_PLAN_DRAFTED",
  "corrective_actions": [
    {
      "violation_ref": "VIOL-001",
      "action": "Supplier must provide updated Certificate of Origin from accredited body",
      "deadline": "2026-03-01",
      "responsible_party": "Supplier SUP-4821",
      "verification_method": "Re-audit with document re-scan"
    }
  ],
  "supplier_email": {
    "to": "compliance@supplier-4821.com",
    "subject": "URGENT: Non-Compliance Notice — Batch #BATCH-2026-0102",
    "body": "Dear Supplier...",
    "status": "PENDING_HUMAN_APPROVAL"
  },
  "loop_decision": "RESOLVED" | "RE_AUDIT" | "ESCALATE_TO_HUMAN"
}
```

## Integration Points
- **Input:** Compliance verdicts from the Regulatory Agent via LangGraph state
- **Output:** Resolution status fed back into LangGraph for loop decision (re-audit or close)
- **APIs Used:** Carbon Interface API (emissions recalculation), OpenCorporates API (supplier verification)

## Error Handling
- If email generation fails, log error and set status to `DRAFT_FAILED` for manual intervention
- If Carbon Interface API is unavailable, proceed with existing emissions data and flag `EMISSIONS_STALE`
- All drafted emails are `PENDING_HUMAN_APPROVAL` by default — no auto-send without human confirmation
