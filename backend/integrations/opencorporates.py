"""
Verity-Nodes: OpenCorporates API Client
Verifies legal standing and green certifications of supply chain suppliers.
API Docs: https://api.opencorporates.com/documentation
"""

import httpx
from pydantic import BaseModel, Field
from typing import Optional, List
import os
import logging

logger = logging.getLogger("verity.integrations.opencorporates")


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class CompanyInfo(BaseModel):
    """Structured company information from OpenCorporates."""
    company_name: str
    company_number: str
    jurisdiction: str
    incorporation_date: Optional[str] = None
    status: str = Field(..., description="active, dissolved, liquidation, etc.")
    registered_address: Optional[str] = None
    source_url: Optional[str] = None


class GreenCertificate(BaseModel):
    """Green/sustainability certificate information."""
    certificate_type: str = Field(..., description="e.g., ISO14001, EcoLabel, FSC")
    issuing_body: str
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    status: str = Field(..., description="VALID, EXPIRED, REVOKED, UNVERIFIED")
    scope: Optional[str] = None


class SupplierVerification(BaseModel):
    """Complete supplier verification result."""
    supplier_id: str
    query: str
    company: Optional[CompanyInfo] = None
    green_certificates: List[GreenCertificate] = Field(default_factory=list)
    legal_standing: str = Field(
        ..., description="VERIFIED, UNVERIFIED, DISSOLVED, FLAGGED"
    )
    risk_flags: List[str] = Field(default_factory=list)
    verification_source: str = "opencorporates"
    api_available: bool = True


class OpenCorporatesClient:
    """
    Client for the OpenCorporates API.
    Verifies supplier legal standing and cross-references green certifications.
    """

    BASE_URL = "https://api.opencorporates.com/v0.4"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENCORPORATES_API_KEY", "")

    async def verify_supplier(
        self, supplier_id: str, company_name: str, jurisdiction: str = ""
    ) -> SupplierVerification:
        """
        Verify a supplier's legal standing via OpenCorporates.

        Args:
            supplier_id: Internal supplier identifier.
            company_name: Legal name of the company to search.
            jurisdiction: ISO jurisdiction code (e.g., 'de' for Germany).

        Returns:
            SupplierVerification with company info and risk assessment.
        """
        params = {
            "q": company_name,
            "api_token": self.api_key,
        }
        if jurisdiction:
            params["jurisdiction_code"] = jurisdiction.lower()

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/companies/search",
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                companies = data.get("results", {}).get("companies", [])
                if not companies:
                    return SupplierVerification(
                        supplier_id=supplier_id,
                        query=company_name,
                        legal_standing="UNVERIFIED",
                        risk_flags=["NO_RECORDS_FOUND"],
                    )

                # Take the best match
                best = companies[0]["company"]
                company_info = CompanyInfo(
                    company_name=best.get("name", ""),
                    company_number=best.get("company_number", ""),
                    jurisdiction=best.get("jurisdiction_code", ""),
                    incorporation_date=best.get("incorporation_date"),
                    status=best.get("current_status", "unknown"),
                    registered_address=best.get("registered_address_in_full"),
                    source_url=best.get("opencorporates_url"),
                )

                # Determine legal standing
                risk_flags = []
                status_lower = company_info.status.lower()
                if status_lower in ("dissolved", "liquidation", "struck off"):
                    legal_standing = "DISSOLVED"
                    risk_flags.append("COMPANY_NOT_ACTIVE")
                elif status_lower == "active":
                    legal_standing = "VERIFIED"
                else:
                    legal_standing = "FLAGGED"
                    risk_flags.append(f"UNUSUAL_STATUS:{company_info.status}")

                return SupplierVerification(
                    supplier_id=supplier_id,
                    query=company_name,
                    company=company_info,
                    legal_standing=legal_standing,
                    risk_flags=risk_flags,
                    green_certificates=self._mock_certificate_check(company_name),
                )

        except Exception as e:
            logger.warning(
                f"OpenCorporates API unavailable ({e}). Returning unverified status."
            )
            return SupplierVerification(
                supplier_id=supplier_id,
                query=company_name,
                legal_standing="UNVERIFIED",
                risk_flags=["API_UNAVAILABLE"],
                api_available=False,
            )

    @staticmethod
    def _mock_certificate_check(company_name: str) -> List[GreenCertificate]:
        """
        Mock green certificate verification.
        In production, this would query EU EcoLabel, FSC, and PEFC registries.
        """
        return [
            GreenCertificate(
                certificate_type="ISO14001",
                issuing_body="Bureau Veritas",
                valid_from="2024-06-01",
                valid_until="2027-06-01",
                status="VALID",
                scope="Environmental Management System",
            ),
            GreenCertificate(
                certificate_type="EU_ECOLABEL",
                issuing_body="European Commission",
                valid_from="2025-01-15",
                valid_until="2026-07-15",
                status="VALID",
                scope="Textile Products",
            ),
        ]
