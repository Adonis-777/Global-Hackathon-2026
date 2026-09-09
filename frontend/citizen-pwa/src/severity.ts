import type { SeverityBand } from './api'

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

export const SEVERITY_BADGE_CLASS: Record<SeverityBand, string> = {
  red: 'bg-red-600 text-white',
  yellow: 'bg-amber-500 text-white',
  green: 'bg-emerald-600 text-white',
}

export const SEVERITY_CARD_CLASS: Record<SeverityBand, string> = {
  red: 'border-red-300 bg-red-50 text-red-900',
  yellow: 'border-amber-300 bg-amber-50 text-amber-900',
  green: 'border-emerald-300 bg-emerald-50 text-emerald-900',
}

/**
 * The backend's severity_band is a percentile rank (top 20% of cells =
 * red, i.e. citywide percentile 80-100), not a fixed probability cutoff -
 * so "red" alone covers everything from a cell just past the yellow
 * boundary to the single worst cell in the city. Treating every red cell
 * identically ("evacuate now") overstates the danger for the low end of
 * that range.
 *
 * UrgencyLevel splits red into two response tiers using the cell's
 * percentile_citywide (not its raw risk_score - risk_score's *absolute*
 * range shifts with rainfall, e.g. red-band scores span ~0.40-0.74 at
 * 60mm but ~0.50-0.77 at 150mm, so a fixed risk_score cutoff would rarely
 * or never fire depending on rainfall; percentile rank stays meaningful
 * regardless of rainfall or which band_method assigned the band).
 * Splitting at percentile 90 means the top HALF of the red band (which
 * itself starts at percentile 80) is "critical" - the other half is
 * "elevated", advised to stay alert and ready rather than leave now.
 */
export type UrgencyLevel = 'critical' | 'elevated' | 'moderate' | 'low'

const RED_CRITICAL_PERCENTILE = 90

export function getUrgencyLevel(band: SeverityBand, percentileCitywide: number): UrgencyLevel {
  if (band === 'red') return percentileCitywide >= RED_CRITICAL_PERCENTILE ? 'critical' : 'elevated'
  if (band === 'yellow') return 'moderate'
  return 'low'
}

export const URGENCY_HEADLINE: Record<UrgencyLevel, string> = {
  critical: 'Act now',
  elevated: 'Stay alert, be ready to move',
  moderate: 'Be prepared',
  low: 'Stay aware',
}
