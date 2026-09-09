import { RiskCell, TelemetryData, SystemEvent, AlertPayload } from '../../../../shared/types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const INITIAL_RISK_CELLS: RiskCell[] = [
  {
    hexId: 'HYD-HEX-101',
    locality: 'Begumpet Underpass',
    riskScore: 92,
    floodProbability: 0.92,
    population: 4200,
    exposedPopulation: 3864,
    severity: 'HIGH',
    waterLevelCm: 48,
    drainageStatus: 'CRITICAL',
    coords: { lat: 17.4447, lng: 78.4664 }
  },
  {
    hexId: 'HYD-HEX-102',
    locality: 'Khairatabad Circle',
    riskScore: 84,
    floodProbability: 0.84,
    population: 6500,
    exposedPopulation: 5460,
    severity: 'HIGH',
    waterLevelCm: 35,
    drainageStatus: 'BLOCKED',
    coords: { lat: 17.4116, lng: 78.4623 }
  },
  {
    hexId: 'HYD-HEX-103',
    locality: 'LB Nagar Junction',
    riskScore: 68,
    floodProbability: 0.68,
    population: 8900,
    exposedPopulation: 6052,
    severity: 'MODERATE',
    waterLevelCm: 22,
    drainageStatus: 'PARTIAL',
    coords: { lat: 17.3541, lng: 78.5492 }
  },
  {
    hexId: 'HYD-HEX-104',
    locality: 'Madhapur Cyber Towers',
    riskScore: 45,
    floodProbability: 0.45,
    population: 12000,
    exposedPopulation: 5400,
    severity: 'MODERATE',
    waterLevelCm: 14,
    drainageStatus: 'PARTIAL',
    coords: { lat: 17.4504, lng: 78.3808 }
  },
  {
    hexId: 'HYD-HEX-105',
    locality: 'Malakpet Nala',
    riskScore: 95,
    floodProbability: 0.95,
    population: 5400,
    exposedPopulation: 5130,
    severity: 'HIGH',
    waterLevelCm: 62,
    drainageStatus: 'CRITICAL',
    coords: { lat: 17.3753, lng: 78.4984 }
  },
  {
    hexId: 'HYD-HEX-106',
    locality: 'Tolichowki Flyover',
    riskScore: 76,
    floodProbability: 0.76,
    population: 7800,
    exposedPopulation: 5928,
    severity: 'HIGH',
    waterLevelCm: 29,
    drainageStatus: 'BLOCKED',
    coords: { lat: 17.4042, lng: 78.4146 }
  },
  {
    hexId: 'HYD-HEX-107',
    locality: 'Ameerpet Metro Corridor',
    riskScore: 32,
    floodProbability: 0.32,
    population: 11000,
    exposedPopulation: 3520,
    severity: 'LOW',
    waterLevelCm: 8,
    drainageStatus: 'CLEAR',
    coords: { lat: 17.4375, lng: 78.4482 }
  },
  {
    hexId: 'HYD-HEX-108',
    locality: 'Old City Charminar Zone',
    riskScore: 61,
    floodProbability: 0.61,
    population: 15000,
    exposedPopulation: 9150,
    severity: 'MODERATE',
    waterLevelCm: 19,
    drainageStatus: 'PARTIAL',
    coords: { lat: 17.3616, lng: 78.4747 }
  }
];

export const INITIAL_SYSTEM_EVENTS: SystemEvent[] = [
  {
    id: 'EVT_1025',
    code: 'EVT_1025',
    title: 'Nala Water Level Spike Alert',
    locality: 'Begumpet Underpass',
    severity: 'HIGH',
    timestamp: '16:02:15',
    details: 'Ultrasonic sensor #42 detected +14cm rise in 10 mins. Drainage throughput down 70%.'
  },
  {
    id: 'EVT_1026',
    code: 'EVT_1026',
    title: 'Debris Drainage Blockage',
    locality: 'Malakpet Nala',
    severity: 'HIGH',
    timestamp: '15:58:40',
    details: 'Civic camera feed flags severe solid waste obstruction near railway culvert.'
  },
  {
    id: 'EVT_1027',
    code: 'EVT_1027',
    title: 'Moderate Rainfall Accumulation',
    locality: 'LB Nagar Junction',
    severity: 'MODERATE',
    timestamp: '15:45:10',
    details: 'AWS Station #09 recorded 28mm/hr precipitation. Surface runoff pooling.'
  },
  {
    id: 'EVT_1028',
    code: 'EVT_1028',
    title: 'Traffic Diversion Activated',
    locality: 'Tolichowki Flyover',
    severity: 'HIGH',
    timestamp: '15:30:00',
    details: 'Police traffic control advisory issued for low-lying underpass.'
  }
];

export class MockApiService {
  private static cells: RiskCell[] = [...INITIAL_RISK_CELLS];

  static async getRiskCells(): Promise<RiskCell[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/risk-map`);
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch {
      // Fallback offline mode
    }
    return this.cells;
  }

  static async getTelemetry(): Promise<TelemetryData> {
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry`);
      if (res.ok) {
        const json = await res.json();
        return json.telemetry;
      }
    } catch {
      // Fallback
    }

    const totalPop = this.cells
      .filter((c) => c.severity === 'HIGH' || c.severity === 'MODERATE')
      .reduce((sum, c) => sum + c.exposedPopulation, 0);

    return {
      totalPopulationAtRisk: totalPop,
      activeAlertCount: this.cells.filter((c) => c.severity === 'HIGH').length,
      monitoredSectors: this.cells.length,
      highRiskSectors: this.cells.filter((c) => c.severity === 'HIGH').length,
      avgWaterRiseRate: '+4.2 cm/hr',
      lastUpdated: new Date().toLocaleTimeString(),
      trend24h: [
        { time: '00:00', riskVelocity: 12, rainfallMm: 4.2, alerts: 10 },
        { time: '04:00', riskVelocity: 18, rainfallMm: 8.6, alerts: 22 },
        { time: '08:00', riskVelocity: 45, rainfallMm: 24.0, alerts: 58 },
        { time: '12:00', riskVelocity: 82, rainfallMm: 42.5, alerts: 110 },
        { time: '16:00', riskVelocity: 95, rainfallMm: 58.1, alerts: 142 },
        { time: '20:00', riskVelocity: 78, rainfallMm: 38.0, alerts: 98 },
      ]
    };
  }

  static async overrideCell(hexId: string, newSeverity: 'HIGH' | 'MODERATE' | 'LOW' | 'NORMAL'): Promise<RiskCell> {
    try {
      const res = await fetch(`${API_BASE_URL}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hexId, newSeverity, commanderId: 'CMD_HYD_OFFICER_01' })
      });
      if (res.ok) {
        const json = await res.json();
        return json.updatedCell;
      }
    } catch {
      // Fallback
    }

    const cell = this.cells.find((c) => c.hexId === hexId);
    if (cell) {
      cell.severity = newSeverity;
      cell.manualOverride = {
        severity: newSeverity,
        updatedBy: 'CMD_HYD_OFFICER_01',
        updatedAt: new Date().toLocaleTimeString()
      };
      if (newSeverity === 'HIGH') {
        cell.riskScore = 90;
        cell.floodProbability = 0.90;
      } else if (newSeverity === 'LOW' || newSeverity === 'NORMAL') {
        cell.riskScore = 20;
        cell.floodProbability = 0.20;
      }
      return { ...cell };
    }
    throw new Error('Cell not found');
  }

  static async triggerEmergencyAlert(payload: AlertPayload): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    return {
      success: True,
      hexId: payload.hexId,
      locality: payload.locality,
      severity: payload.severity,
      affectedPopulation: payload.affectedPopulation,
      dispatches: payload.channels.map((ch) => ({ channel: ch, status: 'MOCK_DISPATCHED' })),
      timestamp: new Date().toISOString()
    };
  }
}
