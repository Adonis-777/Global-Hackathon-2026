import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchFeatureImportance, type FeatureImportance, type ModelName } from './api'

const FEATURE_LABEL: Record<string, string> = {
  dist_to_drain_km: 'Distance to drain',
  dist_to_incident_km: 'Distance to 2019 incident',
  elevation_proxy: 'Terrain elevation',
  rainfall_mm: 'Rainfall',
}

const BAR_COLORS = ['#9a3412', '#c2410c', '#ea580c', '#f97316']

export default function FeatureImportanceChart({ model }: { model: ModelName }) {
  const [features, setFeatures] = useState<FeatureImportance[]>([])

  useEffect(() => {
    let cancelled = false
    fetchFeatureImportance(model).then((res) => !cancelled && setFeatures(res.features))
    return () => {
      cancelled = true
    }
  }, [model])

  const data = features.map((f) => ({ name: FEATURE_LABEL[f.feature] ?? f.feature, importance: f.importance }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, 'Importance']} />
        <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
