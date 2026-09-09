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
// The grid pipeline (ml/build_grid.py) lays cells out on an exact
// 0.0045deg lattice - reusing that constant lets us reconstruct the real
// regular grid (zero interpolation error) instead of Delaunay-triangulating
// a sparse point cloud, which looked faceted/blocky up close.
const LATTICE_SPACING_DEG = 0.0045
const LOCAL_SUPERSAMPLE = 8 // bilinear upsample factor, local drill-down only
const CITY_SUPERSAMPLE = 1 // full-city grid is already dense enough; keep render cost bounded

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

type Feature = RiskGridGeoJSON['features'][number]

/** Snaps real grid cells onto their exact (row, col) lattice position, then
 * bilinear-upsamples between neighbouring cells for a smooth surface. Any
 * output point whose 4 surrounding real cells aren't all present is left as
 * NaN (a gap) rather than fabricating terrain past real data coverage. */
function buildRegularSurface(features: Feature[], supersample: number) {
  const lats = features.map((f) => f.geometry.coordinates[1])
  const lons = features.map((f) => f.geometry.coordinates[0])
  const minLat = Math.min(...lats)
  const minLon = Math.min(...lons)

  const rowOf = (lat: number) => Math.round((lat - minLat) / LATTICE_SPACING_DEG)
  const colOf = (lon: number) => Math.round((lon - minLon) / LATTICE_SPACING_DEG)

  const cellByKey = new Map<string, Feature>()
  let maxRow = 0
  let maxCol = 0
  for (const f of features) {
    const row = rowOf(f.geometry.coordinates[1])
    const col = colOf(f.geometry.coordinates[0])
    cellByKey.set(`${row}_${col}`, f)
    if (row > maxRow) maxRow = row
    if (col > maxCol) maxCol = col
  }

  const nativeRows = maxRow + 1
  const nativeCols = maxCol + 1
  const nativeZ: (number | null)[][] = Array.from({ length: nativeRows }, () => new Array(nativeCols).fill(null))
  const nativeRisk: (number | null)[][] = Array.from({ length: nativeRows }, () => new Array(nativeCols).fill(null))
  for (const [key, f] of cellByKey) {
    const [row, col] = key.split('_').map(Number)
    nativeZ[row][col] = f.properties.elevation_proxy ?? 0
    nativeRisk[row][col] = f.properties.risk_score
  }

  // Real-world spacing at this latitude, so row/col indices convert to true metres.
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos((minLat * Math.PI) / 180)
  const dyM = LATTICE_SPACING_DEG * mPerDegLat
  const dxM = LATTICE_SPACING_DEG * mPerDegLon

  if (supersample <= 1) {
    return {
      xs: Array.from({ length: nativeCols }, (_, c) => c * dxM),
      ys: Array.from({ length: nativeRows }, (_, r) => r * dyM),
      zGrid: nativeZ.map((row) => row.map((v) => (v == null ? NaN : v))),
      riskGrid: nativeRisk.map((row) => row.map((v) => (v == null ? NaN : v))),
    }
  }

  const outRows = (nativeRows - 1) * supersample + 1
  const outCols = (nativeCols - 1) * supersample + 1
  const zGrid: number[][] = Array.from({ length: outRows }, () => new Array(outCols).fill(NaN))
  const riskGrid: number[][] = Array.from({ length: outRows }, () => new Array(outCols).fill(NaN))

  const bilerp = (grid: (number | null)[][], r0: number, c0: number, fr: number, fc: number) => {
    const a = grid[r0]?.[c0]
    const b = grid[r0]?.[c0 + 1]
    const c = grid[r0 + 1]?.[c0]
    const d = grid[r0 + 1]?.[c0 + 1]
    if (a == null || b == null || c == null || d == null) return null
    const top = a * (1 - fc) + b * fc
    const bottom = c * (1 - fc) + d * fc
    return top * (1 - fr) + bottom * fr
  }

  for (let r0 = 0; r0 < nativeRows - 1; r0++) {
    for (let c0 = 0; c0 < nativeCols - 1; c0++) {
      for (let sr = 0; sr <= supersample; sr++) {
        for (let sc = 0; sc <= supersample; sc++) {
          const fr = sr / supersample
          const fc = sc / supersample
          const outR = r0 * supersample + sr
          const outC = c0 * supersample + sc
          const z = bilerp(nativeZ, r0, c0, fr, fc)
          const risk = bilerp(nativeRisk, r0, c0, fr, fc)
          if (z != null) zGrid[outR][outC] = z
          if (risk != null) riskGrid[outR][outC] = risk
        }
      }
    }
  }

  const stepM = dxM / supersample
  const stepMy = dyM / supersample
  return {
    xs: Array.from({ length: outCols }, (_, c) => c * stepM),
    ys: Array.from({ length: outRows }, (_, r) => r * stepMy),
    zGrid,
    riskGrid,
  }
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

    if (features.length < 4) return // too few real cells to build a surface

    let cancelled = false
    import('plotly.js-gl3d-dist').then(({ default: Plotly }) => {
      if (cancelled || !containerRef.current) return

      const supersample = center ? LOCAL_SUPERSAMPLE : CITY_SUPERSAMPLE
      const { xs, ys, zGrid, riskGrid: riskGrid2D } = buildRegularSurface(features, supersample)

      const minLat = Math.min(...features.map((f) => f.geometry.coordinates[1]))
      const minLon = Math.min(...features.map((f) => f.geometry.coordinates[0]))
      const mPerDegLat = 111320
      const mPerDegLon = 111320 * Math.cos((minLat * Math.PI) / 180)

      const surfaceTrace = {
        type: 'surface',
        x: xs,
        y: ys,
        z: zGrid,
        surfacecolor: riskGrid2D,
        cmin: 0,
        cmax: 1,
        colorscale: HEAT_COLORSCALE,
        connectgaps: false,
        colorbar: { title: { text: 'Flood risk' }, len: 0.6 },
        lighting: { ambient: 0.55, diffuse: 0.75, specular: 0.4, roughness: 0.5, fresnel: 0.2 },
        lightposition: { x: 150, y: -150, z: 400 },
        contours: {
          z: { show: true, usecolormap: true, project: { z: true }, highlightcolor: '#ffffff' },
        },
        hovertemplate: 'Elevation: %{z:.1f} m<br>Flood risk: %{surfacecolor:.0%}<extra></extra>',
      }

      // Heat markers stay anchored to the real (non-interpolated) cells, so
      // the precise cell-level data (id, population) shown on hover is
      // never fabricated - only the smoothed surface between them is.
      const risk = features.map((f) => f.properties.risk_score)
      const elevations = features.map((f) => f.properties.elevation_proxy ?? 0)
      const zRange = Math.max(...elevations) - Math.min(...elevations) || 1
      const topIdx = features
        .map((_, i) => i)
        .sort((a, b) => risk[b] - risk[a])
        .slice(0, Math.min(MARKER_COUNT, features.length))
      const markerText = features.map(
        (f) =>
          `Cell #${f.properties.cell_id}<br>Elevation (proxy): ${(f.properties.elevation_proxy ?? 0).toFixed(1)} m` +
          `<br>Risk: ${Math.round(f.properties.risk_score * 100)}% (${f.properties.severity_band})` +
          `<br>Population exposed: ${f.properties.population_exposed.toLocaleString()}`,
      )
      const markerTrace = {
        type: 'scatter3d',
        mode: 'markers+text',
        x: topIdx.map((i) => (features[i].geometry.coordinates[0] - minLon) * mPerDegLon),
        y: topIdx.map((i) => (features[i].geometry.coordinates[1] - minLat) * mPerDegLat),
        z: topIdx.map((i) => elevations[i] + zRange * 0.15),
        text: topIdx.map((i) => `#${features[i].properties.cell_id}`),
        textposition: 'top center',
        textfont: { size: 10, color: '#7f1d1d' },
        marker: { size: 5, color: '#dc2626', symbol: 'diamond', line: { color: '#450a0a', width: 1 } },
        hovertext: topIdx.map((i) => markerText[i]),
        hovertemplate: '%{hovertext}<extra></extra>',
      }

      const xRange = Math.max(...xs) - Math.min(...xs) || 1
      const yRange = Math.max(...ys) - Math.min(...ys) || 1
      const horizontal = Math.max(xRange, yRange)
      const flatZ = zGrid.flat().filter((v) => !Number.isNaN(v))
      const zRangeGrid = (Math.max(...flatZ) - Math.min(...flatZ)) || 1

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
          aspectratio: { x: 1, y: yRange / xRange, z: (zRangeGrid * VERTICAL_EXAGGERATION) / horizontal },
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
        <code>data/DATA_SOURCES.md</code>. Surface is bilinear-smoothed between real grid cells (exact lattice, no
        fabricated data past real coverage); vertical exaggeration {VERTICAL_EXAGGERATION}x. Markers = highest-risk
        real cells shown.
      </div>
    </div>
  )
}
