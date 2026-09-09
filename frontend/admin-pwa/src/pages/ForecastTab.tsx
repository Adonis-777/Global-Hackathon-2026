import type { BandMethod, ModelName } from '../api'
import SimulationPanel from '../SimulationPanel'

interface Props {
  model: ModelName
  bandMethod: BandMethod
  onTick: (rainfallMm: number) => void
}

export default function ForecastTab({ model, bandMethod, onTick }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <SimulationPanel model={model} bandMethod={bandMethod} onTick={onTick} />
    </div>
  )
}
