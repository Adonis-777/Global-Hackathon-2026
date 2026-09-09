import { useEffect, useRef } from 'react'
import type { RiskGridGeoJSON } from './api'

interface Props {
  riskGrid: RiskGridGeoJSON | null
  center: { lat: number; lon: number; cellId?: number } | null
  onResetCenter?: () => void
}

const RADIUS_KM = 2.5
const VERTICAL_EXAGGERATION = 4 // labeled in the caption - real Hyderabad relief is subtle at this scale
const MARKER_COUNT = 5

// A genuine heat gradient (green -> lime -> yellow -> orange -> red) over the
// continuous 0-1 risk_score, matching the 2D map's severity language at the
// green/red ends but with enough stops to actually read as a heat map.
const HEAT_COLORSCALE: [number, string][] = [
  [0, '#15803d'],
  [0.25, '#84cc16'],
  [0.5, '#eab308'],
  [0.75, '#f97316'],
  [1, '#dc2626'],
]

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}

export default function TerrainView({ riskGrid, center, onResetCenter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plottedRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !riskGrid || riskGrid.features.length === 0) return

    const features = center
      ? riskGrid.features.filter((f) => {
          const [lon, lat] = f.geometry.coordinates
          return haversineKm(center.lat, center.lon, lat, lon) <= RADIUS_KM
        })
      : riskGrid.features

    if (features.length < 4) return // too few points to triangulate meaningfully

    let cancelled = false
    import('plotly.js-gl3d-dist').then(({ default: Plotly }) => {
      if (cancelled || !containerRef.current) return

      const lons = features.map((f) => f.geometry.coordinates[0])
      const lats = features.map((f) => f.geometry.coordinates[1])
      const elevations = features.map((f) => f.properties.elevation_proxy ?? 0)
      const risk = features.map((f) => f.properties.risk_score)

      // Local tangent-plane projection to real metres, anchored at the
      // region's own centre - not lon/lat degrees, which mix units with the
      // elevation axis and made the old fixed aspect ratio meaningless.
      const lat0 = center ? center.lat : lats.reduce((a, b) => a + b, 0) / lats.length
      const lon0 = center ? center.lon : lons.reduce((a, b) => a + b, 0) / lons.length
      const mPerDegLat = 111320
      const mPerDegLon = 111320 * Math.cos((lat0 * Math.PI) / 180)
      const xs = lons.map((lon) => (lon - lon0) * mPerDegLon)
      const ys = lats.map((lat) => (lat - lat0) * mPerDegLat)

      const text = features.map(
        (f) =>
          `Cell #${f.properties.cell_id}<br>Elevation (proxy): ${(f.properties.elevation_proxy ?? 0).toFixed(1)} m` +
          `<br>Risk: ${Math.round(f.properties.risk_score * 100)}% (${f.properties.severity_band})` +
          `<br>Population exposed: ${f.properties.population_exposed.toLocaleString()}`,
      )

      const surfaceTrace = {
        type: 'mesh3d',
        x: xs,
        y: ys,
        z: elevations,
        intensity: risk,
        cmin: 0,
        cmax: 1,
        colorscale: HEAT_COLORSCALE,
        delaunayaxis: 'z',
        opacity: 1,
        text,
        hovertemplate: '%{text}<extra></extra>',
        colorbar: { title: { text: 'Flood risk' }, len: 0.6 },
        lighting: { ambient: 0.8, diffuse: 0.6, specular: 0.1, roughness: 0.9 },
        flatshading: false,
      }

      // Heat markers: call out the highest-risk points in the shown region,
      // floated slightly above the surface so they read as pins, not noise.
      const zRange = Math.max(...elevations) - Math.min(...elevations) || 1
      const topIdx = features
        .map((_, i) => i)
        .sort((a, b) => risk[b] - risk[a])
        .slice(0, Math.min(MARKER_COUNT, features.length))
      const markerTrace = {
        type: 'scatter3d',
        mode: 'markers+text',
        x: topIdx.map((i) => xs[i]),
        y: topIdx.map((i) => ys[i]),
        z: topIdx.map((i) => elevations[i] + zRange * 0.15),
        text: topIdx.map((i) => `#${features[i].properties.cell_id}`),
        textposition: 'top center',
        textfont: { size: 10, color: '#7f1d1d' },
        marker: { size: 5, color: '#dc2626', symbol: 'diamond', line: { color: '#450a0a', width: 1 } },
        hovertext: topIdx.map((i) => text[i]),
        hovertemplate: '%{hovertext}<extra></extra>',
      }

      const xRange = Math.max(...xs) - Math.min(...xs) || 1
      const yRange = Math.max(...ys) - Math.min(...ys) || 1
      const horizontal = Math.max(xRange, yRange)

      const layout = {
        margin: { l: 0, r: 0, t: 0, b: 0 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false,
        scene: {
          xaxis: { title: { text: 'East-West (m)' }, showbackground: false },
          yaxis: { title: { text: 'North-South (m)' }, showbackground: false },
          zaxis: { title: { text: 'Elevation (proxy, m)' }, showbackground: true, backgroundcolor: '#f8fafc' },
          aspectmode: 'manual',
          // True horizontal proportions (metres on both axes); vertical axis
          // scaled to real relief x an explicit exaggeration factor so subtle
          // terrain is actually visible, not flattened to a pancake.
          aspectratio: { x: 1, y: yRange / xRange, z: (zRange * VERTICAL_EXAGGERATION) / horizontal },
          camera: { eye: { x: 1.4, y: -1.4, z: 0.9 } },
        },
      }

      const config = { displaylogo: false, responsive: true }
      const data = [surfaceTrace, markerTrace]

      if (!plottedRef.current) {
        Plotly.newPlot(containerRef.current, data, layout, config)
        plottedRef.current = true
      } else {
        Plotly.react(containerRef.current, data, layout, config)
      }
    })

    return () => {
      cancelled = true
    }
  }, [riskGrid, center])

  useEffect(
    () => () => {
      if (containerRef.current && plottedRef.current) {
        import('plotly.js-gl3d-dist').then(({ default: Plotly }) => {
          if (containerRef.current) Plotly.purge(containerRef.current)
        })
      }
    },
    [],
  )

  return (
    <div className="relative h-full w-full bg-slate-50">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute top-2 left-2 flex items-center gap-2 rounded bg-white/90 px-2 py-1 text-xs shadow">
        <span className="font-medium text-slate-700">
          {center ? `Local terrain around cell #${center.cellId} (${RADIUS_KM} km radius)` : 'Hyderabad - full-city terrain'}
        </span>
        {center && onResetCenter && (
          <button onClick={onResetCenter} className="text-orange-800 underline hover:no-underline">
            Show full city
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 max-w-xs rounded bg-white/90 px-2 py-1 text-[10px] text-slate-500 shadow">
        Terrain height is a computed proxy (distance-to-drainage based, not real SRTM elevation) — see{' '}
        <code>data/DATA_SOURCES.md</code>. Axes are true metres (equirectangular projection); vertical exaggeration{' '}
        {VERTICAL_EXAGGERATION}x for visibility. Markers = highest-risk points shown.
      </div>
    </div>
  )
}
