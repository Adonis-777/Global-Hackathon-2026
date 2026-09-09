import { useEffect, useRef } from 'react'
import type { RiskGridGeoJSON } from './api'

interface Props {
  riskGrid: RiskGridGeoJSON | null
}

// Green -> yellow -> red, matching the 2D map's severity colors, over the
// continuous 0-1 risk_score so the terrain shows a smooth risk gradient
// rather than hard band edges.
const RISK_COLORSCALE: [number, string][] = [
  [0, '#16a34a'],
  [0.5, '#eab308'],
  [1, '#dc2626'],
]

export default function TerrainView({ riskGrid }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plottedRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !riskGrid || riskGrid.features.length === 0) return

    let cancelled = false
    import('plotly.js-gl3d-dist').then(({ default: Plotly }) => {
      if (cancelled || !containerRef.current) return

      const lons = riskGrid.features.map((f) => f.geometry.coordinates[0])
      const lats = riskGrid.features.map((f) => f.geometry.coordinates[1])
      const elevations = riskGrid.features.map((f) => f.properties.elevation_proxy ?? 0)
      const risk = riskGrid.features.map((f) => f.properties.risk_score)
      const text = riskGrid.features.map(
        (f) =>
          `Cell #${f.properties.cell_id}<br>Elevation (proxy): ${(f.properties.elevation_proxy ?? 0).toFixed(1)} m` +
          `<br>Risk: ${Math.round(f.properties.risk_score * 100)}% (${f.properties.severity_band})` +
          `<br>Population exposed: ${f.properties.population_exposed.toLocaleString()}`,
      )

      const data = [
        {
          type: 'mesh3d',
          x: lons,
          y: lats,
          z: elevations,
          intensity: risk,
          cmin: 0,
          cmax: 1,
          colorscale: RISK_COLORSCALE,
          delaunayaxis: 'z',
          opacity: 1,
          text,
          hovertemplate: '%{text}<extra></extra>',
          colorbar: { title: { text: 'Flood risk' }, len: 0.6 },
          lighting: { ambient: 0.75, diffuse: 0.6, specular: 0.1, roughness: 0.9 },
          flatshading: false,
        },
      ]

      const layout = {
        margin: { l: 0, r: 0, t: 0, b: 0 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        scene: {
          xaxis: { title: { text: 'Longitude' }, showbackground: false },
          yaxis: { title: { text: 'Latitude' }, showbackground: false },
          zaxis: { title: { text: 'Elevation (proxy, m)' }, showbackground: true, backgroundcolor: '#f8fafc' },
          aspectmode: 'manual',
          aspectratio: { x: 1, y: 1, z: 0.4 },
          camera: { eye: { x: 1.4, y: -1.4, z: 0.9 } },
        },
      }

      const config = { displaylogo: false, responsive: true }

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
  }, [riskGrid])

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
      <div className="pointer-events-none absolute bottom-2 left-2 max-w-xs rounded bg-white/90 px-2 py-1 text-[10px] text-slate-500 shadow">
        Terrain height is a computed proxy (distance-to-drainage based, not real SRTM elevation) — see{' '}
        <code>data/DATA_SOURCES.md</code>. Colored by live flood-risk score.
      </div>
    </div>
  )
}
