# Implementation Plan & API Contracts

> **Project:** Urban Waterlogging Nowcast — Hyderabad  
> **Architecture:** Decoupled Monorepo (`apps/admin-pwa`, `apps/citizen-pwa`, `apps/backend`, `shared/`)

---

## 🛠️ API Contracts & Schemas

### 1. `GET /api/v1/risk-map`
Returns spatial array of `RiskCell` objects representing fine 30m grid locations in Hyderabad.

**Response Schema (`200 OK`):**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "hexId": "HYD-HEX-101",
      "locality": "Begumpet Underpass",
      "riskScore": 92,
      "floodProbability": 0.92,
      "population": 4200,
      "exposedPopulation": 3864,
      "severity": "HIGH",
      "waterLevelCm": 48,
      "drainageStatus": "CRITICAL",
      "coords": { "lat": 17.4447, "lng": 78.4664 }
    }
  ]
}
```

---

### 2. `POST /api/v1/report`
Accepts ground-truth flood reports submitted by citizens via mobile PWA uplink.

**Request Payload:**
```json
{
  "userId": "CITIZEN_9042",
  "locality": "Khairatabad Circle",
  "severityLevel": 3,
  "waterDepthCm": 45,
  "description": "Culvert clogged, water accumulating rapidly near Metro station.",
  "photoUrl": "data:image/png;base64,...",
  "coords": { "lat": 17.4116, "lng": 78.4623 }
}
```

**Response Schema (`200 OK`):**
```json
{
  "success": true,
  "message": "Report logged into ML risk pipeline.",
  "data": {
    "id": "RPT_1001",
    "status": "VERIFIED"
  }
}
```

---

### 3. `POST /api/v1/alerts/trigger`
Dispatches SMS/WhatsApp notifications via Twilio API sandbox.

**Request Payload:**
```json
{
  "hexId": "HYD-HEX-101",
  "locality": "Begumpet Underpass",
  "message": "CRITICAL WATERLOGGING ADVISORY: Evacuate low-lying underpass routes immediately.",
  "severity": "HIGH",
  "channels": ["SMS", "WHATSAPP", "PUSH"]
}
```

---

### 4. `POST /api/v1/override`
Human-in-the-Loop manual commander risk override signal.

**Request Payload:**
```json
{
  "hexId": "HYD-HEX-101",
  "newSeverity": "HIGH",
  "commanderId": "CMD_HYD_OFFICER_01",
  "note": "Ground survey verified severe structural drainage blockage."
}
```

---

## 🗺️ Roadmap & Verification Milestones

1. [x] Git Branch Creation (`feature/quantum2-nowcast`)
2. [x] Monorepo Folder Structure (`apps/admin-pwa`, `apps/citizen-pwa`, `apps/backend`, `shared`)
3. [x] Quantum² Design System Shared Components (`QuantumNav`, `CyberCard`, `CyberButton`, `CyberLabel`, `AlertNotification`)
4. [x] FastAPI Backend Service & Twilio Alert Wrapper (`main.py`, `services/alert_service.py`)
5. [x] Disaster Response Command Center (`AdminDashboardPage.tsx`, `mockApi.ts`)
6. [x] Citizen Commuter Utility (`RiskMapPage.tsx`, `FloodReportingForm.tsx`)
7. [x] Standalone Showcase (`index.html`) & Handover Docs (`README.md`, `DESIGN.md`, `continuework.md`)
