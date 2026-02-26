import asyncio
import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("====================================")
    print("Testing /health")
    response = client.get("/health")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print("====================================\n")

    print("====================================")
    print("Testing /api/supplier/verify-gleif")
    response = client.post("/api/supplier/verify-gleif", json={
        "supplier_id": "SUP-123",
        "company_name": "Volkswagen AG",
        "jurisdiction": "DE"
    })
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print("====================================\n")

    print("====================================")
    print("Testing /api/intelligence/search")
    response = client.post("/api/intelligence/search", json={
        "supplier_id": "SUP-123",
        "supplier_name": "Tesla",
        "additional_context": "emissions"
    })
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print("====================================\n")

    print("====================================")
    print("Testing /api/emissions/calculate")
    response = client.post("/api/emissions/calculate", json={
        "origin": "CNSHA",
        "destination": "DEHAM",
        "weight_kg": 10000,
        "transport_mode": "sea"
    })
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print("====================================\n")

    print("====================================")
    print("Testing /api/audit/demo")
    response = client.get("/api/audit/demo")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Audit ID: {data.get('audit_id')}")
        print(f"Risk Score: {data.get('overall_risk_score')}")
        print(f"Status: {data.get('compliance_status')}")
        print(f"Findings: {len(data.get('findings', []))}")
        print(f"Violations: {len(data.get('violations', []))}")
    else:
        print(response.text)
    print("====================================\n")

if __name__ == "__main__":
    run_tests()
