---
name: DeepAuditor Agent
description: Uses Claude 3.5 Vision to scan invoices, bills of lading, and certificates of origin for date/origin/quantity discrepancies. The first line of defense in the Verity-Nodes zero-trust audit pipeline.
---

# DeepAuditor Agent

## Purpose
DeepAuditor is the **perceptual intelligence** layer of Verity-Nodes. It ingests raw supply chain documents — invoices, bills of lading, certificates of origin, sustainability reports — and uses **Claude 3.5 Sonnet Vision** to perform multi-modal analysis, extracting structured data and detecting discrepancies that indicate greenwashing or non-compliance.

## Capabilities

### 1. Vision-Based Document Analysis (Claude 3.5 Sonnet)
- Accept PDF, PNG, JPG, TIFF document uploads
- Use Claude 3.5 Vision to parse tables, stamps, handwriting, and scanned documents
- Extract structured fields: dates, supplier names, quantities, origin countries, port codes, certificate serial numbers
- Detect tampered or inconsistent visual elements (e.g., mismatched fonts, altered stamps)

- **Origin Fraud:** Declared country-of-origin contradicting port-of-loading on bills of lading. *Forensic Rule: Treat "BD" or "Savar" as a match for Bangladesh.*
- **Quantity Drift:** Mismatches across invoice ↔ manifest ↔ customs declaration (tolerance: 0.5%). *Forensic Rule: Apply 1:25 conversion for 'Cartons' to 'PCS' units (e.g. 200 Cartons = 5000 PCS).*
- **Chronological Sequence:** Validate Prod (10 Feb) -> Inv (15 Feb) -> Ship (18 Feb).
- **Matching Priority:** Cross-document matching MUST prioritize `Invoice Number` (INV-2026-X) over system-generated session IDs.
- **Emissions Verification:** Cross-check declared carbon footprint against Climatiq API calculations

### 3. Confidence Scoring
Each finding scores 0.0–1.0 based on:
- Number of corroborating data points
- Severity of the discrepancy (CRITICAL > HIGH > MEDIUM > LOW)
- Historical pattern matches from previous audit cycles

### 4. Output Schema
```json
{
  "batch_id": "BATCH-2026-0402",
  "findings": [
    {
      "type": "SOURCE_MISMATCH",
      "severity": "CRITICAL",
      "confidence": 0.95,
      "description": "Declared origin 'Germany' contradicts bill of lading port 'BDCGP' (Bangladesh)",
      "evidence": { "declared_origin": "Germany", "port_of_loading": "BDCGP" },
      "claude_reasoning": "The bill of lading clearly shows port code BDCGP (Chittagong, Bangladesh)..."
    }
  ],
  "overall_risk_score": 0.87,
  "recommended_action": "ESCALATE_TO_REGULATORY_SHIELD"
}
```

## Integration Points
- **Input:** Document uploads or automated supply chain feeds
- **Output:** Structured findings → **RegulatoryShield** via LangGraph state
- **Central Brain:** Claude 3.5 Sonnet (reasoning + vision)
- **Cross-validation:** Climatiq API for emissions verification

## Error Handling
- If Claude API rate-limited → queue with exponential backoff (max 3 retries)
- If confidence < 0.5 → mark `NEEDS_HUMAN_REVIEW` instead of `NON_COMPLIANT`
- All operations produce immutable, timestamped audit-trail entries
