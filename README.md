# Urban Waterlogging Nowcast — Hyderabad

A monsoon decision-support system that predicts *where* waterlogging will happen, ranks those locations by severity and people affected, mobilizes disaster-response teams automatically, and gives citizens a live, location-aware way to see their own risk and get out of it — before the water rises, not after.

## Problem

Hyderabad floods in the same handful of low-lying, poorly-drained pockets every monsoon, but response is reactive: alerts go out after water is already on the road, mobilization isn't prioritized by who's actually at risk, and citizens have no way to know their own street's risk in the next few hours. This project turns rainfall + terrain + drainage + population data into a live risk map, an automated disaster-response pipeline, and a citizen-facing early-warning app — so both the city and individual residents can act *before* the water rises instead of after.

## Current status

Everything below is built and working end-to-end, not a mockup:

**Data & ML**
- Real GHMC administrative boundary/zones/wards, real GHMC 2019 waterlogging-locality list (geocoded), real OSM drainage network and arterial road network, real water-body census. Documented placeholders (terrain, population, rainfall) pending official data access — see [`data/DATA_SOURCES.md`](data/DATA_SOURCES.md).
- Three ML algorithms trained and live at once (Random Forest, XGBoost, AdaBoost) — switchable per-request via the API, all three loaded in memory so switching is instant.
- Three severity-banding methods, also switchable live — percentile ranking (production default), K-Means clustering, and a K-Means + spatial-KNN-smoothing hybrid.
- A written research comparison of all six brief-specified algorithms (Random Forest/XGBoost/AdaBoost for prediction; K-Means/KNN/hybrid for ranking), trained and evaluated in `ml/run_experiments.py`, written up as `ML_Algorithm_Comparison_Paper.docx` (kept outside this repo, as a standalone editable document).
- A second, **non-circular** validation: a synthetic 3-day mock flood event with its own independently-generated ground truth, used to measure real precision/recall/DRF-dispatch accuracy per model — see [Mock 3-day event validation](#mock-3-day-event-validation).

**Admin PWA (disaster-response command center)**
- 2D heatmap + click-to-drill-down **3D terrain view** of any clicked region, real Hyderabad scale, heat-colored surface.
- Automated, model-driven DRF (Disaster Response Force) mobilization — a 10-vehicle fleet auto-dispatches to the highest-priority hotspots with no admin click required, computes a real ETA, and auto-returns to base when its job is done.
- A live, playable 1–3 day rainfall forecast simulation — press Play and watch the model re-score the city and the fleet mobilize/free up in real time.
- Human-in-the-loop severity overrides, feature-importance explainability, real GHMC-locality risk lookup, affected-road-segment view.
- Restructured into a 4-tab dashboard (Overview & Map / Fleet & Mobilization / Risk Model & Prone Areas / Forecast Simulation) so authorities see one concern at a time instead of one long scrolling page.

**Citizen PWA (early warning for residents)**
- **Real GPS** location (with a graceful demo-location fallback if denied/unsupported) drives every risk lookup — not a hardcoded point.
- **Live rainfall feed**: a continuously-updating rainfall reading (replaying the same synthetic forecast curve the admin simulation uses), charted, and **persisted on-device** so recent history survives a reload.
- **Next precautionary steps**: severity-specific actionable advice (evacuate now / prepare a kit / stay aware), not generic text.
- **Quickest route to safety**: when a citizen is in a red zone, the app finds the nearest real main road (from OSM) sitting in a yellow/green zone and hands off turn-by-turn navigation to the device's own maps app.
- Side-panel layout (map fills the view, status/route/precautions live in a scrollable sidebar, emergency helpline always pinned in view) instead of a page the user has to scroll through top-to-bottom.

## Architecture — how the pieces fit together

```
data/raw, data/scripts  →  ml/  (grid, features, training, clustering, the mock event)  →  ml/models/*.joblib, data/processed/*
                                                                                                     │
                                                                                                     ▼
                                                                                   backend/ (FastAPI + RiskEngine, in-memory)
                                                                                                     │
                                                                     ┌───────────────────────────────┴───────────────────────────────┐
                                                                     ▼                                                                 ▼
                                                        frontend/admin-pwa                                                frontend/citizen-pwa
                                                        (command center for GHMC/DRF)                                    (early warning for residents)
```

The `ml/` pipeline is offline: it's run once (or whenever the data/features change) to produce the trained model files and processed CSVs. The backend then **does not depend on `ml/` at runtime** — `backend/risk_engine.py` is deliberately self-contained, reading only the pipeline's output files (`data/processed/*`, `ml/models/*.joblib`) so the API can start without the ML dependencies (shapely, python-docx, etc.) that only the offline pipeline needs. Both PWAs are independent Vite apps talking to the same backend over plain REST — there's no shared frontend code, so either app can be deployed, restarted, or worked on by a different person without touching the other.

## Repo structure

```
data/
  raw/            real+placeholder source data (GHMC boundaries, OSM drainage/roads, water census, ...)
  processed/      pipeline outputs (grid, features, unified ML dataset, risk grid, DRF depots, mock event + validation)
  scripts/        one-off fetch/geocode scripts for the raw/ inputs
  DATA_SOURCES.md what's real vs. placeholder, and why
ml/
  common.py                             shared paths/constants (grid spacing, model paths, haversine)
  build_grid.py, features.py            grid + feature engineering
  train_risk_model.py                   trains Random Forest / XGBoost / AdaBoost
  cluster_severity.py, run_pipeline.py  offline pipeline (grid → features → train → cluster)
  build_unified_dataset.py, run_experiments.py, generate_paper.py   the algorithm-comparison paper
  mock_flood_event.py, validate_against_mock_event.py               non-circular mock-event ground truth + model accuracy check
backend/
  app.py            FastAPI routes (see API reference below)
  risk_engine.py    model loading, live scoring, severity banding, DRF fleet + auto-dispatch, forecast simulation, safe-road routing
  alerts.py         Twilio SMS/WhatsApp wrapper (dry-run without credentials)
frontend/
  admin-pwa/    React + Vite + TS + Tailwind — 4-tab command-center dashboard (map/terrain, fleet, model, forecast)
  citizen-pwa/  React + Vite + TS + Tailwind — GPS risk map, live rainfall, precautions, safe-route guidance
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Citizen PWA** | React + Vite + TypeScript, Tailwind CSS, `vite-plugin-pwa` | Installable, offline-capable, fast to build; a resident's own device does the GPS lookup and shows nearby risk + what to do about it |
| **Admin/Disaster-Response PWA** | Same stack, separate app & deploy | Kept as a distinct app (not a role toggle on the citizen app) so it can carry different data density and update cadence for response teams |
| **Map** | MapLibre GL JS (both apps) | Free/open-source vector maps for hotspot layers and location markers |
| **3D terrain (admin only)** | Plotly.js, `plotly.js-gl3d-dist` build only | The full `plotly.js` package force-installs a vulnerable bundled `maplibre-gl` via `react-plotly.js`; using only the gl3d-only distribution plus a small custom wrapper avoids that dependency entirely while still getting `surface`-trace 3D terrain |
| **Charts (both apps)** | Recharts | Severity-vs-population bars, feature importance, rainfall-forecast area charts, and the citizen app's live-rainfall sparkline |
| **Backend API** | FastAPI (Python) | Serves model inference, map/alert data, and the DRF fleet/simulation/safe-route endpoints to both PWAs |
| **Data serving** | Direct from `data/processed/` CSVs + `ml/models/*.joblib`, in-memory | Fast enough at this grid size (2,558 cells) that a database wasn't needed; PostGIS remains the natural next step if the grid grows or persistence across restarts is needed |
| **ML — risk scoring** | Random Forest, XGBoost, AdaBoost (scikit-learn, xgboost) — all three trained and served, selectable live | Compared head-to-head in `ML_Algorithm_Comparison_Paper.docx`; Random Forest is the production default for interpretability, XGBoost the fastest-training alternative |
| **ML — severity ranking** | Percentile ranking, K-Means, and K-Means+KNN hybrid — all three implemented, selectable live | Also compared in the paper; percentile is the production default, K-Means/hybrid available for a more natural-cluster view |
| **Citizen GPS** | Browser Geolocation API (`navigator.geolocation`) | Real device location drives every risk/route lookup; falls back to a real GHMC flood-prone locality (Malakpet) if denied or unsupported, with a manual retry |
| **Citizen live rainfall** | `localStorage`, client-side interval loop | No backend session/DB needed for a per-device rolling rainfall log; survives a page reload, private to that device |
| **Safe-route hand-off** | Google Maps deep link (`maps.google.com/maps/dir/?...`) | A real routing engine (OSRM + the road graph) is out of scope for a 24h hackathon; instead the app identifies *which* real road to head to and defers turn-by-turn navigation to the device's own maps app |
| **Alerts** | Twilio — SMS + WhatsApp **sandbox** | Trial account is sufficient for a hackathon demo; runs in dry-run (logged, not sent) until credentials are configured |
| **Deployment** | Not yet deployed — runs locally (`uvicorn` + two `vite` dev servers) | Docker Compose / Render / Vercel remain the planned next step for a hosted demo |

### Spatial resolution — fine grid over Hyderabad

Rather than ward-level (coarse, but easy), the risk model and map run on a **fine ~500m point grid** over the real GHMC administrative boundary (2,558 cells, `GRID_SPACING_DEG = 0.0045`). Population, only available at ward/census granularity, is **areal-interpolated** down into each grid cell so the severity-ranking step still has a population-exposed number per cell.

### Data sources

Full source-by-source documentation (what's real, what's a documented placeholder, and what a production swap needs) lives in [`data/DATA_SOURCES.md`](data/DATA_SOURCES.md). In short:

- **Real**: GHMC administrative boundary/zones/wards (OpenCity), 2019 GHMC waterlogging-prone locality list (geocoded via Nominatim), OSM drainage network and arterial roads (live Overpass API query), 2018-19 water-body census.
- **Documented placeholders**, pending official access: terrain/elevation (pending a real SRTM DEM via OpenTopography or Bhuvan), population density (pending WorldPop/Census areal interpolation), rainfall (synthetic test events and a synthetic 3-day forecast curve, pending IMD data).

## Methodology

**1. Data & feature engineering**
Fine point grid over the real GHMC boundary. Per cell: distance to nearest drain (real OSM data), distance to nearest historical waterlogging incident (real, geocoded), terrain/elevation and population (documented placeholders), and rainfall intensity for the scenario being scored.

**2. Risk model**
Random Forest, XGBoost, and AdaBoost are all trained on the same features (`ml/train_risk_model.py`) — trained across 8 rainfall scenarios (10–150mm) so the model actually learns rainfall's effect instead of seeing a constant — and loaded live by the backend; a `model` parameter picks which one scores a given request, defaulting to Random Forest. Feature importances per model are exposed for explainability.

**3. Severity ranking**
Three interchangeable banding methods (`band_method` parameter): percentile rank (bottom 50% green / next 30% yellow / top 20% red, the production default — chosen because a fixed absolute risk threshold left "red" nearly empty when the model's score range shifted with rainfall), K-Means clustering on (risk, population), and a hybrid that spatially smooths the K-Means bands via each cell's 5 nearest neighbours (avoids a single isolated red cell inside a green area). All three are benchmarked in `ML_Algorithm_Comparison_Paper.docx`.

**4. 2D & 3D map (Admin PWA)**
Color-coded hotspot heatmap layer spanning all of Hyderabad, filterable by severity band, plus affected road segments. Clicking any cell drills into a **3D terrain view** of that specific region (Plotly `surface` trace, real lattice reconstruction with bilinear supersampling for a smooth presentation-quality mesh, heat-colored by risk, vertically exaggerated so subtle elevation differences that explain *why* water pools are actually visible) — a toggle switches back to the 2D heatmap at any time. Human-in-the-loop: admins see the model's score *and* can manually override a cell's band.

**5. Automated DRF mobilization**
A 10-vehicle fleet (2 per real GHMC zone, stationed at zone centroids) auto-dispatches to the highest-priority uncovered red-severity cells the moment the model flags them — no admin click required, driven by risk × population. Each dispatch computes a real ETA (haversine distance ÷ an assumed urban emergency-vehicle speed) and an on-site duration scaled by severity; once that time elapses the vehicle automatically returns to base and becomes available again (its slot can't be re-selected while busy). Manual dispatch/recall remains available as an override.

**6. Live forecast simulation**
A synthetic 72-hour (3-day) monsoon rainfall forecast can be played back on the admin dashboard: at each simulated hour the model re-scores the city at that hour's rainfall and the DRF fleet automatically mobilizes/frees up in response, visibly, while the map/chart/queue stay in sync. A simulated clock (`sim_epoch`/`sim_now`) decouples this from real wall-clock time so "3 days" can play out in minutes.

**7. Non-circular validation against a mock flood event**
Because there's no historical per-cell flood outcome dataset for Hyderabad yet, the comparison paper's accuracy numbers are inherently measured against the model's own training heuristic. A second, independent test (`ml/mock_flood_event.py` + `ml/validate_against_mock_event.py`) generates ground truth from a *different* rule and random seed, so agreement reflects real generalization rather than memorizing a formula — see [Mock 3-day event validation](#mock-3-day-event-validation).

**8. Citizen GPS + live rainfall**
The citizen app requests the device's real location on load (`navigator.geolocation`), falling back to a real flood-prone demo locality if denied or unsupported. A live rainfall feed replays the same synthetic forecast curve as the admin simulation, one hour "arriving" every 6 real seconds and looping continuously, so the citizen's risk, alert, and safe-route all react to changing rainfall automatically rather than a fixed constant. Each reading is timestamped and kept in `localStorage` (capped to the last 60), so the recent rainfall history is actually stored and survives a reload.

**9. Next precautionary steps**
Severity-specific, Hyderabad-relevant advice (not a generic flood-safety blurb): red means evacuate now / cut power / call the helpline; yellow means prepare a kit / plan an alternate route; green means stay aware / report a blocked drain. Rendered from the same severity band already computed for the alert, so it's always consistent with what the map and status card show.

**10. Quickest route to safety**
When a citizen's cell is red, `RiskEngine.nearest_safe_road()` finds the closest point on a real OSM main road (trunk/primary/secondary/tertiary — the only classes in `data/raw/osm_roads_hyderabad.geojson`) whose surrounding grid cell is yellow or green, measured against the road's actual geometry (not just its midpoint, so a curving road's true closest point is used). The app shows the road's name, distance, and walk/drive ETA, then defers real turn-by-turn navigation to a Google Maps deep link — building a full routing engine (OSRM + the road graph) was judged out of scope for a 24-hour hackathon, but *identifying which real road to aim for* is exactly the piece a generic maps app can't do on its own, since it doesn't know which nearby roads are currently flood-safe.

**11. Alert prototype (Citizen PWA + Twilio)**
Threshold crossing at a citizen's location triggers a Twilio SMS/WhatsApp-style alert including a nearby lower-risk cell as a fallback suggestion (superseded by the road-specific safe-route card when the citizen is actually in a red zone). Runs in dry-run (logged, not sent) until Twilio credentials are configured.

## Admin PWA — a tour by tab

The dashboard is organized into 4 tabs so an authority looks at one concern at a time instead of scrolling one long page:

- **Overview & Map** — the 2D heatmap / 3D terrain toggle, click-to-inspect any cell (risk score, population exposed, current band, override controls), and the DRF panel for whichever cell is selected (dispatch a free vehicle with its ETA, or recall one already assigned).
- **Fleet & Mobilization** — severity-vs-population chart, the top hotspots list (mobilization-score ranked), and a live grid of all 10 DRF vehicles with their status; clicking a hotspot or a vehicle's assigned cell jumps back to Overview with that cell selected.
- **Risk Model & Prone Areas** — real GHMC 2019 waterlogging-prone localities scored live at the current rainfall/model/band-method (not just the abstract grid), next to a feature-importance chart explaining what the active model actually weighs.
- **Forecast Simulation** — the playable 72-hour rainfall curve with the live auto-dispatch log, plus the mock-event validation panel (per-model accuracy/precision/recall/DRF-dispatch numbers) with a "Jump to day-3 test event" button that scrubs the simulation straight to the validated moment.

A top bar (visible from every tab) holds 5 always-current stat cards (DRF deployed, test rainfall, red-severity cells, population at high risk, active model) plus the global rainfall/model/severity-method controls, so switching an algorithm or scrubbing rainfall updates every tab at once.

## Citizen PWA — a tour by feature

- **Header** — app identity plus the citizen's current location source (GPS or demo) with a one-tap "Use my location" retry if GPS was denied.
- **Map (left)** — full-height MapLibre heatmap of the whole city with a small legend, a red pin for the citizen's current position, and a green pin for wherever they should head (alternate low-risk area or, in a red zone, the specific safe road).
- **Sidebar (right)**, top to bottom:
  1. **Live rainfall** — current mm/hr, a live sparkline, and how many readings are stored on-device.
  2. **Risk status** — the citizen's current severity band, risk score, and distance from the nearest incident-history/drainage data point, with an alternate-area note when relevant.
  3. **Quickest route to safety** — only shown in a red zone; names a real road, its distance, and walk/drive ETA, with a button that opens the device's own turn-by-turn navigation.
  4. **Next precautionary steps** — the severity-specific action list.
  5. **Emergency helpline** — pinned to the bottom of the sidebar (not the page), so it's reachable without scrolling no matter how much else is on screen.

Every piece of this — the map markers, the status card, the route card, and the precautions — recomputes automatically whenever the live rainfall feed ticks or the citizen's GPS location changes; nothing needs a manual refresh.

## API reference

All routes are served by `backend/app.py`; `rainfall_mm`, `model` (`random_forest`/`xgboost`/`adaboost`), and `band_method` (`percentile`/`kmeans`/`hybrid`) are query params accepted by most read endpoints, defaulting to `60`, `random_forest`, and `percentile`.

| Route | Purpose |
|---|---|
| `GET /api/health` | Liveness check + cells-loaded count |
| `GET /api/model/options` | Available models/band-methods, for building selectors |
| `GET /api/risk-grid` | Full 2,558-cell scored GeoJSON (map layer) |
| `GET /api/hotspots` | Top-N cells by mobilization score (risk × population) |
| `GET /api/stats/severity-population` | Per-band cell count + population exposed |
| `GET /api/stats/risk-histogram` | Risk-score distribution |
| `GET /api/model/feature-importance` | What the active model weighs |
| `GET /api/risk-at-point` | Nearest cell's full detail for an arbitrary lat/lon |
| `GET /api/risk-at-localities` | Every real GHMC 2019 flood-prone locality, scored |
| `GET /api/localities` | The raw locality list (name + coordinates) |
| `GET /api/road-segments` | OSM road segments near a yellow/red cell |
| `GET`/`POST`/`DELETE /api/overrides` | List / set / clear a human-in-the-loop severity override |
| `GET /api/fleet` | All DRF vehicles' status (optionally ETA to a target point) |
| `POST`/`DELETE /api/mobilize` | Dispatch / recall a specific vehicle |
| `POST /api/auto-dispatch` | One-shot: send every free vehicle to the highest-priority uncovered hotspot |
| `GET /api/forecast` | The synthetic 72-hour rainfall curve |
| `POST /api/simulate/step` `/reset` `/stop` | Drive the live forecast simulation's clock |
| `GET /api/safe-route` | Nearest safe (yellow/green) real main road for a lat/lon — powers the citizen app's route-out card |
| `GET /api/mock-event-validation` | Precomputed per-model accuracy + DRF-dispatch results against the mock flood event |
| `POST /api/alerts/trigger` | Threshold-based Twilio alert (dry-run without credentials) + nearest lower-risk cell |

## Research & experiments

`ml/run_experiments.py` benchmarks all six algorithms named in the project brief on a unified dataset (`ml/build_unified_dataset.py`) combining every predictive factor. Results are written to `data/processed/ml_experiment_results.json` and assembled into a full paper (abstract, methodology, results tables, honest ground-truth-caveat discussion, references) by `ml/generate_paper.py`, saved as `ML_Algorithm_Comparison_Paper.docx` **outside** this repo (one directory up) so it stays a standalone, independently-editable document.

## Mock 3-day event validation

The comparison paper above measures each algorithm against the model's own training heuristic — useful for benchmarking the algorithms against each other, but circular as a test of real predictive skill, since the label being predicted and the label being trained on come from the same formula. To get a genuine, non-circular accuracy number, this project adds a second, independent test: a **mock 3-day monsoon event with its own synthetic ground truth**, generated by a different rule and a different random seed than anything the models were trained on.

**How the event is built** (`ml/mock_flood_event.py`)
- The same 72-hour, three-burst rainfall curve used by the live forecast simulation (`backend/risk_engine.py`'s `rainfall_forecast()`) is replayed, giving a cumulative 3-day rainfall total and a day-3 peak (in the current calibration: **2,618.9mm cumulative, peaking at 73.0mm at hour 58** — hour 58 falls in day 3, i.e. the "after 3 days" mark the DRF mobilization is checked against).
- That cumulative total is converted into a 0–1 **exposure index** (how "saturated" the 3-day event has made the city).
- A **ground-truth "did this cell actually flood?" label** is generated using a *threshold/OR rule* — a cell floods if its drainage proximity, incident-history proximity, **or** low elevation crosses a threshold that scales with the exposure index — using random seed `99`. This is a different functional form (threshold/OR) and a different seed than `ml/train_risk_model.py`'s training label (a smooth weighted sum, seed `7`), so a model that happened to fit the training formula gets no free pass here.
- Real-world noise is layered on top: 8% of "should have flooded" cells are randomly spared (drainage coped after all) and 3% of "should have been fine" cells flood anyway (an unmodelled local factor — a blocked drain, a construction site) — so the test isn't a rule the model could trivially match 100%.
- Result: **297 of 2,558 cells (11.6%)** are flagged as actually flooded — a realistic minority-class event, not an extreme everything-floods scenario.

**How the models are scored** (`ml/validate_against_mock_event.py`)
Each of the three trained models (Random Forest, XGBoost, AdaBoost) is asked to score every cell using **only the day-3 instantaneous rainfall reading (73.0mm)** — never the cumulative 3-day exposure the ground truth was built from — then thresholded into "predicted flooded" using the same top-20%-by-percentile rule the live "red" severity band uses. Predictions are compared against the mock ground truth with standard accuracy/precision/recall/F1, and a DRF dispatch check simulates sending the 10-vehicle fleet (by risk × population, same as `auto_dispatch()`) to the highest-priority predicted-red cells to see how many of those dispatches would have hit an actually-flooded cell, and what share of all real flooding a fleet that size can realistically reach.

**Results** (regenerate with `python ml/mock_flood_event.py && python ml/validate_against_mock_event.py`; saved to `data/processed/mock_event_validation_results.json`, served at `/api/mock-event-validation`, shown on the admin dashboard's Forecast tab):

| Model | Accuracy | Precision | Recall | F1 | DRF dispatch precision | Coverage of actual flooding |
|---|---|---|---|---|---|---|
| Random Forest | 79.5% | 28.1% | 48.8% | 0.357 | 90% (9/10) | 3.0% |
| XGBoost | 80.6% | 30.5% | 52.5% | 0.386 | 90% (9/10) | 3.0% |
| AdaBoost | 78.9% | 26.6% | 46.5% | 0.339 | 80% (8/10) | 2.7% |

Baseline flood rate in this event is 11.6%, so precision in the 27–31% range is **2.3–2.6x better than chance**, and recall near 50% means the model correctly flags roughly half of all cells that actually flood using only a single rainfall reading (no cumulative-exposure signal). DRF dispatch precision of 80–90% is the more actionable number for a response team: when the model tells the fleet to go somewhere, it is right 4 times out of 5 or better. Coverage of actual flooding is intentionally low (~3%) — it reflects an honest fleet-capacity limit, not a model failure: 10 vehicles cannot physically reach hundreds of at-risk cells simultaneously, which is itself a real, useful finding about the current fleet size versus a full-event's scope.

These numbers describe how the model behaves against one synthetic, non-circular test event — not validated real-world performance, since no historical per-cell flood outcome dataset exists yet for Hyderabad (see `data/DATA_SOURCES.md`). Swapping in a real historical rainfall-event outcome as the ground truth, once available, is the one change needed to turn this into a validated predictive claim.

## Honest limitations — what's real, what's a stand-in, and why

This project is built to be transparent about exactly which parts are production-ready and which are hackathon-scope stand-ins, so a judge or a future contributor can see precisely what to swap in:

- **Terrain, population, and rainfall are synthetic** (see [`data/DATA_SOURCES.md`](data/DATA_SOURCES.md)) because the real sources (SRTM/Bhuvan DEM, WorldPop/Census, IMD rainfall) either need paid/restricted API access or weren't reachable in the time available. Everything downstream (risk model, severity bands, mock event) is honest about this in code comments and this README rather than presenting synthetic numbers as measured ones.
- **No historical per-cell flood outcome dataset exists for Hyderabad**, so the risk model's training label is a documented heuristic, not a fitted ground truth — which is exactly why the [mock 3-day event validation](#mock-3-day-event-validation) exists as an independent, non-circular sanity check rather than relying on the heuristic-vs-itself comparison alone.
- **DRF fleet size (10 vehicles) is a deliberate assumption**, not a real GHMC dispatch capacity figure. The mock-event validation's ~3% coverage-of-actual-flooding number is a direct, honest consequence of that assumption, surfaced rather than hidden.
- **The safe-route feature identifies *which* road, not turn-by-turn directions** — building a real routing engine (OSRM + the full road graph, with live closures) was out of scope for 24 hours; the app instead does the one thing a generic maps app can't (know which nearby road is currently flood-safe) and hands off actual navigation to the device's own maps app.
- **Alerts run through Twilio's sandbox** and are dry-run (logged, not sent) unless credentials are configured — sufficient to demonstrate the flow without needing a paid account.
- **Not deployed** — everything runs locally via `uvicorn` + two `vite` dev servers; Docker Compose / a hosted backend + static frontend deploy remain the natural next step.

## Running this project

**1. ML pipeline** (grid → features → train all 3 models → cluster; produces what the API serves)
```
python -m venv .venv
.venv/Scripts/activate        # .venv/bin/activate on macOS/Linux
pip install -r ml/requirements.txt
python ml/run_pipeline.py
```

**2. Backend** (FastAPI — risk-grid/hotspots/stats/fleet/simulation/safe-route/alerts)
```
pip install -r backend/requirements.txt
cd backend && uvicorn app:app --reload --port 8000
```
Copy `backend/.env.example` to `backend/.env` and fill in Twilio credentials to send real SMS/WhatsApp alerts — alerts run in dry-run (logged, not sent) otherwise.

**3. Frontend** (two independent PWAs)
```
cd frontend/citizen-pwa && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
cd frontend/admin-pwa   && cp .env.example .env && npm install && npm run dev   # http://localhost:5174
```
The citizen app will prompt for location permission on load — allow it to see your real GPS-based risk, or deny it to see the built-in demo location (a real GHMC flood-prone locality).

**4. (Optional) Re-run the algorithm-comparison experiments / regenerate the paper**
```
python ml/build_unified_dataset.py
python ml/run_experiments.py
python ml/generate_paper.py     # writes ML_Algorithm_Comparison_Paper.docx one directory above this repo
```

**5. (Optional) Regenerate the mock 3-day event validation** (see [Mock 3-day event validation](#mock-3-day-event-validation))
```
python ml/mock_flood_event.py             # builds the synthetic event + independent ground truth
python ml/validate_against_mock_event.py  # scores all 3 models against it, writes data/processed/mock_event_validation_results.json
```
