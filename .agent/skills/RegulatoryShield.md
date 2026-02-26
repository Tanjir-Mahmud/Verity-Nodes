---
name: RegulatoryShield Agent
description: Performs RAG against the full text of EU ESPR 2024/0455 and the Green Claims Directive to calculate 4% revenue risk penalties. Cross-references findings from DeepAuditor with specific regulation articles and quantifies financial exposure.
---

# RegulatoryShield Agent

## Purpose
RegulatoryShield is the **compliance brain** of Verity-Nodes. It receives structured findings from DeepAuditor and performs **Retrieval-Augmented Generation (RAG)** against a vector store of EU sustainability regulations to determine:
1. Whether each finding constitutes a formal violation
2. Which specific regulation articles are violated
3. The **quantified financial penalty risk** (up to 4% of annual EU turnover)

## Capabilities

### 1. Regulation Vector Store (ChromaDB)
Pre-loaded corpus:
- EU ESPR 2024/0455 (full text, chunked by article)
- EU Green Claims Directive 2023/0085
- ISO 14067 (Carbon Footprint of Products)
- EU Deforestation Regulation (EUDR)
- GLEC Framework v3.0 (Global Logistics Emissions Council)

### 2. RAG-Powered Compliance Analysis
For each DeepAuditor finding:
1. **Semantic search** against vector store (top-k=5, similarity threshold 0.6)
2. **Claude 3.5 Sonnet reasoning** to evaluate finding against matched articles
3. **Structured verdict** with cited regulation text, violation type, and penalty calculation
4. **Revenue risk quantification**: Calculate 4% annual EU turnover penalty exposure

### 3. Penalty Risk Calculator
```
Penalty = Annual EU Revenue × Violation Multiplier
CRITICAL: 4.0% (max under ESPR Art. 68)
MAJOR:    2.5%
MINOR:    1.0%
OBSERVATION: 0% (advisory only)
```

### 4. Cross-Examination Protocol
RegulatoryShield performs **zero-trust verification** of DeepAuditor's findings:
- Challenge low-confidence findings (< 0.7) with counter-queries
- Verify that the cited regulation article actually applies to the product category
- Escalate ambiguous cases to human with specific questions

### 5. Output Schema
```json
{
  "compliance_status": "NON_COMPLIANT",
  "violations": [
    {
      "finding_ref": "FIND-001",
      "regulation": "EU ESPR 2024/0455, Article 9(3)",
      "violation_type": "CRITICAL",
      "cited_text": "Economic operators shall ensure the accuracy...",
      "penalty_risk_pct": 4.0,
      "penalty_risk_eur": 2400000,
      "remediation_deadline": "2026-03-15"
    }
  ],
  "total_financial_exposure_eur": 3600000
}
```

## Integration Points
- **Input:** Findings from DeepAuditor via LangGraph state
- **Output:** Violations + penalty calculations → **ActionAgent** via LangGraph state
- **Central Brain:** Claude 3.5 Sonnet for RAG reasoning
- **APIs:** ChromaDB (vector store), Climatiq API (emissions benchmarking)

## Error Handling
- If vector store returns no matches (similarity < 0.6) → flag `REGULATION_GAP` for human review
- Maximum 2 re-evaluation loops before mandatory human escalation
- All penalty calculations logged with formula and source data for audit trail
