export type SeverityLevel = 'HIGH' | 'MODERATE' | 'LOW' | 'NORMAL';

export interface RiskCell {
  hexId: string;
  locality: string;
  riskScore: number; // 0 to 100
  floodProbability: number; // 0.0 to 1.0
  population: number;
  exposedPopulation: number;
  severity: SeverityLevel;
  waterLevelCm: number;
  drainageStatus: 'BLOCKED' | 'PARTIAL' | 'CLEAR' | 'CRITICAL';
  coords: {
    lat: number;
    lng: number;
  };
  manualOverride?: {
    severity: SeverityLevel;
    updatedBy: string;
    updatedAt: string;
  };
}

export interface ReportData {
  id?: string;
  userId: string;
  locality: string;
  severityLevel: number; // 1 to 5
  waterDepthCm: number;
  description: string;
  photoUrl?: string;
  timestamp: string;
  coords: {
    lat: number;
    lng: number;
  };
  status: 'PENDING' | 'VERIFIED' | 'RESOLVED';
}

export interface AlertPayload {
  hexId: string;
  locality: string;
  message: string;
  severity: SeverityLevel;
  channels: ('SMS' | 'WHATSAPP' | 'PUSH')[];
  affectedPopulation: number;
  timestamp?: string;
}

export interface SystemEvent {
  id: string;
  code: string; // e.g. EVT_1025
  title: string;
  locality: string;
  severity: SeverityLevel;
  timestamp: string;
  details: string;
}

export interface TelemetryData {
  totalPopulationAtRisk: number;
  activeAlertCount: number;
  monitoredSectors: number;
  highRiskSectors: number;
  avgWaterRiseRate: string;
  lastUpdated: string;
  trend24h: {
    time: string;
    riskVelocity: number;
    rainfallMm: number;
    alerts: number;
  }[];
}

export interface SafeRouteOption {
  id: string;
  name: string;
  via: string;
  durationMinutes: number;
  distanceKm: number;
  riskScore: number; // lower is safer
  isRecommended: boolean;
  warnings: string[];
}
