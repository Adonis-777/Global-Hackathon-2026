import { MODEL_LABEL } from '../constants'
import type { BandMethod, LocalityRisk, ModelName } from '../api'
import FeatureImportanceChart from '../FeatureImportanceChart'
import ProneAreasPanel from '../ProneAreasPanel'

interface Props {
  rainfallMm: number
  model: ModelName
  bandMethod: BandMethod
  onSelect: (loc: LocalityRisk) => void
}

export default function RiskModelTab({ rainfallMm, model, bandMethod, onSelect }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ProneAreasPanel rainfallMm={rainfallMm} model={model} bandMethod={bandMethod} onSelect={onSelect} />
        </div>

        <div className="rounded-lg border border-slate-300 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Why: {MODEL_LABEL[model]} feature importance</h2>
          <p className="text-[11px] text-slate-400 mb-2">What the model actually weighs when scoring a location - see ML_Algorithm_Comparison_Paper.docx.</p>
          <FeatureImportanceChart model={model} />
        </div>
      </div>
    </div>
  )
}
