import type { FeatureCollection } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { RiskCellProperties, RiskGridGeoJSON } from './api'

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
      center: HYDERABAD_CENTER,
      zoom: 10.5,
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
      map.addLayer({
        id: 'risk-grid-circles',
        type: 'circle',
        source: 'risk-grid',
        paint: {
          'circle-radius': 5,
          'circle-color': SEVERITY_COLOR_EXPR,
          'circle-opacity': 0.7,
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
