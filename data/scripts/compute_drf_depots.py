"""
Derive Disaster Response Force depot locations from the real GHMC zone
boundaries (data/raw/ghmc_zones_2022.kml - 5 zones: East, South, North,
West, Central) by taking each zone's polygon centroid. Two vehicles are
stationed per zone (10 total), which is a placeholder fleet size - real
GHMC/HYDRAA disaster-response vehicle counts and station locations were
not available within the hackathon's data-sourcing window (see
data/DATA_SOURCES.md).

Run: python compute_drf_depots.py
Output: data/processed/drf_depots.json
"""
import json
import os
import xml.etree.ElementTree as ET

from shapely.geometry import Polygon
from shapely.ops import unary_union

KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}
ZONES_KML = os.path.join(os.path.dirname(__file__), "..", "raw", "ghmc_zones_2022.kml")
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "processed", "drf_depots.json")

VEHICLES_PER_ZONE = 2


def main():
    tree = ET.parse(ZONES_KML)
    root = tree.getroot()

    depots = []
    for placemark in root.iter("{http://www.opengis.net/kml/2.2}Placemark"):
        name_el = placemark.find("kml:name", KML_NS)
        if name_el is None:
            continue
        zone_name = name_el.text.strip().replace("Greater Hyderabad Municipal Corporation ", "")

        polygons = []
        for poly_el in placemark.iter("{http://www.opengis.net/kml/2.2}Polygon"):
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
            continue

        centroid = unary_union(polygons).centroid
        depots.append({"zone": zone_name, "lat": round(centroid.y, 6), "lon": round(centroid.x, 6)})

    vehicles = []
    for depot in depots:
        for i in range(1, VEHICLES_PER_ZONE + 1):
            vehicles.append(
                {
                    "vehicle_id": f"DRF-{depot['zone'].split()[0]}-{i}",
                    "zone": depot["zone"],
                    "home_lat": depot["lat"],
                    "home_lon": depot["lon"],
                }
            )

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(vehicles, f, indent=2)

    print(f"Computed {len(depots)} zone depots -> {len(vehicles)} vehicles -> {OUT_PATH}")


if __name__ == "__main__":
    main()
