from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from services.alert_service import AlertService

app = FastAPI(
    title="Urban Waterlogging Nowcast API - Hyderabad",
    description="Backend ML risk engine output, spatial cell data, emergency broadcast service, and citizen uplink reports.",
    version="2.0.0"
)

# Enable CORS for PWA Frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

alert_service = AlertService()

# In-memory data store for Hyderabad spatial risk cells
RISK_CELLS: List[Dict[str, Any]] = [
    {
        "hexId": "HYD-HEX-101",
        "locality": "Begumpet Underpass",
        "riskScore": 92,
        "floodProbability": 0.92,
        "population": 4200,
        "exposedPopulation": 3864,
        "severity": "HIGH",
        "waterLevelCm": 48,
        "drainageStatus": "CRITICAL",
        "coords": {"lat": 17.4447, "lng": 78.4664}
    },
    {
        "hexId": "HYD-HEX-102",
        "locality": "Khairatabad Circle",
        "riskScore": 84,
        "floodProbability": 0.84,
        "population": 6500,
        "exposedPopulation": 5460,
        "severity": "HIGH",
        "waterLevelCm": 35,
        "drainageStatus": "BLOCKED",
        "coords": {"lat": 17.4116, "lng": 78.4623}
    },
    {
        "hexId": "HYD-HEX-103",
        "locality": "LB Nagar Junction",
        "riskScore": 68,
        "floodProbability": 0.68,
        "population": 8900,
        "exposedPopulation": 6052,
        "severity": "MODERATE",
        "waterLevelCm": 22,
        "drainageStatus": "PARTIAL",
        "coords": {"lat": 17.3541, "lng": 78.5492}
    },
    {
        "hexId": "HYD-HEX-104",
        "locality": "Madhapur Cyber Towers",
        "riskScore": 45,
        "floodProbability": 0.45,
        "population": 12000,
        "exposedPopulation": 5400,
        "severity": "MODERATE",
        "waterLevelCm": 14,
        "drainageStatus": "PARTIAL",
        "coords": {"lat": 17.4504, "lng": 78.3808}
    },
    {
        "hexId": "HYD-HEX-105",
        "locality": "Malakpet Nala",
        "riskScore": 95,
        "floodProbability": 0.95,
        "population": 5400,
        "exposedPopulation": 5130,
        "severity": "HIGH",
        "waterLevelCm": 62,
        "drainageStatus": "CRITICAL",
        "coords": {"lat": 17.3753, "lng": 78.4984}
    },
    {
        "hexId": "HYD-HEX-106",
        "locality": "Tolichowki Flyover",
        "riskScore": 76,
        "floodProbability": 0.76,
        "population": 7800,
        "exposedPopulation": 5928,
        "severity": "HIGH",
        "waterLevelCm": 29,
        "drainageStatus": "BLOCKED",
        "coords": {"lat": 17.4042, "lng": 78.4146}
    },
    {
        "hexId": "HYD-HEX-107",
        "locality": "Ameerpet Metro Corridor",
        "riskScore": 32,
        "floodProbability": 0.32,
        "population": 11000,
        "exposedPopulation": 3520,
        "severity": "LOW",
        "waterLevelCm": 8,
        "drainageStatus": "CLEAR",
        "coords": {"lat": 17.4375, "lng": 78.4482}
    },
    {
        "hexId": "HYD-HEX-108",
        "locality": "Old City Charminar Zone",
        "riskScore": 61,
        "floodProbability": 0.61,
        "population": 15000,
        "exposedPopulation": 9150,
        "severity": "MODERATE",
        "waterLevelCm": 19,
        "drainageStatus": "PARTIAL",
        "coords": {"lat": 17.3616, "lng": 78.4747}
    }
]

CITIZEN_REPORTS: List[Dict[str, Any]] = []

# Pydantic Schemas
class CoordsSchema(BaseModel):
    lat: float
    lng: float

class CitizenReportRequest(BaseModel):
    userId: str
    locality: str
    severityLevel: int = Field(ge=1, le=5)
    waterDepthCm: int
    description: str
    photoUrl: Optional[str] = None
    coords: CoordsSchema

class AlertTriggerRequest(BaseModel):
    hexId: str
    locality: str
    message: str
    severity: str
    channels: List[str] = ["SMS", "WHATSAPP", "PUSH"]

class ManualOverrideRequest(BaseModel):
    hexId: str
    newSeverity: str
    commanderId: str = "CMD_HYD_01"
    note: Optional[str] = None

@app.get("/")
def root():
    return {
        "service": "Urban Waterlogging Nowcast Backend",
        "status": "OPERATIONAL",
        "version": "2.0.0",
        "designSystem": "Quantum²"
    }

@app.get("/health")
def health_check():
    return {"status": "HEALTHY", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/v1/risk-map")
def get_risk_map():
    """
    Returns spatial array of RiskCell objects for Hyderabad sector grid.
    """
    return {
        "success": True,
        "count": len(RISK_CELLS),
        "data": RISK_CELLS,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/v1/telemetry")
def get_telemetry():
    """
    Returns city telemetry, population exposed summary, and 24h risk trend data.
    """
    total_exposed = sum(cell["exposedPopulation"] for cell in RISK_CELLS if cell["severity"] in ["HIGH", "MODERATE"])
    active_alerts = len([cell for cell in RISK_CELLS if cell["severity"] == "HIGH"])
    
    trend_24h = [
        {"time": "00:00", "riskVelocity": 12, "rainfallMm": 4.2, "alerts": 10},
        {"time": "04:00", "riskVelocity": 18, "rainfallMm": 8.6, "alerts": 22},
        {"time": "08:00", "riskVelocity": 45, "rainfallMm": 24.0, "alerts": 58},
        {"time": "12:00", "riskVelocity": 82, "rainfallMm": 42.5, "alerts": 110},
        {"time": "16:00", "riskVelocity": 95, "rainfallMm": 58.1, "alerts": 142},
        {"time": "20:00", "riskVelocity": 78, "rainfallMm": 38.0, "alerts": 98},
    ]

    return {
        "success": True,
        "telemetry": {
            "totalPopulationAtRisk": total_exposed,
            "activeAlertCount": active_alerts,
            "monitoredSectors": len(RISK_CELLS),
            "highRiskSectors": active_alerts,
            "avgWaterRiseRate": "+4.2 cm/hr",
            "lastUpdated": datetime.utcnow().isoformat(),
            "trend24h": trend_24h
        }
    }

@app.post("/api/v1/report")
def submit_report(report: CitizenReportRequest):
    """
    Accepts citizen flood reports from mobile PWA uplink.
    """
    new_report = {
        "id": f"RPT_{len(CITIZEN_REPORTS) + 1001}",
        "userId": report.userId,
        "locality": report.locality,
        "severityLevel": report.severityLevel,
        "waterDepthCm": report.waterDepthCm,
        "description": report.description,
        "photoUrl": report.photoUrl or "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500&auto=format&fit=crop",
        "coords": report.coords.dict(),
        "timestamp": datetime.utcnow().isoformat(),
        "status": "VERIFIED"
    }
    CITIZEN_REPORTS.append(new_report)
    return {"success": True, "message": "Report logged into ML risk pipeline.", "data": new_report}

@app.post("/api/v1/alerts/trigger")
def trigger_alert(req: AlertTriggerRequest):
    """
    Dispatches emergency alert via SMS/WhatsApp/Push.
    """
    target_cell = next((c for c in RISK_CELLS if c["hexId"] == req.hexId), None)
    pop = target_cell["exposedPopulation"] if target_cell else 5000
    
    result = alert_service.trigger_emergency_alert(
        hex_id=req.hexId,
        locality=req.locality,
        message=req.message,
        severity=req.severity,
        channels=req.channels,
        affected_population=pop
    )
    return result

@app.post("/api/v1/override")
def override_risk_cell(req: ManualOverrideRequest):
    """
    Human-in-the-Loop commander override for cell risk severity.
    """
    target_cell = next((c for c in RISK_CELLS if c["hexId"] == req.hexId), None)
    if not target_cell:
        raise HTTPException(status_code=404, detail="Risk cell not found")
    
    target_cell["severity"] = req.newSeverity
    target_cell["manualOverride"] = {
        "severity": req.newSeverity,
        "updatedBy": req.commanderId,
        "updatedAt": datetime.utcnow().isoformat()
    }
    
    if req.newSeverity == "HIGH":
        target_cell["riskScore"] = max(target_cell["riskScore"], 88)
        target_cell["floodProbability"] = 0.88
    elif req.newSeverity == "LOW":
        target_cell["riskScore"] = 25
        target_cell["floodProbability"] = 0.25

    return {
        "success": True,
        "message": f"Risk cell {req.hexId} overridden to {req.newSeverity} by commander {req.commanderId}.",
        "updatedCell": target_cell
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
