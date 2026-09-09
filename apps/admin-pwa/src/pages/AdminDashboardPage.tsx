import React, { useState, useEffect } from 'react';
import { QuantumNav } from '../../../../shared/ui/QuantumNav';
import { CyberCard } from '../../../../shared/ui/CyberCard';
import { CyberButton } from '../../../../shared/ui/CyberButton';
import { CyberLabel } from '../../../../shared/ui/CyberLabel';
import { AlertNotification } from '../../../../shared/ui/AlertNotification';
import { RiskCell, TelemetryData, SystemEvent, AlertPayload } from '../../../../shared/types';
import { MockApiService, INITIAL_SYSTEM_EVENTS } from '../api/mockApi';
import { InteractiveMap } from '../components/InteractiveMap';
import { HexGridCanvas } from '../components/HexGridCanvas';

export const AdminDashboardPage: React.FC = () => {
  const [cells, setCells] = useState<RiskCell[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [events, setEvents] = useState<SystemEvent[]>(INITIAL_SYSTEM_EVENTS);
  const [selectedCell, setSelectedCell] = useState<RiskCell | null>(null);
  const [activeTab, setActiveTab] = useState<string>('map');
  const [mapMode, setMapMode] = useState<'leaflet' | 'hexgrid'>('leaflet');
  
  // Modals & Triggers
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [activeAlertNotification, setActiveAlertNotification] = useState<AlertPayload | null>(null);
  
  // Override state
  const [overrideSeverity, setOverrideSeverity] = useState<'HIGH' | 'MODERATE' | 'LOW'>('HIGH');
  const [overrideNote, setOverrideNote] = useState('');
  
  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState('CRITICAL WATERLOGGING ADVISORY: Evacuate low-lying underpass routes immediately.');
  const [selectedChannels, setSelectedChannels] = useState<('SMS' | 'WHATSAPP' | 'PUSH')[]>(['SMS', 'WHATSAPP', 'PUSH']);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const fetchedCells = await MockApiService.getRiskCells();
    const fetchedTelemetry = await MockApiService.getTelemetry();
    setCells(fetchedCells);
    setTelemetry(fetchedTelemetry);
    if (fetchedCells.length > 0 && !selectedCell) {
      setSelectedCell(fetchedCells[0]);
    }
  };

  // Priority Queue sorted by (Flood Probability * Exposed Population)
  const priorityQueue = [...cells].sort(
    (a, b) => (b.floodProbability * b.exposedPopulation) - (a.floodProbability * a.exposedPopulation)
  );

  const handleApplyOverride = async () => {
    if (!selectedCell) return;
    try {
      const updated = await MockApiService.overrideCell(selectedCell.hexId, overrideSeverity);
      setCells((prev) => prev.map((c) => (c.hexId === updated.hexId ? updated : c)));
      setSelectedCell(updated);
      setOverrideModalOpen(false);
      setEvents((prev) => [
        {
          id: `EVT_${Date.now()}`,
          code: 'EVT_OVERRIDE',
          title: 'Human Commander Risk Override',
          locality: updated.locality,
          severity: updated.severity,
          timestamp: new Date().toLocaleTimeString(),
          details: `Commander manually adjusted severity to ${overrideSeverity}. Note: ${overrideNote || 'Ground survey verified.'}`
        },
        ...prev
      ]);
    } catch (err) {
      console.error('Failed to apply override', err);
    }
  };

  const handleTriggerBroadcast = async () => {
    if (!selectedCell) return;
    setDispatchStatus('Dispatching SMS & WhatsApp alerts via Twilio API wrapper...');
    
    const payload: AlertPayload = {
      hexId: selectedCell.hexId,
      locality: selectedCell.locality,
      message: broadcastMessage,
      severity: selectedCell.severity,
      channels: selectedChannels,
      affectedPopulation: selectedCell.exposedPopulation,
    };

    await MockApiService.triggerEmergencyAlert(payload);
    setDispatchStatus(`Successfully broadcasted to ${selectedCell.exposedPopulation.toLocaleString()} residents.`);
    
    setActiveAlertNotification(payload);
    setTimeout(() => {
      setBroadcastModalOpen(false);
      setDispatchStatus(null);
    }, 1800);
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return <span className="px-2 py-0.5 text-[11px] font-bold bg-[#ff3131]/15 text-[#ff3131] border border-[#ff3131]/40 rounded-full shrink-0">HIGH RISK</span>;
      case 'MODERATE':
        return <span className="px-2 py-0.5 text-[11px] font-bold bg-[#f6a825]/15 text-[#f6a825] border border-[#f6a825]/40 rounded-full shrink-0">MODERATE</span>;
      case 'LOW':
      default:
        return <span className="px-2 py-0.5 text-[11px] font-bold bg-[#38c6ec]/15 text-[#38c6ec] border border-[#38c6ec]/40 rounded-full shrink-0">LOW RISK</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-[#38c6ec] selection:text-black pb-16">
      {/* Floating Black Pill Navbar */}
      <QuantumNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        ctaText="Emergency Broadcast"
        onCtaClick={() => setBroadcastModalOpen(true)}
      />

      {/* Main Grid Container */}
      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Top 4 Telemetry Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <CyberCard showAccentBar={true} className="bg-[#0e0e0e] flex flex-col justify-between h-full">
            <div>
              <CyberLabel variant="eyebrow" color="muted">EXPOSED POPULATION AT RISK</CyberLabel>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-black text-[#ff3131] font-mono tracking-tight">
                  {telemetry ? `${(telemetry.totalPopulationAtRisk / 1000).toFixed(1)}k` : '41.0k'}
                </span>
                <span className="text-xs text-[#ff3131] bg-[#ff3131]/15 px-2.5 py-0.5 rounded font-bold border border-[#ff3131]/30">CRITICAL</span>
              </div>
            </div>
            <p className="text-[11px] text-[#b8b8b8] mt-3 leading-tight">Population weighted across 8 high-risk cells</p>
          </CyberCard>

          <CyberCard showAccentBar={true} className="bg-[#0e0e0e] flex flex-col justify-between h-full">
            <div>
              <CyberLabel variant="eyebrow" color="muted">ACTIVE SECTOR ALERTS</CyberLabel>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-black text-[#f6a825] font-mono tracking-tight">
                  {telemetry ? telemetry.activeAlertCount : 4} / {telemetry ? telemetry.monitoredSectors : 8}
                </span>
                <span className="text-xs text-[#f6a825] bg-[#f6a825]/15 px-2.5 py-0.5 rounded font-bold border border-[#f6a825]/30">MONITORED</span>
              </div>
            </div>
            <p className="text-[11px] text-[#b8b8b8] mt-3 leading-tight">Nala sensors & drainage telemetry stream</p>
          </CyberCard>

          <CyberCard showAccentBar={true} className="bg-[#0e0e0e] flex flex-col justify-between h-full">
            <div>
              <CyberLabel variant="eyebrow" color="muted">AVG WATER RISE RATE</CyberLabel>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-black text-[#38c6ec] font-mono tracking-tight">
                  {telemetry ? telemetry.avgWaterRiseRate : '+4.2 cm/h'}
                </span>
                <span className="text-xs text-[#38c6ec] bg-[#38c6ec]/15 px-2.5 py-0.5 rounded font-bold border border-[#38c6ec]/30">NOWCASTING</span>
              </div>
            </div>
            <p className="text-[11px] text-[#b8b8b8] mt-3 leading-tight">RF / XGBoost ensemble predictive model</p>
          </CyberCard>

          <CyberCard showAccentBar={true} className="bg-[#0e0e0e] flex flex-col justify-between h-full">
            <div>
              <CyberLabel variant="eyebrow" color="muted">MOBILIZATION PRIORITY</CyberLabel>
              <div className="flex items-center justify-between mt-2 gap-2">
                <span className="text-base font-bold text-white truncate max-w-[170px]" title={priorityQueue[0]?.locality || 'Begumpet Underpass'}>
                  {priorityQueue[0]?.locality || 'Begumpet Underpass'}
                </span>
                <span className="text-xs text-[#ff3131] font-mono font-bold shrink-0 bg-[#ff3131]/10 px-2 py-0.5 rounded border border-[#ff3131]/30">RANK #1</span>
              </div>
            </div>
            <p className="text-[11px] text-[#b8b8b8] mt-3 leading-tight">Top pump deployment dispatch target</p>
          </CyberCard>

        </div>

        {/* Middle Section: Spatial Hex Grid & Map HUD + Mobilization Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Interactive Map HUD (2 Columns) */}
          <div className="lg:col-span-2">
            <CyberCard
              title="Spatial Sector Grid & Hex Map — Hyderabad"
              subtitle="Real-time waterlogging risk scanner with spatial hexagonal polygons & severity bands"
              showLivePulse={true}
              badge="LIVE MAP HUD"
              headerAction={
                <div className="flex items-center bg-[#1a1a1a] p-1 rounded-lg border border-white/10 text-xs font-mono">
                  <button
                    onClick={() => setMapMode('leaflet')}
                    className={`px-2.5 py-1 rounded-md transition-all font-bold ${mapMode === 'leaflet' ? 'bg-[#38c6ec] text-black shadow-[0_0_8px_#38c6ec]' : 'text-[#b8b8b8] hover:text-white'}`}
                  >
                    🗺️ Circle Map
                  </button>
                  <button
                    onClick={() => setMapMode('hexgrid')}
                    className={`px-2.5 py-1 rounded-md transition-all font-bold ${mapMode === 'hexgrid' ? 'bg-[#38c6ec] text-black shadow-[0_0_8px_#38c6ec]' : 'text-[#b8b8b8] hover:text-white'}`}
                  >
                    ⬡ Hex Matrix
                  </button>
                </div>
              }
              className="bg-[#0a0a0a] min-h-[580px] flex flex-col justify-between"
            >
              {/* Map Mode Renderer */}
              {mapMode === 'leaflet' ? (
                <div className="space-y-4">
                  <InteractiveMap
                    cells={cells}
                    selectedCell={selectedCell}
                    onSelectCell={setSelectedCell}
                  />

                  {/* Active Selected Inspector Footer Drawer */}
                  {selectedCell && (
                    <div className="bg-[#121212] border border-[#38c6ec]/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xl backdrop-blur">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#38c6ec]">{selectedCell.hexId}</span>
                          <h4 className="text-sm font-bold text-white">{selectedCell.locality}</h4>
                          {getSeverityBadge(selectedCell.severity)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#b8b8b8] font-mono">
                          <span>Water Level: <strong className="text-white">{selectedCell.waterLevelCm} cm</strong></span>
                          <span>Exposed Pop: <strong className="text-white">{selectedCell.exposedPopulation.toLocaleString()}</strong></span>
                          <span>Drainage: <strong className="text-[#38c6ec]">{selectedCell.drainageStatus}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                        <CyberButton
                          size="sm"
                          variant="white"
                          onClick={() => setOverrideModalOpen(true)}
                        >
                          Manual Override
                        </CyberButton>
                        <CyberButton
                          size="sm"
                          variant="accent"
                          onClick={() => setBroadcastModalOpen(true)}
                        >
                          Broadcast Alert
                        </CyberButton>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <HexGridCanvas
                    cells={cells}
                    selectedCell={selectedCell}
                    onSelectCell={setSelectedCell}
                  />

                  {/* Active Selected Inspector Footer Drawer */}
                  {selectedCell && (
                    <div className="bg-[#121212] border border-[#38c6ec]/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xl backdrop-blur">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#38c6ec]">{selectedCell.hexId}</span>
                          <h4 className="text-sm font-bold text-white">{selectedCell.locality}</h4>
                          {getSeverityBadge(selectedCell.severity)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#b8b8b8] font-mono">
                          <span>Water Level: <strong className="text-white">{selectedCell.waterLevelCm} cm</strong></span>
                          <span>Exposed Pop: <strong className="text-white">{selectedCell.exposedPopulation.toLocaleString()}</strong></span>
                          <span>Drainage: <strong className="text-[#38c6ec]">{selectedCell.drainageStatus}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                        <CyberButton
                          size="sm"
                          variant="white"
                          onClick={() => setOverrideModalOpen(true)}
                        >
                          Manual Override
                        </CyberButton>
                        <CyberButton
                          size="sm"
                          variant="accent"
                          onClick={() => setBroadcastModalOpen(true)}
                        >
                          Broadcast Alert
                        </CyberButton>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CyberCard>
          </div>

          {/* Population-Weighted Priority Mobilization Queue */}
          <div className="lg:col-span-1">
            <CyberCard
              title="Mobilization Queue"
              subtitle="Population-Weighted Risk Priority"
              badge="AUTO RANKED"
              className="bg-[#0a0a0a] min-h-[580px] flex flex-col"
            >
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {priorityQueue.map((cell, idx) => {
                  const weightScore = Math.round((cell.floodProbability * cell.exposedPopulation) / 100);
                  const isTop = idx === 0;

                  return (
                    <div
                      key={cell.hexId}
                      onClick={() => setSelectedCell(cell)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedCell?.hexId === cell.hexId
                          ? 'border-[#38c6ec] bg-[#38c6ec]/15 shadow-[0_0_12px_rgba(56,198,236,0.25)]'
                          : 'border-[#242424] bg-[#121212] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${isTop ? 'bg-[#ff3131] text-white' : 'bg-[#242424] text-[#b8b8b8]'}`}>
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-white truncate max-w-[140px]" title={cell.locality}>
                            {cell.locality}
                          </span>
                        </div>
                        {getSeverityBadge(cell.severity)}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5 text-[11px] font-mono text-[#b8b8b8]">
                        <div>
                          <span>Prob: </span>
                          <strong className="text-white">{(cell.floodProbability * 100).toFixed(0)}%</strong>
                        </div>
                        <div>
                          <span>Exposed: </span>
                          <strong className="text-white">{cell.exposedPopulation.toLocaleString()}</strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-white/5">
                        <span className="text-[10px] text-[#38c6ec] font-mono">Impact Score: {weightScore} pts</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCell(cell);
                            setBroadcastModalOpen(true);
                          }}
                          className="text-[11px] font-bold text-white bg-white/10 hover:bg-[#38c6ec] hover:text-black px-2.5 py-1 rounded-lg transition-all"
                        >
                          Dispatch Team
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CyberCard>
          </div>

        </div>

        {/* Bottom Section: 24h Trend Analytics + Real-Time Event Log Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 24h Trend Analytics Graph */}
          <div className="lg:col-span-2">
            <CyberCard
              title="24-Hour Risk Trend Velocity & Rainfall"
              subtitle="Cumulative rainfall accumulation (mm) vs sector risk velocity index"
              badge="RECHARTS ENGINE"
              className="bg-[#0a0a0a]"
            >
              <div className="w-full flex flex-col justify-between pt-2">
                <div className="relative w-full h-[180px]">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
                    <defs>
                      <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38c6ec" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#38c6ec" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1="0" y1="30" x2="500" y2="30" stroke="#242424" strokeDasharray="3 3" />
                    <line x1="0" y1="75" x2="500" y2="75" stroke="#242424" strokeDasharray="3 3" />
                    <line x1="0" y1="120" x2="500" y2="120" stroke="#242424" strokeDasharray="3 3" />

                    {/* Area fill */}
                    <polygon points="0,135 0,130 100,120 200,80 300,30 400,20 500,40 500,135" fill="url(#cyanGrad)" />

                    {/* Risk Velocity Path (Cyan Line) */}
                    <path
                      d="M0,130 Q50,125 100,120 T200,80 T300,30 T400,20 T500,40"
                      fill="none"
                      stroke="#38c6ec"
                      strokeWidth="3"
                    />

                    {/* Rainfall Accumulation Path (Red Line) */}
                    <path
                      d="M0,140 Q50,138 100,130 T200,95 T300,45 T400,30 T500,60"
                      fill="none"
                      stroke="#ff3131"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />

                    {/* Data Points */}
                    <circle cx="100" cy="120" r="4" fill="#38c6ec" />
                    <circle cx="200" cy="80" r="4" fill="#38c6ec" />
                    <circle cx="300" cy="30" r="5" fill="#ff3131" />
                    <circle cx="400" cy="20" r="5" fill="#ff3131" />
                    <circle cx="500" cy="40" r="4" fill="#38c6ec" />
                  </svg>
                </div>

                {/* X-Axis Labels */}
                <div className="flex justify-between text-[11px] font-mono text-[#b8b8b8] px-2 pt-3 border-t border-[#242424]">
                  <span>00:00 (4.2mm)</span>
                  <span>04:00 (8.6mm)</span>
                  <span>08:00 (24.0mm)</span>
                  <span>12:00 (42.5mm)</span>
                  <span className="text-[#38c6ec] font-bold">16:00 (58.1mm) NOW</span>
                  <span>20:00 (Fcst)</span>
                </div>
              </div>
            </CyberCard>
          </div>

          {/* Real-Time Event Stream Log */}
          <div className="lg:col-span-1">
            <CyberCard
              title="Real-Time Event Stream"
              subtitle="Telemetry sensors & drainage log feed"
              badge="EVT STREAM"
              className="bg-[#0a0a0a]"
            >
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {events.map((evt) => (
                  <div key={evt.id} className="p-3 rounded-lg bg-[#121212] border border-[#242424] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[#38c6ec] font-bold">{evt.code}</span>
                      <span className="text-[10px] text-[#b8b8b8] font-mono">{evt.timestamp}</span>
                    </div>
                    <p className="font-bold text-white">{evt.title}</p>
                    <p className="text-[#b8b8b8] text-[11px] leading-snug">{evt.details}</p>
                  </div>
                ))}
              </div>
            </CyberCard>
          </div>

        </div>

      </main>

      {/* Human-in-the-Loop Manual Risk Override Modal */}
      {overrideModalOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0f0f0f] border border-[#38c6ec]/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono text-[#38c6ec]">HUMAN-IN-THE-LOOP OVERRIDE</span>
                <h3 className="text-lg font-bold text-white">{selectedCell.locality} [{selectedCell.hexId}]</h3>
              </div>
              <button onClick={() => setOverrideModalOpen(false)} className="text-[#b8b8b8] hover:text-white">✕</button>
            </div>

            <p className="text-xs text-[#b8b8b8]">
              Override ML model predictions with direct on-ground officer observation before broadcasting alerts to citizens.
            </p>

            <div>
              <label className="block text-xs font-mono text-[#b8b8b8] mb-2">SELECT OVERRIDE SEVERITY BAND</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setOverrideSeverity('HIGH')}
                  className={`p-3 rounded-xl border font-bold text-xs transition-all ${
                    overrideSeverity === 'HIGH' ? 'bg-[#ff3131] text-white border-[#ff3131] ring-2 ring-white' : 'bg-[#181818] text-[#b8b8b8] border-[#242424]'
                  }`}
                >
                  HIGH RISK (RED)
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideSeverity('MODERATE')}
                  className={`p-3 rounded-xl border font-bold text-xs transition-all ${
                    overrideSeverity === 'MODERATE' ? 'bg-[#f6a825] text-black border-[#f6a825] ring-2 ring-white' : 'bg-[#181818] text-[#b8b8b8] border-[#242424]'
                  }`}
                >
                  MODERATE (YELLOW)
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideSeverity('LOW')}
                  className={`p-3 rounded-xl border font-bold text-xs transition-all ${
                    overrideSeverity === 'LOW' ? 'bg-[#38c6ec] text-black border-[#38c6ec] ring-2 ring-white' : 'bg-[#181818] text-[#b8b8b8] border-[#242424]'
                  }`}
                >
                  LOW / CLEAR (CYAN)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#b8b8b8] mb-1">COMMANDER OBSERVER NOTE</label>
              <textarea
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="e.g. Ground survey confirmed culvert failure at 16:00."
                className="w-full bg-[#161616] border border-[#242424] rounded-xl p-3 text-xs text-white focus:border-[#38c6ec] focus:outline-none"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <CyberButton variant="ghost" onClick={() => setOverrideModalOpen(false)}>Cancel</CyberButton>
              <CyberButton variant="accent" onClick={handleApplyOverride}>Confirm & Update Risk State</CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Broadcast Trigger Modal */}
      {broadcastModalOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0f0f0f] border border-[#ff3131]/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono text-[#ff3131]">EMERGENCY ALERT DISPATCH</span>
                <h3 className="text-lg font-bold text-white">Broadcast to {selectedCell.locality}</h3>
              </div>
              <button onClick={() => setBroadcastModalOpen(false)} className="text-[#b8b8b8] hover:text-white">✕</button>
            </div>

            <div className="bg-[#ff3131]/10 border border-[#ff3131]/30 p-3 rounded-xl text-xs text-[#ff3131] font-mono">
              Target Cell: <strong>{selectedCell.hexId}</strong> | Affected Population: <strong>{selectedCell.exposedPopulation.toLocaleString()}</strong>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#b8b8b8] mb-1">DISPATCH MESSAGE (SMS & WHATSAPP)</label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full bg-[#161616] border border-[#242424] rounded-xl p-3 text-xs text-white focus:border-[#38c6ec] focus:outline-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[#b8b8b8] mb-2">DISPATCH CHANNELS</label>
              <div className="flex gap-4 text-xs font-mono">
                {['SMS', 'WHATSAPP', 'PUSH'].map((ch) => (
                  <label key={ch} className="flex items-center gap-2 cursor-pointer text-white">
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(ch as any)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChannels([...selectedChannels, ch as any]);
                        } else {
                          setSelectedChannels(selectedChannels.filter((c) => c !== ch));
                        }
                      }}
                      className="accent-[#38c6ec]"
                    />
                    <span>{ch}</span>
                  </label>
                ))}
              </div>
            </div>

            {dispatchStatus && (
              <div className="p-3 bg-[#38c6ec]/10 border border-[#38c6ec]/40 rounded-xl text-xs text-[#38c6ec] font-mono animate-pulse">
                {dispatchStatus}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <CyberButton variant="ghost" onClick={() => setBroadcastModalOpen(false)}>Cancel</CyberButton>
              <CyberButton variant="danger" onClick={handleTriggerBroadcast}>Trigger Emergency Dispatch</CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Active Floating Alert Notification Banner */}
      <AlertNotification
        alert={activeAlertNotification}
        onDismiss={() => setActiveAlertNotification(null)}
      />

    </div>
  );
};

export default AdminDashboardPage;
