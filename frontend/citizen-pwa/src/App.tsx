import { useEffect, useState } from 'react'
import { fetchRiskGrid, fetchSafeRoute, triggerAlert, type AlertResponse, type RiskGridGeoJSON, type SafeRoute } from './api'
import PrecautionarySteps from './PrecautionarySteps'
import RiskMap from './RiskMap'
import SafeRouteCard from './SafeRouteCard'
import { useGeolocation } from './useGeolocation'

// Fallback "my location" - a real GHMC waterlogging-prone locality (Malakpet,
// geocoded in data/processed/ghmc_waterlogging_incidents_2019.csv) so the
// alert has a real chance of firing if device geolocation is unavailable or denied.
const DEMO_LOCATION = { lat: 17.3736706, lon: 78.4996484 }

const SEVERITY_LABEL: Record<string, string> = {
  red: 'High risk',
  yellow: 'Moderate risk',
  green: 'Low risk',
}

function App() {
  const rainfallMm = 60
  const { location, status: gpsStatus, requestLocation } = useGeolocation(DEMO_LOCATION)
  const [riskGrid, setRiskGrid] = useState<RiskGridGeoJSON | null>(null)
  const [alert, setAlert] = useState<AlertResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [safeRoute, setSafeRoute] = useState<SafeRoute | null>(null)
  const [safeRouteLoading, setSafeRouteLoading] = useState(false)

  // Ask for device GPS once on load; falls back to the demo location if
  // denied/unsupported (useGeolocation already seeds that as the initial state).
  useEffect(() => {
    requestLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRiskGrid(rainfallMm),
      triggerAlert({ lat: location.lat, lon: location.lon, rainfallMm }),
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
  }, [location.lat, location.lon])

  // Only a citizen actually in a red zone needs a route out - fetch on
  // demand rather than for every visitor.
  useEffect(() => {
    if (alert?.cell.severity_band !== 'red') {
      setSafeRoute(null)
      return
    }
    let cancelled = false
    setSafeRouteLoading(true)
    fetchSafeRoute(location.lat, location.lon, rainfallMm)
      .then((route) => !cancelled && setSafeRoute(route))
      .catch(() => !cancelled && setSafeRoute(null))
      .finally(() => !cancelled && setSafeRouteLoading(false))
    return () => {
      cancelled = true
    }
  }, [alert, location.lat, location.lon])

  const markers = [{ lon: location.lon, lat: location.lat, color: '#0f766e' }]
  if (alert?.alternate_route) {
    markers.push({ lon: alert.alternate_route.lon, lat: alert.alternate_route.lat, color: '#22c55e' })
  }
  if (safeRoute) {
    markers.push({ lon: safeRoute.lon, lat: safeRoute.lat, color: '#0d9488' })
  }

  const locationLabel =
    location.source === 'gps'
      ? 'Your current location (GPS)'
      : gpsStatus === 'locating'
        ? 'Locating...'
        : 'Malakpet (demo location - GPS unavailable)'

  return (
    <main className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <header className="bg-teal-700 text-white px-4 py-3">
        <h1 className="text-lg font-semibold">Hyderabad Waterlogging Alerts</h1>
        <div className="flex items-center justify-between gap-2">
          <p className="text-teal-100 text-sm">Citizen PWA - {locationLabel}</p>
          {location.source === 'demo' && gpsStatus !== 'locating' && (
            <button
              onClick={requestLocation}
              className="text-xs font-medium bg-teal-800/60 hover:bg-teal-800 px-2 py-1 rounded-full whitespace-nowrap"
            >
              Use my location
            </button>
          )}
        </div>
      </header>

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
        {alert?.cell.severity_band === 'red' && <SafeRouteCard route={safeRoute} loading={safeRouteLoading} />}
        {alert && <PrecautionarySteps severityBand={alert.cell.severity_band} />}
      </section>

      <footer className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Emergency Helpline</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">GHMC Disaster Management</p>
          <a
            href="tel:155304"
            className="bg-teal-600 text-white px-3 py-1 rounded-full text-xs font-medium hover:bg-teal-700 transition-colors"
          >
            Call 155304
          </a>
        </div>
      </footer>

    </main>
  )
}

export default App
