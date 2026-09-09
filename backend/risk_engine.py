"""
Loads the trained risk model + severity clustering + grid features produced
by ml/run_pipeline.py, and serves risk-grid / hotspot / stats queries.

Reads directly from data/processed/ and ml/models/ (repo-root relative) so
the backend doesn't need to import the ml/ package - it only needs the
pipeline's output files to exist. Run `python ml/run_pipeline.py` once
(from a venv with ml/requirements.txt installed) before starting the API.
"""
import json
import os
from datetime import datetime, timedelta, timezone

import joblib
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GRID_FEATURES_CSV = os.path.join(REPO_ROOT, "data", "processed", "grid_features.csv")
MODEL_PATH = os.path.join(REPO_ROOT, "ml", "models", "risk_model.joblib")
ROADS_GEOJSON = os.path.join(REPO_ROOT, "data", "raw", "osm_roads_hyderabad.geojson")
LOCALITIES_CSV = os.path.join(REPO_ROOT, "data", "processed", "ghmc_waterlogging_incidents_2019.csv")
DEPOTS_JSON = os.path.join(REPO_ROOT, "data", "processed", "drf_depots.json")

BAND_RANK = {"green": 0, "yellow": 1, "red": 2}
BAND_NAMES = ["green", "yellow", "red"]

# Placeholder assumptions (see data/DATA_SOURCES.md) pending real routing data:
# average urban emergency-vehicle speed incl. monsoon/traffic conditions, and
# on-site operation time scaled by how bad the flooding is at the target cell.
DRF_SPEED_KMH = 25.0
ON_SITE_MINUTES = {"red": 60, "yellow": 40, "green": 20}


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
        # DRF vehicle fleet: in-memory list of dicts (id, zone, home_lat/lon,
        # status, and - while busy - the assigned cell + timestamps). Loaded
        # once from the real GHMC-zone-centroid depots computed by
        # data/scripts/compute_drf_depots.py.
        self.fleet: list[dict] = self._load_fleet()

        # Grid rows never change position/order after this, so a KDTree built
        # once here can be reused by every request - only risk_score/severity
        # (which don't affect nearest-neighbour geometry) change per rainfall.
        self._grid_tree = cKDTree(self.grid[["lat", "lon"]].values)
        self._roads = self._load_roads() if os.path.exists(ROADS_GEOJSON) else []

    @staticmethod
    def _load_fleet():
        if not os.path.exists(DEPOTS_JSON):
            return []
        with open(DEPOTS_JSON, encoding="utf-8") as f:
            depots = json.load(f)
        return [
            {
                **depot,
                "status": "free",
                "assigned_cell_id": None,
                "severity_band": None,
                "dispatched_at": None,
                "eta_minutes": None,
                "busy_until": None,
            }
            for depot in depots
        ]

    @staticmethod
    def _load_roads():
        with open(ROADS_GEOJSON, encoding="utf-8") as f:
            geojson = json.load(f)
        roads = []
        for feat in geojson["features"]:
            coords = feat["geometry"]["coordinates"]
            mid = coords[len(coords) // 2]
            roads.append(
                {
                    "osm_id": feat["properties"].get("osm_id"),
                    "name": feat["properties"].get("name"),
                    "highway": feat["properties"].get("highway"),
                    "coordinates": coords,
                    "mid_lon": mid[0],
                    "mid_lat": mid[1],
                }
            )
        return roads

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
        self._expire_stale_dispatches()
        assigned = {v["assigned_cell_id"]: v for v in self.fleet if v["status"] == "busy"}
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
                "drf_status": "mobilized" if int(row.cell_id) in assigned else "pending",
                "drf_vehicle_id": assigned.get(int(row.cell_id), {}).get("vehicle_id"),
            }
            for row in top.itertuples()
        ]

    def _expire_stale_dispatches(self):
        """Vehicles auto-return to free once their estimated busy duration
        elapses - no manual recall required for the normal flow."""
        now = datetime.now(timezone.utc)
        for v in self.fleet:
            if v["status"] == "busy" and datetime.fromisoformat(v["busy_until"]) <= now:
                self._reset_vehicle(v)

    @staticmethod
    def _reset_vehicle(v: dict):
        v.update(status="free", assigned_cell_id=None, severity_band=None, dispatched_at=None, eta_minutes=None, busy_until=None)

    def fleet_status(self, target_lat: float | None = None, target_lon: float | None = None) -> list[dict]:
        self._expire_stale_dispatches()
        now = datetime.now(timezone.utc)
        out = []
        for v in self.fleet:
            entry = dict(v)
            if v["status"] == "busy":
                entry["free_in_minutes"] = round((datetime.fromisoformat(v["busy_until"]) - now).total_seconds() / 60, 1)
            elif target_lat is not None and target_lon is not None:
                dist_km = float(haversine_km(v["home_lat"], v["home_lon"], target_lat, target_lon))
                entry["eta_minutes_to_target"] = round(dist_km / DRF_SPEED_KMH * 60, 1)
                entry["distance_km_to_target"] = round(dist_km, 2)
            out.append(entry)
        return out

    def mobilize_drf(self, vehicle_id: str, cell_id: int, rainfall_mm: float) -> dict:
        """Dispatch a specific free DRF vehicle to a cell, grounded in that
        cell's live risk_score/severity_band. The vehicle becomes busy for an
        estimated round-trip-plus-on-site duration and cannot be dispatched
        again until it expires (or is manually recalled early)."""
        self._expire_stale_dispatches()
        vehicle = next((v for v in self.fleet if v["vehicle_id"] == vehicle_id), None)
        if vehicle is None:
            raise ValueError(f"Unknown vehicle_id {vehicle_id}")
        if vehicle["status"] != "free":
            raise ValueError(f"{vehicle_id} is already deployed")

        df = self.score(rainfall_mm)
        row = df.loc[df["cell_id"] == cell_id]
        if row.empty:
            raise ValueError(f"Unknown cell_id {cell_id}")
        row = row.iloc[0]

        dist_km = float(haversine_km(vehicle["home_lat"], vehicle["home_lon"], row.lat, row.lon))
        eta_minutes = dist_km / DRF_SPEED_KMH * 60
        on_site_minutes = ON_SITE_MINUTES[row.severity_band]
        total_busy_minutes = 2 * eta_minutes + on_site_minutes  # there, on-site, and back
        now = datetime.now(timezone.utc)

        vehicle.update(
            status="busy",
            assigned_cell_id=cell_id,
            severity_band=row.severity_band,
            dispatched_at=now.isoformat(),
            eta_minutes=round(eta_minutes, 1),
            busy_until=(now + timedelta(minutes=total_busy_minutes)).isoformat(),
        )
        return {
            **vehicle,
            "cell_risk_score": round(float(row.risk_score), 4),
            "population_exposed": int(row.population_exposed),
            "on_site_minutes": on_site_minutes,
            "free_in_minutes": round(total_busy_minutes, 1),
        }

    def recall_drf(self, vehicle_id: str):
        """Manual early return-to-base, ahead of the automatic expiry."""
        vehicle = next((v for v in self.fleet if v["vehicle_id"] == vehicle_id), None)
        if vehicle is not None:
            self._reset_vehicle(vehicle)

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

    def localities(self) -> list[dict]:
        """Real GHMC 2019 waterlogging-prone localities (geocoded), used to
        populate a real location picker instead of one hardcoded demo point."""
        if not os.path.exists(LOCALITIES_CSV):
            return []
        df = pd.read_csv(LOCALITIES_CSV)
        return [
            {"name": row.locality, "lat": float(row.lat), "lon": float(row.lon)}
            for row in df.itertuples()
        ]

    def feature_importances(self) -> list[dict]:
        pairs = sorted(zip(self.feature_cols, self.model.feature_importances_), key=lambda x: -x[1])
        return [{"feature": f, "importance": round(float(i), 4)} for f, i in pairs]

    def risk_histogram(self, rainfall_mm: float, bins: int = 10) -> list[dict]:
        df = self.score(rainfall_mm)
        counts, edges = np.histogram(df["risk_score"], bins=bins, range=(0, 1))
        return [
            {"bin_start": round(float(edges[i]), 2), "bin_end": round(float(edges[i + 1]), 2), "count": int(counts[i])}
            for i in range(len(counts))
        ]

    def risk_at_point(self, lat: float, lon: float, rainfall_mm: float) -> dict:
        df = self.score(rainfall_mm)
        dist = haversine_km(lat, lon, df["lat"].values, df["lon"].values)
        idx = int(np.argmin(dist))
        row = df.iloc[idx]
        percentile = float((df["risk_score"] <= row.risk_score).mean() * 100)
        return {
            "cell_id": int(row.cell_id),
            "lat": float(row.lat),
            "lon": float(row.lon),
            "distance_km": round(float(dist[idx]), 3),
            "risk_score": round(float(row.risk_score), 4),
            "severity_band": row.severity_band,
            "percentile_citywide": round(percentile, 1),
            "population_exposed": int(row.population_exposed),
            "rainfall_mm": rainfall_mm,
            "factors": {
                "dist_to_drain_km": round(float(row.dist_to_drain_km), 3),
                "dist_to_incident_km": round(float(row.dist_to_incident_km), 3),
                "elevation_proxy": round(float(row.elevation_proxy), 1),
            },
        }

    def affected_road_segments(self, rainfall_mm: float) -> dict:
        """Road segments (trunk/primary/secondary/tertiary, from OSM) whose
        nearest grid cell is yellow or red at this rainfall - i.e. roads
        actually near a modelled hotspot, not just any road in the city."""
        df = self.score(rainfall_mm)
        severity = df["severity_band"].values
        risk = df["risk_score"].values

        if not self._roads:
            return {"type": "FeatureCollection", "features": []}

        mids = np.array([[r["mid_lat"], r["mid_lon"]] for r in self._roads])
        _, idx = self._grid_tree.query(mids, k=1)

        features = []
        for road, cell_idx in zip(self._roads, idx):
            band = severity[cell_idx]
            if band == "green":
                continue
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": road["coordinates"]},
                    "properties": {
                        "osm_id": road["osm_id"],
                        "name": road["name"],
                        "highway": road["highway"],
                        "severity_band": band,
                        "risk_score": round(float(risk[cell_idx]), 4),
                    },
                }
            )
        return {"type": "FeatureCollection", "features": features}

    def set_override(self, cell_id: int, severity_band: str):
        if severity_band not in BAND_NAMES:
            raise ValueError(f"severity_band must be one of {BAND_NAMES}")
        self.overrides[cell_id] = severity_band

    def clear_override(self, cell_id: int):
        self.overrides.pop(cell_id, None)
