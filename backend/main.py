"""
Verity-Nodes: FastAPI Main Application (v2)
Serves the DeepAuditor → RegulatoryShield → ActionAgent pipeline.
REST + WebSocket endpoints with live agent feed streaming.
"""

from __future__ import annotations
import json
import logging
import sys
import os
import base64
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.graph import build_audit_graph, get_initial_state
from integrations.claude_brain import ClaudeClient
from integrations.climatiq import ClimatiqClient, FreightEstimateRequest
from integrations.gleif import GLEIFClient
from integrations.yousearch import YouSearchClient

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("verity.main")

# ---------------------------------------------------------------------------
# App Setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Verity-Nodes API",
    description="Autonomous Multi-Agent Audit Network — DeepAuditor + RegulatoryShield + ActionAgent",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build graph at startup
audit_graph = build_audit_graph()
active_connections: list[WebSocket] = []


# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class AuditRequest(BaseModel):
    batch_id: str = Field(default="BATCH-2026-0402")
    supplier_id: str = Field(default="SUP-4821")
    supplier_name: str = Field(default="GreenTextile GmbH")
    documents: Optional[list[str]] = None
    extracted_data: Optional[list[dict]] = None
    max_loops: int = Field(default=3, ge=1, le=10)


class EmissionsRequest(BaseModel):
    origin: str = Field(..., description="Origin location")
    destination: str = Field(..., description="Destination location")
    weight_kg: float = Field(..., gt=0)
    transport_mode: str = Field(default="sea")


class GLEIFRequest(BaseModel):
    supplier_id: str
    company_name: str
    jurisdiction: str = ""


class ExtractionResult(BaseModel):
    """Result from Claude Vision document extraction."""
    vendor_name: str = ""
    manufacturing_date: str = ""
    invoice_date: str = ""
    country_of_origin: str = ""
    declared_origin: str = ""
    port_of_loading: str = ""
    port_of_discharge: str = ""
    quantity: Optional[float] = None
    unit: str = ""
    weight_kg: Optional[float] = None
    certificate_numbers: list[str] = []
    certificate_type: str = ""
    certificate_expiry: str = ""
    total_value: Optional[float] = None
    currency: str = ""
    vessel_name: str = ""
    raw_extraction: dict = {}
    confidence: float = 0.0
    document_type: str = ""
    file_name: str = ""


class IntelligenceRequest(BaseModel):
    supplier_id: str
    supplier_name: str
    additional_context: str = ""


# ---------------------------------------------------------------------------
# WebSocket Manager
# ---------------------------------------------------------------------------

async def broadcast_log(log_entry: dict):
    """Broadcast agent log entry to all WebSocket clients."""
    message = json.dumps(log_entry)
    disconnected = []
    for ws in active_connections:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        active_connections.remove(ws)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "operational",
        "service": "verity-nodes",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "agents": ["DeepAuditor", "RegulatoryShield", "ActionAgent"],
        "integrations": ["Claude 3.5 Sonnet", "Climatiq", "GLEIF", "You.com Search"],
        "central_brain": "Claude 3.5 Sonnet",
    }


@app.post("/api/audit/start")
async def start_audit(request: AuditRequest):
    """
    Start full autonomous audit: DeepAuditor → RegulatoryShield → ActionAgent.
    Returns complete audit result with agent logs for the Live Feed.
    """
    logger.info(f"Starting audit for batch {request.batch_id}")

    initial_state = get_initial_state(
        batch_id=request.batch_id,
        supplier_id=request.supplier_id,
        supplier_name=request.supplier_name,
        documents=request.documents,
        extracted_data=request.extracted_data,
        max_loops=request.max_loops,
    )

    result = await audit_graph.ainvoke(initial_state)

    # Broadcast logs to WebSocket clients
    for log_entry in result.get("agent_log", []):
        await broadcast_log(log_entry)

    return {
        "audit_id": result.get("audit_id"),
        "batch_id": result.get("batch_id"),
        "supplier_id": result.get("supplier_id"),
        "supplier_name": result.get("supplier_name"),
        "compliance_status": result.get("compliance_status"),
        "overall_risk_score": result.get("overall_risk_score"),
        "findings_count": len(result.get("findings", [])),
        "violations_count": len(result.get("violations", [])),
        "total_financial_exposure_eur": result.get("total_financial_exposure_eur", 0),
        "findings": result.get("findings", []),
        "violations": result.get("violations", []),
        "corrective_actions": result.get("corrective_actions", []),
        "supplier_email": result.get("supplier_email"),
        "resolution_status": result.get("resolution_status"),
        "loop_count": result.get("loop_count"),
        "loop_decision": result.get("loop_decision"),
        "emissions_data": result.get("emissions_data"),
        "gleif_verification": result.get("gleif_verification"),
        "live_intelligence": result.get("live_intelligence"),
        "agent_log": result.get("agent_log", []),
        "claude_tokens": {
            "input": result.get("total_input_tokens", 0),
            "output": result.get("total_output_tokens", 0),
        },
    }


@app.get("/api/audit/demo")
async def demo_audit():
    """Run a demo audit with default parameters."""
    request = AuditRequest()
    return await start_audit(request)


@app.post("/api/audit/extract")
async def extract_document(
    file: UploadFile = File(...),
    document_type: str = Form(default="auto"),
):
    """
    Extract structured data from an uploaded document using Claude 3.5 Sonnet Vision.

    Sends the file to Claude with a forensic auditor system prompt to extract:
    - Vendor Name, Manufacturing Date, Country of Origin
    - Sustainability Certificate numbers
    - Quantities, weights, port codes, vessel names
    """
    logger.info(f"Extracting document: {file.filename} (type: {file.content_type})")

    # Read and encode the file
    file_bytes = await file.read()
    file_b64 = base64.standard_b64encode(file_bytes).decode("utf-8")

    # Determine media type for Claude Vision
    content_type = file.content_type or "application/octet-stream"
    if content_type == "application/pdf":
        media_type = "application/pdf"
    elif content_type in ("image/png", "image/jpeg", "image/jpg"):
        media_type = content_type
    else:
        media_type = "application/pdf"

    claude = ClaudeClient()

    # Build the Claude Vision request with the forensic auditor prompt
    system_prompt = """Act as a Forensic Supply Chain Auditor specializing in the EU Green Claims Directive.
Analyze the provided document(s) with zero-trust rigor for the Verity-Nodes Agent Network.

━━━ PHASE 1: DATA EXTRACTION ━━━
Extract the following fields from every document:
  • Vendor Name / Supplier Legal Entity
  • Batch ID or Reference Number
  • Country of Origin (as declared on the document)
  • Factory Address (full address if visible)
  • Invoice Date, Manufacturing Date, Shipping Date
  • Quantity and Unit of Measure
  • Weight (kg)
  • Port of Loading (UN/LOCODE)
  • Port of Discharge (UN/LOCODE)
  • Vessel Name
  • Total Value and Currency

━━━ PHASE 2: INTEGRITY CHECK (Red Flags) ━━━
Perform these forensic checks and flag ALL anomalies:
  • DATE ANOMALIES: Manufacturing date AFTER shipping date, invoice date BEFORE manufacturing date, or any chronological impossibility.
  • QUANTITY DRIFTS: Invoice quantity differs from packing list or bill of lading quantity by more than 0.5%.
  • VALUE INCONSISTENCIES: Unit price vs total value arithmetic errors, or values that don't match market rates.

━━━ PHASE 3: ORIGIN FRAUD CHECK ━━━
Cross-reference across document types:
  • Compare the "Declared Origin" on the invoice with the "Loading Port" on the Bill of Lading.
  • Flag if the Loading Port country does NOT match the Declared Origin country.
  • Check shipper entity name against the supplier entity name for discrepancies.

━━━ PHASE 4: CERTIFICATE VALIDATION ━━━
Identify and validate sustainability certificates:
  • Oeko-Tex Standard 100 / MADE IN GREEN
  • GOTS (Global Organic Textile Standard)
  • EU Ecolabel
  • FSC (Forest Stewardship Council)
  • ISO 14001 / ISO 14064
  • Any other environmental or social compliance certificates
  • Flag certificates that appear expired, have mismatched scope, or reference different entities.

━━━ OUTPUT FORMAT ━━━
RESPOND IN VALID JSON ONLY with this exact schema:
{
  "vendor_name": "string",
  "batch_id": "string or empty",
  "factory_address": "string or empty",
  "manufacturing_date": "YYYY-MM-DD or empty",
  "invoice_date": "YYYY-MM-DD or empty",
  "shipping_date": "YYYY-MM-DD or empty",
  "country_of_origin": "string",
  "declared_origin": "string (the origin claimed on the document)",
  "port_of_loading": "string (UN/LOCODE if visible)",
  "port_of_discharge": "string (UN/LOCODE if visible)",
  "quantity": number or null,
  "unit": "string (meters, kg, pieces, etc)",
  "weight_kg": number or null,
  "certificate_numbers": ["string"],
  "certificate_type": "string (OEKO_TEX, GOTS, EU_ECOLABEL, FSC, ISO_14001, etc)",
  "certificate_expiry": "YYYY-MM-DD or empty",
  "total_value": number or null,
  "currency": "string (EUR, USD, etc)",
  "vessel_name": "string or empty",
  "document_type": "invoice | bill_of_lading | certificate | manifest | packing_list | unknown",
  "confidence": 0.0-1.0,
  "red_flags": [
    {
      "type": "DATE_ANOMALY | QUANTITY_DRIFT | ORIGIN_FRAUD | CERTIFICATE_ISSUE | VALUE_INCONSISTENCY",
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "description": "string",
      "evidence": {}
    }
  ]
}

Output ALL findings. If no red flags are found, return an empty "red_flags" array. Be exhaustive."""

    text = ""
    try:
        # Use Claude's multimodal API
        import httpx
        payload = {
            "model": claude.model,
            "max_tokens": 2048,
            "temperature": 0.1,
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image" if media_type.startswith("image") else "document",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": file_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": f"Extract the Vendor Name, Manufacturing Date, Country of Origin, and Sustainability Certificate numbers from this {document_type} document. Analyze every detail forensically.",
                        },
                    ],
                }
            ],
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            headers = claude.headers.copy()
            if media_type == "application/pdf":
                headers["anthropic-beta"] = "pdfs-2024-09-25"
                
            response = await client.post(
                f"{claude.BASE_URL}/messages",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        # Extract text response
        content_blocks = data.get("content", [])
        text = ""
        for block in content_blocks:
            if block.get("type") == "text":
                text += block.get("text", "")

        # Parse JSON from response
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        extracted = json.loads(text)
        extracted["file_name"] = file.filename or "unknown"

        input_tokens = data.get("usage", {}).get("input_tokens", 0)
        output_tokens = data.get("usage", {}).get("output_tokens", 0)

        logger.info(f"Extraction complete: {file.filename} ({input_tokens}+{output_tokens} tokens)")

        return {
            "status": "success",
            "extraction": extracted,
            "tokens": {"input": input_tokens, "output": output_tokens},
            "file_name": file.filename,
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude extraction response: {e}")
        return {
            "status": "error",
            "error": f"Extraction parsing failed: {str(e)}",
            "raw_response": text[:500] if text else "",
            "file_name": file.filename,
        }
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "file_name": file.filename,
        }


@app.post("/api/emissions/calculate")
async def calculate_emissions(request: EmissionsRequest):
    """Calculate GLEC-compliant emissions via Climatiq."""
    client = ClimatiqClient()
    req = FreightEstimateRequest(
        origin=request.origin,
        destination=request.destination,
        weight_kg=request.weight_kg,
        transport_mode=request.transport_mode,
    )
    result = await client.estimate_freight_emissions(req)
    return result.model_dump()


@app.post("/api/supplier/verify-gleif")
async def verify_gleif(request: GLEIFRequest):
    """Verify supplier legal identity via GLEIF LEI registry."""
    client = GLEIFClient()
    result = await client.verify_supplier(
        supplier_id=request.supplier_id,
        company_name=request.company_name,
        jurisdiction=request.jurisdiction,
    )
    return result.model_dump()


@app.post("/api/intelligence/search")
async def search_intelligence(request: IntelligenceRequest):
    """Search for live intelligence about a supplier via You.com."""
    client = YouSearchClient()
    result = await client.search_supplier_intelligence(
        supplier_id=request.supplier_id,
        supplier_name=request.supplier_name,
        additional_context=request.additional_context,
    )
    return result.model_dump()


@app.websocket("/ws/agent-feed")
async def agent_feed_websocket(websocket: WebSocket):
    """WebSocket for real-time Live Agent Orchestration Feed."""
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"WebSocket client connected ({len(active_connections)} total)")

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected ({len(active_connections)} remaining)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
