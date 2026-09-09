"""
Step 3 of the risk pipeline: train a Random Forest to predict per-cell
flood-risk probability (0-1).

IMPORTANT / honest limitation: GHMC has not published historical per-cell
flood outcomes (see data/DATA_SOURCES.md), so there is no ground-truth label
to train against. `risk_label` below is a heuristic composite built from the
real distance-to-drain and distance-to-historical-incident features plus the
elevation/rainfall placeholders, with noise added so the model has to
actually generalize rather than memorize a formula. This demonstrates the
intended pipeline shape (features -> trained model -> feature importances
-> per-cell probability) rather than a validated predictive claim. Swapping
in real historical rainfall-event outcomes (once available) as the label is
the one change needed to make this a genuine predictive model.

Run: python train_risk_model.py
Output: ml/models/risk_model.joblib, prints feature importances + held-out R^2
"""
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score
from sklearn.model_selection import train_test_split

from common import FEATURES_CSV_PATH, MODEL_PATH

FEATURE_COLS = ["dist_to_drain_km", "dist_to_incident_km", "elevation_proxy", "rainfall_mm"]


def make_heuristic_label(df, rng):
    drain_risk = np.exp(-df["dist_to_drain_km"] / 0.5)
    incident_risk = np.exp(-df["dist_to_incident_km"] / 1.0)
    elevation_risk = 1.0 / (1.0 + df["elevation_proxy"] / 20.0)
    rainfall_risk = (df["rainfall_mm"] / 150.0).clip(upper=1.0)

    label = 0.35 * drain_risk + 0.35 * incident_risk + 0.15 * elevation_risk + 0.15 * rainfall_risk
    label += rng.normal(0, 0.05, size=len(df))
    return label.clip(0, 1)


RAINFALL_SCENARIOS_MM = [10, 25, 40, 60, 80, 100, 125, 150]


def expand_with_rainfall_scenarios(base_df):
    """Cross-join every cell with several rainfall levels so the model
    actually sees rainfall vary and can learn its effect (a single constant
    rainfall value during training gives it zero feature importance)."""
    static_cols = ["dist_to_drain_km", "dist_to_incident_km", "elevation_proxy"]
    frames = []
    for mm in RAINFALL_SCENARIOS_MM:
        chunk = base_df[static_cols].copy()
        chunk["rainfall_mm"] = mm
        frames.append(chunk)
    return pd.concat(frames, ignore_index=True)


def main():
    base_df = pd.read_csv(FEATURES_CSV_PATH)
    df = expand_with_rainfall_scenarios(base_df)
    rng = np.random.default_rng(7)
    df["risk_label"] = make_heuristic_label(df, rng)

    X = df[FEATURE_COLS]
    y = df["risk_label"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=7)

    model = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=7, n_jobs=-1)
    model.fit(X_train, y_train)

    r2 = r2_score(y_test, model.predict(X_test))
    print(f"Held-out R^2 vs heuristic label: {r2:.3f}")
    print("Feature importances:")
    for col, imp in sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: -x[1]):
        print(f"  {col}: {imp:.3f}")

    joblib.dump({"model": model, "feature_cols": FEATURE_COLS}, MODEL_PATH)
    print(f"Saved model -> {MODEL_PATH}")


if __name__ == "__main__":
    main()
