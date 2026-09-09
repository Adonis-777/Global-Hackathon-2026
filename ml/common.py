"""Shared helpers for the risk-grid pipeline: KML boundary parsing and the
Hyderabad grid definition, reused by build_grid.py and by the backend at
inference time (backend/app/risk_engine.py imports GRID_CSV_PATH etc.).
"""
import os
import xml.etree.ElementTree as ET

from shapely.geometry import Polygon
from shapely.ops import unary_union

KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_RAW = os.path.join(REPO_ROOT, "data", "raw")
DATA_PROCESSED = os.path.join(REPO_ROOT, "data", "processed")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

BOUNDARY_KML = os.path.join(DATA_RAW, "ghmc_boundary.kml")
DRAINAGE_GEOJSON = os.path.join(DATA_RAW, "osm_drainage_hyderabad.geojson")
INCIDENTS_CSV = os.path.join(DATA_PROCESSED, "ghmc_waterlogging_incidents_2019.csv")

GRID_CSV_PATH = os.path.join(DATA_PROCESSED, "grid_points.csv")
FEATURES_CSV_PATH = os.path.join(DATA_PROCESSED, "grid_features.csv")
RISK_GRID_GEOJSON_PATH = os.path.join(DATA_PROCESSED, "risk_grid.geojson")
MODEL_PATH = os.path.join(MODELS_DIR, "risk_model.joblib")  # kept for back-compat = random_forest
KMEANS_PATH = os.path.join(MODELS_DIR, "severity_kmeans.joblib")

# One regressor per algorithm compared in the research paper
# (ML_Algorithm_Comparison_Paper.docx) - selectable live via the backend's
# `model` query param instead of only ever training/serving Random Forest.
MODEL_NAMES = ["random_forest", "xgboost", "adaboost"]
MODEL_PATHS = {name: os.path.join(MODELS_DIR, f"risk_model_{name}.joblib") for name in MODEL_NAMES}

# Grid spacing in degrees. ~0.0045deg latitude is ~500m at Hyderabad's latitude.
GRID_SPACING_DEG = 0.0045

DEFAULT_RAINFALL_MM = 60.0  # synthetic test event used for the first training pass


def load_boundary_polygon():
    """Parse ghmc_boundary.kml and return the union of all Polygons as one geometry."""
    tree = ET.parse(BOUNDARY_KML)
    root = tree.getroot()
    polygons = []
    for poly_el in root.iter("{http://www.opengis.net/kml/2.2}Polygon"):
        coords_el = poly_el.find(".//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates", KML_NS)
        if coords_el is None or not coords_el.text:
            continue
        pts = []
        for triplet in coords_el.text.strip().split():
            lon, lat, *_ = triplet.split(",")
            pts.append((float(lon), float(lat)))
        if len(pts) >= 3:
            polygons.append(Polygon(pts))
    if not polygons:
        raise RuntimeError(f"No polygons found in {BOUNDARY_KML}")
    return unary_union(polygons)


def haversine_km(lat1, lon1, lat2, lon2):
    import numpy as np

    r = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))
