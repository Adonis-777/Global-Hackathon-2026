"""
Loads the trained risk model + severity clustering + grid features produced
by ml/run_pipeline.py, and serves risk-grid / hotspot / stats queries.

Reads directly from data/processed/ and ml/models/ (repo-root relative) so
the backend doesn't need to import the ml/ package - it only needs the
pipeline's output files to exist. Run `python ml/run_pipeline.py` once
(from a venv with ml/requirements.txt installed) before starting the API.
"""
import os

import joblib
import numpy as np
import pandas as pd

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GRID_FEATURES_CSV = os.path.join(REPO_ROOT, "data", "processed", "grid_features.csv")
MODEL_PATH = os.path.join(REPO_ROOT, "ml", "models", "risk_model.joblib")

BAND_RANK = {"green": 0, "yellow": 1, "red": 2}
BAND_NAMES = ["green", "yellow", "red"]


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))


class RiskEngine:
    """Loaded once at API startup; recomputes risk for a requested rainfall_mm
    without needing to re-run the whole offline pipeline."""

    def __init__(self):
        missing = [p for p in (GRID_FEATURES_CSV, MODEL_PATH) if not os.path.exists(p)]
        if missing:
            raise FileNotFoundError(
                "Missing pipeline output(s): "
                + ", ".join(missing)
                + ". Run `python ml/run_pipeline.py` first (see ml/requirements.txt)."
            )
        self.grid = pd.read_csv(GRID_FEATURES_CSV)
        bundle = joblib.load(MODEL_PATH)
        self.model = bundle["model"]
        self.feature_cols = bundle["feature_cols"]
        # human-in-the-loop overrides: cell_id -> severity_band, kept in memory only
        self.overrides: dict[int, str] = {}

    def score(self, rainfall_mm: float) -> pd.DataFrame:
        df = self.grid.copy()
        df["rainfall_mm"] = rainfall_mm
        df["risk_score"] = self.model.predict(df[self.feature_cols]).clip(0, 1)
        df["population_exposed"] = (df["population_density"] * 0.25).round().astype(int)

        # Severity via percentile rank, not fixed absolute thresholds: the
        # heuristic-trained model's score range shifts with rainfall_mm, so a
        # fixed 0.33/0.66 cut left "red" almost empty at moderate rainfall.
        # Bottom 50% -> green, next 30% -> yellow, top 20% -> red mirrors the
        # real use case (a small, prioritized mobilization set), not an even split.
        df["severity_band"] = pd.qcut(
            df["risk_score"].rank(method="first"), q=[0, 0.5, 0.8, 1.0], labels=BAND_NAMES
        ).astype(str)

        for cell_id, band in self.overrides.items():
            df.loc[df["cell_id"] == cell_id, "severity_band"] = band

        return df

    def risk_grid_geojson(self, rainfall_mm: float) -> dict:
        df = self.score(rainfall_mm)
        features = [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [row.lon, row.lat]},
                "properties": {
                    "cell_id": int(row.cell_id),
                    "risk_score": round(float(row.risk_score), 4),
                    "severity_band": row.severity_band,
                    "population_exposed": int(row.population_exposed),
                    "dist_to_drain_km": round(float(row.dist_to_drain_km), 3),
                    "dist_to_incident_km": round(float(row.dist_to_incident_km), 3),
                    "overridden": int(row.cell_id) in self.overrides,
                },
            }
            for row in df.itertuples()
        ]
        return {"type": "FeatureCollection", "features": features}

    def hotspots(self, rainfall_mm: float, limit: int = 20) -> list[dict]:
        df = self.score(rainfall_mm)
        df["mobilization_score"] = df["risk_score"] * df["population_exposed"]
        top = df.sort_values("mobilization_score", ascending=False).head(limit)
        return [
            {
                "cell_id": int(row.cell_id),
                "lat": float(row.lat),
                "lon": float(row.lon),
                "risk_score": round(float(row.risk_score), 4),
                "severity_band": row.severity_band,
                "population_exposed": int(row.population_exposed),
                "mobilization_score": round(float(row.mobilization_score), 1),
            }
            for row in top.itertuples()
        ]

    def severity_population_stats(self, rainfall_mm: float) -> list[dict]:
        df = self.score(rainfall_mm)
        grouped = df.groupby("severity_band").agg(
            cell_count=("cell_id", "count"),
            total_population_exposed=("population_exposed", "sum"),
            avg_risk_score=("risk_score", "mean"),
        )
        return [
            {
                "severity_band": band,
                "cell_count": int(grouped.loc[band, "cell_count"]) if band in grouped.index else 0,
                "total_population_exposed": int(grouped.loc[band, "total_population_exposed"]) if band in grouped.index else 0,
                "avg_risk_score": round(float(grouped.loc[band, "avg_risk_score"]), 4) if band in grouped.index else 0.0,
            }
            for band in BAND_NAMES
        ]

    def nearest_cell(self, lat: float, lon: float, rainfall_mm: float) -> dict | None:
        df = self.score(rainfall_mm)
        dist = haversine_km(lat, lon, df["lat"].values, df["lon"].values)
        idx = int(np.argmin(dist))
        row = df.iloc[idx]
        return {
            "cell_id": int(row.cell_id),
            "lat": float(row.lat),
            "lon": float(row.lon),
            "risk_score": round(float(row.risk_score), 4),
            "severity_band": row.severity_band,
            "distance_km": round(float(dist[idx]), 3),
        }

    def suggest_safer_alternate(self, cell_id: int, rainfall_mm: float, radius_km: float = 5.0) -> dict | None:
        """Nearest cell with a strictly lower severity band, within radius_km.
        Stands in for real road-network routing (out of scope for a 24h
        hackathon - would need OSRM + the road graph)."""
        df = self.score(rainfall_mm)
        origin = df.loc[df["cell_id"] == cell_id]
        if origin.empty:
            return None
        origin = origin.iloc[0]
        origin_rank = BAND_RANK[origin.severity_band]

        safer = df[df["severity_band"].map(BAND_RANK) < origin_rank].copy()
        if safer.empty:
            return None
        safer["distance_km"] = haversine_km(origin.lat, origin.lon, safer["lat"].values, safer["lon"].values)
        safer = safer[safer["distance_km"] <= radius_km]
        if safer.empty:
            return None
        best = safer.sort_values("distance_km").iloc[0]
        return {
            "cell_id": int(best.cell_id),
            "lat": float(best.lat),
            "lon": float(best.lon),
            "severity_band": best.severity_band,
            "distance_km": round(float(best.distance_km), 3),
        }

    def set_override(self, cell_id: int, severity_band: str):
        if severity_band not in BAND_NAMES:
            raise ValueError(f"severity_band must be one of {BAND_NAMES}")
        self.overrides[cell_id] = severity_band

    def clear_override(self, cell_id: int):
        self.overrides.pop(cell_id, None)
