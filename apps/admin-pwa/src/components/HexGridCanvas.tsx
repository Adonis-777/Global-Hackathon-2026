import React from 'react';
import { RiskCell } from '../../../../shared/types';

export interface HexGridCanvasProps {
  cells: RiskCell[];
  selectedCell: RiskCell | null;
  onSelectCell: (cell: RiskCell) => void;
}

export const HexGridCanvas: React.FC<HexGridCanvasProps> = ({
  cells,
  selectedCell,
  onSelectCell,
}) => {
  return (
    <div className="relative w-full min-h-[440px] bg-[#050505] rounded-xl border border-[#242424] overflow-hidden p-6 flex flex-col justify-between">
      {/* Background Matrix Grid */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(56,198,236,0.25) 0%, transparent 70%),
            linear-gradient(to right, rgba(56,198,236,0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56,198,236,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 32px 32px, 32px 32px',
        }}
      />

      {/* Cyan Animated Scanner Sweep Beam */}
      <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-[#38c6ec] to-transparent shadow-[0_0_20px_#38c6ec] animate-scan pointer-events-none z-10" />

      {/* Top Header Bar */}
      <div className="relative z-20 flex flex-wrap justify-between items-center text-[11px] text-[#b8b8b8] font-mono bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#38c6ec] animate-ping" />
          <span className="font-bold text-white">QUANTUM² SPATIAL HEXAGON MATRIX — HYDERABAD</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#ff3131]" /> High Risk</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#f6a825]" /> Moderate</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#38c6ec]" /> Low / Normal</span>
        </div>
      </div>

      {/* Honeycomb SVG / Polygon Hex Cell Matrix */}
      <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 my-4">
        {cells.map((cell) => {
          const isSelected = selectedCell?.hexId === cell.hexId;
          const isHigh = cell.severity === 'HIGH';
          const isMod = cell.severity === 'MODERATE';

          const strokeColor = isHigh ? '#ff3131' : isMod ? '#f6a825' : '#38c6ec';
          const bgColor = isHigh ? 'bg-[#ff3131]/15' : isMod ? 'bg-[#f6a825]/15' : 'bg-[#38c6ec]/15';
          const glowShadow = isHigh
            ? 'shadow-[0_0_20px_rgba(255,49,49,0.4)]'
            : isMod
            ? 'shadow-[0_0_20px_rgba(246,168,37,0.4)]'
            : 'shadow-[0_0_20px_rgba(56,198,236,0.4)]';

          return (
            <div
              key={cell.hexId}
              onClick={() => onSelectCell(cell)}
              className={`relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer transform hover:-translate-y-1 ${bgColor} ${
                isSelected ? `${glowShadow} ring-2 ring-white border-white` : 'border-white/10 hover:border-white/30'
              }`}
              style={{ borderColor: isSelected ? '#ffffff' : strokeColor }}
            >
              {/* Hex Header Badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                    <polygon points="7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5" stroke={strokeColor} strokeWidth="1.5" fill={strokeColor} fillOpacity="0.2" />
                  </svg>
                  <span className="text-[11px] font-mono font-bold text-white">{cell.hexId}</span>
                </div>
                {cell.manualOverride && (
                  <span className="text-[9px] bg-white text-black font-extrabold px-1.5 py-0.5 rounded">OVERRIDDEN</span>
                )}
              </div>

              {/* Locality Title */}
              <h4 className="text-sm font-bold text-white truncate" title={cell.locality}>{cell.locality}</h4>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-white/10 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-[#b8b8b8] block">WATER DEPTH</span>
                  <strong className="text-white font-bold">{cell.waterLevelCm} cm</strong>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#b8b8b8] block">FLOOD PROB</span>
                  <strong className="font-black" style={{ color: strokeColor }}>
                    {(cell.floodProbability * 100).toFixed(0)}%
                  </strong>
                </div>
              </div>

              {/* Risk Score Meter */}
              <div className="w-full bg-black/60 h-2 rounded-full mt-3 overflow-hidden border border-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${cell.riskScore}%`,
                    backgroundColor: strokeColor,
                    boxShadow: `0 0 8px ${strokeColor}`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Matrix Footnote */}
      <div className="relative z-20 text-[10px] font-mono text-[#b8b8b8] text-center pt-2 border-t border-white/10">
        Spatial Cell Resolution: 30m SRTM DEM Interpolation | Active Sensors: 8 Sector Hexes Monitored
      </div>
    </div>
  );
};

export default HexGridCanvas;
