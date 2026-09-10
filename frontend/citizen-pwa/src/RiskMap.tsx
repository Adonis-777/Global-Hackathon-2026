import type { FeatureCollection } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { RiskGridGeoJSON } from './api'

// maplibre-gl auto-detects its own worker script's URL at runtime, but that
// detection doesn't survive this project's Vite/Rolldown production bundle -
// the worker request 404s (silently, no console error) and no tiles ever
// render. Pointing it at a plain static copy in public/ (served verbatim,
// unbundled) sidesteps the bundler issue entirely.
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')

const HYDERABAD_CENTER: [number, number] = [78.4867, 17.385]
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

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
  markers?: Array<{ lon: number; lat: number; color: string }>
}

export default function RiskMap({ riskGrid, markers = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRefs = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: HYDERABAD_CENTER,
      zoom: 10.5,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.on('error', (e) => console.error('maplibre error', e.error))
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
      map.addLayer({
        id: 'risk-grid-circles',
        type: 'circle',
        source: 'risk-grid',
        paint: {
          'circle-radius': 4,
          'circle-color': SEVERITY_COLOR_EXPR,
          'circle-opacity': 0.65,
        },
      })
    }

    if (map.isStyleLoaded()) applyLayer()
    else map.once('load', applyLayer)
  }, [riskGrid])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRefs.current.forEach((m) => m.remove())
    markerRefs.current = markers.map((m) =>
      new maplibregl.Marker({ color: m.color }).setLngLat([m.lon, m.lat]).addTo(map),
    )
  }, [markers])

  return <div ref={containerRef} className="w-full h-full" />
}
