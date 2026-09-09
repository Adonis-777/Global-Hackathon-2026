import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeverityStat } from './api'

const BAND_COLOR: Record<string, string> = { green: '#16a34a', yellow: '#eab308', red: '#dc2626' }

export default function SeverityChart({ bands }: { bands: SeverityStat[] }) {
  const data = bands.map((b) => ({
    band: b.severity_band,
    population: b.total_population_exposed,
    cells: b.cell_count,
    avgRisk: b.avg_risk_score,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="band" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value, name) =>
            name === 'population' ? [Number(value).toLocaleString(), 'Population exposed'] : [value, String(name)]
          }
        />
        <Bar dataKey="population" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.band} fill={BAND_COLOR[entry.band]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
