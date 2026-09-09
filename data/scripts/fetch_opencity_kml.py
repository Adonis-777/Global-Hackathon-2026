"""
Download real GHMC/Telangana boundary and water-census GIS layers from the
OpenCity CKAN portal (data.opencity.in). No API key required.

Sources (verified via CKAN package_show API on 2026-09-09):
- Greater Hyderabad Wards Map - 2022 (KML)
- Greater Hyderabad Zones Map - 2022 (KML)
- Greater Hyderabad Municipal Corporation Boundary Map (KML)
- Hyderabad Water Census Map 2023 (KML) - Dept. of Water Resources, 2018-19 census, released 2023

Run: python fetch_opencity_kml.py
Output: ../raw/*.kml
"""
import os
import urllib.request

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "raw")

FILES = {
    "ghmc_wards_2022.kml": "https://data.opencity.in/dataset/15cb7d8d-eed1-4aad-8cd7-f281cbf4f94f/resource/14b033e3-3721-4149-8326-cc29420e062e/download/ghmc_wards.kml",
    "ghmc_zones_2022.kml": "https://data.opencity.in/dataset/15cb7d8d-eed1-4aad-8cd7-f281cbf4f94f/resource/ecaab873-4dd3-42db-9813-b9c28b45ca68/download/28fc477d-7725-4d57-8941-620f02a6a8dd.kml",
    "ghmc_boundary.kml": "https://data.opencity.in/dataset/15cb7d8d-eed1-4aad-8cd7-f281cbf4f94f/resource/bc818c3d-9c7c-4047-a451-ba463d9710b2/download/fc191d52-4b8a-4e2f-8fb8-0359746037d7.kml",
    "hyderabad_water_census_2023.kml": "https://data.opencity.in/dataset/037dc191-1419-4242-a6c1-0dcbfecae600/resource/4b7fe252-8d3c-4a1b-8f50-eccb3caf3269/download/e94a1948-f2a6-4661-9243-750e55616d3d.kml",
}


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    req_headers = {"User-Agent": "hydernowcast-hackathon/1.0 (educational GIS data pull)"}
    for filename, url in FILES.items():
        dest = os.path.join(RAW_DIR, filename)
        print(f"Fetching {filename} ...")
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=30) as resp, open(dest, "wb") as out:
            out.write(resp.read())
        print(f"  saved -> {dest}")


if __name__ == "__main__":
    main()
