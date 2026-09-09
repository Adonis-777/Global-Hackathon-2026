import React, { useState, useEffect } from 'react';
import { QuantumNav } from '../../../../shared/ui/QuantumNav';
import { CyberCard } from '../../../../shared/ui/CyberCard';
import { CyberButton } from '../../../../shared/ui/CyberButton';
import { CyberLabel } from '../../../../shared/ui/CyberLabel';
import { AlertNotification } from '../../../../shared/ui/AlertNotification';
import { RiskCell, SafeRouteOption, AlertPayload } from '../../../../shared/types';
import { MockApiService } from '../../../admin-pwa/src/api/mockApi';
import { CitizenInteractiveMap } from '../components/CitizenInteractiveMap';
import { PrecautionarySteps, RiskLevel } from '../components/PrecautionarySteps';


export interface RiskMapPageProps {
  onOpenReportForm?: () => void;
}

export const RiskMapPage: React.FC<RiskMapPageProps> = ({ onOpenReportForm }) => {
  const [cells, setCells] = useState<RiskCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<RiskCell | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('map');
  const [routeGuidanceOpen, setRouteGuidanceOpen] = useState(false);
  const [emergencyAlert, setEmergencyAlert] = useState<AlertPayload | null>(null);

  // Simulated Safe Routes
  const [routes] = useState<SafeRouteOption[]>([
    {
      id: 'RTE_01',
      name: 'Eastern Bypass Corridor (Recommended)',
      via: 'Hitec City Main Rd → ORR Stretch',
      durationMinutes: 28,
      distanceKm: 14.2,
      riskScore: 12,
      isRecommended: true,
      warnings: ['Clear of all active flood zones', 'Traffic moving smoothly @ 45 km/h']
    },
    {
      id: 'RTE_02',
      name: 'Begumpet Underpass Direct Route',
      via: 'Raj Bhavan Rd → Begumpet Culvert',
      durationMinutes: 42,
      distanceKm: 9.8,
      riskScore: 94,
      isRecommended: false,
      warnings: ['CRITICAL: Water level 48cm at Begumpet Underpass', 'High risk of vehicle stall']
    },
    {
      id: 'RTE_03',
      name: 'Old City Radial Road',
      via: 'Malakpet Nala → Chaderghat Flyover',
      durationMinutes: 38,
      distanceKm: 11.5,
      riskScore: 82,
      isRecommended: false,
      warnings: ['MODERATE RISK: Water rise rate +4cm/h', 'Expect heavy congestion']
    }
  ]);

  useEffect(() => {
    MockApiService.getRiskCells().then((data) => {
      setCells(data);
      if (data.length > 0) setSelectedCell(data[0]);

      const highRisk = data.find((c) => c.severity === 'HIGH');
      if (highRisk) {
        setTimeout(() => {
          setEmergencyAlert({
            hexId: highRisk.hexId,
            locality: highRisk.locality,
            message: `AVOID AREA: Critical water accumulation detected (${highRisk.waterLevelCm}cm depth). Safe route guidance active.`,
            severity: 'HIGH',
            channels: ['SMS', 'PUSH'],
            affectedPopulation: highRisk.exposedPopulation
          });
        }, 1500);
      }
    });
  }, []);

  const filteredCells = cells.filter((c) =>
    c.locality.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.hexId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-[#38c6ec] selection:text-black pb-16">
      <QuantumNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        ctaText='Report Flood ("Uplink")'
        onCtaClick={onOpenReportForm}
        subtitle="COMMUTER"
      />

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">

        {/* Hero Commuter Banner */}
        <div className="bg-[#0e0e0e] border border-[#38c6ec]/30 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#38c6ec]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38c6ec] animate-ping" />
                <CyberLabel variant="eyebrow" color="accent">LIVE COMMUTER WATERLOGGING HUD</CyberLabel>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "'Figtree', sans-serif", letterSpacing: '-0.0572em', fontWeight: 783 }}>
                Hyderabad Urban Flood & Safe Route Guidance
              </h1>
              <p className="text-xs md:text-sm text-[#b8b8b8] mt-1 max-w-2xl" style={{ fontFamily: "'Figtree', sans-serif", letterSpacing: '-0.0475em' }}>
                Interactive CartoDB dark matter map with real-time sector risk markers. Avoid active red hotspots and route around high water accumulation in real-time.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <CyberButton variant="accent" onClick={() => setRouteGuidanceOpen(true)}>
                Safe Route Advice
              </CyberButton>
              {onOpenReportForm && (
                <CyberButton variant="white" onClick={onOpenReportForm}>
                  + Submit Flood Uplink
                </CyberButton>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Map & Locality Inspector Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Map Vector Viewer (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <CyberCard
              title="Interactive Commuter Risk Zone Map"
              subtitle="Leaflet vector map with street-pocket resolution markers & flood radius"
              showLivePulse={true}
              badge="LIVE MAP"
              className="bg-[#0a0a0a]"
            >
              {/* Search Bar Input */}
              <div className="mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search locality e.g. Begumpet, Khairatabad, Madhapur, Charminar..."
                  className="w-full bg-[#161616] border border-[#242424] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#b8b8b8] focus:border-[#38c6ec] focus:outline-none"
                />
              </div>

              {/* Leaflet Interactive Map View */}
              <CitizenInteractiveMap
                cells={filteredCells}
                selectedCell={selectedCell}
                onSelectCell={setSelectedCell}
              />

              {/* Active Selected Location Details Panel */}
              {selectedCell && (
                <div className="mt-4 bg-[#121212] border border-[#38c6ec]/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{selectedCell.locality}</h4>
                      <span className="text-xs font-mono text-[#38c6ec]">[{selectedCell.hexId}]</span>
                    </div>
                    <p className="text-xs text-[#b8b8b8] mt-1 font-mono">
                      Water Depth: <strong className="text-white">{selectedCell.waterLevelCm} cm</strong> | Flood Prob: <strong className="text-white">{(selectedCell.floodProbability * 100).toFixed(0)}%</strong>
                    </p>
                  </div>

                  <CyberButton
                    size="sm"
                    variant={selectedCell.severity === 'HIGH' ? 'danger' : 'accent'}
                    onClick={() => setRouteGuidanceOpen(true)}
                  >
                    {selectedCell.severity === 'HIGH' ? '⚠️ Avoid Zone & Reroute' : 'Check Safe Route'}
                  </CyberButton>
                </div>
              )}
            </CyberCard>
          </div>

          {/* Commuter Hazard Advice Panel (1 Col) */}
          <div className="lg:col-span-1 space-y-4">
            <CyberCard
              title="Hazard Avoidance Advice"
              subtitle="Active route warnings & rerouting advice"
              badge="AUTO NAV"
              className="bg-[#0a0a0a]"
            >
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-[#ff3131]/10 border border-[#ff3131]/30">
                  <div className="flex items-center gap-2 text-[#ff3131] font-bold text-xs">
                    <span className="w-2 h-2 rounded-full bg-[#ff3131] animate-ping" />
                    <span>HIGH RISK ADVISORY — SECTOR 4</span>
                  </div>
                  <p className="text-xs text-[#b8b8b8] mt-1 leading-relaxed">
                    "Avoid Begumpet Sector 4 (Red Zone). Use Eastern Bypass Corridor via ORR."
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424] space-y-2">
                  <span className="text-[11px] font-mono text-[#38c6ec]">FASTEST SAFE ROUTE</span>
                  <h4 className="text-sm font-bold text-white">Eastern Bypass Corridor</h4>
                  <div className="flex items-center justify-between text-xs text-[#b8b8b8] font-mono">
                    <span>Est. Time: <strong className="text-white">28 mins</strong></span>
                    <span>Distance: <strong className="text-white">14.2 km</strong></span>
                  </div>
                  <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#38c6ec] h-full w-[88%]" />
                  </div>
                  <p className="text-[11px] text-[#38c6ec] font-mono">98.8% Flood-Free Safety Index</p>
                </div>

                {onOpenReportForm && (
                  <button
                    onClick={onOpenReportForm}
                    className="w-full py-3 rounded-xl border border-dashed border-[#38c6ec]/50 bg-[#38c6ec]/5 hover:bg-[#38c6ec]/15 text-[#38c6ec] font-bold text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <span>📷 Report Waterlogging Here ("Uplink")</span>
                  </button>
                )}
              </div>
            </CyberCard>
          </div>

        </div>

        {/* Next Precautionary Steps Section */}
        <PrecautionarySteps riskLevel={(selectedCell?.severity as RiskLevel) || 'LOW'} />
      </main>

      {/* Safe Route Guidance Modal */}
      {routeGuidanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0f0f0f] border border-[#38c6ec]/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono text-[#38c6ec]">DYNAMIC ROUTE RECALCULATION</span>
                <h3 className="text-lg font-bold text-white">Safe Route Guidance & Hazard Avoidance</h3>
              </div>
              <button onClick={() => setRouteGuidanceOpen(false)} className="text-[#b8b8b8] hover:text-white">✕</button>
            </div>

            <p className="text-xs text-[#b8b8b8]">
              Routes are dynamically weighted against ML waterlogging nowcasts to keep commuters clear of submerged underpasses and stalled traffic.
            </p>

            <div className="space-y-3">
              {routes.map((rte) => (
                <div
                  key={rte.id}
                  className={`p-4 rounded-xl border transition-all ${
                    rte.isRecommended
                      ? 'bg-[#38c6ec]/10 border-[#38c6ec] shadow-[0_0_15px_rgba(56,198,236,0.2)]'
                      : 'bg-[#141414] border-[#242424]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-white">{rte.name}</h4>
                    {rte.isRecommended ? (
                      <span className="px-2 py-0.5 text-[10px] font-black bg-[#38c6ec] text-black rounded-full">RECOMMENDED</span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-black bg-[#ff3131] text-white rounded-full">HIGH RISK</span>
                    )}
                  </div>
                  <p className="text-xs text-[#b8b8b8] font-mono">Via {rte.via}</p>

                  <div className="flex items-center gap-4 mt-2 text-xs font-mono text-[#b8b8b8]">
                    <span>Duration: <strong className="text-white">{rte.durationMinutes} mins</strong></span>
                    <span>Distance: <strong className="text-white">{rte.distanceKm} km</strong></span>
                    <span>Risk Score: <strong className={rte.isRecommended ? 'text-[#38c6ec]' : 'text-[#ff3131]'}>{rte.riskScore}/100</strong></span>
                  </div>

                  <div className="mt-2 space-y-1">
                    {rte.warnings.map((w, idx) => (
                      <p key={idx} className={`text-[11px] font-mono ${rte.isRecommended ? 'text-[#38c6ec]' : 'text-[#ff3131]'}`}>
                        • {w}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10">
              <CyberButton variant="accent" onClick={() => setRouteGuidanceOpen(false)}>
                Confirm Route & Start Navigation
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Floating Retro Emergency Alert Banner */}
      <AlertNotification
        alert={emergencyAlert}
        onDismiss={() => setEmergencyAlert(null)}
        onAction={() => setRouteGuidanceOpen(true)}
      />
    </div>
  );
};

export default RiskMapPage;
