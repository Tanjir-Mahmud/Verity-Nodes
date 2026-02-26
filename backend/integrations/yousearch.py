"""
Verity-Nodes: You.com Search API Client
Verifies live news regarding supplier environmental violations, port strikes,
and regulatory enforcement actions.
API Docs: https://documentation.you.com/
"""

import httpx
from pydantic import BaseModel, Field
from typing import Optional, List
import os
import logging
from datetime import datetime

logger = logging.getLogger("verity.integrations.yousearch")


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class NewsHit(BaseModel):
    """A single news result from You.com search."""
    title: str
    snippet: str
    url: str
    source: Optional[str] = None
    published_date: Optional[str] = None
    relevance_score: float = Field(0.0, ge=0.0, le=1.0)


class SupplierIntelligence(BaseModel):
    """Aggregated intelligence report for a supplier."""
    supplier_id: str
    query: str
    search_timestamp: str
    news_hits: List[NewsHit] = Field(default_factory=list)
    risk_keywords_found: List[str] = Field(default_factory=list)
    overall_risk: str = Field(
        "LOW", description="LOW, MEDIUM, HIGH, CRITICAL"
    )
    summary: str = ""
    api_available: bool = True


# ---------------------------------------------------------------------------
# Risk Keywords for Environmental Compliance
# ---------------------------------------------------------------------------
RISK_KEYWORDS = [
    "environmental violation",
    "pollution",
    "fine",
    "penalty",
    "greenwashing",
    "deforestation",
    "illegal logging",
    "toxic waste",
    "emissions scandal",
    "port strike",
    "supply chain disruption",
    "regulatory action",
    "sanctions",
    "forced labor",
    "child labor",
    "human rights violation",
    "carbon fraud",
    "certificate revoked",
]


class YouSearchClient:
    """
    Client for the You.com Search API.
    Used as an intelligence tool to verify live news about suppliers,
    environmental violations, port disruptions, and regulatory enforcement.
    """

    BASE_URL = "https://api.ydc-index.io"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("YOU_API_KEY", "")
        self.headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def search_supplier_intelligence(
        self,
        supplier_id: str,
        supplier_name: str,
        additional_context: str = "",
    ) -> SupplierIntelligence:
        """
        Search for live news and intelligence about a specific supplier.

        Args:
            supplier_id: Internal supplier identifier.
            supplier_name: Legal/trade name of the supplier.
            additional_context: Extra context like product type, region, etc.

        Returns:
            SupplierIntelligence with news hits and risk assessment.
        """
        query = f"{supplier_name} environmental compliance sustainability"
        if additional_context:
            query += f" {additional_context}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/search",
                    params={"query": query},
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()

                hits = []
                risk_keywords = []

                for hit in data.get("hits", [])[:10]:
                    snippet = hit.get("description", hit.get("snippet", ""))
                    title = hit.get("title", "")
                    url = hit.get("url", "")

                    # Check for risk keywords
                    combined_text = f"{title} {snippet}".lower()
                    found_keywords = [
                        kw for kw in RISK_KEYWORDS
                        if kw in combined_text
                    ]
                    risk_keywords.extend(found_keywords)

                    # Calculate relevance score
                    relevance = min(len(found_keywords) * 0.2, 1.0) if found_keywords else 0.1

                    hits.append(NewsHit(
                        title=title,
                        snippet=snippet[:500],
                        url=url,
                        source=hit.get("source", ""),
                        published_date=hit.get("published_date"),
                        relevance_score=relevance,
                    ))

                # Deduplicate risk keywords
                unique_risk_keywords = list(set(risk_keywords))

                # Determine overall risk level
                risk_count = len(unique_risk_keywords)
                if risk_count >= 5:
                    overall_risk = "CRITICAL"
                elif risk_count >= 3:
                    overall_risk = "HIGH"
                elif risk_count >= 1:
                    overall_risk = "MEDIUM"
                else:
                    overall_risk = "LOW"

                return SupplierIntelligence(
                    supplier_id=supplier_id,
                    query=query,
                    search_timestamp=datetime.utcnow().isoformat(),
                    news_hits=hits,
                    risk_keywords_found=unique_risk_keywords,
                    overall_risk=overall_risk,
                    summary=self._generate_summary(hits, unique_risk_keywords),
                )

        except Exception as e:
            logger.warning(
                f"You.com Search API unavailable ({e}). Returning empty intelligence."
            )
            return SupplierIntelligence(
                supplier_id=supplier_id,
                query=query,
                search_timestamp=datetime.utcnow().isoformat(),
                overall_risk="UNKNOWN",
                summary="Live intelligence unavailable — API error.",
                api_available=False,
            )

    async def check_port_disruptions(self, port_code: str) -> SupplierIntelligence:
        """
        Check for port strikes or disruptions at a specific port.

        Args:
            port_code: Port code (e.g., 'DEHAM' for Hamburg).

        Returns:
            SupplierIntelligence with disruption-related news.
        """
        return await self.search_supplier_intelligence(
            supplier_id=f"PORT-{port_code}",
            supplier_name=f"port {port_code}",
            additional_context="strike disruption delay closure",
        )

    @staticmethod
    def _generate_summary(hits: List[NewsHit], risk_keywords: List[str]) -> str:
        """Generate a human-readable summary of intelligence findings."""
        if not hits:
            return "No relevant news found for this supplier."

        parts = [f"Found {len(hits)} relevant news items."]
        if risk_keywords:
            parts.append(
                f"Risk indicators detected: {', '.join(risk_keywords[:5])}."
            )
        else:
            parts.append("No immediate risk indicators found in recent news.")

        return " ".join(parts)
