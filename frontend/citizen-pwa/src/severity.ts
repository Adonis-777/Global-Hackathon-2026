import type { SeverityBand } from './api'

// Used only by RiskLegend, to describe the map's raw dot colors - the map
// legitimately shows the model's actual band, unmoderated, since it's a
// citywide overview rather than a directive aimed at one person.
export const SEVERITY_LABEL: Record<SeverityBand, string> = {
  red: 'High risk',
  yellow: 'Moderate risk',
  green: 'Low risk',
}

export const SEVERITY_DOT_CLASS: Record<SeverityBand, string> = {
  red: 'bg-red-600',
  yellow: 'bg-amber-500',
  green: 'bg-emerald-600',
}

/**
 * The backend's severity_band is a percentile rank (top 20% of cells =
 * red, i.e. citywide percentile 80-100), not a fixed probability cutoff -
 * so "red" alone covers everything from a cell just past the yellow
 * boundary to the single worst cell in the city. A badge reading "RED /
 * High risk" next to text that says "not urgent yet" is a contradiction -
 * misleading in exactly the way a citizen would notice and distrust.
 *
 * UrgencyLevel is what all citizen-facing copy, badges, and card colors
 * key off from here on - never the raw band directly - so the badge
 * always matches what the text underneath actually says. It's derived
 * from the cell's percentile_citywide (not raw risk_score - risk_score's
 * *absolute* range shifts with rainfall, e.g. red-band scores span
 * ~0.40-0.74 at 60mm but ~0.50-0.77 at 150mm, so a fixed risk_score
 * cutoff would rarely or never fire depending on rainfall; percentile
 * rank stays meaningful regardless of rainfall or band_method). The top
 * half of the red band (percentile >= 90) is "critical"; the rest is
 * "elevated" - visually and verbally distinct from critical, not just a
 * softer sentence under the same red badge.
 */
export type UrgencyLevel = 'critical' | 'elevated' | 'moderate' | 'low'

const RED_CRITICAL_PERCENTILE = 90

export function getUrgencyLevel(band: SeverityBand, percentileCitywide: number): UrgencyLevel {
  if (band === 'red') return percentileCitywide >= RED_CRITICAL_PERCENTILE ? 'critical' : 'elevated'
  if (band === 'yellow') return 'moderate'
  return 'low'
}

export const URGENCY_BADGE_LABEL: Record<UrgencyLevel, string> = {
  critical: 'critical',
  elevated: 'elevated',
  moderate: 'moderate',
  low: 'low',
}

export const URGENCY_RISK_LABEL: Record<UrgencyLevel, string> = {
  critical: 'Critical risk',
  elevated: 'Elevated risk',
  moderate: 'Moderate risk',
  low: 'Low risk',
}

export const URGENCY_HEADLINE: Record<UrgencyLevel, string> = {
  critical: 'Act now',
  elevated: 'Stay alert, be ready to move',
  moderate: 'Be prepared',
  low: 'Stay aware',
}

export const URGENCY_BADGE_CLASS: Record<UrgencyLevel, string> = {
  critical: 'bg-red-600 text-white',
  elevated: 'bg-orange-500 text-white',
  moderate: 'bg-amber-500 text-white',
  low: 'bg-emerald-600 text-white',
}

export const URGENCY_CARD_CLASS: Record<UrgencyLevel, string> = {
  critical: 'border-red-300 bg-red-50 text-red-900',
  elevated: 'border-orange-300 bg-orange-50 text-orange-900',
  moderate: 'border-amber-300 bg-amber-50 text-amber-900',
  low: 'border-emerald-300 bg-emerald-50 text-emerald-900',
}
