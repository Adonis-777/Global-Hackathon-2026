"""
Step 4 of the risk pipeline: score every cell with the trained model at the
default rainfall event, cluster (risk, population_exposed) into green/yellow/
red severity bands with K-Means, and export the final risk grid as GeoJSON
for the backend/frontend to consume directly.

Run: python cluster_severity.py
Output: data/processed/risk_grid.geojson, ml/models/severity_kmeans.joblib
"""
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from common import FEATURES_CSV_PATH, KMEANS_PATH, MODEL_PATH, RISK_GRID_GEOJSON_PATH

BAND_NAMES = ["green", "yellow", "red"]  # low -> high risk, assigned after sorting cluster centers


def main():
    df = pd.read_csv(FEATURES_CSV_PATH)
    bundle = joblib.load(MODEL_PATH)
    model, feature_cols = bundle["model"], bundle["feature_cols"]

    df["risk_score"] = model.predict(df[feature_cols]).clip(0, 1)
    df["population_exposed"] = (df["population_density"] * 0.25).round().astype(int)  # ~0.25 km^2 per cell

    X = StandardScaler().fit_transform(df[["risk_score", "population_exposed"]])
    kmeans = KMeans(n_clusters=3, random_state=7, n_init=10)
    df["cluster"] = kmeans.fit_predict(X)

    # Order clusters by mean risk_score so band labels are consistent (low->high).
    cluster_order = df.groupby("cluster")["risk_score"].mean().sort_values().index.tolist()
    band_map = {cluster_id: BAND_NAMES[i] for i, cluster_id in enumerate(cluster_order)}
    df["severity_band"] = df["cluster"].map(band_map)

    joblib.dump(kmeans, KMEANS_PATH)

    features = []
    for _, row in df.iterrows():
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [row["lon"], row["lat"]]},
                "properties": {
                    "cell_id": int(row["cell_id"]),
                    "risk_score": round(float(row["risk_score"]), 4),
                    "severity_band": row["severity_band"],
                    "population_exposed": int(row["population_exposed"]),
                    "dist_to_drain_km": round(float(row["dist_to_drain_km"]), 3),
                    "dist_to_incident_km": round(float(row["dist_to_incident_km"]), 3),
                    "rainfall_mm": float(row["rainfall_mm"]),
                },
            }
        )

    geojson = {"type": "FeatureCollection", "features": features}
    with open(RISK_GRID_GEOJSON_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f)

    counts = df["severity_band"].value_counts().to_dict()
    print(f"Severity band counts: {counts}")
    print(f"Saved risk grid -> {RISK_GRID_GEOJSON_PATH}")


if __name__ == "__main__":
    main()
