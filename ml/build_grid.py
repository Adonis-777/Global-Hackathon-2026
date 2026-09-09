"""
Step 1 of the risk pipeline: build a fine point grid covering the real GHMC
boundary (data/raw/ghmc_boundary.kml), at ~500m spacing.

Run: python build_grid.py
Output: data/processed/grid_points.csv (cell_id, lat, lon)
"""
import csv

from shapely.geometry import Point
from shapely.prepared import prep

from common import GRID_CSV_PATH, GRID_SPACING_DEG, load_boundary_polygon


def main():
    boundary = load_boundary_polygon()
    prepared = prep(boundary)
    minx, miny, maxx, maxy = boundary.bounds

    rows = []
    cell_id = 0
    lat = miny
    while lat <= maxy:
        lon = minx
        while lon <= maxx:
            if prepared.contains(Point(lon, lat)):
                rows.append({"cell_id": cell_id, "lat": round(lat, 6), "lon": round(lon, 6)})
                cell_id += 1
            lon += GRID_SPACING_DEG
        lat += GRID_SPACING_DEG

    with open(GRID_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["cell_id", "lat", "lon"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} grid cells inside the GHMC boundary -> {GRID_CSV_PATH}")


if __name__ == "__main__":
    main()
