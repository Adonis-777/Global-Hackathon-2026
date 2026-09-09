"""
FastAPI backend for the Urban Waterlogging Nowcast.

Run (from backend/, with backend/requirements.txt installed, and after
`python ml/run_pipeline.py` has produced data/processed/grid_features.csv
and ml/models/risk_model.joblib):

    uvicorn app:app --reload --port 8000
"""
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from alerts import build_alert_message, send_alert
from risk_engine import BAND_NAMES, RiskEngine

load_dotenv()
logging.basicConfig(level=logging.INFO)

DEFAULT_RAINFALL_MM = 60.0

app = FastAPI(title="Urban Waterlogging Nowcast API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

engine: RiskEngine | None = None


@app.on_event("startup")
def _load_engine():
    global engine
    engine = RiskEngine()


def get_engine() -> RiskEngine:
    if engine is None:
        raise HTTPException(status_code=503, detail="Risk engine not loaded yet")
    return engine


@app.get("/api/health")
def health():
    return {"status": "ok", "cells_loaded": len(engine.grid) if engine else 0}


@app.get("/api/risk-grid")
def risk_grid(rainfall_mm: float = DEFAULT_RAINFALL_MM):
    return get_engine().risk_grid_geojson(rainfall_mm)


@app.get("/api/hotspots")
def hotspots(rainfall_mm: float = DEFAULT_RAINFALL_MM, limit: int = 20):
    return {"rainfall_mm": rainfall_mm, "hotspots": get_engine().hotspots(rainfall_mm, limit)}


@app.get("/api/stats/severity-population")
def severity_population_stats(rainfall_mm: float = DEFAULT_RAINFALL_MM):
    return {"rainfall_mm": rainfall_mm, "bands": get_engine().severity_population_stats(rainfall_mm)}


@app.get("/api/stats/risk-histogram")
def risk_histogram(rainfall_mm: float = DEFAULT_RAINFALL_MM, bins: int = 10):
    return {"rainfall_mm": rainfall_mm, "bins": get_engine().risk_histogram(rainfall_mm, bins)}


@app.get("/api/model/feature-importance")
def feature_importance():
    return {"features": get_engine().feature_importances()}


@app.get("/api/risk-at-point")
def risk_at_point(lat: float, lon: float, rainfall_mm: float = DEFAULT_RAINFALL_MM):
    return get_engine().risk_at_point(lat, lon, rainfall_mm)


@app.get("/api/road-segments")
def road_segments(rainfall_mm: float = DEFAULT_RAINFALL_MM):
    return get_engine().affected_road_segments(rainfall_mm)


@app.get("/api/localities")
def localities():
    return {"localities": get_engine().localities()}


class OverrideRequest(BaseModel):
    cell_id: int
    severity_band: str = Field(pattern="^(green|yellow|red)$")


@app.post("/api/overrides")
def set_override(body: OverrideRequest):
    get_engine().set_override(body.cell_id, body.severity_band)
    return {"cell_id": body.cell_id, "severity_band": body.severity_band}


@app.delete("/api/overrides/{cell_id}")
def clear_override(cell_id: int):
    get_engine().clear_override(cell_id)
    return {"cell_id": cell_id, "cleared": True}


@app.get("/api/overrides")
def list_overrides():
    return get_engine().overrides


class MobilizeRequest(BaseModel):
    cell_id: int
    rainfall_mm: float = DEFAULT_RAINFALL_MM


@app.post("/api/mobilize")
def mobilize_drf(body: MobilizeRequest):
    try:
        return get_engine().mobilize_drf(body.cell_id, body.rainfall_mm)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.delete("/api/mobilize/{cell_id}")
def recall_drf(cell_id: int):
    get_engine().recall_drf(cell_id)
    return {"cell_id": cell_id, "recalled": True}


@app.get("/api/mobilizations")
def list_mobilizations():
    return {"mobilizations": get_engine().list_mobilizations()}


class AlertRequest(BaseModel):
    lat: float
    lon: float
    phone_number: str = Field(default="+10000000000", description="Demo number; dry-run unless Twilio is configured")
    rainfall_mm: float = DEFAULT_RAINFALL_MM
    threshold: float = Field(default=0.6, ge=0, le=1)


@app.post("/api/alerts/trigger")
def trigger_alert(body: AlertRequest):
    eng = get_engine()
    nearest = eng.nearest_cell(body.lat, body.lon, body.rainfall_mm)
    if nearest["risk_score"] < body.threshold:
        return {"triggered": False, "reason": "below threshold", "cell": nearest}

    alternate = eng.suggest_safer_alternate(nearest["cell_id"], body.rainfall_mm)
    message = build_alert_message(nearest["severity_band"], nearest["risk_score"], alternate)
    result = send_alert(body.phone_number, message)
    return {"triggered": True, "cell": nearest, "alternate_route": alternate, "delivery": result}
