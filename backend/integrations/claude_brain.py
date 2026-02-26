"""
Verity-Nodes: Claude 3.5 Sonnet — Central Brain
Powers all agent reasoning, document vision analysis, and RAG synthesis.
API Docs: https://docs.anthropic.com/en/docs/
"""

import httpx
from pydantic import BaseModel, Field
from typing import Optional, List
import os
import json
import logging

logger = logging.getLogger("verity.integrations.claude")


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class ClaudeMessage(BaseModel):
    """A single message in a Claude conversation."""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class ClaudeResponse(BaseModel):
    """Structured response from Claude API."""
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    stop_reason: str


class DocumentAnalysis(BaseModel):
    """Structured document analysis from Claude Vision."""
    document_type: str
    extracted_fields: dict
    discrepancies: List[dict] = Field(default_factory=list)
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    reasoning: str = ""


class ClaudeClient:
    """
    Client for Anthropic Claude 3.5 Sonnet API.
    Serves as the Central Brain for all Verity-Nodes agent reasoning.
    """

    BASE_URL = "https://api.anthropic.com/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.model = "claude-sonnet-4-20250514"
        self.headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    async def reason(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> ClaudeResponse:
        """
        Send a reasoning request to Claude 3.5 Sonnet.

        Args:
            system_prompt: System instructions for the agent role.
            user_message: The user/agent query or analysis request.
            max_tokens: Maximum response length.
            temperature: Creativity level (0.0 = deterministic, 1.0 = creative).

        Returns:
            ClaudeResponse with content and token usage.
        """
        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_message}
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/messages",
                    headers=self.headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

                content_blocks = data.get("content", [])
                text = ""
                for block in content_blocks:
                    if block.get("type") == "text":
                        text += block.get("text", "")

                return ClaudeResponse(
                    content=text,
                    model=data.get("model", self.model),
                    input_tokens=data.get("usage", {}).get("input_tokens", 0),
                    output_tokens=data.get("usage", {}).get("output_tokens", 0),
                    stop_reason=data.get("stop_reason", ""),
                )

        except httpx.HTTPStatusError as e:
            logger.error(f"Claude API HTTP error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise

    async def analyze_document(
        self,
        document_text: str,
        document_type: str = "invoice",
    ) -> DocumentAnalysis:
        """
        Analyze a supply chain document using Claude's reasoning.

        Args:
            document_text: Extracted or OCR'd text from the document.
            document_type: Type hint (invoice, certificate, manifest, etc.)

        Returns:
            DocumentAnalysis with extracted fields and detected discrepancies.
        """
        system_prompt = """You are DeepAuditor, an expert supply chain document analyst for the 
Verity-Nodes autonomous audit system. You specialize in detecting greenwashing 
and non-compliance with the 2026 EU Green Claims Directive.

Your task: Analyze the provided document and extract all relevant fields. 
Identify any discrepancies, anomalies, or red flags.

RESPOND IN VALID JSON ONLY with this schema:
{
  "document_type": "string",
  "extracted_fields": { ... all key-value pairs from the document ... },
  "discrepancies": [
    {
      "type": "DATE_ANOMALY|SOURCE_MISMATCH|QUANTITY_DRIFT|CERTIFICATE_EXPIRED|EMISSIONS_EXCESS",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "description": "string",
      "evidence": { ... }
    }
  ],
  "confidence": 0.0-1.0,
  "reasoning": "Your chain-of-thought analysis"
}"""

        user_message = f"Document Type: {document_type}\n\n--- DOCUMENT CONTENT ---\n{document_text}"

        try:
            response = await self.reason(system_prompt, user_message)
            # Parse JSON from Claude's response
            content = response.content.strip()
            # Handle markdown code blocks
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            parsed = json.loads(content)
            return DocumentAnalysis(**parsed)

        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Failed to parse Claude analysis: {e}")
            return DocumentAnalysis(
                document_type=document_type,
                extracted_fields={},
                confidence=0.0,
                reasoning=f"Analysis failed: {str(e)}",
            )

    async def evaluate_compliance(
        self,
        finding: dict,
        regulation_text: str,
    ) -> dict:
        """
        Use Claude to evaluate whether a finding violates a specific regulation.

        Args:
            finding: Structured finding from DeepAuditor.
            regulation_text: Relevant EU regulation article text.

        Returns:
            Dict with violation assessment, penalty risk, and reasoning.
        """
        system_prompt = """You are RegulatoryShield, a legal compliance expert specializing in 
EU ESPR 2024/0455 and the Green Claims Directive 2023/0085. 

Evaluate whether the provided audit finding constitutes a violation of the 
cited regulation. Calculate the penalty risk as a percentage of annual EU 
turnover (max 4% for CRITICAL violations per Article 68).

RESPOND IN VALID JSON ONLY:
{
  "is_violation": true/false,
  "violation_type": "CRITICAL|MAJOR|MINOR|OBSERVATION",
  "penalty_risk_pct": 0.0-4.0,
  "cited_article": "string",
  "legal_reasoning": "string",
  "remediation_steps": ["step1", "step2"]
}"""

        user_message = f"""AUDIT FINDING:
{json.dumps(finding, indent=2)}

REGULATION TEXT:
{regulation_text}"""

        try:
            response = await self.reason(system_prompt, user_message)
            content = response.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(content)
        except Exception as e:
            logger.warning(f"Compliance evaluation failed: {e}")
            return {
                "is_violation": True,
                "violation_type": "MAJOR",
                "penalty_risk_pct": 2.5,
                "cited_article": "Unable to determine",
                "legal_reasoning": f"Evaluation failed: {str(e)}",
                "remediation_steps": ["Manual review required"],
            }

    async def draft_supplier_email(
        self,
        supplier_name: str,
        batch_id: str,
        violations: list,
        corrective_actions: list,
    ) -> str:
        """
        Use Claude to draft a professional, regulation-cited supplier email.

        Args:
            supplier_name: Legal name of the supplier.
            batch_id: Audit batch identifier.
            violations: List of confirmed violations.
            corrective_actions: List of required corrective actions.

        Returns:
            Formatted email body string.
        """
        system_prompt = """You are ActionAgent's email drafting module. Write a formal, 
professional supplier non-compliance notification email that:
1. Cites specific EU ESPR 2024/0455 articles
2. Lists each violation with evidence
3. Specifies corrective actions with deadlines
4. Warns of penalty risks (up to 4% of annual EU turnover)
5. Requests acknowledgment within 72 hours
6. Maintains firm but professional tone

Do NOT use markdown. Write plain text email format."""

        user_message = f"""Supplier: {supplier_name}
Batch: {batch_id}
Violations: {json.dumps(violations, indent=2)}
Corrective Actions: {json.dumps(corrective_actions, indent=2)}"""

        response = await self.reason(system_prompt, user_message, temperature=0.3)
        return response.content
