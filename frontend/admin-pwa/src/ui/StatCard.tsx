interface Props {
  label: string
  value: string | number
  accent?: 'default' | 'red' | 'amber' | 'green'
  sub?: string
}

const ACCENT: Record<string, string> = {
  default: 'text-slate-900',
  red: 'text-red-700',
  amber: 'text-amber-600',
  green: 'text-emerald-700',
}

export default function StatCard({ label, value, accent = 'default', sub }: Props) {
  return (
    <div className="flex-1 min-w-[110px] rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xl font-bold leading-tight ${ACCENT[accent]}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}
