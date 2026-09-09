import { useEffect, useState } from 'react'
import {
  clearOverride,
  fetchFleet,
  fetchHotspots,
  fetchModelOptions,
  fetchRiskGrid,
  fetchSeverityStats,
  mobilizeDrf,
  recallDrf,
  setOverride,
  type BandMethod,
  type FleetVehicle,
  type Hotspot,
  type LocalityRisk,
  type ModelName,
  type ModelOptions,
  type RiskCellProperties,
  type RiskGridGeoJSON,
  type SeverityBand,
  type SeverityStat,
} from './api'
import { BAND_METHOD_LABEL, MODEL_LABEL } from './constants'
import FleetOpsTab from './pages/FleetOpsTab'
import ForecastTab from './pages/ForecastTab'
import OverviewTab from './pages/OverviewTab'
import RiskModelTab from './pages/RiskModelTab'
import StatCard from './ui/StatCard'

type Tab = 'overview' | 'fleet' | 'model' | 'forecast'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview & Map' },
  { id: 'fleet', label: 'Fleet & Mobilization' },
  { id: 'model', label: 'Risk Model & Prone Areas' },
  { id: 'forecast', label: 'Forecast Simulation' },
]

function localityToCell(loc: LocalityRisk): RiskCellProperties {
  return {
    cell_id: loc.cell_id,
    lat: loc.lat,
    lon: loc.lon,
    risk_score: loc.risk_score,
    severity_band: loc.severity_band,
    population_exposed: loc.population_exposed,
    dist_to_drain_km: 0,
    dist_to_incident_km: 0,
    overridden: false,
  }
}

function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [rainfallMm, setRainfallMm] = useState(60)
  const [modelOptions, setModelOptions] = useState<ModelOptions | null>(null)
  const [model, setModel] = useState<ModelName>('random_forest')
  const [bandMethod, setBandMethod] = useState<BandMethod>('percentile')
  const [riskGrid, setRiskGrid] = useState<RiskGridGeoJSON | null>(null)
  const [view3D, setView3D] = useState(false)
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
    fetchModelOptions().then((opts) => {
      setModelOptions(opts)
      setModel(opts.default_model)
      setBandMethod(opts.default_band_method)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRiskGrid(rainfallMm, model, bandMethod),
      fetchHotspots(rainfallMm, model, bandMethod, 15),
      fetchSeverityStats(rainfallMm, model, bandMethod),
      fetchFleet(),
    ])
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
  }, [rainfallMm, model, bandMethod, refreshTick])

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
      await mobilizeDrf(vehicleId, selected.cell_id, rainfallMm, model, bandMethod)
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

  const goToOverview = (cell: RiskCellProperties) => {
    setSelected(cell)
    setTab('overview')
  }

  const busyCount = fleet.filter((v) => v.status === 'busy').length
  const redBand = bands.find((b) => b.severity_band === 'red')

  return (
    <main className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <header className="bg-orange-800 text-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Hyderabad Disaster Response</h1>
            <p className="text-orange-100 text-xs">Admin Command Center</p>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <label htmlFor="rainfall" className="whitespace-nowrap">
              Rainfall: {rainfallMm} mm
            </label>
            <input
              id="rainfall"
              type="range"
              min={10}
              max={150}
              step={5}
              value={rainfallMm}
              onChange={(e) => setRainfallMm(Number(e.target.value))}
            />
            {modelOptions && (
              <>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as ModelName)}
                  className="rounded bg-orange-900/60 border border-orange-700 text-xs px-2 py-1"
                  title="Prediction model (see ML_Algorithm_Comparison_Paper.docx)"
                >
                  {modelOptions.models.map((m) => (
                    <option key={m} value={m}>
                      {MODEL_LABEL[m]}
                    </option>
                  ))}
                </select>
                <select
                  value={bandMethod}
                  onChange={(e) => setBandMethod(e.target.value as BandMethod)}
                  className="rounded bg-orange-900/60 border border-orange-700 text-xs px-2 py-1"
                  title="Severity-banding method (see ML_Algorithm_Comparison_Paper.docx)"
                >
                  {modelOptions.band_methods.map((b) => (
                    <option key={b} value={b}>
                      {BAND_METHOD_LABEL[b]}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 px-4 py-3 bg-white border-b border-slate-200">
        <StatCard label="DRF deployed" value={`${busyCount}/${fleet.length}`} accent={busyCount > 0 ? 'red' : 'green'} />
        <StatCard label="Test rainfall" value={`${rainfallMm} mm`} />
        <StatCard label="Red-severity cells" value={redBand?.cell_count ?? 0} accent="red" sub="at current rainfall" />
        <StatCard label="Population at high risk" value={(redBand?.total_population_exposed ?? 0).toLocaleString()} accent="amber" />
        <StatCard label="Active model" value={MODEL_LABEL[model]} />

        <nav className="ml-auto flex items-end">
          <div className="flex rounded-full bg-slate-100 p-0.5 text-xs">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${
                  tab === t.id ? 'bg-orange-800 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {tab === 'overview' && (
        <OverviewTab
          riskGrid={riskGrid}
          view3D={view3D}
          setView3D={setView3D}
          selected={selected}
          setSelected={setSelected}
          loading={loading}
          error={error}
          fleet={fleet}
          fleetForSelected={fleetForSelected}
          dispatching={dispatching}
          applyOverride={applyOverride}
          removeOverride={removeOverride}
          dispatchVehicle={dispatchVehicle}
          recallVehicle={recallVehicle}
        />
      )}

      {tab === 'fleet' && (
        <FleetOpsTab
          bands={bands}
          hotspots={hotspots}
          fleet={fleet}
          recallVehicle={recallVehicle}
          dispatching={dispatching}
          goToOverview={goToOverview}
        />
      )}

      {tab === 'model' && (
        <RiskModelTab
          rainfallMm={rainfallMm}
          model={model}
          bandMethod={bandMethod}
          onSelect={(loc) => goToOverview(localityToCell(loc))}
        />
      )}

      {tab === 'forecast' && <ForecastTab model={model} bandMethod={bandMethod} onTick={setRainfallMm} />}
    </main>
  )
}

export default App
