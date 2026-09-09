import { useEffect, useState } from 'react'
import { fetchRiskGrid, triggerAlert, type AlertResponse, type RiskGridGeoJSON } from './api'
import RiskMap from './RiskMap'

// Demo "my location" - a real GHMC waterlogging-prone locality (Malakpet,
// geocoded in data/processed/ghmc_waterlogging_incidents_2019.csv) so the
// alert has a real chance of firing without needing device geolocation.
const DEMO_LOCATION = { lat: 17.3736706, lon: 78.4996484, label: 'Malakpet (demo location)' }

const SEVERITY_LABEL: Record<string, string> = {
  red: 'High risk',
  yellow: 'Moderate risk',
  green: 'Low risk',
}

function App() {
  const [rainfallMm, setRainfallMm] = useState(60)
  const [riskGrid, setRiskGrid] = useState<RiskGridGeoJSON | null>(null)
  const [alert, setAlert] = useState<AlertResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRiskGrid(rainfallMm),
      triggerAlert({ lat: DEMO_LOCATION.lat, lon: DEMO_LOCATION.lon, rainfallMm }),
    ])
      .then(([grid, alertResult]) => {
        if (cancelled) return
        setRiskGrid(grid)
        setAlert(alertResult)
      })
      .catch((err) => !cancelled && setError(String(err)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [rainfallMm])

  const markers = [{ lon: DEMO_LOCATION.lon, lat: DEMO_LOCATION.lat, color: '#0f766e' }]
  if (alert?.alternate_route) {
    markers.push({ lon: alert.alternate_route.lon, lat: alert.alternate_route.lat, color: '#22c55e' })
  }

  return (
    <main className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <header className="bg-teal-700 text-white px-4 py-3">
        <h1 className="text-lg font-semibold">Hyderabad Waterlogging Alerts</h1>
        <p className="text-teal-100 text-sm">Citizen PWA - {DEMO_LOCATION.label}</p>
      </header>

      <section className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
        <label htmlFor="rainfall" className="text-sm text-slate-600 whitespace-nowrap">
          Test rainfall: {rainfallMm} mm
        </label>
        <input
          id="rainfall"
          type="range"
          min={10}
          max={150}
          step={5}
          value={rainfallMm}
          onChange={(e) => setRainfallMm(Number(e.target.value))}
          className="w-full"
        />
      </section>

      <div className="flex-1 relative min-h-[280px]">
        <RiskMap riskGrid={riskGrid} markers={markers} />
        {loading && (
          <div className="absolute top-2 left-2 bg-white/90 text-xs px-2 py-1 rounded shadow">Loading...</div>
        )}
      </div>

      <section className="p-4 space-y-2 bg-white border-t border-slate-200">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {alert && (
          <div
            className={
              'rounded-lg border p-3 text-sm ' +
              (alert.triggered ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200 bg-slate-50 text-slate-600')
            }
          >
            {alert.triggered ? (
              <>
                <p className="font-semibold">
                  {SEVERITY_LABEL[alert.cell.severity_band]} near you (score {alert.cell.risk_score.toFixed(2)})
                </p>
                {alert.alternate_route ? (
                  <p>
                    Suggested alternate route: ~{alert.alternate_route.distance_km} km toward a {alert.alternate_route.severity_band} zone.
                  </p>
                ) : (
                  <p>No safer nearby route found within 5km.</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Alert delivery: {alert.delivery?.status} (Twilio dry-run unless credentials are configured)
                </p>
              </>
            ) : (
              <p>No active alert at your location for this rainfall scenario.</p>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
