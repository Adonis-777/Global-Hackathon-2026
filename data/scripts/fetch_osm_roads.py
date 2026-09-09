"""
Pull the real OpenStreetMap arterial road network for the GHMC area via the
public Overpass API (no API key required). Used to render "affected road
segments" on the admin map - roads near a red/yellow risk cell.

Limited to trunk/primary/secondary/tertiary highways (not residential) to
keep the dataset a reasonable size for a hackathon demo map.

Run: python fetch_osm_roads.py
Output: ../raw/osm_roads_hyderabad.geojson
"""
import json
import os
import urllib.parse
import urllib.request

BBOX = (17.20, 78.24, 17.62, 78.66)  # south, west, north, east
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "raw", "osm_roads_hyderabad.geojson")

QUERY = f"""
[out:json][timeout:120];
way["highway"~"^(trunk|primary|secondary|tertiary)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
out geom;
"""


def overpass_to_geojson(osm_json):
    features = []
    for el in osm_json.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el:
            continue
        coords = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
        if len(coords) < 2:
            continue
        tags = el.get("tags", {})
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "osm_id": el.get("id"),
                    "highway": tags.get("highway"),
                    "name": tags.get("name"),
                },
                "geometry": {"type": "LineString", "coordinates": coords},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    print("Querying Overpass API for Hyderabad arterial roads ...")
    req = urllib.request.Request(
        OVERPASS_URL,
        data=urllib.parse.urlencode({"data": QUERY}).encode("utf-8"),
        headers={"User-Agent": "hydernowcast-hackathon/1.0"},
    )
    with urllib.request.urlopen(req, timeout=150) as resp:
        osm_json = json.loads(resp.read().decode("utf-8"))

    geojson = overpass_to_geojson(osm_json)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f)

    print(f"Saved {len(geojson['features'])} road segments -> {OUT_PATH}")


if __name__ == "__main__":
    main()
