"""
Verity-Nodes: Carbon Interface API Client
Calculates real-time Scope 3 emissions for supply chain logistics legs.
API Docs: https://docs.carboninterface.com/
"""

import httpx
from pydantic import BaseModel, Field
from typing import Optional
import os
import logging

logger = logging.getLogger("verity.integrations.carbon")

# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class ShippingLeg(BaseModel):
    """Represents a single logistics leg for emissions calculation."""
    origin: str = Field(..., description="Origin port/city code (e.g., 'CNSHA')")
    destination: str = Field(..., description="Destination port/city code (e.g., 'DEHAM')")
    weight_kg: float = Field(..., gt=0, description="Cargo weight in kilograms")
    transport_method: str = Field(
        ..., 
        description="Transport mode: 'ship', 'truck', 'rail', 'plane'"
    )
    distance_km: Optional[float] = Field(
        default=None, gt=0, description="Distance in km (auto-calculated if omitted)"
    )


class EmissionsResult(BaseModel):
    """Structured result from Carbon Interface API."""
    leg_id: str
    carbon_kg: float = Field(..., description="CO2 equivalent in kilograms")
    carbon_mt: float = Field(..., description="CO2 equivalent in metric tons")
    transport_method: str
    origin: str
    destination: str
    api_source: str = "carbon_interface"
    estimated: bool = Field(
        default=False, description="True if using fallback estimation instead of API"
    )


# ---------------------------------------------------------------------------
# Fallback Emission Factors (kg CO2 per ton-km)
# Used when the API is unavailable
# ---------------------------------------------------------------------------
EMISSION_FACTORS = {
    "ship": 0.016,
    "truck": 0.062,
    "rail": 0.022,
    "plane": 0.602,
}


class CarbonInterfaceClient:
    """
    Client for the Carbon Interface API.
    Calculates Scope 3 emissions for each logistics leg in a supply chain.
    Falls back to industry-standard emission factors if the API is unavailable.
    """

    BASE_URL = "https://www.carboninterface.com/api/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("CARBON_INTERFACE_API_KEY", "")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def calculate_emissions(self, leg: ShippingLeg) -> EmissionsResult:
        """
        Calculate CO2 emissions for a single shipping leg.

        Args:
            leg: A ShippingLeg with origin, destination, weight, and transport method.

        Returns:
            EmissionsResult with calculated carbon footprint.

        Raises:
            httpx.HTTPStatusError: If the API returns a non-2xx status (caught internally).
        """
        # Map our transport methods to Carbon Interface types
        transport_map = {
            "ship": "shipping",
            "truck": "shipping",
            "rail": "shipping",
            "plane": "flight",
        }

        payload = {
            "type": transport_map.get(leg.transport_method, "shipping"),
            "weight_unit": "kg",
            "weight_value": leg.weight_kg,
            "distance_unit": "km",
            "distance_value": leg.distance_km or self._estimate_distance(leg),
            "transport_method": leg.transport_method,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/estimates",
                    headers=self.headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

                carbon_kg = data["data"]["attributes"]["carbon_kg"]
                return EmissionsResult(
                    leg_id=f"{leg.origin}-{leg.destination}",
                    carbon_kg=carbon_kg,
                    carbon_mt=carbon_kg / 1000,
                    transport_method=leg.transport_method,
                    origin=leg.origin,
                    destination=leg.destination,
                )

        except Exception as e:
            logger.warning(
                f"Carbon Interface API unavailable ({e}). Using fallback estimation."
            )
            return self._fallback_estimate(leg)

    def _fallback_estimate(self, leg: ShippingLeg) -> EmissionsResult:
        """
        Estimate emissions using industry-standard emission factors.
        Used when Carbon Interface API is unavailable.
        """
        factor = EMISSION_FACTORS.get(leg.transport_method, 0.062)
        distance = leg.distance_km or self._estimate_distance(leg)
        carbon_kg = (leg.weight_kg / 1000) * distance * factor

        return EmissionsResult(
            leg_id=f"{leg.origin}-{leg.destination}",
            carbon_kg=round(carbon_kg, 2),
            carbon_mt=round(carbon_kg / 1000, 4),
            transport_method=leg.transport_method,
            origin=leg.origin,
            destination=leg.destination,
            estimated=True,
        )

    @staticmethod
    def _estimate_distance(leg: ShippingLeg) -> float:
        """Rough distance estimation fallback (great-circle placeholder)."""
        # In production, this would use a geocoding API
        # Placeholder: return a reasonable default
        default_distances = {
            "ship": 8000,
            "truck": 500,
            "rail": 1200,
            "plane": 5000,
        }
        return default_distances.get(leg.transport_method, 1000)
