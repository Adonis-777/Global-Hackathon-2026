import type { SeverityBand } from './api'

export const SEVERITY_LABEL: Record<SeverityBand, string> = {
  red: 'High risk',
  yellow: 'Moderate risk',
  green: 'Low risk',
}

export const SEVERITY_HEADLINE: Record<SeverityBand, string> = {
  red: 'Act now',
  yellow: 'Be prepared',
  green: 'Stay aware',
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
