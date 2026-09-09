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

export interface Hotspot {
  cell_id: number
  lat: number
  lon: number
  risk_score: number
  severity_band: SeverityBand
  population_exposed: number
  mobilization_score: number
}

export interface SeverityStat {
  severity_band: SeverityBand
  cell_count: number
  total_population_exposed: number
  avg_risk_score: number
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

export const fetchRiskGrid = (rainfallMm: number) =>
  getJSON<RiskGridGeoJSON>(`/api/risk-grid?rainfall_mm=${rainfallMm}`)

export const fetchHotspots = (rainfallMm: number, limit = 20) =>
  getJSON<{ rainfall_mm: number; hotspots: Hotspot[] }>(`/api/hotspots?rainfall_mm=${rainfallMm}&limit=${limit}`)

export const fetchSeverityStats = (rainfallMm: number) =>
  getJSON<{ rainfall_mm: number; bands: SeverityStat[] }>(`/api/stats/severity-population?rainfall_mm=${rainfallMm}`)

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
