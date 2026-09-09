import { useEffect, useState } from 'react'
import { fetchRiskAtLocalities, type BandMethod, type LocalityRisk, type ModelName, type SeverityBand } from './api'

const BAND_BADGE: Record<SeverityBand, string> = {
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
}
const BAND_BAR: Record<SeverityBand, string> = { red: 'bg-red-500', yellow: 'bg-yellow-500', green: 'bg-green-500' }

interface Props {
  rainfallMm: number
  model: ModelName
  bandMethod: BandMethod
  onSelect?: (loc: LocalityRisk) => void
}

export default function ProneAreasPanel({ rainfallMm, model, bandMethod, onSelect }: Props) {
  const [localities, setLocalities] = useState<LocalityRisk[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchRiskAtLocalities(rainfallMm, model, bandMethod)
      .then((res) => !cancelled && setLocalities(res.localities))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [rainfallMm, model, bandMethod])

  const redCount = localities.filter((l) => l.severity_band === 'red').length

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Flood probability - major prone areas of Hyderabad <span className="text-slate-400 font-normal">(test rainfall: {rainfallMm} mm)</span>
        </h2>
        <span className="text-xs text-slate-500">
          {loading ? 'Updating...' : `${redCount}/${localities.length} at high risk`}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
              <th className="py-1">Locality (real GHMC 2019 prone list)</th>
              <th className="w-40">Flood probability</th>
              <th>Band</th>
              <th>Pop. exposed</th>
              <th>Percentile</th>
            </tr>
          </thead>
          <tbody>
            {localities.map((loc) => (
              <tr key={loc.name} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => onSelect?.(loc)}>
                <td className="py-1.5 pr-2">{loc.name}</td>
                <td className="pr-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${BAND_BAR[loc.severity_band]}`}
                        style={{ width: `${Math.round(loc.risk_score * 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums w-9 text-right">{Math.round(loc.risk_score * 100)}%</span>
                  </div>
                </td>
                <td>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${BAND_BADGE[loc.severity_band]}`}>
                    {loc.severity_band}
                  </span>
                </td>
                <td>{loc.population_exposed.toLocaleString()}</td>
                <td>{loc.percentile_citywide}th</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
