"""
Pull the real OpenStreetMap drainage/waterway network for the GHMC area via
the public Overpass API (no API key required). This is the fallback layer
called out in README.md for "distance-to-nearest-drain" since GHMC itself
does not publish a downloadable stormwater-drain shapefile.

Bounding box covers the Greater Hyderabad Municipal Corporation limits
(south, west, north, east) with a small buffer.

Run: python fetch_osm_drainage.py
Output: ../raw/osm_drainage_hyderabad.geojson
"""
import json
import os
import urllib.parse
import urllib.request

BBOX = (17.20, 78.24, 17.62, 78.66)  # south, west, north, east
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "raw", "osm_drainage_hyderabad.geojson")

QUERY = f"""
[out:json][timeout:120];
(
  way["waterway"~"^(drain|canal|stream|ditch|river)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["natural"="water"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  relation["natural"="water"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out geom;
"""


def overpass_to_geojson(osm_json):
    features = []
    for el in osm_json.get("elements", []):
        if el.get("type") not in ("way", "relation") or "geometry" not in el:
            # relations from `out geom` don't include a flat geometry; skip those,
            # ways always do.
            if el.get("type") == "way" and "geometry" in el:
                pass
            else:
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
                    "osm_type": el.get("type"),
                    "waterway": tags.get("waterway"),
                    "natural": tags.get("natural"),
                    "name": tags.get("name"),
                },
                "geometry": {"type": "LineString", "coordinates": coords},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    print("Querying Overpass API for Hyderabad waterways/drains ...")
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

    print(f"Saved {len(geojson['features'])} drainage/water features -> {OUT_PATH}")


if __name__ == "__main__":
    main()
