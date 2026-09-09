const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type SeverityBand = 'green' | 'yellow' | 'red'

export interface RiskCellProperties {
  cell_id: number
  risk_score: number
  severity_band: SeverityBand
  population_exposed: number
  dist_to_drain_km: number
  dist_to_incident_km: number
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

export interface AlertResponse {
  triggered: boolean
  reason?: string
  cell: {
    cell_id: number
    lat: number
    lon: number
    risk_score: number
    severity_band: SeverityBand
    distance_km: number
  }
  alternate_route?: {
    cell_id: number
    lat: number
    lon: number
    severity_band: SeverityBand
    distance_km: number
  } | null
  delivery?: { status: string; to: string; message: string }
}

export async function fetchRiskGrid(rainfallMm: number): Promise<RiskGridGeoJSON> {
  const res = await fetch(`${API_URL}/api/risk-grid?rainfall_mm=${rainfallMm}`)
  if (!res.ok) throw new Error(`risk-grid failed: ${res.status}`)
  return res.json()
}

export async function triggerAlert(params: {
  lat: number
  lon: number
  rainfallMm: number
  threshold?: number
}): Promise<AlertResponse> {
  const res = await fetch(`${API_URL}/api/alerts/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: params.lat,
      lon: params.lon,
      rainfall_mm: params.rainfallMm,
      threshold: params.threshold ?? 0.4,
    }),
  })
  if (!res.ok) throw new Error(`alerts/trigger failed: ${res.status}`)
  return res.json()
}

export interface SafeRoute {
  road_name: string
  highway: string
  severity_band: SeverityBand
  lat: number
  lon: number
  distance_km: number
  walk_minutes: number
  drive_minutes: number
  user_severity_band: SeverityBand
}

export async function fetchSafeRoute(lat: number, lon: number, rainfallMm: number): Promise<SafeRoute | null> {
  const res = await fetch(`${API_URL}/api/safe-route?lat=${lat}&lon=${lon}&rainfall_mm=${rainfallMm}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`safe-route failed: ${res.status}`)
  return res.json()
}

export interface ForecastHour {
  hour: number
  day: number
  hour_of_day: number
  rainfall_mm: number
}

export const fetchForecast = (days = 3) => getJSON<{ days: number; hours: ForecastHour[] }>(`/api/forecast?days=${days}`)

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}
