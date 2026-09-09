"""
FastAPI backend for the Urban Waterlogging Nowcast.

Run (from backend/, with backend/requirements.txt installed, and after
`python ml/run_pipeline.py` has produced data/processed/grid_features.csv
and the ml/models/risk_model_{random_forest,xgboost,adaboost}.joblib trio):

    uvicorn app:app --reload --port 8000
"""
import json
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from alerts import build_alert_message, send_alert
from risk_engine import DEFAULT_BAND_METHOD, DEFAULT_MODEL, RiskEngine

load_dotenv()
logging.basicConfig(level=logging.INFO)

DEFAULT_RAINFALL_MM = 60.0
MOCK_EVENT_VALIDATION_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "processed", "mock_event_validation_results.json"
)

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


@app.get("/api/model/options")
def model_options():
    """Model/severity-banding choices available, per
    ML_Algorithm_Comparison_Paper.docx - lets the frontend build selectors
    instead of hardcoding the algorithm names."""
    return RiskEngine.available_options()


@app.get("/api/risk-grid")
def risk_grid(rainfall_mm: float = DEFAULT_RAINFALL_MM, model: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD):
    return get_engine().risk_grid_geojson(rainfall_mm, model, band_method)


@app.get("/api/hotspots")
def hotspots(rainfall_mm: float = DEFAULT_RAINFALL_MM, limit: int = 20, model: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD):
    return {"rainfall_mm": rainfall_mm, "hotspots": get_engine().hotspots(rainfall_mm, limit, model, band_method)}


@app.get("/api/stats/severity-population")
def severity_population_stats(rainfall_mm: float = DEFAULT_RAINFALL_MM, model: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD):
    return {"rainfall_mm": rainfall_mm, "bands": get_engine().severity_population_stats(rainfall_mm, model, band_method)}


@app.get("/api/stats/risk-histogram")
def risk_histogram(rainfall_mm: float = DEFAULT_RAINFALL_MM, bins: int = 10, model: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD):
    return {"rainfall_mm": rainfall_mm, "bins": get_engine().risk_histogram(rainfall_mm, bins, model, band_method)}


@app.get("/api/model/feature-importance")
def feature_importance(model: str = DEFAULT_MODEL):
    return {"model": model, "features": get_engine().feature_importances(model)}


@app.get("/api/risk-at-point")
def risk_at_point(lat: float, lon: float, rainfall_mm: float = DEFAULT_RAINFALL_MM, model: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD):
    return get_engine().risk_at_point(lat, lon, rainfall_mm, model, band_method)


@app.get("/api/road-segments")
def road_segments(rainfall_mm: float = DEFAULT_RAINFALL_MM, model: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD):
    return get_engine().affected_road_segments(rainfall_mm, model, band_method)


@app.get("/api/localities")
def localities():
    return {"localities": get_engine().localities()}


@app.get("/api/risk-at-localities")
def risk_at_localities(rainfall_mm: float = DEFAULT_RAINFALL_MM, model: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD):
    """Location-level flood probability for a test rainfall event, across
    every real GHMC 2019 waterlogging-prone locality - the major
    flood-prone areas of Hyderabad, not just the abstract grid."""
    return {
        "rainfall_mm": rainfall_mm,
        "model": model,
        "band_method": band_method,
        "localities": get_engine().risk_at_localities(rainfall_mm, model, band_method),
    }


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


@app.get("/api/fleet")
def fleet_status(target_lat: float | None = None, target_lon: float | None = None):
    return {"fleet": get_engine().fleet_status(target_lat, target_lon)}


class MobilizeRequest(BaseModel):
    vehicle_id: str
    cell_id: int
    rainfall_mm: float = DEFAULT_RAINFALL_MM
    model: str = DEFAULT_MODEL
    band_method: str = DEFAULT_BAND_METHOD


@app.post("/api/mobilize")
def mobilize_drf(body: MobilizeRequest):
    try:
        return get_engine().mobilize_drf(body.vehicle_id, body.cell_id, body.rainfall_mm, body.model, body.band_method)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@app.delete("/api/mobilize/{vehicle_id}")
def recall_drf(vehicle_id: str):
    get_engine().recall_drf(vehicle_id)
    return {"vehicle_id": vehicle_id, "recalled": True}


class AutoDispatchRequest(BaseModel):
    rainfall_mm: float = DEFAULT_RAINFALL_MM
    model: str = DEFAULT_MODEL
    band_method: str = DEFAULT_BAND_METHOD
    threshold_band: str = Field(default="red", pattern="^(green|yellow|red)$")


@app.post("/api/auto-dispatch")
def auto_dispatch(body: AutoDispatchRequest):
    """One-shot automated mobilization: dispatch every currently-free
    vehicle to the highest-priority uncovered cell at/above threshold_band,
    driven purely by the model's current risk/severity output."""
    dispatched = get_engine().auto_dispatch(body.rainfall_mm, body.model, body.band_method, body.threshold_band)
    return {"dispatched": dispatched}


@app.get("/api/forecast")
def rainfall_forecast(days: int = 3):
    return {"days": days, "hours": get_engine().rainfall_forecast(days)}


class SimulateStepRequest(BaseModel):
    hour_index: int = Field(ge=0)
    rainfall_mm: float
    model: str = DEFAULT_MODEL
    band_method: str = DEFAULT_BAND_METHOD


@app.post("/api/simulate/step")
def simulate_step(body: SimulateStepRequest):
    """One tick of the live 1-3 day forecast playback: advances the
    simulated clock, lets vehicles whose job duration has elapsed by then
    auto-return to base, and auto-dispatches free vehicles to any newly
    red cell at this step's rainfall - the whole point being to watch
    mobilization happen live as the forecast plays out, with no admin
    clicking anything."""
    return get_engine().simulate_step(body.hour_index, body.rainfall_mm, body.model, body.band_method)


@app.post("/api/simulate/reset")
def simulate_reset():
    get_engine().reset_simulation()
    return {"reset": True}


@app.post("/api/simulate/stop")
def simulate_stop():
    get_engine().stop_simulation()
    return {"stopped": True}


class AlertRequest(BaseModel):
    lat: float
    lon: float
    phone_number: str = Field(default="+10000000000", description="Demo number; dry-run unless Twilio is configured")
    rainfall_mm: float = DEFAULT_RAINFALL_MM
    threshold: float = Field(default=0.6, ge=0, le=1)


@app.get("/api/mock-event-validation")
def mock_event_validation():
    """Precomputed accuracy/DRF-dispatch results of testing the live models
    against a synthetic 3-day mock flood event's ground truth (see
    ml/mock_flood_event.py + ml/validate_against_mock_event.py) - a fixed
    reference artifact re-served here, not recomputed per-request."""
    if not os.path.exists(MOCK_EVENT_VALIDATION_PATH):
        raise HTTPException(status_code=404, detail="Run ml/validate_against_mock_event.py first")
    with open(MOCK_EVENT_VALIDATION_PATH, encoding="utf-8") as f:
        return json.load(f)


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
