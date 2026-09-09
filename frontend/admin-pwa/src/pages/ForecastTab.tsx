import { useState } from 'react'
import type { BandMethod, ModelName } from '../api'
import ModelValidationPanel from '../ModelValidationPanel'
import SimulationPanel from '../SimulationPanel'

interface Props {
  model: ModelName
  bandMethod: BandMethod
  onTick: (rainfallMm: number) => void
}

export default function ForecastTab({ model, bandMethod, onTick }: Props) {
  const [jumpToHour, setJumpToHour] = useState<number | null>(null)

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <SimulationPanel
        model={model}
        bandMethod={bandMethod}
        onTick={onTick}
        jumpToHour={jumpToHour}
        onJumpHandled={() => setJumpToHour(null)}
      />
      <ModelValidationPanel model={model} onJumpToEvent={setJumpToHour} />
    </div>
  )
}
