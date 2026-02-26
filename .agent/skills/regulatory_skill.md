---
name: Regulatory Agent Skill
description: Cross-references audit findings with a Vector DB of 2026 EU ESPR regulations, green certification databases, and live regulatory updates to determine compliance status.
---

# Regulatory Agent Skill

## Purpose
The Regulatory Agent is the **compliance brain** of Verity-Nodes. It receives structured findings from the Auditor Agent and determines whether each finding constitutes a violation of the 2026 EU Ecodesign for Sustainable Products Regulation (ESPR) and the EU Green Claims Directive.

## Capabilities

### 1. Regulation Vector Store
- Maintains a ChromaDB vector store pre-loaded with:
  - EU ESPR 2024/0455 full regulation text (chunked by article)
  - EU Green Claims Directive 2023/0085 requirements
  - ISO 14067 (Carbon Footprint of Products) standards
  - EU Deforestation Regulation (EUDR) provisions
- Performs semantic similarity search to find the **most relevant regulation articles** for each finding

### 2. Compliance Determination
- For each Auditor finding, the agent:
  1. Queries the vector store for relevant regulation clauses
  2. Evaluates the finding against matched regulation text
  3. Produces a structured compliance verdict with cited regulation articles
  4. Assigns a violation severity: `CRITICAL`, `MAJOR`, `MINOR`, `OBSERVATION`

### 3. Certificate Verification
- Cross-reference supplier green certificates against:
  - EU EcoLabel registry
  - FSC/PEFC certification databases
  - Fairtrade certification records
- Verify certificate authenticity, expiry dates, and scope coverage

### 4. Live Regulatory Intelligence
- Use You.com Search API to check for:
  - Recent enforcement actions against specific suppliers
  - Port strikes or supply chain disruptions affecting compliance timelines
  - New regulatory amendments or guidance published since last vector store update

### 5. Output Format
```json
{
  "batch_id": "BATCH-2026-0102",
  "compliance_status": "NON_COMPLIANT",
  "violations": [
    {
      "finding_ref": "FIND-001",
      "regulation": "EU ESPR 2024/0455, Article 9(3)",
      "violation_type": "CRITICAL",
      "description": "Product passport data shows origin discrepancy violating traceability requirements",
      "cited_text": "Economic operators shall ensure the accuracy and completeness of the information in the digital product passport...",
      "remediation_deadline": "2026-03-15",
      "penalty_risk": "Up to 4% of annual EU turnover"
    }
  ],
  "recommended_action": "ESCALATE_TO_RESOLVER"
}
```

## Integration Points
- **Input:** Structured findings from the Auditor Agent via LangGraph state
- **Output:** Compliance verdicts passed to the **Resolution Agent** via LangGraph state
- **APIs Used:** ChromaDB (local vector store), You.com Search API, OpenCorporates API

## Error Handling
- If vector store returns no matches (similarity < 0.6), flag as `REGULATION_GAP` for human review
- If You.com API is unavailable, proceed with vector store results only and note `LIVE_INTEL_UNAVAILABLE`
- Maximum 2 re-evaluation loops before mandatory human escalation
