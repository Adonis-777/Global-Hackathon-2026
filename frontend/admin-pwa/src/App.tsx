import { useEffect, useState } from 'react'
import {
  clearOverride,
  fetchHotspots,
  fetchRiskGrid,
  fetchSeverityStats,
  setOverride,
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
  const [selected, setSelected] = useState<RiskCellProperties | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchRiskGrid(rainfallMm), fetchHotspots(rainfallMm, 15), fetchSeverityStats(rainfallMm)])
      .then(([grid, hotspotRes, statsRes]) => {
        if (cancelled) return
        setRiskGrid(grid)
        setHotspots(hotspotRes.hotspots)
        setBands(statsRes.bands)
      })
      .catch((err) => !cancelled && setError(String(err)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [rainfallMm, refreshTick])

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

  return (
    <main className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <header className="bg-orange-800 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Hyderabad Disaster Response</h1>
          <p className="text-orange-100 text-sm">Admin PWA</p>
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
