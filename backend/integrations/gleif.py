"""
Verity-Nodes: GLEIF API Client (Free — No Key Required)
Verifies Legal Entity Identifiers (LEI) and ownership chains for suppliers.
API Docs: https://www.gleif.org/en/lei-data/gleif-lei-look-up-api
Replaces: OpenCorporates API (previous version)
"""

import httpx
from pydantic import BaseModel, Field
from typing import Optional, List
import logging

logger = logging.getLogger("verity.integrations.gleif")


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class LEIRecord(BaseModel):
    """GLEIF Legal Entity Identifier record."""
    lei: str = Field(..., description="20-character LEI code")
    legal_name: str
    jurisdiction: str = ""
    category: str = ""
    registration_status: str = Field(..., description="ISSUED, LAPSED, RETIRED, etc.")
    registration_authority_id: str = ""
    registration_authority_name: str = ""
    legal_address_city: str = ""
    legal_address_country: str = ""
    headquarters_city: str = ""
    headquarters_country: str = ""
    entity_status: str = Field("ACTIVE", description="ACTIVE, INACTIVE")
    conformity_flag: str = ""
    last_update: str = ""


class OwnershipLink(BaseModel):
    """Parent/child ownership relationship."""
    parent_lei: str
    parent_name: str
    child_lei: str
    child_name: str
    relationship_type: str = Field(..., description="IS_DIRECTLY_CONSOLIDATED_BY, IS_ULTIMATELY_CONSOLIDATED_BY")


class GLEIFVerification(BaseModel):
    """Complete supplier verification result from GLEIF."""
    supplier_id: str
    query: str
    lei_records: List[LEIRecord] = Field(default_factory=list)
    ownership_chain: List[OwnershipLink] = Field(default_factory=list)
    verification_status: str = Field(
        ..., description="VERIFIED, UNVERIFIED, LAPSED, FLAGGED, NO_LEI_FOUND"
    )
    risk_flags: List[str] = Field(default_factory=list)
    total_records_found: int = 0
    api_available: bool = True


class GLEIFClient:
    """
    Client for the GLEIF LEI API (Free, no API key needed).
    Verifies legal entity identifiers and ownership chains
    for supply chain suppliers.
    """

    BASE_URL = "https://api.gleif.org/api/v1"

    def __init__(self):
        self.headers = {
            "Accept": "application/vnd.api+json",
        }

    async def verify_supplier(
        self,
        supplier_id: str,
        company_name: str,
        jurisdiction: str = "",
    ) -> GLEIFVerification:
        """
        Verify a supplier's legal identity via GLEIF LEI registry.

        Args:
            supplier_id: Internal supplier identifier.
            company_name: Legal name of the company.
            jurisdiction: ISO country code (e.g., 'DE' for Germany).

        Returns:
            GLEIFVerification with LEI records and risk assessment.
        """
        params = {
            "filter[entity.legalName]": company_name,
            "page[size]": "5",
        }
        if jurisdiction:
            params["filter[entity.legalAddress.country]"] = jurisdiction.upper()

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/lei-records",
                    params=params,
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()

                records_data = data.get("data", [])
                if not records_data:
                    # Try fuzzy search
                    return await self._fuzzy_search(supplier_id, company_name)

                lei_records = []
                risk_flags = []

                for record in records_data:
                    attrs = record.get("attributes", {})
                    entity = attrs.get("entity", {})
                    reg = attrs.get("registration", {})

                    legal_name_obj = entity.get("legalName", {})
                    legal_name = legal_name_obj.get("name", "") if isinstance(legal_name_obj, dict) else str(legal_name_obj)

                    legal_addr = entity.get("legalAddress", {})
                    hq_addr = entity.get("headquartersAddress", {})

                    lei_record = LEIRecord(
                        lei=record.get("id", attrs.get("lei", "")),
                        legal_name=legal_name,
                        jurisdiction=entity.get("jurisdiction", ""),
                        category=entity.get("category", ""),
                        registration_status=reg.get("status", "UNKNOWN"),
                        registration_authority_id=reg.get("managingLou", ""),
                        registration_authority_name=reg.get("managingLou", ""),
                        legal_address_city=legal_addr.get("city", ""),
                        legal_address_country=legal_addr.get("country", ""),
                        headquarters_city=hq_addr.get("city", ""),
                        headquarters_country=hq_addr.get("country", ""),
                        entity_status=entity.get("status", "ACTIVE"),
                        conformity_flag=reg.get("conformityFlag", ""),
                        last_update=reg.get("lastUpdateDate", ""),
                    )
                    lei_records.append(lei_record)

                    # Risk flag analysis
                    if lei_record.registration_status == "LAPSED":
                        risk_flags.append("LEI_REGISTRATION_LAPSED")
                    if lei_record.entity_status == "INACTIVE":
                        risk_flags.append("ENTITY_INACTIVE")
                    if lei_record.conformity_flag == "NON_CONFORMING":
                        risk_flags.append("NON_CONFORMING_LEI")

                # Determine verification status
                if not lei_records:
                    status = "NO_LEI_FOUND"
                    risk_flags.append("NO_LEI_REGISTRATION")
                elif any(r.registration_status == "LAPSED" for r in lei_records):
                    status = "LAPSED"
                elif any(r.entity_status == "INACTIVE" for r in lei_records):
                    status = "FLAGGED"
                elif risk_flags:
                    status = "FLAGGED"
                else:
                    status = "VERIFIED"

                # Fetch ownership chain for the primary LEI
                ownership = []
                if lei_records:
                    ownership = await self._get_ownership_chain(lei_records[0].lei)

                return GLEIFVerification(
                    supplier_id=supplier_id,
                    query=company_name,
                    lei_records=lei_records,
                    ownership_chain=ownership,
                    verification_status=status,
                    risk_flags=risk_flags,
                    total_records_found=len(records_data),
                )

        except Exception as e:
            logger.warning(f"GLEIF API error ({e}). Returning unverified.")
            return GLEIFVerification(
                supplier_id=supplier_id,
                query=company_name,
                verification_status="UNVERIFIED",
                risk_flags=["API_ERROR"],
                api_available=False,
            )

    async def _fuzzy_search(
        self, supplier_id: str, company_name: str
    ) -> GLEIFVerification:
        """Fuzzy name search using GLEIF's fulltext endpoint."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/lei-records",
                    params={
                        "filter[fulltext]": company_name,
                        "page[size]": "3",
                    },
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()

                if not data.get("data"):
                    return GLEIFVerification(
                        supplier_id=supplier_id,
                        query=company_name,
                        verification_status="NO_LEI_FOUND",
                        risk_flags=["NO_LEI_REGISTRATION", "FUZZY_SEARCH_NO_MATCH"],
                    )

                # Re-process with found data
                record = data["data"][0]
                attrs = record.get("attributes", {})
                entity = attrs.get("entity", {})
                reg = attrs.get("registration", {})
                legal_name_obj = entity.get("legalName", {})
                legal_name = legal_name_obj.get("name", "") if isinstance(legal_name_obj, dict) else str(legal_name_obj)

                lei_record = LEIRecord(
                    lei=record.get("id", ""),
                    legal_name=legal_name,
                    jurisdiction=entity.get("jurisdiction", ""),
                    registration_status=reg.get("status", "UNKNOWN"),
                    entity_status=entity.get("status", "ACTIVE"),
                    legal_address_country=entity.get("legalAddress", {}).get("country", ""),
                    headquarters_country=entity.get("headquartersAddress", {}).get("country", ""),
                    last_update=reg.get("lastUpdateDate", ""),
                )

                return GLEIFVerification(
                    supplier_id=supplier_id,
                    query=company_name,
                    lei_records=[lei_record],
                    verification_status="VERIFIED" if lei_record.entity_status == "ACTIVE" else "FLAGGED",
                    risk_flags=["FUZZY_MATCH_ONLY"],
                    total_records_found=len(data.get("data", [])),
                )

        except Exception as e:
            logger.warning(f"GLEIF fuzzy search failed: {e}")
            return GLEIFVerification(
                supplier_id=supplier_id,
                query=company_name,
                verification_status="UNVERIFIED",
                risk_flags=["API_ERROR"],
                api_available=False,
            )

    async def _get_ownership_chain(self, lei: str) -> List[OwnershipLink]:
        """Fetch the ownership/consolidation chain for a given LEI."""
        ownership = []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Direct parent
                response = await client.get(
                    f"{self.BASE_URL}/lei-records/{lei}/direct-parent",
                    headers=self.headers,
                )
                if response.status_code == 200:
                    data = response.json()
                    parent_data = data.get("data")
                    if parent_data:
                        parent_attrs = parent_data.get("attributes", {})
                        parent_entity = parent_attrs.get("entity", {})
                        parent_name_obj = parent_entity.get("legalName", {})
                        parent_name = parent_name_obj.get("name", "") if isinstance(parent_name_obj, dict) else str(parent_name_obj)
                        ownership.append(OwnershipLink(
                            parent_lei=parent_data.get("id", ""),
                            parent_name=parent_name,
                            child_lei=lei,
                            child_name="",
                            relationship_type="IS_DIRECTLY_CONSOLIDATED_BY",
                        ))
        except Exception as e:
            logger.debug(f"Ownership chain lookup failed for {lei}: {e}")

        return ownership

    async def lookup_by_lei(self, lei: str) -> Optional[LEIRecord]:
        """Direct lookup by LEI code."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/lei-records/{lei}",
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()

                record = data.get("data", {})
                attrs = record.get("attributes", {})
                entity = attrs.get("entity", {})
                reg = attrs.get("registration", {})
                legal_name_obj = entity.get("legalName", {})
                legal_name = legal_name_obj.get("name", "") if isinstance(legal_name_obj, dict) else str(legal_name_obj)

                return LEIRecord(
                    lei=record.get("id", lei),
                    legal_name=legal_name,
                    jurisdiction=entity.get("jurisdiction", ""),
                    registration_status=reg.get("status", ""),
                    entity_status=entity.get("status", ""),
                    legal_address_country=entity.get("legalAddress", {}).get("country", ""),
                    last_update=reg.get("lastUpdateDate", ""),
                )
        except Exception as e:
            logger.warning(f"GLEIF lookup failed for {lei}: {e}")
            return None
