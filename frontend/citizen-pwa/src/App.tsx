import { useEffect, useState } from 'react'
import { fetchRiskGrid, fetchSafeRoute, triggerAlert, type AlertResponse, type RiskGridGeoJSON, type SafeRoute } from './api'
import { DropletIcon, LocationIcon, PhoneIcon } from './icons'
import PrecautionarySteps from './PrecautionarySteps'
import RiskLegend from './RiskLegend'
import RiskMap from './RiskMap'
import RiskStatusCard from './RiskStatusCard'
import SafeRouteCard from './SafeRouteCard'
import { useGeolocation } from './useGeolocation'

// Fallback "my location" - a real GHMC waterlogging-prone locality (Malakpet,
// geocoded in data/processed/ghmc_waterlogging_incidents_2019.csv) so the
// alert has a real chance of firing if device geolocation is unavailable or denied.
const DEMO_LOCATION = { lat: 17.3736706, lon: 78.4996484 }

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

  // Red = where the citizen currently is, green = where they should head.
  // Destination markers are added first, current location last, so the
  // red pin renders on top when the two are close enough to overlap.
  const markers: Array<{ lon: number; lat: number; color: string }> = []
  if (alert?.alternate_route) {
    markers.push({ lon: alert.alternate_route.lon, lat: alert.alternate_route.lat, color: '#16a34a' })
  }
  if (safeRoute) {
    markers.push({ lon: safeRoute.lon, lat: safeRoute.lat, color: '#16a34a' })
  }
  markers.push({ lon: location.lon, lat: location.lat, color: '#dc2626' })

  const locationLabel =
    location.source === 'gps'
      ? 'Your current location (GPS)'
      : gpsStatus === 'locating'
        ? 'Locating...'
        : 'Malakpet (demo location)'

  return (
    <main className="flex flex-col h-screen bg-slate-100 text-slate-900 overflow-hidden">
      <header className="bg-teal-700 text-white px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <DropletIcon className="w-5 h-5 text-teal-200" />
          <h1 className="text-base font-semibold leading-tight">Hyderabad Waterlogging Alerts</h1>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5 pl-7">
          <p className="text-teal-100 text-xs flex items-center gap-1">
            <LocationIcon className="w-3 h-3 shrink-0" />
            {locationLabel}
          </p>
          {location.source === 'demo' && gpsStatus !== 'locating' && (
            <button
              onClick={requestLocation}
              className="text-[11px] font-medium bg-teal-800/60 hover:bg-teal-800 px-2 py-1 rounded-full whitespace-nowrap transition-colors"
            >
              Use my location
            </button>
          )}
        </div>
      </header>

      <div className="flex-[1.1] relative min-h-[200px]">
        <RiskMap riskGrid={riskGrid} markers={markers} />
        <RiskLegend />
        {loading && (
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur text-xs px-2.5 py-1.5 rounded-lg shadow-md text-slate-600">
            Loading...
          </div>
        )}
      </div>

      <section className="relative z-10 -mt-5 rounded-t-3xl bg-white shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.12)] flex flex-col flex-1 min-h-0">
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {alert && <RiskStatusCard alert={alert} />}
          {alert?.cell.severity_band === 'red' && <SafeRouteCard route={safeRoute} loading={safeRouteLoading} />}
          {alert && <PrecautionarySteps severityBand={alert.cell.severity_band} />}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 rounded-b-3xl px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-slate-700">Emergency Helpline</h2>
            <p className="text-xs text-slate-500">GHMC Disaster Management</p>
          </div>
          <a
            href="tel:155304"
            className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-teal-700 transition-colors"
          >
            <PhoneIcon className="w-3.5 h-3.5" />
            Call 155304
          </a>
        </div>
      </section>
    </main>
  )
}

export default App
