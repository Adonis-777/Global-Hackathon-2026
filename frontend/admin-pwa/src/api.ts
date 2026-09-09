const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type SeverityBand = 'green' | 'yellow' | 'red'

export interface RiskCellProperties {
  cell_id: number
  lat: number
  lon: number
  risk_score: number
  severity_band: SeverityBand
  population_exposed: number
  dist_to_drain_km: number
  dist_to_incident_km: number
  elevation_proxy?: number
  overridden: boolean
}

export interface RiskGridGeoJSON {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: RiskCellProperties
  }>
}

export interface Hotspot {
  cell_id: number
  lat: number
  lon: number
  risk_score: number
  severity_band: SeverityBand
  population_exposed: number
  mobilization_score: number
  drf_status: 'pending' | 'mobilized'
  drf_vehicle_id: string | null
}

export interface FleetVehicle {
  vehicle_id: string
  zone: string
  home_lat: number
  home_lon: number
  status: 'free' | 'busy'
  assigned_cell_id: number | null
  severity_band: SeverityBand | null
  dispatched_at: string | null
  eta_minutes: number | null
  busy_until: string | null
  free_in_minutes?: number
  eta_minutes_to_target?: number
  distance_km_to_target?: number
}

export interface SeverityStat {
  severity_band: SeverityBand
  cell_count: number
  total_population_exposed: number
  avg_risk_score: number
}

export type ModelName = 'random_forest' | 'xgboost' | 'adaboost'
export type BandMethod = 'percentile' | 'kmeans' | 'hybrid'

export interface ModelOptions {
  models: ModelName[]
  default_model: ModelName
  band_methods: BandMethod[]
  default_band_method: BandMethod
}

export const fetchModelOptions = () => getJSON<ModelOptions>('/api/model/options')

export interface LocalityRisk {
  name: string
  lat: number
  lon: number
  cell_id: number
  risk_score: number
  severity_band: SeverityBand
  percentile_citywide: number
  population_exposed: number
}

export const fetchRiskAtLocalities = (rainfallMm: number, model: ModelName, bandMethod: BandMethod) =>
  getJSON<{ rainfall_mm: number; model: ModelName; band_method: BandMethod; localities: LocalityRisk[] }>(
    `/api/risk-at-localities?rainfall_mm=${rainfallMm}&model=${model}&band_method=${bandMethod}`,
  )

export interface FeatureImportance {
  feature: string
  importance: number
}

export const fetchFeatureImportance = (model: ModelName) =>
  getJSON<{ model: ModelName; features: FeatureImportance[] }>(`/api/model/feature-importance?model=${model}`)

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

export const fetchRiskGrid = (rainfallMm: number, model: ModelName, bandMethod: BandMethod) =>
  getJSON<RiskGridGeoJSON>(`/api/risk-grid?rainfall_mm=${rainfallMm}&model=${model}&band_method=${bandMethod}`)

export const fetchHotspots = (rainfallMm: number, model: ModelName, bandMethod: BandMethod, limit = 20) =>
  getJSON<{ rainfall_mm: number; hotspots: Hotspot[] }>(
    `/api/hotspots?rainfall_mm=${rainfallMm}&model=${model}&band_method=${bandMethod}&limit=${limit}`,
  )

export const fetchSeverityStats = (rainfallMm: number, model: ModelName, bandMethod: BandMethod) =>
  getJSON<{ rainfall_mm: number; bands: SeverityStat[] }>(
    `/api/stats/severity-population?rainfall_mm=${rainfallMm}&model=${model}&band_method=${bandMethod}`,
  )

export async function setOverride(cellId: number, severityBand: SeverityBand) {
  const res = await fetch(`${API_URL}/api/overrides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cell_id: cellId, severity_band: severityBand }),
  })
  if (!res.ok) throw new Error(`override failed: ${res.status}`)
  return res.json()
}

export async function clearOverride(cellId: number) {
  const res = await fetch(`${API_URL}/api/overrides/${cellId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`clear override failed: ${res.status}`)
  return res.json()
}

export const fetchFleet = (targetLat?: number, targetLon?: number) =>
  getJSON<{ fleet: FleetVehicle[] }>(
    targetLat != null && targetLon != null ? `/api/fleet?target_lat=${targetLat}&target_lon=${targetLon}` : '/api/fleet',
  )

export async function mobilizeDrf(
  vehicleId: string,
  cellId: number,
  rainfallMm: number,
  model: ModelName,
  bandMethod: BandMethod,
): Promise<FleetVehicle> {
  const res = await fetch(`${API_URL}/api/mobilize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicle_id: vehicleId, cell_id: cellId, rainfall_mm: rainfallMm, model, band_method: bandMethod }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `mobilize failed: ${res.status}`)
  }
  return res.json()
}

export async function recallDrf(vehicleId: string) {
  const res = await fetch(`${API_URL}/api/mobilize/${vehicleId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`recall failed: ${res.status}`)
  return res.json()
}

export interface ForecastHour {
  hour: number
  day: number
  hour_of_day: number
  rainfall_mm: number
}

export const fetchForecast = (days = 3) => getJSON<{ days: number; hours: ForecastHour[] }>(`/api/forecast?days=${days}`)

export interface DispatchLogEntry {
  sim_time: string
  hour_index: number
  vehicle_id: string
  cell_id: number
  severity_band: SeverityBand
  risk_score: number
  population_exposed: number
}

export interface SimulateStepResult {
  sim_time: string
  hour_index: number
  rainfall_mm: number
  newly_dispatched: FleetVehicle[]
  fleet: FleetVehicle[]
  hotspots: Hotspot[]
  bands: SeverityStat[]
  log: DispatchLogEntry[]
}

export async function simulateStep(
  hourIndex: number,
  rainfallMm: number,
  model: ModelName,
  bandMethod: BandMethod,
): Promise<SimulateStepResult> {
  const res = await fetch(`${API_URL}/api/simulate/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hour_index: hourIndex, rainfall_mm: rainfallMm, model, band_method: bandMethod }),
  })
  if (!res.ok) throw new Error(`simulate/step failed: ${res.status}`)
  return res.json()
}

export async function resetSimulation() {
  const res = await fetch(`${API_URL}/api/simulate/reset`, { method: 'POST' })
  if (!res.ok) throw new Error(`simulate/reset failed: ${res.status}`)
  return res.json()
}

export async function stopSimulation() {
  const res = await fetch(`${API_URL}/api/simulate/stop`, { method: 'POST' })
  if (!res.ok) throw new Error(`simulate/stop failed: ${res.status}`)
  return res.json()
}
