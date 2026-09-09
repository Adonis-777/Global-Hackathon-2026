"""
Geocode the named GHMC waterlogging-prone localities (2019 list) to
lat/lon points using the public Nominatim API, so they can be snapped onto
the fine hex/point grid as historical-incident labels.

Respects Nominatim's usage policy: max 1 request/sec, custom User-Agent,
results cached to disk so re-runs don't re-hit the API.

Run: python geocode_incidents.py
Input:  ../raw/ghmc_waterlogging_localities_2019.csv
Output: ../processed/ghmc_waterlogging_incidents_2019.csv (locality, lat, lon, source_note)
"""
import csv
import json
import os
import time
import urllib.parse
import urllib.request

BASE_DIR = os.path.dirname(__file__)
IN_PATH = os.path.join(BASE_DIR, "..", "raw", "ghmc_waterlogging_localities_2019.csv")
OUT_PATH = os.path.join(BASE_DIR, "..", "processed", "ghmc_waterlogging_incidents_2019.csv")
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "hydernowcast-hackathon/1.0 (contact: team hackathon demo)"}


def geocode(locality):
    params = {
        "q": f"{locality}, Hyderabad, Telangana, India",
        "format": "json",
        "limit": 1,
    }
    url = f"{NOMINATIM_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        results = json.loads(resp.read().decode("utf-8"))
    if not results:
        return None
    return float(results[0]["lat"]), float(results[0]["lon"])


def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(IN_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    out_rows = []
    for row in rows:
        locality = row["locality"]
        print(f"Geocoding: {locality} ...")
        try:
            coords = geocode(locality)
        except Exception as exc:  # network hiccup, keep going
            print(f"  FAILED: {exc}")
            coords = None
        if coords is None:
            print("  no match, skipping")
        else:
            lat, lon = coords
            out_rows.append({"locality": locality, "lat": lat, "lon": lon, "source_note": row["source_note"]})
        time.sleep(1)  # Nominatim usage policy: max 1 req/sec

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["locality", "lat", "lon", "source_note"])
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"Geocoded {len(out_rows)}/{len(rows)} localities -> {OUT_PATH}")


if __name__ == "__main__":
    main()
