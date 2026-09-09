import type { FleetVehicle } from './api'

interface Props {
  fleet: FleetVehicle[]
  onSelectCell?: (cellId: number, lat: number, lon: number) => void
  onRecall?: (vehicleId: string) => void
  recalling?: string | null
}

export default function FleetStatusGrid({ fleet, onSelectCell, onRecall, recalling }: Props) {
  const byZone = [...fleet].sort((a, b) => a.zone.localeCompare(b.zone) || a.vehicle_id.localeCompare(b.vehicle_id))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {byZone.map((v) => (
        <div
          key={v.vehicle_id}
          className={`rounded-lg border p-2.5 text-xs ${
            v.status === 'busy' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">{v.vehicle_id}</span>
            <span className={`h-2 w-2 rounded-full ${v.status === 'busy' ? 'bg-red-500' : 'bg-emerald-500'}`} />
          </div>
          <p className="text-[10px] text-slate-500">{v.zone}</p>
          {v.status === 'busy' ? (
            <div className="mt-1 space-y-0.5">
              <button
                className="text-[11px] text-red-800 underline hover:no-underline"
                onClick={() => v.assigned_cell_id != null && onSelectCell?.(v.assigned_cell_id, v.home_lat, v.home_lon)}
              >
                &rarr; Cell #{v.assigned_cell_id}
              </button>
              <p className="text-[10px] text-slate-500">free in {v.free_in_minutes}m</p>
              {onRecall && (
                <button
                  onClick={() => onRecall(v.vehicle_id)}
                  disabled={recalling === v.vehicle_id}
                  className="text-[10px] text-slate-500 underline hover:no-underline disabled:opacity-50"
                >
                  {recalling === v.vehicle_id ? 'recalling...' : 'recall'}
                </button>
              )}
            </div>
          ) : (
            <p className="mt-1 text-[11px] font-medium text-emerald-700">Available</p>
          )}
        </div>
      ))}
    </div>
  )
}
