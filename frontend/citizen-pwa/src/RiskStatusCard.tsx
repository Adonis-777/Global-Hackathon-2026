import type { AlertResponse } from './api'
import { InfoIcon, WarningIcon } from './icons'
import { getUrgencyLevel, SEVERITY_BADGE_CLASS, SEVERITY_CARD_CLASS, SEVERITY_LABEL, URGENCY_HEADLINE } from './severity'

export default function RiskStatusCard({ alert }: { alert: AlertResponse }) {
  const band = alert.cell.severity_band

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

  const urgency = getUrgencyLevel(band, alert.cell.percentile_citywide)
  const Icon = urgency === 'low' ? InfoIcon : WarningIcon

  return (
    <div className={`rounded-xl border p-4 ${SEVERITY_CARD_CLASS[band]}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-6 h-6 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${SEVERITY_BADGE_CLASS[band]}`}>
              {band}
            </span>
            <h2 className="font-semibold text-sm">
              {SEVERITY_LABEL[band]} near you — {URGENCY_HEADLINE[urgency]}
            </h2>
          </div>
          <p className="text-xs mt-1 opacity-80">Risk score {alert.cell.risk_score.toFixed(2)} · {alert.cell.distance_km} km from your location</p>

          {urgency === 'elevated' && (
            <p className="text-xs mt-1.5 opacity-90">
              This is on the lower end of the high-risk range - not yet critical, but close enough to prepare to move if it worsens.
            </p>
          )}

          {band !== 'red' && alert.alternate_route && (
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
