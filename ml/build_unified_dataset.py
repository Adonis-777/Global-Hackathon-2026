"""
Builds the single unified CSV combining every factor used for waterlogging
prediction and severity ranking, as requested for the algorithm-comparison
paper:

  - Terrain           -> elevation_proxy   (placeholder pending Google Maps
                          3D terrain / real SRTM DEM extraction - see
                          data/DATA_SOURCES.md)
  - Rainfall (cm)      -> rainfall_cm       (synthetic test-event scenarios;
                          placeholder pending IMD meteorological data)
  - Drainage           -> dist_to_drain_km  (REAL - nearest OSM waterway/
                          drain vertex, data/raw/osm_drainage_hyderabad.geojson)
  - Historical incidents -> dist_to_incident_km (REAL - geocoded 2019 GHMC
                          waterlogging-prone localities)
  - Population exposed -> population_exposed (placeholder radial-decay
                          proxy - see data/DATA_SOURCES.md)
  - waterlog_label     -> binary target (1 = will waterlog) derived from
                          the same heuristic used to train the production
                          model (ml/train_risk_model.py) - there is no
                          published historical per-cell flood-outcome
                          ground truth to train against (see
                          data/DATA_SOURCES.md), so this heuristic is the
                          best available proxy label for a fair multi-
                          algorithm comparison.
  - risk_probability   -> continuous heuristic risk score (same formula)

Run: python build_unified_dataset.py
Output: data/processed/unified_ml_dataset.csv
"""
import numpy as np
import pandas as pd

from common import DATA_PROCESSED, FEATURES_CSV_PATH

OUT_PATH = f"{DATA_PROCESSED}/unified_ml_dataset.csv"
RAINFALL_SCENARIOS_MM = [10, 25, 40, 60, 80, 100, 125, 150]


def make_heuristic_risk(df, rng):
    drain_risk = np.exp(-df["dist_to_drain_km"] / 0.5)
    incident_risk = np.exp(-df["dist_to_incident_km"] / 1.0)
    elevation_risk = 1.0 / (1.0 + df["elevation_proxy"] / 20.0)
    rainfall_risk = (df["rainfall_mm"] / 150.0).clip(upper=1.0)
    risk = 0.35 * drain_risk + 0.35 * incident_risk + 0.15 * elevation_risk + 0.15 * rainfall_risk
    risk += rng.normal(0, 0.05, size=len(df))
    return risk.clip(0, 1)


def main():
    base = pd.read_csv(FEATURES_CSV_PATH)
    rng = np.random.default_rng(7)

    frames = []
    for mm in RAINFALL_SCENARIOS_MM:
        chunk = base[
            ["cell_id", "lat", "lon", "dist_to_drain_km", "dist_to_incident_km", "elevation_proxy", "population_density"]
        ].copy()
        chunk["rainfall_mm"] = mm
        frames.append(chunk)
    df = pd.concat(frames, ignore_index=True)

    df["risk_probability"] = make_heuristic_risk(df, rng).round(4)
    df["waterlog_label"] = (df["risk_probability"] >= 0.5).astype(int)
    df["population_exposed"] = (df["population_density"] * 0.25).round().astype(int)
    df["rainfall_cm"] = (df["rainfall_mm"] / 10).round(2)

    df = df.rename(columns={"elevation_proxy": "terrain_elevation_m", "dist_to_drain_km": "drainage_distance_km"})
    df = df[
        [
            "cell_id",
            "lat",
            "lon",
            "terrain_elevation_m",
            "rainfall_cm",
            "rainfall_mm",
            "drainage_distance_km",
            "dist_to_incident_km",
            "population_exposed",
            "risk_probability",
            "waterlog_label",
        ]
    ]

    df.to_csv(OUT_PATH, index=False)
    print(f"Unified dataset: {len(df)} rows ({len(base)} cells x {len(RAINFALL_SCENARIOS_MM)} rainfall scenarios)")
    print(f"Positive class (waterlog_label=1): {df['waterlog_label'].mean():.1%}")
    print(f"Saved -> {OUT_PATH}")


if __name__ == "__main__":
    main()
