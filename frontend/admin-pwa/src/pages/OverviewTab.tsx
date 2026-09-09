import { BAND_BADGE } from '../constants'
import type { FleetVehicle, RiskCellProperties, RiskGridGeoJSON, SeverityBand } from '../api'
import RiskMap from '../RiskMap'
import TerrainView from '../TerrainView'

interface Props {
  riskGrid: RiskGridGeoJSON | null
  view3D: boolean
  setView3D: (v: boolean) => void
  selected: RiskCellProperties | null
  setSelected: (c: RiskCellProperties | null) => void
  loading: boolean
  error: string | null
  fleet: FleetVehicle[]
  fleetForSelected: FleetVehicle[]
  dispatching: string | null
  applyOverride: (band: SeverityBand) => void
  removeOverride: () => void
  dispatchVehicle: (vehicleId: string) => void
  recallVehicle: (vehicleId: string) => void
}

export default function OverviewTab({
  riskGrid,
  view3D,
  setView3D,
  selected,
  setSelected,
  loading,
  error,
  fleet,
  fleetForSelected,
  dispatching,
  applyOverride,
  removeOverride,
  dispatchVehicle,
  recallVehicle,
}: Props) {
  const assignedToSelected = selected
    ? fleet.find((v) => v.status === 'busy' && v.assigned_cell_id === selected.cell_id)
    : undefined

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 relative min-h-[280px]">
        {view3D ? (
          <TerrainView
            riskGrid={riskGrid}
            center={selected ? { lat: selected.lat, lon: selected.lon, cellId: selected.cell_id } : null}
            onResetCenter={() => setSelected(null)}
          />
        ) : (
          <RiskMap
            riskGrid={riskGrid}
            onCellClick={(cell) => {
              setSelected(cell)
              setView3D(true)
            }}
          />
        )}

        <div className="absolute top-2 right-2 flex rounded-full bg-white/90 p-0.5 text-xs shadow">
          <button
            onClick={() => setView3D(false)}
            className={`px-3 py-1 rounded-full font-medium ${!view3D ? 'bg-orange-800 text-white' : 'text-slate-600'}`}
          >
            2D Heatmap
          </button>
          <button
            onClick={() => setView3D(true)}
            className={`px-3 py-1 rounded-full font-medium ${view3D ? 'bg-orange-800 text-white' : 'text-slate-600'}`}
          >
            3D Terrain
          </button>
        </div>

        {loading && <div className="absolute bottom-2 right-2 bg-white/90 text-xs px-2 py-1 rounded shadow">Loading...</div>}
        {error && <div className="absolute bottom-2 right-2 bg-red-50 text-red-700 text-xs px-2 py-1 rounded shadow">{error}</div>}
      </div>

      <aside className="w-96 overflow-y-auto border-l border-slate-200 bg-white p-4">
        {selected ? (
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
                    <strong>{assignedToSelected.vehicle_id}</strong> en route/on-site - free in {assignedToSelected.free_in_minutes}{' '}
                    min
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
                <ul className="space-y-1 max-h-64 overflow-y-auto">
                  {[...fleetForSelected]
                    .sort((a, b) =>
                      a.status === b.status ? (a.eta_minutes_to_target ?? 0) - (b.eta_minutes_to_target ?? 0) : a.status === 'free' ? -1 : 1,
                    )
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
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
            Click a cell on the map to inspect its risk, override severity, or dispatch a DRF unit.
          </div>
        )}
      </aside>
    </div>
  )
}
