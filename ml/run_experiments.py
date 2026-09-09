"""
Algorithm-comparison experiments for the research paper:

  Task A - Waterlogging prediction (binary classification): given
  terrain/rainfall/drainage/historical-incident features for a location,
  predict whether it will waterlog. Compared: Random Forest, XGBoost,
  AdaBoost.

  Task B - Severity ranking (location clustering into green/yellow/red by
  risk + population exposed). Compared: K-Means (unsupervised, the
  production approach), KNN (supervised classifier trained on the K-Means
  bands, for fast inference on new points), and a Hybrid K-Means+KNN
  (K-Means sets the bands, KNN smooths each point's band using its spatial
  neighbours' majority vote - a simple, explainable hybrid).

Ground truth caveat (see data/DATA_SOURCES.md): GHMC has not published
historical per-cell flood outcomes, so Task A's label and Task B's
K-Means bands are both built from the same documented heuristic used by
the production model (ml/train_risk_model.py), not independent real-world
ground truth. Metrics below measure how well each algorithm recovers that
heuristic signal from the input features - i.e. algorithm suitability for
this feature set and problem shape, not validated real-world accuracy.

Run: python run_experiments.py
Output: data/processed/ml_experiment_results.json (feeds generate_paper.py)
"""
import json
import time

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import AdaBoostClassifier, RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    davies_bouldin_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    silhouette_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from common import DATA_PROCESSED

UNIFIED_CSV = f"{DATA_PROCESSED}/unified_ml_dataset.csv"
RESULTS_PATH = f"{DATA_PROCESSED}/ml_experiment_results.json"

TASK_A_FEATURES = ["terrain_elevation_m", "rainfall_cm", "drainage_distance_km", "dist_to_incident_km"]
RANDOM_STATE = 7


def task_a_classification(df: pd.DataFrame) -> dict:
    X = df[TASK_A_FEATURES]
    y = df["waterlog_label"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y)

    models = {
        "Random Forest": RandomForestClassifier(n_estimators=200, max_depth=8, random_state=RANDOM_STATE, n_jobs=-1),
        "XGBoost": XGBClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.1, random_state=RANDOM_STATE, eval_metric="logloss"
        ),
        "AdaBoost": AdaBoostClassifier(n_estimators=200, random_state=RANDOM_STATE),
    }

    results = {}
    for name, model in models.items():
        start = time.perf_counter()
        model.fit(X_train, y_train)
        train_seconds = time.perf_counter() - start

        pred = model.predict(X_test)
        proba = model.predict_proba(X_test)[:, 1]

        importances = getattr(model, "feature_importances_", None)
        results[name] = {
            "accuracy": round(float(accuracy_score(y_test, pred)), 4),
            "precision": round(float(precision_score(y_test, pred)), 4),
            "recall": round(float(recall_score(y_test, pred)), 4),
            "f1_score": round(float(f1_score(y_test, pred)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, proba)), 4),
            "train_seconds": round(train_seconds, 3),
            "feature_importances": (
                {f: round(float(i), 4) for f, i in zip(TASK_A_FEATURES, importances)} if importances is not None else None
            ),
        }
    results["_meta"] = {
        "n_train": len(X_train),
        "n_test": len(X_test),
        "positive_rate_test": round(float(y_test.mean()), 4),
        "features": TASK_A_FEATURES,
    }
    return results


def task_b_severity_ranking(df: pd.DataFrame) -> dict:
    # One rainfall scenario at a time for ranking (severity ranking is a
    # per-event operation, matching how the production admin dashboard uses it).
    scenario = df[df["rainfall_mm"] == 60].copy()
    X = scenario[["risk_probability", "population_exposed"]]
    X_scaled = StandardScaler().fit_transform(X)

    start = time.perf_counter()
    kmeans = KMeans(n_clusters=3, random_state=RANDOM_STATE, n_init=10)
    kmeans_labels = kmeans.fit_predict(X_scaled)
    kmeans_seconds = time.perf_counter() - start

    # Order clusters by mean risk so band names are meaningful (0=green low risk -> 2=red high risk)
    order = pd.Series(scenario["risk_probability"].values).groupby(kmeans_labels).mean().sort_values().index.tolist()
    band_map = {cluster: rank for rank, cluster in enumerate(order)}
    band_labels = np.array([band_map[c] for c in kmeans_labels])

    kmeans_metrics = {
        "silhouette_score": round(float(silhouette_score(X_scaled, kmeans_labels)), 4),
        "davies_bouldin_score": round(float(davies_bouldin_score(X_scaled, kmeans_labels)), 4),
        "train_seconds": round(kmeans_seconds, 4),
        "cluster_sizes": {str(b): int((band_labels == b).sum()) for b in sorted(set(band_labels))},
    }

    # KNN: supervised classifier trained to reproduce the K-Means bands, so
    # a new point's band can be predicted without re-running K-Means.
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, band_labels, test_size=0.2, random_state=RANDOM_STATE, stratify=band_labels
    )
    start = time.perf_counter()
    knn = KNeighborsClassifier(n_neighbors=7)
    knn.fit(X_train, y_train)
    knn_seconds = time.perf_counter() - start
    knn_pred = knn.predict(X_test)
    knn_metrics = {
        "accuracy_vs_kmeans_bands": round(float(accuracy_score(y_test, knn_pred)), 4),
        "f1_macro_vs_kmeans_bands": round(float(f1_score(y_test, knn_pred, average="macro")), 4),
        "train_seconds": round(knn_seconds, 4),
    }

    # Hybrid: K-Means sets the band, then each point's band is smoothed by
    # a majority vote among its k geographic neighbours (catches cells the
    # unsupervised split placed inconsistently vs. their surroundings).
    coords = scenario[["lat", "lon"]].values
    start = time.perf_counter()
    geo_knn = KNeighborsClassifier(n_neighbors=5)
    geo_knn.fit(coords, band_labels)
    neighbour_idx = geo_knn.kneighbors(coords, return_distance=False)
    hybrid_labels = np.array([np.bincount(band_labels[idx]).argmax() for idx in neighbour_idx])
    hybrid_seconds = time.perf_counter() - start
    changed = int((hybrid_labels != band_labels).sum())
    hybrid_metrics = {
        "silhouette_score": round(float(silhouette_score(X_scaled, hybrid_labels)), 4),
        "cells_reassigned_by_smoothing": changed,
        "pct_reassigned": round(changed / len(band_labels) * 100, 2),
        "train_seconds": round(hybrid_seconds, 4),
    }

    return {
        "K-Means": kmeans_metrics,
        "KNN": knn_metrics,
        "Hybrid (K-Means + spatial KNN smoothing)": hybrid_metrics,
        "_meta": {"n_cells": len(scenario), "rainfall_scenario_mm": 60},
    }


def main():
    df = pd.read_csv(UNIFIED_CSV)
    results = {
        "task_a_waterlog_prediction": task_a_classification(df),
        "task_b_severity_ranking": task_b_severity_ranking(df),
    }
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("=== Task A: Waterlogging prediction (classification) ===")
    for name, m in results["task_a_waterlog_prediction"].items():
        if name == "_meta":
            continue
        print(f"{name:15s} acc={m['accuracy']:.3f} f1={m['f1_score']:.3f} roc_auc={m['roc_auc']:.3f} train={m['train_seconds']}s")

    print("\n=== Task B: Severity ranking ===")
    print("K-Means:", results["task_b_severity_ranking"]["K-Means"])
    print("KNN:", results["task_b_severity_ranking"]["KNN"])
    print("Hybrid:", results["task_b_severity_ranking"]["Hybrid (K-Means + spatial KNN smoothing)"])

    print(f"\nSaved -> {RESULTS_PATH}")


if __name__ == "__main__":
    main()
