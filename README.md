# Urban Waterlogging Nowcast — Hyderabad

A monsoon decision-support system that predicts *where* waterlogging will happen, ranks those locations by severity and people affected, and mobilizes disaster-response teams and citizen alerts — automatically, ahead of the water rising.

## Problem

Hyderabad floods in the same handful of low-lying, poorly-drained pockets every monsoon, but response is reactive: alerts go out after water is already on the road, and mobilization isn't prioritized by who's actually at risk. This project turns rainfall + terrain + drainage + population data into a live risk map and an automated response pipeline, so mobilization can happen *before* the water rises instead of after.

## Current status

Everything below is built and working end-to-end, not just planned:

- **Real data pipeline** — real GHMC administrative boundary/zones/wards, real GHMC 2019 waterlogging-locality list (geocoded), real OSM drainage network and arterial road network, real water-body census. Documented placeholders (terrain, population, rainfall) pending official data access — see [`data/DATA_SOURCES.md`](data/DATA_SOURCES.md).
- **ML risk model, three algorithms live at once** — Random Forest, XGBoost, and AdaBoost are all trained and loaded by the backend; an admin can switch between them live via the API/UI and see risk scores and hotspot rankings change accordingly.
- **Three severity-banding methods, also switchable live** — percentile ranking (production default), K-Means clustering, and a K-Means + spatial-KNN-smoothing hybrid. See the comparison paper for why each exists.
- **A written research comparison** of all six algorithms (Random Forest/XGBoost/AdaBoost for prediction; K-Means/KNN/hybrid for ranking), trained and evaluated in `ml/run_experiments.py`, written up as `ML_Algorithm_Comparison_Paper.docx` (kept outside this repo, alongside it, as a standalone editable document).
- **Automated, model-driven DRF mobilization** — a 10-vehicle Disaster Response Force fleet (2 per real GHMC zone) dispatches itself to the highest-priority (risk × population) hotspots with no admin click required, computes a real ETA from each vehicle's depot, and automatically returns to base once its estimated job duration elapses.
- **A live, playable 1–3 day rainfall forecast simulation** — press Play on the admin dashboard and watch the model re-score the city and the DRF fleet mobilize/free up in real time as a synthetic 72-hour monsoon forecast plays out.
- **Admin PWA** — hotspot map, severity-vs-population chart, mobilization queue, human-in-the-loop severity overrides, live model/severity-method selectors, DRF fleet dispatch panel, forecast simulation panel.
- **Citizen PWA** — nearby risk map, and a WhatsApp-style alert prototype with a suggested safer alternate route, sent via Twilio (dry-run by default; real SMS/WhatsApp once credentials are configured).

## Repo structure

```
data/
  raw/            real+placeholder source data (GHMC boundaries, OSM drainage/roads, water census, ...)
  processed/      pipeline outputs (grid, features, unified ML dataset, risk grid, DRF depots)
  scripts/        one-off fetch/geocode scripts for the raw/ inputs
  DATA_SOURCES.md what's real vs. placeholder, and why
ml/
  build_grid.py, features.py          grid + feature engineering
  train_risk_model.py                 trains Random Forest / XGBoost / AdaBoost
  cluster_severity.py, run_pipeline.py offline pipeline (grid → features → train → cluster)
  build_unified_dataset.py, run_experiments.py, generate_paper.py   the algorithm-comparison paper
backend/
  app.py            FastAPI routes
  risk_engine.py    model loading, live scoring, severity banding, DRF fleet + auto-dispatch, forecast simulation
  alerts.py         Twilio SMS/WhatsApp wrapper (dry-run without credentials)
frontend/
  citizen-pwa/      React + Vite + TS + Tailwind - risk map + alert prototype
  admin-pwa/        React + Vite + TS + Tailwind - map, mobilization queue, DRF fleet, forecast simulation
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Citizen PWA** | React + Vite + TypeScript, Tailwind CSS, `vite-plugin-pwa` | Installable, offline-capable, fast to build; shows nearby risk + alerts + alternate routes to commuters/residents |
| **Admin/Disaster-Response PWA** | Same stack, separate app & deploy | Kept as a distinct app (not a role toggle on the citizen app) so it can carry different data density and update cadence for response teams |
| **Map & charts (both apps)** | MapLibre GL JS + Recharts | Free/open-source vector maps for hotspot layers, severity-vs-population and rainfall-forecast charts |
| **Backend API** | FastAPI (Python) | Serves model inference, map/alert data, and the DRF fleet/simulation endpoints to both PWAs |
| **Data serving** | Direct from `data/processed/` CSVs + `ml/models/*.joblib`, in-memory | Fast enough at this grid size (2,558 cells) that a database wasn't needed yet; PostGIS remains the natural next step if the grid grows or persistence across restarts is needed |
| **ML — risk scoring** | Random Forest, XGBoost, AdaBoost (scikit-learn, xgboost) — all three trained and served, selectable live | Compared head-to-head in `ML_Algorithm_Comparison_Paper.docx`; Random Forest is the production default for interpretability, XGBoost the fastest-training alternative |
| **ML — severity ranking** | Percentile ranking, K-Means, and K-Means+KNN hybrid — all three implemented, selectable live | Also compared in the paper; percentile is the production default, K-Means/hybrid available for a more natural-cluster view |
| **Alerts** | Twilio — SMS + WhatsApp **sandbox** | Trial account is sufficient for a hackathon demo; runs in dry-run (logged, not sent) until credentials are configured |
| **Deployment** | Not yet deployed — runs locally (`uvicorn` + two `vite` dev servers) | Docker Compose / Render / Vercel remain the planned next step for a hosted demo |

### Spatial resolution — fine grid over Hyderabad

Rather than ward-level (coarse, but easy), the risk model and map run on a **fine ~500m point grid** over the real GHMC administrative boundary (2,558 cells). Population, only available at ward/census granularity, is **areal-interpolated** down into each grid cell so the severity-ranking step still has a population-exposed number per cell.

### Data sources

Full source-by-source documentation (what's real, what's a documented placeholder, and what a production swap needs) lives in [`data/DATA_SOURCES.md`](data/DATA_SOURCES.md). In short:

- **Real**: GHMC administrative boundary/zones/wards (OpenCity), 2019 GHMC waterlogging-prone locality list (geocoded), OSM drainage network and arterial roads, 2018-19 water-body census.
- **Documented placeholders**, pending official access: terrain/elevation (pending Google Maps 3D terrain or real SRTM DEM), population density (pending WorldPop/Census areal interpolation), rainfall (synthetic test events and a synthetic 3-day forecast curve, pending IMD data).

## Methodology

**1. Data & feature engineering**
Fine point grid over the real GHMC boundary. Per cell: distance to nearest drain (real OSM data), distance to nearest historical waterlogging incident (real, geocoded), terrain/elevation and population (documented placeholders), and rainfall intensity for the scenario being scored.

**2. Risk model**
Random Forest, XGBoost, and AdaBoost are all trained on the same features (`ml/train_risk_model.py`) and loaded live by the backend; a `model` parameter picks which one scores a given request, defaulting to Random Forest. Feature importances per model are exposed for explainability.

**3. Severity ranking**
Three interchangeable banding methods (`band_method` parameter): percentile rank (bottom 50% green / next 30% yellow / top 20% red, the production default), K-Means clustering on (risk, population), and a hybrid that spatially smooths the K-Means bands via each cell's 5 nearest neighbours. All three are benchmarked in `ML_Algorithm_Comparison_Paper.docx`.

**4. Map interface (Admin PWA)**
Color-coded hotspot layer, filterable by severity band, plus affected road segments. Human-in-the-loop: admins see the model's score *and* can manually override a cell's band.

**5. Automated DRF mobilization**
A 10-vehicle fleet (2 per real GHMC zone, stationed at zone centroids) auto-dispatches to the highest-priority uncovered red-severity cells the moment the model flags them — no admin click required. Each dispatch computes a real ETA (haversine distance ÷ an assumed urban emergency-vehicle speed) and an on-site duration scaled by severity; once that time elapses the vehicle automatically returns to base and becomes available again. Manual dispatch/recall remains available as an override.

**6. Live forecast simulation**
A synthetic 72-hour (3-day) monsoon rainfall forecast can be played back on the admin dashboard: at each simulated hour the model re-scores the city at that hour's rainfall and the DRF fleet automatically mobilizes/frees up in response, visibly, while the map/chart/queue stay in sync.

**7. Alert prototype (Citizen PWA + Twilio)**
Threshold crossing at a citizen's location triggers a Twilio SMS/WhatsApp-style alert including a suggested alternate route to the nearest lower-risk cell. Runs in dry-run (logged, not sent) until Twilio credentials are configured.

## Research & experiments

`ml/run_experiments.py` benchmarks all six algorithms named in the project brief on a unified dataset (`ml/build_unified_dataset.py`) combining every predictive factor. Results are written to `data/processed/ml_experiment_results.json` and assembled into a full paper (abstract, methodology, results tables, honest ground-truth-caveat discussion, references) by `ml/generate_paper.py`, saved as `ML_Algorithm_Comparison_Paper.docx` **outside** this repo (one directory up) so it stays a standalone, independently-editable document.

## Running this project

**1. ML pipeline** (grid → features → train all 3 models → cluster; produces what the API serves)
```
python -m venv .venv
.venv/Scripts/activate        # .venv/bin/activate on macOS/Linux
pip install -r ml/requirements.txt
python ml/run_pipeline.py
```

**2. Backend** (FastAPI — risk-grid/hotspots/stats/fleet/simulation/alerts)
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

**4. (Optional) Re-run the algorithm-comparison experiments / regenerate the paper**
```
python ml/build_unified_dataset.py
python ml/run_experiments.py
python ml/generate_paper.py     # writes ML_Algorithm_Comparison_Paper.docx one directory above this repo
```
