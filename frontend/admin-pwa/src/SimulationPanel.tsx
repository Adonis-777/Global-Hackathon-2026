import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  fetchForecast,
  resetSimulation,
  simulateStep,
  stopSimulation,
  type BandMethod,
  type DispatchLogEntry,
  type ForecastHour,
  type ModelName,
} from './api'

interface Props {
  model: ModelName
  bandMethod: BandMethod
  onTick: (rainfallMm: number) => void
}

const TICK_MS = 500

function labelFor(h: ForecastHour) {
  return `D${h.day} ${String(h.hour_of_day).padStart(2, '0')}:00`
}

export default function SimulationPanel({ model, bandMethod, onTick }: Props) {
  const [hours, setHours] = useState<ForecastHour[]>([])
  const [hourIndex, setHourIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [log, setLog] = useState<DispatchLogEntry[]>([])
  const [busyCount, setBusyCount] = useState(0)
  const [fleetSize, setFleetSize] = useState(0)
  const [stepping, setStepping] = useState(false)

  useEffect(() => {
    fetchForecast(3).then((res) => setHours(res.hours))
    return () => {
      stopSimulation().catch(() => {})
    }
  }, [])

  // Advance the clock while playing.
  useEffect(() => {
    if (!playing || hours.length === 0) return
    const id = window.setInterval(() => {
      setHourIndex((prev) => {
        if (prev + 1 >= hours.length) {
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [playing, hours.length])

  // Run one simulated step whenever the clock (or model/band choice) changes.
  useEffect(() => {
    const current = hours[hourIndex]
    if (!current) return
    let cancelled = false
    setStepping(true)
    simulateStep(hourIndex, current.rainfall_mm, model, bandMethod)
      .then((res) => {
        if (cancelled) return
        setLog(res.log)
        setBusyCount(res.fleet.filter((v) => v.status === 'busy').length)
        setFleetSize(res.fleet.length)
        onTick(current.rainfall_mm)
      })
      .finally(() => !cancelled && setStepping(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourIndex, hours, model, bandMethod])

  const handleReset = async () => {
    setPlaying(false)
    await resetSimulation()
    setLog([])
    setHourIndex(0)
  }

  const current = hours[hourIndex]
  const chartData = hours.map((h) => ({ label: labelFor(h), rainfall: h.rainfall_mm }))
  const atEnd = hours.length > 0 && hourIndex >= hours.length - 1

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Live 3-day forecast &amp; auto-mobilization</h2>
        <span className="text-xs text-slate-500">
          {current ? `Day ${current.day}, ${String(current.hour_of_day).padStart(2, '0')}:00` : '-'} - {current?.rainfall_mm ?? 0} mm
          {stepping && ' (updating...)'}
        </span>
      </div>

      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={11} />
            <YAxis tick={{ fontSize: 9 }} width={30} />
            <Tooltip formatter={(v) => [`${v} mm`, 'Rainfall']} />
            <Area type="monotone" dataKey="rainfall" stroke="#9a3412" fill="#fed7aa" strokeWidth={1.5} isAnimationActive={false} />
            {current && <ReferenceLine x={labelFor(current)} stroke="#9a3412" strokeWidth={2} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={atEnd || hours.length === 0}
          className="text-xs font-semibold px-3 py-1.5 rounded bg-orange-800 text-white hover:bg-orange-900 disabled:opacity-50"
        >
          {playing ? 'Pause' : atEnd ? 'Complete' : 'Play'}
        </button>
        <button onClick={handleReset} className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100">
          Reset
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(hours.length - 1, 0)}
          value={hourIndex}
          disabled={playing}
          onChange={(e) => setHourIndex(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs text-slate-500 whitespace-nowrap">
          DRF busy: {busyCount}/{fleetSize}
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-600 mb-1">Auto-dispatch log (model-driven, no admin click)</p>
        <ul className="max-h-32 overflow-y-auto space-y-0.5 text-[11px] text-slate-600">
          {log.length === 0 && <li className="text-slate-400">No dispatches yet - press Play.</li>}
          {[...log].reverse().map((entry, i) => (
            <li key={`${entry.vehicle_id}-${entry.sim_time}-${i}`}>
              <span className="text-slate-400">
                D{Math.floor(entry.hour_index / 24) + 1} {String(entry.hour_index % 24).padStart(2, '0')}:00
              </span>{' '}
              <strong>{entry.vehicle_id}</strong> &rarr; cell #{entry.cell_id} ({entry.severity_band}, {Math.round(entry.risk_score * 100)}%
              risk, {entry.population_exposed.toLocaleString()} people)
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
