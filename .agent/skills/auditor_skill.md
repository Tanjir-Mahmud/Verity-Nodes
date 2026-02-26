---
name: Auditor Agent Skill
description: Scans invoices, shipping manifests, and PDFs using Vision APIs to detect date, source, and quantity discrepancies in supply chain documentation.
---

# Auditor Agent Skill

## Purpose
The Auditor Agent is the **first line of defense** in the Verity-Nodes audit pipeline. It ingests raw supply chain documents (invoices, certificates of origin, shipping manifests, sustainability reports) and performs multi-modal analysis to detect discrepancies that indicate potential greenwashing or non-compliance.

## Capabilities

### 1. Document Ingestion & OCR
- Accept PDF, PNG, JPG, and TIFF document uploads
- Extract structured text using Vision API (Google Cloud Vision / Azure Document Intelligence)
- Parse tables, line items, dates, supplier names, and quantities into structured Pydantic models

### 2. Discrepancy Detection
- **Date Anomalies:** Flag documents where invoice dates precede manufacturing dates, or certificates expire before shipment dates
- **Source Mismatch:** Cross-reference claimed origin country against port-of-loading and logistics data
- **Quantity Drift:** Compare declared quantities across invoice ↔ manifest ↔ customs declaration
- **Duplicate Detection:** Identify recycled certificate numbers or duplicate invoice references across batches

### 3. Confidence Scoring
- Each finding receives a confidence score (0.0–1.0) based on:
  - Number of corroborating data points
  - Severity of the discrepancy
  - Historical pattern matches from previous audits

### 4. Output Format
```json
{
  "batch_id": "BATCH-2026-0102",
  "document_type": "invoice",
  "supplier_id": "SUP-4821",
  "findings": [
    {
      "type": "DATE_ANOMALY",
      "severity": "HIGH",
      "confidence": 0.92,
      "description": "Invoice date (2026-01-15) precedes manufacturing date (2026-01-20)",
      "evidence": {
        "invoice_date": "2026-01-15",
        "manufacturing_date": "2026-01-20",
        "source_document": "INV-2026-4821-003.pdf"
      }
    }
  ],
  "overall_risk_score": 0.87,
  "recommended_action": "ESCALATE_TO_REGULATORY"
}
```

## Integration Points
- **Input:** Raw documents from the upload endpoint or automated supply chain feeds
- **Output:** Structured findings passed to the **Regulatory Agent** via LangGraph state
- **APIs Used:** Google Cloud Vision API, Carbon Interface API (for emissions verification)

## Error Handling
- If Vision API is unavailable, queue documents for retry with exponential backoff (max 3 attempts)
- If confidence score < 0.5, flag finding as `NEEDS_REVIEW` instead of `NON_COMPLIANT`
- Log all processing errors with document ID and timestamp for audit trail
