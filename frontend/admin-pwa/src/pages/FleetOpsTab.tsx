import { BAND_BADGE } from '../constants'
import type { FleetVehicle, Hotspot, RiskCellProperties, SeverityStat } from '../api'
import FleetStatusGrid from '../FleetStatusGrid'
import SeverityChart from '../SeverityChart'

interface Props {
  bands: SeverityStat[]
  hotspots: Hotspot[]
  fleet: FleetVehicle[]
  recallVehicle: (vehicleId: string) => void
  dispatching: string | null
  goToOverview: (cell: RiskCellProperties) => void
}

export default function FleetOpsTab({ bands, hotspots, fleet, recallVehicle, dispatching, goToOverview }: Props) {
  const selectCell = (h: Hotspot) =>
    goToOverview({
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

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="rounded-lg border border-slate-300 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">DRF fleet status (10 units, 2 per GHMC zone)</h2>
        <FleetStatusGrid
          fleet={fleet}
          onSelectCell={(cellId, depotLat, depotLon) => {
            // Prefer the cell's own real location/data from the mobilization
            // queue; a vehicle only carries its own depot coordinates, which
            // would otherwise point the map at the wrong place.
            const known = hotspots.find((h) => h.cell_id === cellId)
            goToOverview(
              known
                ? {
                    cell_id: known.cell_id,
                    lat: known.lat,
                    lon: known.lon,
                    risk_score: known.risk_score,
                    severity_band: known.severity_band,
                    population_exposed: known.population_exposed,
                    dist_to_drain_km: 0,
                    dist_to_incident_km: 0,
                    overridden: false,
                  }
                : {
                    cell_id: cellId,
                    lat: depotLat,
                    lon: depotLon,
                    risk_score: 0,
                    severity_band: 'red',
                    population_exposed: 0,
                    dist_to_drain_km: 0,
                    dist_to_incident_km: 0,
                    overridden: false,
                  },
            )
          }}
          onRecall={recallVehicle}
          recalling={dispatching}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-300 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Severity vs. population exposed</h2>
          <SeverityChart bands={bands} />
        </div>

        <div className="rounded-lg border border-slate-300 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Mobilization queue (top {hotspots.length})</h2>
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
                <tr key={h.cell_id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => selectCell(h)}>
                  <td className="py-1">#{h.cell_id}</td>
                  <td>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${BAND_BADGE[h.severity_band]}`}>{h.severity_band}</span>
                  </td>
                  <td>{h.population_exposed.toLocaleString()}</td>
                  <td>{h.mobilization_score.toLocaleString()}</td>
                  <td>
                    {h.drf_status === 'mobilized' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">{h.drf_vehicle_id}</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-orange-300 text-orange-800">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
