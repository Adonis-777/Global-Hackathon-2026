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
from sklearn.cluster import KMeans
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GRID_FEATURES_CSV = os.path.join(REPO_ROOT, "data", "processed", "grid_features.csv")
ROADS_GEOJSON = os.path.join(REPO_ROOT, "data", "raw", "osm_roads_hyderabad.geojson")
LOCALITIES_CSV = os.path.join(REPO_ROOT, "data", "processed", "ghmc_waterlogging_incidents_2019.csv")
DEPOTS_JSON = os.path.join(REPO_ROOT, "data", "processed", "drf_depots.json")

# The three regressors compared in ML_Algorithm_Comparison_Paper.docx
# (ml/run_experiments.py), trained live for continuous risk scoring by
# ml/train_risk_model.py. All three are loaded so the API's `model` param
# can switch between them without a restart.
MODEL_NAMES = ["random_forest", "xgboost", "adaboost"]
MODEL_PATHS = {name: os.path.join(REPO_ROOT, "ml", "models", f"risk_model_{name}.joblib") for name in MODEL_NAMES}
DEFAULT_MODEL = "random_forest"

BAND_METHODS = ["percentile", "kmeans", "hybrid"]
DEFAULT_BAND_METHOD = "percentile"

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
        missing = [p for p in (GRID_FEATURES_CSV, *MODEL_PATHS.values()) if not os.path.exists(p)]
        if missing:
            raise FileNotFoundError(
                "Missing pipeline output(s): "
                + ", ".join(missing)
                + ". Run `python ml/train_risk_model.py` (or the full `python ml/run_pipeline.py`) first."
            )
        self.grid = pd.read_csv(GRID_FEATURES_CSV)
        self.models: dict[str, dict] = {name: joblib.load(path) for name, path in MODEL_PATHS.items()}
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

        # Simulated clock for the forecast playback (simulate_step): while a
        # simulation is running, sim_now advances hours-per-step instead of
        # real wall-clock minutes, so a ~90-minute vehicle dispatch actually
        # visibly frees up again within the fast-forwarded playback. reset_
        # simulation() re-anchors sim_epoch to real "now" and clears it back
        # to normal (real-time) operation.
        self.sim_epoch: datetime = datetime.now(timezone.utc)
        self.sim_now: datetime | None = None
        self.sim_log: list[dict] = []

    def _now(self) -> datetime:
        return self.sim_now if self.sim_now is not None else datetime.now(timezone.utc)

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
                "dispatch_reason": None,
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

    def score(self, rainfall_mm: float, model_name: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD) -> pd.DataFrame:
        bundle = self.models.get(model_name, self.models[DEFAULT_MODEL])
        model, feature_cols = bundle["model"], bundle["feature_cols"]

        df = self.grid.copy()
        df["rainfall_mm"] = rainfall_mm
        df["risk_score"] = model.predict(df[feature_cols]).clip(0, 1)
        df["population_exposed"] = (df["population_density"] * 0.25).round().astype(int)
        df["severity_band"] = self._assign_bands(df, band_method if band_method in BAND_METHODS else DEFAULT_BAND_METHOD)

        for cell_id, band in self.overrides.items():
            df.loc[df["cell_id"] == cell_id, "severity_band"] = band

        return df

    @staticmethod
    def _assign_bands(df: pd.DataFrame, band_method: str) -> pd.Series:
        """Three interchangeable severity-banding methods, all benchmarked in
        ML_Algorithm_Comparison_Paper.docx (ml/run_experiments.py, Task B):

        - percentile (default/production): bottom 50% green, next 30% yellow,
          top 20% red. Cheap, and avoids a fixed absolute threshold leaving
          "red" empty when the model's score range shifts with rainfall_mm.
        - kmeans: unsupervised K-Means(k=3) on standardized
          (risk_score, population_exposed), the paper's baseline - bands
          reflect natural clusters in the risk/population space rather than
          a fixed percentile split.
        - hybrid: kmeans bands, then each cell's band is replaced by the
          majority band among its 5 nearest geographic neighbours, trading a
          little cluster purity for map-visible spatial coherence (no
          isolated single red cell inside a green area).
        """
        if band_method == "percentile":
            return pd.qcut(df["risk_score"].rank(method="first"), q=[0, 0.5, 0.8, 1.0], labels=BAND_NAMES).astype(str)

        X = StandardScaler().fit_transform(df[["risk_score", "population_exposed"]])
        kmeans = KMeans(n_clusters=3, random_state=7, n_init=10)
        clusters = kmeans.fit_predict(X)
        order = pd.Series(df["risk_score"].values).groupby(clusters).mean().sort_values().index.tolist()
        band_map = {cluster: BAND_NAMES[rank] for rank, cluster in enumerate(order)}
        bands = np.array([band_map[c] for c in clusters])

        if band_method == "kmeans":
            return pd.Series(bands, index=df.index)

        # hybrid: spatial smoothing on top of the kmeans bands
        band_ranks = np.array([BAND_RANK[b] for b in bands])
        coords = df[["lat", "lon"]].values
        geo_knn = KNeighborsClassifier(n_neighbors=5)
        geo_knn.fit(coords, band_ranks)
        neighbour_idx = geo_knn.kneighbors(coords, return_distance=False)
        smoothed_ranks = np.array([np.bincount(band_ranks[idx]).argmax() for idx in neighbour_idx])
        return pd.Series([BAND_NAMES[r] for r in smoothed_ranks], index=df.index)

    def risk_grid_geojson(self, rainfall_mm: float, model_name: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD) -> dict:
        df = self.score(rainfall_mm, model_name, band_method)
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

    def hotspots(self, rainfall_mm: float, limit: int = 20, model_name: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD) -> list[dict]:
        self._expire_stale_dispatches()
        assigned = {v["assigned_cell_id"]: v for v in self.fleet if v["status"] == "busy"}
        df = self.score(rainfall_mm, model_name, band_method)
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
        now = self._now()
        for v in self.fleet:
            if v["status"] == "busy" and datetime.fromisoformat(v["busy_until"]) <= now:
                self._reset_vehicle(v)

    @staticmethod
    def _reset_vehicle(v: dict):
        v.update(
            status="free",
            assigned_cell_id=None,
            severity_band=None,
            dispatched_at=None,
            eta_minutes=None,
            busy_until=None,
            dispatch_reason=None,
        )

    def fleet_status(self, target_lat: float | None = None, target_lon: float | None = None) -> list[dict]:
        self._expire_stale_dispatches()
        now = self._now()
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

    def _dispatch(self, vehicle: dict, row, reason: str) -> dict:
        """Shared assignment logic for both manual (mobilize_drf) and
        automatic (auto_dispatch) DRF dispatch - grounded in the cell's live
        risk_score/severity_band either way. The vehicle becomes busy for an
        estimated round-trip-plus-on-site duration (using the engine's
        current clock - real time normally, simulated time during forecast
        playback) and cannot be dispatched again until it expires or is
        manually recalled."""
        dist_km = float(haversine_km(vehicle["home_lat"], vehicle["home_lon"], row.lat, row.lon))
        eta_minutes = dist_km / DRF_SPEED_KMH * 60
        on_site_minutes = ON_SITE_MINUTES[row.severity_band]
        total_busy_minutes = 2 * eta_minutes + on_site_minutes  # there, on-site, and back
        now = self._now()

        vehicle.update(
            status="busy",
            assigned_cell_id=int(row.cell_id),
            severity_band=row.severity_band,
            dispatched_at=now.isoformat(),
            eta_minutes=round(eta_minutes, 1),
            busy_until=(now + timedelta(minutes=total_busy_minutes)).isoformat(),
            dispatch_reason=reason,
        )
        return {
            **vehicle,
            "cell_risk_score": round(float(row.risk_score), 4),
            "population_exposed": int(row.population_exposed),
            "on_site_minutes": on_site_minutes,
            "free_in_minutes": round(total_busy_minutes, 1),
        }

    def mobilize_drf(
        self,
        vehicle_id: str,
        cell_id: int,
        rainfall_mm: float,
        model_name: str = DEFAULT_MODEL,
        band_method: str = DEFAULT_BAND_METHOD,
    ) -> dict:
        """Manually dispatch a specific free DRF vehicle to a cell."""
        self._expire_stale_dispatches()
        vehicle = next((v for v in self.fleet if v["vehicle_id"] == vehicle_id), None)
        if vehicle is None:
            raise ValueError(f"Unknown vehicle_id {vehicle_id}")
        if vehicle["status"] != "free":
            raise ValueError(f"{vehicle_id} is already deployed")

        df = self.score(rainfall_mm, model_name, band_method)
        row = df.loc[df["cell_id"] == cell_id]
        if row.empty:
            raise ValueError(f"Unknown cell_id {cell_id}")
        return self._dispatch(vehicle, row.iloc[0], reason="manual")

    def auto_dispatch(
        self,
        rainfall_mm: float,
        model_name: str = DEFAULT_MODEL,
        band_method: str = DEFAULT_BAND_METHOD,
        threshold_band: str = "red",
    ) -> list[dict]:
        """Automatically dispatch every currently-free vehicle to the
        highest-priority (risk x population) cell at or above threshold_band
        that doesn't already have a vehicle assigned - i.e. mobilization
        driven directly by the model's own severity/probability output,
        no admin click required. Limited by however many vehicles are
        actually free right now, same as a human dispatcher would be."""
        self._expire_stale_dispatches()
        threshold_rank = BAND_RANK[threshold_band]

        df = self.score(rainfall_mm, model_name, band_method)
        df["mobilization_score"] = df["risk_score"] * df["population_exposed"]
        assigned_cells = {v["assigned_cell_id"] for v in self.fleet if v["status"] == "busy"}
        candidates = df[
            (df["severity_band"].map(BAND_RANK) >= threshold_rank) & (~df["cell_id"].isin(assigned_cells))
        ].sort_values("mobilization_score", ascending=False)

        free_vehicles = [v for v in self.fleet if v["status"] == "free"]
        dispatched = []
        for row in candidates.itertuples():
            if not free_vehicles:
                break
            nearest = min(free_vehicles, key=lambda v: haversine_km(v["home_lat"], v["home_lon"], row.lat, row.lon))
            record = self._dispatch(nearest, row, reason="auto")
            free_vehicles.remove(nearest)
            dispatched.append(record)
        return dispatched

    def recall_drf(self, vehicle_id: str):
        """Manual early return-to-base, ahead of the automatic expiry."""
        vehicle = next((v for v in self.fleet if v["vehicle_id"] == vehicle_id), None)
        if vehicle is not None:
            self._reset_vehicle(vehicle)

    def rainfall_forecast(self, days: int = 3) -> list[dict]:
        """Synthetic multi-day monsoon rainfall forecast (placeholder pending
        real IMD forecast data, see data/DATA_SOURCES.md) - three staggered
        rain-burst events of increasing then decreasing intensity, so the
        live simulation has real variation to react to across the window
        instead of one flat number."""
        hours = np.arange(days * 24)
        bursts = [(14, 3.5, 40), (40, 4.0, 120), (58, 3.0, 65)]  # (center_hour, width_hours, peak_mm)
        rainfall = np.full(len(hours), 8.0)
        for center, width, peak in bursts:
            rainfall += peak * np.exp(-((hours - center) ** 2) / (2 * width**2))
        rainfall = np.clip(rainfall, 5, 160)
        return [
            {"hour": int(h), "day": int(h // 24) + 1, "hour_of_day": int(h % 24), "rainfall_mm": round(float(r), 1)}
            for h, r in zip(hours, rainfall)
        ]

    def reset_simulation(self):
        """Re-anchors the simulated clock to real 'now' and returns every
        vehicle to base, for a clean demo restart."""
        self.sim_epoch = datetime.now(timezone.utc)
        self.sim_now = None
        self.sim_log = []
        for v in self.fleet:
            self._reset_vehicle(v)

    def stop_simulation(self):
        """Exit simulated-time mode and resume real wall-clock time for
        every subsequent request (fleet timers keep whatever busy_until they
        already have, now measured against real time again)."""
        self.sim_now = None

    def simulate_step(
        self, hour_index: int, rainfall_mm: float, model_name: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD
    ) -> dict:
        """One tick of the live forecast playback: advance the simulated
        clock to sim_epoch + hour_index hours, let any vehicles whose
        estimated job duration has elapsed by that point auto-return to
        base, then auto-dispatch free vehicles to any new/still-uncovered
        red cell - purely driven by the model's current output at this
        step's rainfall, not a scripted sequence."""
        self.sim_now = self.sim_epoch + timedelta(hours=hour_index)
        dispatched = self.auto_dispatch(rainfall_mm, model_name, band_method)

        for record in dispatched:
            self.sim_log.append(
                {
                    "sim_time": self.sim_now.isoformat(),
                    "hour_index": hour_index,
                    "vehicle_id": record["vehicle_id"],
                    "cell_id": record["assigned_cell_id"],
                    "severity_band": record["severity_band"],
                    "risk_score": record["cell_risk_score"],
                    "population_exposed": record["population_exposed"],
                }
            )

        return {
            "sim_time": self.sim_now.isoformat(),
            "hour_index": hour_index,
            "rainfall_mm": rainfall_mm,
            "newly_dispatched": dispatched,
            "fleet": self.fleet_status(),
            "hotspots": self.hotspots(rainfall_mm, 15, model_name, band_method),
            "bands": self.severity_population_stats(rainfall_mm, model_name, band_method),
            "log": self.sim_log[-30:],
        }

    def severity_population_stats(self, rainfall_mm: float, model_name: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD) -> list[dict]:
        df = self.score(rainfall_mm, model_name, band_method)
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

    def risk_at_localities(
        self, rainfall_mm: float, model_name: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD
    ) -> list[dict]:
        """Location-level flood probability for a test rainfall event, for
        every real GHMC 2019 waterlogging-prone locality at once (the
        "major flood-prone areas" view) - batches the nearest-cell lookup
        via the shared KDTree instead of N separate risk_at_point() calls."""
        localities = self.localities()
        if not localities:
            return []

        df = self.score(rainfall_mm, model_name, band_method)
        coords = np.array([[loc["lat"], loc["lon"]] for loc in localities])
        _, idx = self._grid_tree.query(coords, k=1)

        results = []
        for loc, cell_idx in zip(localities, idx):
            row = df.iloc[cell_idx]
            percentile = float((df["risk_score"] <= row.risk_score).mean() * 100)
            results.append(
                {
                    "name": loc["name"],
                    "lat": loc["lat"],
                    "lon": loc["lon"],
                    "cell_id": int(row.cell_id),
                    "risk_score": round(float(row.risk_score), 4),
                    "severity_band": row.severity_band,
                    "percentile_citywide": round(percentile, 1),
                    "population_exposed": int(row.population_exposed),
                }
            )
        results.sort(key=lambda r: r["risk_score"], reverse=True)
        return results

    @staticmethod
    def available_options() -> dict:
        """Model/severity-banding choices the frontend can offer, per the
        comparison in ML_Algorithm_Comparison_Paper.docx."""
        return {
            "models": MODEL_NAMES,
            "default_model": DEFAULT_MODEL,
            "band_methods": BAND_METHODS,
            "default_band_method": DEFAULT_BAND_METHOD,
        }

    def feature_importances(self, model_name: str = DEFAULT_MODEL) -> list[dict]:
        bundle = self.models.get(model_name, self.models[DEFAULT_MODEL])
        pairs = sorted(zip(bundle["feature_cols"], bundle["model"].feature_importances_), key=lambda x: -x[1])
        return [{"feature": f, "importance": round(float(i), 4)} for f, i in pairs]

    def risk_histogram(self, rainfall_mm: float, bins: int = 10, model_name: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD) -> list[dict]:
        df = self.score(rainfall_mm, model_name, band_method)
        counts, edges = np.histogram(df["risk_score"], bins=bins, range=(0, 1))
        return [
            {"bin_start": round(float(edges[i]), 2), "bin_end": round(float(edges[i + 1]), 2), "count": int(counts[i])}
            for i in range(len(counts))
        ]

    def risk_at_point(self, lat: float, lon: float, rainfall_mm: float, model_name: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD) -> dict:
        df = self.score(rainfall_mm, model_name, band_method)
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

    def affected_road_segments(self, rainfall_mm: float, model_name: str = DEFAULT_MODEL, band_method: str = DEFAULT_BAND_METHOD) -> dict:
        """Road segments (trunk/primary/secondary/tertiary, from OSM) whose
        nearest grid cell is yellow or red at this rainfall - i.e. roads
        actually near a modelled hotspot, not just any road in the city."""
        df = self.score(rainfall_mm, model_name, band_method)
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
