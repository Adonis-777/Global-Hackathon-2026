import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import type { RainfallReading } from './useLiveRainfall'

interface Props {
  current: RainfallReading | null
  history: RainfallReading[]
  loading: boolean
}

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function LiveRainfallCard({ current, history, loading }: Props) {
  if (loading || !current) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-400">
        Connecting to live rainfall feed...
      </div>
    )
  }

  const chartData = history.map((r) => ({ label: timeLabel(r.timestamp), rainfall: r.rainfallMm }))

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-60" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-sky-600" />
          </span>
          <h2 className="font-semibold text-sm">Live rainfall</h2>
        </div>
        <span className="text-[10px] text-sky-600">Day {current.day}, {String(current.hourOfDay).padStart(2, '0')}:00</span>
      </div>

      <p className="text-2xl font-bold leading-tight">
        {current.rainfallMm.toFixed(1)} <span className="text-sm font-normal text-sky-700">mm/hr</span>
      </p>
      <p className="text-[11px] text-sky-600 mb-2">Last updated {timeLabel(current.timestamp)}</p>

      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <YAxis hide domain={[0, 'dataMax + 10']} />
            <Tooltip
              formatter={(v: number) => [`${v} mm/hr`, 'Rainfall']}
              labelFormatter={(l) => l}
              contentStyle={{ fontSize: 11 }}
            />
            <Area type="monotone" dataKey="rainfall" stroke="#0284c7" fill="#7dd3fc" strokeWidth={1.5} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-sky-500 mt-1">
        Synthetic forecast feed (real IMD data pending - see README). Last {history.length} readings stored on this device.
      </p>
    </div>
  )
}
