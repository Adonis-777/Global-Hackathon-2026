import type { AlertResponse } from './api'
import { InfoIcon, WarningIcon } from './icons'
import { getUrgencyLevel, URGENCY_BADGE_CLASS, URGENCY_BADGE_LABEL, URGENCY_CARD_CLASS, URGENCY_HEADLINE, URGENCY_RISK_LABEL } from './severity'

export default function RiskStatusCard({ alert }: { alert: AlertResponse }) {
  if (!alert.triggered) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 p-4 flex items-start gap-3">
        <InfoIcon className="w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-sm">No active alert at your location</h2>
          <p className="text-xs mt-1 opacity-80">Current risk score {alert.cell.risk_score.toFixed(2)} for this rainfall scenario.</p>
        </div>
      </div>
    )
  }

  const urgency = getUrgencyLevel(alert.cell.severity_band, alert.cell.percentile_citywide)
  const Icon = urgency === 'low' ? InfoIcon : WarningIcon

  return (
    <div className={`rounded-xl border p-4 ${URGENCY_CARD_CLASS[urgency]}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-6 h-6 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${URGENCY_BADGE_CLASS[urgency]}`}>
              {URGENCY_BADGE_LABEL[urgency]}
            </span>
            <h2 className="font-semibold text-sm">
              {URGENCY_RISK_LABEL[urgency]} near you — {URGENCY_HEADLINE[urgency]}
            </h2>
          </div>
          <p className="text-xs mt-1 opacity-80">
            Top {(100 - alert.cell.percentile_citywide).toFixed(0)}% citywide · {alert.cell.distance_km} km from your location
          </p>

          {urgency === 'elevated' && (
            <p className="text-xs mt-1.5 opacity-90">
              Your area is in the high-risk band, but not its worst part right now - not an immediate evacuation, just a reason to be ready.
            </p>
          )}

          {urgency !== 'critical' && alert.alternate_route && (
            <p className="text-xs mt-1.5">
              Nearby lower-risk area: ~{alert.alternate_route.distance_km} km toward a {alert.alternate_route.severity_band} zone.
            </p>
          )}

          <p className="text-[11px] mt-1.5 opacity-60">
            Alert delivery: {alert.delivery?.status} (Twilio dry-run unless credentials are configured)
          </p>
        </div>
      </div>
    </div>
  )
}
