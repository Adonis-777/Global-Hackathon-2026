import type { SeverityBand } from './api'
import { InfoIcon, WarningIcon } from './icons'
import { SEVERITY_BADGE_CLASS, SEVERITY_CARD_CLASS } from './severity'

const STEPS_BY_BAND: Record<SeverityBand, { heading: string; steps: string[] }> = {
  red: {
    heading: 'High risk — act now',
    steps: [
      'Avoid the area now — do not drive or walk through standing water; as little as 30cm can sweep away a car.',
      'If you are already there, move to higher ground immediately (upper floors, raised roads).',
      'Switch off mains electricity and gas at your premises if water is entering.',
      'Keep your phone charged and save GHMC Disaster Management (155304) for reporting or rescue requests.',
      'Check on elderly neighbours, people with disabilities, and anyone living on a ground floor nearby.',
    ],
  },
  yellow: {
    heading: 'Moderate risk — be prepared',
    steps: [
      'Plan an alternate route in advance — avoid known low-lying stretches and underpasses during heavy rain.',
      'Keep a torch, power bank, drinking water, and any essential medication ready at home.',
      'Move vehicles and valuables away from low-lying parking areas or basements.',
      'Watch local rainfall updates and re-check this app if rain intensifies.',
      'Clear leaves or debris from the drain/gutter nearest your house if it is safe to do so.',
    ],
  },
  green: {
    heading: 'Low risk — stay aware',
    steps: [
      'No immediate action needed, but keep an eye on the forecast if heavy rain is expected.',
      'Report a blocked or overflowing drain near you — early reports help prevent flooding upstream.',
      'Know your nearest higher-ground route in case conditions change quickly.',
      'Save GHMC Disaster Management (155304) in your phone for any future emergency.',
    ],
  },
}

export default function PrecautionarySteps({ severityBand }: { severityBand: SeverityBand }) {
  const group = STEPS_BY_BAND[severityBand]
  const Icon = severityBand === 'green' ? InfoIcon : WarningIcon

  return (
    <div className={`rounded-xl border p-4 ${SEVERITY_CARD_CLASS[severityBand]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5 shrink-0" />
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${SEVERITY_BADGE_CLASS[severityBand]}`}>
          {severityBand}
        </span>
        <h2 className="font-semibold text-sm">{group.heading}</h2>
      </div>
      <ul className="space-y-1.5">
        {group.steps.map((step) => (
          <li key={step} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-60" />
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
