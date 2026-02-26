"""
Verity-Nodes: Climatiq API Client
Generates GLEC-compliant carbon footprint scores for supply chain logistics.
API Docs: https://www.climatiq.io/docs
Replaces: Carbon Interface API (previous version)
"""

import httpx
from pydantic import BaseModel, Field
from typing import Optional, List
import os
import logging

logger = logging.getLogger("verity.integrations.climatiq")


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class FreightEstimateRequest(BaseModel):
    """Request for GLEC-compliant freight emissions estimate."""
    origin: str = Field(..., description="Origin location (e.g., 'Chittagong, Bangladesh')")
    destination: str = Field(..., description="Destination location (e.g., 'Hamburg, Germany')")
    weight_kg: float = Field(..., gt=0, description="Cargo weight in kilograms")
    transport_mode: str = Field(
        "sea", description="Transport mode: 'sea', 'road', 'rail', 'air'"
    )
    distance_km: Optional[float] = Field(default=None, gt=0, description="Distance in km")


class EmissionEstimate(BaseModel):
    """GLEC-compliant emission estimate result."""
    co2e_kg: float = Field(..., description="CO2 equivalent in kilograms")
    co2e_tonnes: float = Field(..., description="CO2 equivalent in metric tonnes")
    emission_factor_id: str = ""
    emission_factor_source: str = ""
    activity_id: str = ""
    transport_mode: str = ""
    origin: str = ""
    destination: str = ""
    glec_compliant: bool = True
    api_source: str = "climatiq"
    estimated: bool = Field(default=False, description="True if using fallback estimation")


# ---------------------------------------------------------------------------
# GLEC Framework v3.0 Fallback Emission Factors (kg CO2e per tonne-km)
# ---------------------------------------------------------------------------
GLEC_EMISSION_FACTORS = {
    "sea": 0.016,        # Container ship (average)
    "road": 0.062,       # Heavy truck (average)
    "rail": 0.022,       # Freight rail (average)
    "air": 0.602,        # Air freight (average)
    "barge": 0.031,      # Inland waterway
}

# Transport mode → Climatiq activity IDs
CLIMATIQ_ACTIVITY_MAP = {
    "sea": "freight_vessel-vessel_type_container_ship-route_type_na-size_na",
    "road": "freight_vehicle-vehicle_type_hgv-fuel_source_diesel-vehicle_weight_gt_33t-percentage_load_na",
    "rail": "freight_train-route_type_domestic-fuel_source_na",
    "air": "freight_flight-route_type_na-distance_na-weight_na-rf_included",
}

# Fallback distances for common trade routes
ROUTE_DISTANCES_KM = {
    ("BDCGP", "DEHAM"): 14500,   # Chittagong → Hamburg
    ("CNSHA", "DEHAM"): 19500,   # Shanghai → Hamburg
    ("CNSHA", "NLRTM"): 19200,   # Shanghai → Rotterdam
    ("INVTZ", "DEHAM"): 11200,   # Visakhapatnam → Hamburg
    ("BDCGP", "NLRTM"): 14800,  # Chittagong → Rotterdam
}


class ClimatiqClient:
    """
    Client for the Climatiq API.
    Generates GLEC-compliant carbon footprint scores for logistics legs.
    Falls back to GLEC Framework v3.0 emission factors if API is unavailable.
    """

    BASE_URL = "https://api.climatiq.io/data/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("CLIMATIQ_API_KEY", "")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def estimate_freight_emissions(
        self, request: FreightEstimateRequest
    ) -> EmissionEstimate:
        """
        Calculate GLEC-compliant CO2e emissions for a freight shipment.

        Args:
            request: FreightEstimateRequest with origin, destination, weight, and mode.

        Returns:
            EmissionEstimate with CO2e values and GLEC compliance flag.
        """
        activity_id = CLIMATIQ_ACTIVITY_MAP.get(
            request.transport_mode,
            CLIMATIQ_ACTIVITY_MAP["sea"],
        )

        distance = request.distance_km or self._get_route_distance(
            request.origin, request.destination, request.transport_mode
        )

        # Climatiq /estimate payload
        payload = {
            "emission_factor": {
                "activity_id": activity_id,
                "data_version": "^6",
            },
            "parameters": {
                "weight": request.weight_kg / 1000,  # Convert to tonnes
                "weight_unit": "t",
                "distance": distance,
                "distance_unit": "km",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/estimate",
                    headers=self.headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

                co2e_kg = data.get("co2e", 0)
                return EmissionEstimate(
                    co2e_kg=round(co2e_kg, 2),
                    co2e_tonnes=round(co2e_kg / 1000, 4),
                    emission_factor_id=data.get("emission_factor", {}).get("id", ""),
                    emission_factor_source=data.get("emission_factor", {}).get("source", "Climatiq"),
                    activity_id=activity_id,
                    transport_mode=request.transport_mode,
                    origin=request.origin,
                    destination=request.destination,
                    glec_compliant=True,
                )

        except Exception as e:
            logger.warning(f"Climatiq API unavailable ({e}). Using GLEC fallback.")
            return self._glec_fallback(request, distance)

    def _glec_fallback(
        self, request: FreightEstimateRequest, distance_km: float
    ) -> EmissionEstimate:
        """
        Fallback calculation using GLEC Framework v3.0 emission factors.
        """
        factor = GLEC_EMISSION_FACTORS.get(request.transport_mode, 0.062)
        weight_tonnes = request.weight_kg / 1000
        co2e_kg = weight_tonnes * distance_km * factor

        return EmissionEstimate(
            co2e_kg=round(co2e_kg, 2),
            co2e_tonnes=round(co2e_kg / 1000, 4),
            emission_factor_id="glec-v3-fallback",
            emission_factor_source="GLEC Framework v3.0",
            activity_id="fallback",
            transport_mode=request.transport_mode,
            origin=request.origin,
            destination=request.destination,
            glec_compliant=True,
            estimated=True,
        )

    @staticmethod
    def _get_route_distance(origin: str, destination: str, mode: str) -> float:
        """Look up or estimate route distance."""
        key = (origin.upper(), destination.upper())
        if key in ROUTE_DISTANCES_KM:
            return ROUTE_DISTANCES_KM[key]

        # Default distances by mode
        defaults = {"sea": 12000, "road": 500, "rail": 1200, "air": 5000}
        return defaults.get(mode, 5000)

    async def batch_estimate(
        self, legs: List[FreightEstimateRequest]
    ) -> List[EmissionEstimate]:
        """Calculate emissions for multiple logistics legs."""
        results = []
        for leg in legs:
            result = await self.estimate_freight_emissions(leg)
            results.append(result)
        return results
