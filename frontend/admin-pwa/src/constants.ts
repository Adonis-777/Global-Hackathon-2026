import type { BandMethod, ModelName, SeverityBand } from './api'

export const BAND_BADGE: Record<SeverityBand, string> = {
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
}

export const MODEL_LABEL: Record<ModelName, string> = {
  random_forest: 'Random Forest',
  xgboost: 'XGBoost',
  adaboost: 'AdaBoost',
}

export const BAND_METHOD_LABEL: Record<BandMethod, string> = {
  percentile: 'Percentile (default)',
  kmeans: 'K-Means',
  hybrid: 'Hybrid (K-Means + KNN)',
}
