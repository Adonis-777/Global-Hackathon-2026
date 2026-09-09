"""Run the full risk-grid pipeline end to end: grid -> features -> train -> cluster.

Run: python run_pipeline.py
"""
import build_grid
import cluster_severity
import features
import train_risk_model


def main():
    build_grid.main()
    features.main()
    train_risk_model.main()
    cluster_severity.main()


if __name__ == "__main__":
    main()
