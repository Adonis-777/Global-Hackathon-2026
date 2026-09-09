import { SEVERITY_DOT_CLASS, SEVERITY_LABEL } from './severity'
import type { SeverityBand } from './api'

const BANDS: SeverityBand[] = ['red', 'yellow', 'green']

export default function RiskLegend() {
  return (
    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md px-3 py-2 space-y-1">
      {BANDS.map((band) => (
        <div key={band} className="flex items-center gap-1.5 text-[11px] text-slate-700">
          <span className={`w-2.5 h-2.5 rounded-full ${SEVERITY_DOT_CLASS[band]}`} />
          {SEVERITY_LABEL[band]}
        </div>
      ))}
    </div>
  )
}
