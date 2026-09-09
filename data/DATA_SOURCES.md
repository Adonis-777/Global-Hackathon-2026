# Data sources

## Real data (downloaded via `data/scripts/`)

| File | Source | Fetched via |
|---|---|---|
| `raw/ghmc_boundary.kml`, `raw/ghmc_wards_2022.kml`, `raw/ghmc_zones_2022.kml` | OpenCity CKAN portal (data.opencity.in), GHMC admin boundaries, 2022 | `scripts/fetch_opencity_kml.py` |
| `raw/hyderabad_water_census_2023.kml` | Dept. of Water Resources, River Development & Ganga Rejuvenation - water body census conducted 2018-19, released 2023 | `scripts/fetch_opencity_kml.py` |
| `raw/osm_drainage_hyderabad.geojson` | OpenStreetMap, `waterway=drain/canal/stream/ditch/river` + `natural=water`, live Overpass API query | `scripts/fetch_osm_drainage.py` |
| `raw/ghmc_waterlogging_localities_2019.csv` → `processed/ghmc_waterlogging_incidents_2019.csv` | GHMC's 2019 published list of waterlogging-prone localities (graded A/B/C by severity), reported by The News Minute; geocoded to lat/lon via Nominatim | `scripts/geocode_incidents.py` |

**What GHMC does NOT publish**: a downloadable stormwater-drain network shapefile/API, or a geocoded list of the current 141 waterlogging hotspots (2025) with coordinates. GHMC has announced a GIS drone-survey drainage-mapping project (Deccan Chronicle, 2024) but no dataset from it is public yet. The OSM drainage layer and the geocoded 2019 locality list are the closest available real substitutes, and are what the ML pipeline actually uses.

## Documented placeholders (used by `ml/features.py`, pending real data)

| Feature | Current approach | Real source to swap in |
|---|---|---|
| `elevation_proxy` | Synthetic: derived from distance-to-water (low ground tends to sit near drainage) plus smooth noise | SRTM 30m DEM via OpenTopography API (needs a free API key) or Bhuvan |
| `population_density` | Synthetic: radial decay from city center + IT-corridor secondary peak | WorldPop raster or Census 2011 ward data, areal-interpolated per grid cell |
| `rainfall_mm` | Synthetic test event(s), 10-150mm scenarios used during training | IMD historical rainfall data |

These are called out explicitly in code comments (`ml/features.py`, `ml/train_risk_model.py`) so judges/teammates can see exactly what's real vs. simplified, and what a production version would need.
