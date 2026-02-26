---
name: ActionAgent
description: Verifies supplier identity via the GLEIF LEI registry, searches for live environmental scandals via You.com API, drafts corrective action plans, and generates auto-healing supplier notification emails.
---

# ActionAgent

## Purpose
ActionAgent is the **investigation + resolution engine** of Verity-Nodes. It takes confirmed violations from RegulatoryShield and:
1. **Investigates** the supplier via GLEIF (legal identity) and You.com (live scandals)
2. **Drafts** corrective action plans with deadlines
3. **Self-heals** the supply chain by generating automated compliance emails to suppliers

## Capabilities

### 1. GLEIF LEI Verification (Free API)
- Query `https://api.gleif.org/api/v1/lei-records` by supplier name
- Verify Legal Entity Identifier (LEI), registration status, and ownership chain
- Detect dissolved/inactive companies, shell company structures
- Cross-reference registered jurisdiction against claimed origin

### 2. You.com Live Intelligence Search
- Search for real-time news about suppliers: environmental violations, greenwashing accusations, port strikes, regulatory enforcement actions
- Risk keyword detection: "pollution", "fine", "penalty", "greenwashing", "scandal", "deforestation"
- Aggregate findings into severity score: LOW / MEDIUM / HIGH / CRITICAL

### 3. Self-Healing Corrective Actions
For each violation, generate:
- Root cause analysis
- Specific remediation steps with ISO-standard deadlines
- Required re-certification documentation
- Estimated cost impact and timeline
- Auto-drafted supplier email (PENDING_HUMAN_APPROVAL)

### 4. Automated Supplier Email Draft
```
Subject: URGENT: Non-Compliance Notice — Batch #{batch_id}
To: compliance@{supplier_domain}

Dear {supplier_name} Compliance Team,

This notice is issued pursuant to EU ESPR 2024/0455...

VIOLATIONS FOUND: [list]
REQUIRED ACTIONS: [list with deadlines]
PENALTY RISK: Up to 4% of annual EU turnover

Please acknowledge within 72 hours.

— Verity-Nodes Autonomous Audit System
```

### 5. Loop Decision Engine
- `RESOLVED` → All violations have corrective actions, no critical items
- `RE_AUDIT` → Non-critical violations, corrective docs submitted → loop back to DeepAuditor
- `ESCALATE_TO_HUMAN` → Critical violations, supplier non-responsive, or max loops (3) reached

### 6. Output Schema
```json
{
  "resolution_status": "ESCALATED",
  "gleif_verification": {
    "lei": "5493001KJTIIGC8Y1R12",
    "legal_name": "GreenTextile GmbH",
    "status": "ACTIVE",
    "jurisdiction": "DE",
    "registration_authority": "Bundesanzeiger Verlag"
  },
  "live_intelligence": {
    "risk_level": "HIGH",
    "scandals_found": 2,
    "keywords": ["greenwashing", "fine"]
  },
  "corrective_actions": [...],
  "supplier_email": { "status": "PENDING_HUMAN_APPROVAL", ... },
  "loop_decision": "ESCALATE_TO_HUMAN"
}
```

## Integration Points
- **Input:** Violations + penalties from RegulatoryShield via LangGraph state
- **Output:** Resolution status fed back into LangGraph for loop decision
- **APIs:** GLEIF (free, no key), You.com Search API, Climatiq (re-calculate after corrections)
- **Central Brain:** Claude 3.5 Sonnet for email drafting and investigation reasoning
