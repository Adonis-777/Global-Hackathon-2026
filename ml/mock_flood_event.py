"""
Generates a mock "ground truth" outcome for a specific synthetic 3-day
monsoon event, independent of the model's own training formula, so the
model can be genuinely tested against it rather than checked against
itself (see ml/train_risk_model.py's heuristic label - testing a model
against the exact formula it was trained on would be circular).

The rainfall curve mirrors backend/risk_engine.py's rainfall_forecast()
(same three burst events) so the mock event matches what the live 3-day
forecast simulation plays through - kept as a separate, documented copy
rather than a shared import because the backend is deliberately
self-contained from the ml/ package (see backend/risk_engine.py's
module docstring).

Ground truth rule: deliberately a different FUNCTIONAL FORM than the
model's training heuristic (a threshold/OR rule here vs. a smooth
weighted sum there), using a different random seed, so agreement between
the model's prediction and this outcome reflects the model having learned
a real, generalizable relationship from the features - not memorizing the
label-generating formula. It is still a synthetic/mock outcome, not a
real historical flood record (none is available yet - see
data/DATA_SOURCES.md) - treat the resulting accuracy numbers as evidence
the model behaves sensibly, not as validated real-world performance.

Run: python mock_flood_event.py
Output: data/processed/mock_flood_event_ground_truth.csv
        data/processed/mock_flood_event_meta.json
"""
import json

import numpy as np
import pandas as pd

from common import DATA_PROCESSED, FEATURES_CSV_PATH

GROUND_TRUTH_PATH = f"{DATA_PROCESSED}/mock_flood_event_ground_truth.csv"
META_PATH = f"{DATA_PROCESSED}/mock_flood_event_meta.json"

# Same three rain bursts as backend/risk_engine.py's rainfall_forecast() -
# keep in sync if that curve ever changes.
BURSTS = [(14, 3.5, 40), (40, 4.0, 120), (58, 3.0, 65)]  # (center_hour, width_hours, peak_mm)
DAYS = 3
REFERENCE_MAX_CUMULATIVE_MM = 6200.0  # normalizes the abstract 3-day "exposure index" to 0-1 - not a literal forecast total

GROUND_TRUTH_SEED = 99  # deliberately different from train_risk_model.py's seed (7)


def rainfall_curve(days=DAYS):
    hours = np.arange(days * 24)
    rainfall = np.full(len(hours), 8.0)
    for center, width, peak in BURSTS:
        rainfall += peak * np.exp(-((hours - center) ** 2) / (2 * width**2))
    return hours, np.clip(rainfall, 5, 160)


def main():
    hours, rainfall = rainfall_curve()
    cumulative_mm = float(rainfall.sum())
    exposure_index = min(cumulative_mm / REFERENCE_MAX_CUMULATIVE_MM, 1.0)

    day3_hours = (hours >= 48) & (hours < 72)
    day3_peak_hour = int(hours[day3_hours][np.argmax(rainfall[day3_hours])])
    day3_peak_mm = float(rainfall[day3_peak_hour])

    df = pd.read_csv(FEATURES_CSV_PATH)
    rng = np.random.default_rng(GROUND_TRUTH_SEED)

    # Threshold/OR rule (distinct form from the model's weighted-sum training
    # label) - a cell "actually" floods if EITHER its drainage proximity,
    # historical-incident proximity, or low elevation crosses a threshold
    # that scales with how much rain the 3-day event has dumped so far.
    would_flood = (
        ((df["dist_to_drain_km"] < 0.6) & (exposure_index > 0.55))
        | ((df["dist_to_incident_km"] < 1.0) & (exposure_index > 0.40))
        | ((df["elevation_proxy"] < 15) & (exposure_index > 0.50))
    )

    # Real-world unpredictability: some at-risk cells don't flood (drainage
    # coped after all), some low-risk cells flood anyway (unmodelled local
    # factors - a blocked drain, a construction site). Keeps the accuracy
    # test honest/non-trivial instead of a rule the model could match 100%.
    drainage_saved_it = rng.random(len(df)) < 0.08
    unmodelled_flood = rng.random(len(df)) < 0.03
    actual_flooded = np.where(would_flood, ~drainage_saved_it, unmodelled_flood)

    out = df[["cell_id", "lat", "lon", "dist_to_drain_km", "dist_to_incident_km", "elevation_proxy"]].copy()
    out["actual_flooded"] = actual_flooded.astype(int)
    out.to_csv(GROUND_TRUTH_PATH, index=False)

    meta = {
        "event_name": "Mock 3-day monsoon test event",
        "days": DAYS,
        "cumulative_rainfall_mm": round(cumulative_mm, 1),
        "exposure_index": round(exposure_index, 4),
        "day3_peak_hour": day3_peak_hour,
        "day3_peak_rainfall_mm": day3_peak_mm,
        "ground_truth_seed": GROUND_TRUTH_SEED,
        "actual_flooded_count": int(actual_flooded.sum()),
        "total_cells": len(df),
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"Mock event: {meta['cumulative_rainfall_mm']}mm cumulative (exposure index {meta['exposure_index']})")
    print(f"Day 3 peak: hour {day3_peak_hour}, {day3_peak_mm}mm")
    print(f"Actually flooded (mock ground truth): {meta['actual_flooded_count']} / {meta['total_cells']} cells")
    print(f"Saved -> {GROUND_TRUTH_PATH}")
    print(f"Saved -> {META_PATH}")


if __name__ == "__main__":
    main()
