"""
Step 2 of the risk pipeline: feature engineering per grid cell.

Real, data-backed features:
- dist_to_drain_km:    nearest OSM waterway/water-body vertex (data/raw/osm_drainage_hyderabad.geojson)
- dist_to_incident_km: nearest geocoded 2019 GHMC waterlogging-prone locality
                        (data/processed/ghmc_waterlogging_incidents_2019.csv)

Documented placeholders (no free downloadable source found within hackathon
time budget - see data/DATA_SOURCES.md for what a production swap needs):
- elevation_proxy:  synthetic, derived from distance-to-water (low-lying land
                     tends to sit near drainage/water features) plus smooth
                     low-frequency noise. Real source: SRTM 30m DEM via
                     OpenTopography API (needs a free API key).
- population_density: synthetic radial decay from Hyderabad's core plus the
                     Gachibowli/Madhapur IT-corridor secondary peak. Real
                     source: WorldPop raster, areal-interpolated per cell.
- rainfall_mm:       synthetic test event, constant across the grid for the
                     training pass (backend/app/risk_engine.py re-substitutes
                     this at request time for the "what-if rainfall" endpoint).

Run: python features.py
Output: data/processed/grid_features.csv
"""
import json

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

from common import (
    DEFAULT_RAINFALL_MM,
    DRAINAGE_GEOJSON,
    FEATURES_CSV_PATH,
    GRID_CSV_PATH,
    INCIDENTS_CSV,
    haversine_km,
)

CITY_CENTER = (17.3850, 78.4867)  # Abids / central Hyderabad
IT_CORRIDOR_CENTER = (17.4435, 78.3772)  # Gachibowli/Madhapur


def load_drainage_vertices():
    with open(DRAINAGE_GEOJSON, encoding="utf-8") as f:
        geojson = json.load(f)
    lats, lons = [], []
    for feat in geojson["features"]:
        for lon, lat in feat["geometry"]["coordinates"]:
            lats.append(lat)
            lons.append(lon)
    return np.array(lats), np.array(lons)


def nearest_distance_km(grid_lat, grid_lon, ref_lat, ref_lon):
    """KDTree nearest-neighbour in degree-space, then exact haversine on the match."""
    tree = cKDTree(np.column_stack([ref_lat, ref_lon]))
    _, idx = tree.query(np.column_stack([grid_lat, grid_lon]), k=1)
    return haversine_km(grid_lat, grid_lon, ref_lat[idx], ref_lon[idx])


def main():
    grid = pd.read_csv(GRID_CSV_PATH)

    drain_lat, drain_lon = load_drainage_vertices()
    grid["dist_to_drain_km"] = nearest_distance_km(grid["lat"].values, grid["lon"].values, drain_lat, drain_lon)

    incidents = pd.read_csv(INCIDENTS_CSV)
    grid["dist_to_incident_km"] = nearest_distance_km(
        grid["lat"].values, grid["lon"].values, incidents["lat"].values, incidents["lon"].values
    )

    # --- elevation_proxy (placeholder, see module docstring) ---
    rng = np.random.default_rng(42)  # deterministic so re-runs are reproducible
    low_freq_noise = (
        np.sin(grid["lat"].values * 40) * np.cos(grid["lon"].values * 40) * 8
        + rng.normal(0, 2, size=len(grid))
    )
    grid["elevation_proxy"] = 20 + grid["dist_to_drain_km"] * 6 + low_freq_noise
    grid["elevation_proxy"] = grid["elevation_proxy"].clip(lower=5)

    # --- population_density (placeholder, see module docstring) ---
    dist_center_km = haversine_km(grid["lat"].values, grid["lon"].values, *CITY_CENTER)
    dist_it_km = haversine_km(grid["lat"].values, grid["lon"].values, *IT_CORRIDOR_CENTER)
    grid["population_density"] = (
        28000 * np.exp(-dist_center_km / 5.0) + 16000 * np.exp(-dist_it_km / 4.0) + 1500
    ).round().astype(int)

    # --- rainfall (synthetic test event) ---
    grid["rainfall_mm"] = DEFAULT_RAINFALL_MM

    grid.to_csv(FEATURES_CSV_PATH, index=False)
    print(f"Computed features for {len(grid)} cells -> {FEATURES_CSV_PATH}")


if __name__ == "__main__":
    main()
