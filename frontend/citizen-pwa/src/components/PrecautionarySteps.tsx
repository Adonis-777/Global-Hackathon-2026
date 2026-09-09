import React from 'react';
import { CyberCard } from '../../../shared/ui/CyberCard';
import { CyberLabel } from '../../../shared/ui/CyberLabel';

export type RiskLevel = 'HIGH' | 'MODERATE' | 'LOW';

interface PrecautionaryStepsProps {
  riskLevel: RiskLevel;
}

const RISK_MAPPING: Record<RiskLevel, {
  badge: string;
  badgeVariant: 'danger' | 'warning' | 'accent';
  color: 'danger' | 'warning' | 'accent';
  steps: string[]
}> = {
  HIGH: {
    badge: 'URGENT',
    badgeVariant: 'danger',
    color: 'danger',
    steps: [
      'Evacuate immediately to designated higher ground.',
      'Avoid all underpasses, bridges, and low-lying areas.',
      'Shut off electricity and gas if water enters your premises.',
      'Contact emergency services via the emergency uplink.'
    ]
  },
  MODERATE: {
    badge: 'CAUTION',
    badgeVariant: 'warning',
    color: 'warning',
    steps: [
      'Monitor official weather alerts and city telemetry updates.',
      'Avoid known flood-prone zones (e.g., Begumpet, Hitech City underpasses).',
      'Prepare an emergency kit with essentials (water, medication, torch).',
      'Check on elderly neighbors and vulnerable residents.'
    ]
  },
  LOW: {
    badge: 'AWARENESS',
    badgeVariant: 'accent',
    color: 'accent',
    steps: [
      'Ensure storm drains near your residence are clear of debris.',
      'Stay informed via the Quantum² Risk Map.',
      'Review evacuation routes and family emergency plans.',
      'Keep a torch and batteries accessible.'
    ]
  }
};

export const PrecautionarySteps: React.FC<PrecautionaryStepsProps> = ({ riskLevel = 'LOW' }) => {
  const config = RISK_MAPPING[riskLevel] || RISK_MAPPING.LOW;

  return (
    <CyberCard
      title="Next precautionary steps"
      subtitle="Actionable advice based on current risk level"
      badge={config.badge}
      badgeVariant={config.badgeVariant}
      showLivePulse={true}
      className="bg-[#0a0a0a] mt-4"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <CyberLabel variant="eyebrow" color={config.color}>
            {config.badge} STATUS GUIDANCE
          </CyberLabel>
        </div>
        <ul className="space-y-3">
          {config.steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#38c6ec] shrink-0 shadow-[0_0_6px_#38c6ec]" />
              <CyberLabel
                variant="body"
                color="white"
                className="text-xs leading-relaxed"
              >
                {step}
              </CyberLabel>
            </li>
          ))}
        </ul>
      </div>
    </CyberCard>
  );
};

export default PrecautionarySteps;
