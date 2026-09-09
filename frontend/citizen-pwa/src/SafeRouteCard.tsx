import type { SafeRoute } from './api'

interface Props {
  route: SafeRoute | null
  loading: boolean
}

export default function SafeRouteCard({ route, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
        Finding the nearest safe main road...
      </div>
    )
  }

  if (!route) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
        No safer main road found within range - follow official evacuation guidance.
      </div>
    )
  }

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${route.lat},${route.lon}`

  return (
    <div className="rounded-lg border border-teal-300 bg-teal-50 p-3 text-sm text-teal-900">
      <h2 className="font-semibold mb-1">Quickest route to safety</h2>
      <p>
        Head to <strong>{route.road_name}</strong> ({route.severity_band} zone) — about{' '}
        <strong>{route.distance_km} km</strong> away.
      </p>
      <p className="text-xs text-teal-700 mt-1">
        ~{route.walk_minutes} min walking, ~{route.drive_minutes} min driving.
      </p>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-2 bg-teal-600 text-white text-xs font-medium px-3 py-1.5 rounded-full hover:bg-teal-700 transition-colors"
      >
        Open turn-by-turn directions
      </a>
    </div>
  )
}
