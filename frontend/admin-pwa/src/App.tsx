import { useEffect, useState } from 'react'
import {
  clearOverride,
  fetchFleet,
  fetchHotspots,
  fetchRiskGrid,
  fetchSeverityStats,
  mobilizeDrf,
  recallDrf,
  setOverride,
  type FleetVehicle,
  type Hotspot,
  type RiskCellProperties,
  type RiskGridGeoJSON,
  type SeverityBand,
  type SeverityStat,
} from './api'
import RiskMap from './RiskMap'
import SeverityChart from './SeverityChart'

const BAND_BADGE: Record<SeverityBand, string> = {
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
}

function App() {
  const [rainfallMm, setRainfallMm] = useState(60)
  const [riskGrid, setRiskGrid] = useState<RiskGridGeoJSON | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [bands, setBands] = useState<SeverityStat[]>([])
  const [fleet, setFleet] = useState<FleetVehicle[]>([])
  const [fleetForSelected, setFleetForSelected] = useState<FleetVehicle[]>([])
  const [selected, setSelected] = useState<RiskCellProperties | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [dispatching, setDispatching] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchRiskGrid(rainfallMm), fetchHotspots(rainfallMm, 15), fetchSeverityStats(rainfallMm), fetchFleet()])
      .then(([grid, hotspotRes, statsRes, fleetRes]) => {
        if (cancelled) return
        setRiskGrid(grid)
        setHotspots(hotspotRes.hotspots)
        setBands(statsRes.bands)
        setFleet(fleetRes.fleet)
      })
      .catch((err) => !cancelled && setError(String(err)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [rainfallMm, refreshTick])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    fetchFleet(selected.lat, selected.lon).then((res) => !cancelled && setFleetForSelected(res.fleet))
    return () => {
      cancelled = true
    }
  }, [selected, refreshTick])

  const refresh = () => setRefreshTick((t) => t + 1)

  const applyOverride = async (band: SeverityBand) => {
    if (!selected) return
    await setOverride(selected.cell_id, band)
    setSelected({ ...selected, severity_band: band, overridden: true })
    refresh()
  }

  const removeOverride = async () => {
    if (!selected) return
    await clearOverride(selected.cell_id)
    setSelected({ ...selected, overridden: false })
    refresh()
  }

  const dispatchVehicle = async (vehicleId: string) => {
    if (!selected) return
    setDispatching(vehicleId)
    try {
      await mobilizeDrf(vehicleId, selected.cell_id, rainfallMm)
      refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setDispatching(null)
    }
  }

  const recallVehicle = async (vehicleId: string) => {
    setDispatching(vehicleId)
    try {
      await recallDrf(vehicleId)
      refresh()
    } finally {
      setDispatching(null)
    }
  }

  const assignedToSelected = selected ? fleet.find((v) => v.status === 'busy' && v.assigned_cell_id === selected.cell_id) : undefined
  const busyCount = fleet.filter((v) => v.status === 'busy').length

  return (
    <main className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <header className="bg-orange-800 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Hyderabad Disaster Response</h1>
          <p className="text-orange-100 text-sm">Admin PWA</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-orange-900/60 px-3 py-1 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          DRF units deployed: <strong>{busyCount}</strong> / {fleet.length}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="rainfall">Rainfall: {rainfallMm} mm</label>
          <input
            id="rainfall"
            type="range"
            min={10}
            max={150}
            step={5}
            value={rainfallMm}
            onChange={(e) => setRainfallMm(Number(e.target.value))}
          />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative min-h-[280px]">
          <RiskMap riskGrid={riskGrid} onCellClick={setSelected} />
          {loading && (
            <div className="absolute top-2 left-2 bg-white/90 text-xs px-2 py-1 rounded shadow">Loading...</div>
          )}
          {error && (
            <div className="absolute top-2 left-2 bg-red-50 text-red-700 text-xs px-2 py-1 rounded shadow">
              {error}
            </div>
          )}
        </div>

        <aside className="w-96 overflow-y-auto border-l border-slate-200 bg-white p-4 space-y-4">
          {selected && (
            <div className="rounded-lg border border-slate-300 p-3 text-sm space-y-2">
              <p className="font-semibold">Cell #{selected.cell_id}</p>
              <p>
                Risk score: {selected.risk_score.toFixed(2)} - Population exposed: {selected.population_exposed}
              </p>
              <p>
                Current band:{' '}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${BAND_BADGE[selected.severity_band]}`}>
                  {selected.severity_band}
                  {selected.overridden ? ' (overridden)' : ''}
                </span>
              </p>
              <div className="flex gap-2">
                {(['green', 'yellow', 'red'] as SeverityBand[]).map((band) => (
                  <button
                    key={band}
                    onClick={() => applyOverride(band)}
                    className={`text-xs px-2 py-1 rounded border ${BAND_BADGE[band]} border-transparent hover:opacity-80`}
                  >
                    Set {band}
                  </button>
                ))}
                {selected.overridden && (
                  <button onClick={removeOverride} className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">Human-in-the-loop: model score above, admin judgement here.</p>

              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <p className="text-xs font-semibold text-slate-600">Disaster Response Force</p>

                {assignedToSelected ? (
                  <div className="flex items-center justify-between rounded bg-emerald-50 px-2 py-1.5">
                    <span className="text-xs text-emerald-800">
                      <strong>{assignedToSelected.vehicle_id}</strong> en route/on-site - free in{' '}
                      {assignedToSelected.free_in_minutes} min
                    </span>
                    <button
                      onClick={() => recallVehicle(assignedToSelected.vehicle_id)}
                      disabled={dispatching === assignedToSelected.vehicle_id}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Recall
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {[...fleetForSelected]
                      .sort((a, b) => (a.status === b.status ? (a.eta_minutes_to_target ?? 0) - (b.eta_minutes_to_target ?? 0) : a.status === 'free' ? -1 : 1))
                      .map((v) => (
                        <li key={v.vehicle_id} className="flex items-center justify-between text-xs">
                          <span className={v.status === 'free' ? 'text-slate-700' : 'text-slate-400'}>
                            {v.vehicle_id} <span className="text-slate-400">({v.zone.replace(' Zone', '')})</span>
                          </span>
                          {v.status === 'free' ? (
                            <button
                              onClick={() => dispatchVehicle(v.vehicle_id)}
                              disabled={dispatching === v.vehicle_id}
                              className="px-2 py-0.5 rounded bg-orange-800 text-white hover:bg-orange-900 disabled:opacity-50"
                            >
                              {dispatching === v.vehicle_id ? '...' : `Dispatch (ETA ${v.eta_minutes_to_target}m)`}
                            </button>
                          ) : (
                            <span className="text-slate-400">busy - free in {v.free_in_minutes}m</span>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold mb-2">Severity vs. population exposed</h2>
            <SeverityChart bands={bands} />
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-2">Mobilization queue (top {hotspots.length})</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1">Cell</th>
                  <th>Band</th>
                  <th>Pop.</th>
                  <th>Score</th>
                  <th>DRF</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map((h) => (
                  <tr
                    key={h.cell_id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() =>
                      setSelected({
                        cell_id: h.cell_id,
                        lat: h.lat,
                        lon: h.lon,
                        risk_score: h.risk_score,
                        severity_band: h.severity_band,
                        population_exposed: h.population_exposed,
                        dist_to_drain_km: 0,
                        dist_to_incident_km: 0,
                        overridden: false,
                      })
                    }
                  >
                    <td className="py-1">#{h.cell_id}</td>
                    <td>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${BAND_BADGE[h.severity_band]}`}>
                        {h.severity_band}
                      </span>
                    </td>
                    <td>{h.population_exposed.toLocaleString()}</td>
                    <td>{h.mobilization_score.toLocaleString()}</td>
                    <td>
                      {h.drf_status === 'mobilized' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                          {h.drf_vehicle_id}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-orange-300 text-orange-800">
                          Unassigned
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default App
