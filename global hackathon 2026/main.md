# Urban Waterlogging Nowcast — Hyderabad

  

A monsoon decision-support system that predicts *where* waterlogging will happen in the next 1–3 hours, ranks those locations by severity and people affected, and pushes alerts with safe alternate routes — to both commuters and civic disaster-response teams.

  

## Problem

  

Hyderabad floods in the same handful of low-lying, poorly-drained pockets every monsoon, but response is reactive: alerts go out after water is already on the road, and mobilization isn't prioritized by who's actually at risk. This project turns rainfall + terrain + drainage + population data into a live risk map and an automated alert pipeline, so response can happen *before* the water rises instead of after.

  

## MVP flow

  

```

Monsoon rainfall event

        │

        ▼

Ingest rainfall (test event) + terrain + drainage + historical incident data

        │

        ▼

Feature engineering on a fine hex/point grid over Hyderabad

        │

        ▼

ML risk model → per-cell flood probability (0–1)

        │

        ▼

Severity clustering (green/yellow/red) × population exposed per cell

        │

        ├──► Citizen PWA: personal alerts (SMS/WhatsApp) with alternate route

        │

        └──► Admin PWA: hotspot map, severity ranking, mobilization queue

                          (model score + human override)

```

  

## Tech stack

  

| Layer                           | Choice                                                                | Why                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Citizen PWA**                 | React + Vite + TypeScript, Tailwind CSS, `vite-plugin-pwa`            | Installable, offline-capable, fast to build; shows nearby risk, alerts, and alternate routes to commuters/residents                      |
| **Admin/Disaster-Response PWA** | Same stack, separate app & deploy, auth-gated                         | Kept as a distinct app rather than a role toggle on the citizen app, allowing different data density, authentication, and update cadence |
| **Map & Charts (both apps)**    | MapLibre GL JS + Recharts                                             | Free/open-source vector maps for hotspot layers and severity-vs-population histograms                                                    |
| **Backend API**                 | FastAPI (Python)                                                      | Serves model inference and map/alert data to both PWAs; async, typed, and pairs naturally with the ML stack                              |
| **Database**                    | PostgreSQL + PostGIS                                                  | Enables geospatial queries such as nearest-drain, point-in-cell, and road-segment lookup at grid resolution                              |
| **ML — Risk Scoring**           | Random Forest / XGBoost (scikit-learn, XGBoost)                       | Well suited for tabular features, robust with limited data, and feature importances provide explainability for the admin view            |
| **ML — Severity Clustering**    | K-Means / DBSCAN                                                      | Buckets cells into green/yellow/red bands for the map layer, independently of the raw probability                                        |
| **ML — Stretch Goal**           | Small PyTorch feed-forward/spatio-temporal model                      | Consider only after the tree-based baseline works, and if time and historical rainfall-event data allow                                  |
| **Alerts**                      | Twilio — SMS + WhatsApp **sandbox**                                   | Trial account is sufficient for a hackathon demo; SMS supports verified numbers and WhatsApp can use the sandbox                         |
| **Deployment**                  | Docker Compose locally; Render/Railway (API + DB); Vercel (both PWAs) | Cheap and fast to set up for a hackathon timeline                                                                                        |

  

### Spatial resolution — fine grid over Hyderabad

  

Rather than ward-level (coarse, but easy), we run the risk model and map on a **fine hex/point grid** covering the city. This gives per-street-pocket precision instead of one score for an entire ward — the differentiator for judging. Population, which is only available at ward/census granularity, is **areal-interpolated** down into each grid cell (population density × cell area) so the severity-ranking step still has a population-exposed number per cell.

  

### Data sources

  

- **Drainage & historical incidents**: attempt to source real **GHMC** drainage-network and waterlogging-incident records first (most accurate, ties the demo directly to Hyderabad's actual civic data).

- **Fallback**, wherever GHMC data isn't available for a cell: open data —

  - Terrain: SRTM DEM (30m) via Bhuvan/OpenTopography → elevation & slope

  - Drainage: OpenStreetMap (`waterway=drain`, `natural=water`) → proximity-to-drain feature

  - Population: WorldPop / Census 2011 ward data → areal-interpolated per grid cell

  - Rainfall: IMD historical data + one synthetic/test rainfall event for the demo

  

## Methodology

  

**1. Data & feature engineering**

- Build the fine hex/point grid over Hyderabad.

- Per cell: elevation, slope, distance-to-nearest-drain, historical waterlogging incident count (GHMC where available), land-use/imperviousness, interpolated population, and rainfall intensity (mm, from the test event).

  

**2. Risk model**

- Random Forest / XGBoost → 0–1 flood probability per cell for a given rainfall input.

- Feature importances surfaced in the admin PWA as an explainability layer ("why is this cell high-risk").

  

**3. Severity clustering & ranking**

- K-Means/DBSCAN on (risk score, population exposed) → green/yellow/red bands per cell.

- Histogram of severity vs. population exposed, with a slope/ratio reported as a rough impact index (explicitly an estimate, not a hard economic figure).

  

**4. Map interface (Admin PWA)**

- Color-coded hotspot layer over affected road segments, filterable by severity band.

- Human-in-the-loop: admins see the model's score *and* can override with judgement — the map is the primary decision surface, the number is a supporting signal.

- Mobilization queue ranked by severity × population exposed.

  

**5. Alert prototype (Citizen PWA + Twilio)**

- Threshold crossing (e.g., risk ≥ 0.6 for a cell) triggers a Twilio SMS/WhatsApp alert to residents/commuters in that cell, including a suggested alternate route to the nearest lower-risk road segment.

- Civic/disaster-response feed (in the Admin PWA) is separate from the citizen alert and carries the full ranked list, not just a threshold trigger.

  

**6. Validation**

- Run the full pipeline against one synthetic/test rainfall event end-to-end: rainfall in → per-cell risk map + severity ranking + sample citizen alert out. That's the demo.

  

## Next steps

  

Once this README is confirmed:

1. Attempt to source real GHMC drainage/incident data; fall back to open data per cell where it's unavailable.

2. Scaffold the two PWAs (citizen, admin) and the FastAPI backend.

3. Build the grid, pull terrain/drainage/population data for Hyderabad, and train the first-pass risk model.