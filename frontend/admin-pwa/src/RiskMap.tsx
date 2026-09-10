import type { FeatureCollection } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { RiskCellProperties, RiskGridGeoJSON } from './api'

// maplibre-gl auto-detects its own worker script's URL at runtime, but that
// detection doesn't survive this project's Vite/Rolldown production bundle -
// the worker request 404s (silently, no console error) and no tiles ever
// render. Pointing it at a plain static copy in public/ (served verbatim,
// unbundled) sidesteps the bundler issue entirely.
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')

const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

// Exact GHMC grid extent (data/processed/grid_features.csv) - keeps both the
// initial view and pan/zoom limits scoped to Hyderabad only, not the world.
const HYDERABAD_BOUNDS: [[number, number], [number, number]] = [
  [78.243207, 17.296138],
  [78.621207, 17.557138],
]
const HYDERABAD_MAX_BOUNDS: [[number, number], [number, number]] = [
  [78.15, 17.21],
  [78.72, 17.65],
]

const SEVERITY_COLOR_EXPR: maplibregl.ExpressionSpecification = [
  'match',
  ['get', 'severity_band'],
  'red', '#dc2626',
  'yellow', '#eab308',
  'green', '#16a34a',
  '#94a3b8',
]

interface Props {
  riskGrid: RiskGridGeoJSON | null
  onCellClick?: (cell: RiskCellProperties) => void
}

export default function RiskMap({ riskGrid, onCellClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onCellClickRef = useRef(onCellClick)
  onCellClickRef.current = onCellClick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      bounds: HYDERABAD_BOUNDS,
      fitBoundsOptions: { padding: 16 },
      maxBounds: HYDERABAD_MAX_BOUNDS,
      minZoom: 9.5,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.on('error', (e) => console.error('maplibre error', e.error))
    map.on('click', 'risk-grid-circles', (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      const [lon, lat] = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates
      onCellClickRef.current?.({ ...(feature.properties as RiskCellProperties), lat, lon })
    })
    map.on('mouseenter', 'risk-grid-circles', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'risk-grid-circles', () => {
      map.getCanvas().style.cursor = ''
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !riskGrid) return

    const applyLayer = () => {
      const source = map.getSource('risk-grid') as maplibregl.GeoJSONSource | undefined
      if (source) {
        source.setData(riskGrid as FeatureCollection)
        return
      }
      map.addSource('risk-grid', { type: 'geojson', data: riskGrid as FeatureCollection })

      // Heatmap first (renders underneath) so severity visually spreads and
      // blends across the whole city between grid cells, instead of only
      // showing isolated 5px dots with visible gaps between them.
      map.addLayer({
        id: 'risk-grid-heat',
        type: 'heatmap',
        source: 'risk-grid',
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'risk_score'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9.5, 1, 15, 3],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(21,128,61,0.55)',
            0.4, 'rgba(132,204,22,0.65)',
            0.6, 'rgba(234,179,8,0.75)',
            0.8, 'rgba(249,115,22,0.8)',
            1, 'rgba(220,38,38,0.85)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9.5, 18, 15, 45],
          'heatmap-opacity': 0.85,
        },
      })

      // Clickable per-cell dots on top, for the precise selection/override/
      // DRF-dispatch interactions - kept small and semi-transparent so the
      // heat spread beneath still reads clearly.
      map.addLayer({
        id: 'risk-grid-circles',
        type: 'circle',
        source: 'risk-grid',
        paint: {
          'circle-radius': 4,
          'circle-color': SEVERITY_COLOR_EXPR,
          'circle-opacity': 0.55,
          'circle-stroke-width': ['case', ['get', 'overridden'], 2, 0],
          'circle-stroke-color': '#0f172a',
        },
      })
    }

    if (map.isStyleLoaded()) applyLayer()
    else map.once('load', applyLayer)
  }, [riskGrid])

  return <div ref={containerRef} className="w-full h-full" />
}
