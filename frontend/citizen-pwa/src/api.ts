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
