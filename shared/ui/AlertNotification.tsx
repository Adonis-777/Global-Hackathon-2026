import React, { useState, useEffect } from 'react';
import { AlertPayload } from '../types';

export interface AlertNotificationProps {
  alert?: AlertPayload | null;
  onDismiss?: () => void;
  onAction?: (alert: AlertPayload) => void;
  autoDismissMs?: number;
}

export const AlertNotification: React.FC<AlertNotificationProps> = ({
  alert,
  onDismiss,
  onAction,
  autoDismissMs = 12000,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      if (autoDismissMs > 0) {
        const timer = setTimeout(() => {
          setVisible(false);
          if (onDismiss) onDismiss();
        }, autoDismissMs);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [alert, autoDismissMs, onDismiss]);

  if (!alert || !visible) return null;

  const isDanger = alert.severity === 'HIGH';
  const borderColor = isDanger ? '#ff3131' : '#f6a825';
  const bgAccent = isDanger ? 'bg-[#ff3131]' : 'bg-[#f6a825]';
  const textAccent = isDanger ? 'text-[#ff3131]' : 'text-[#f6a825]';

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full px-4 animate-bounce-short pointer-events-auto font-sans">
      <div
        className="relative bg-[#000000] text-white p-5 rounded-2xl shadow-2xl border-2 overflow-hidden transition-all duration-300 backdrop-blur-lg"
        style={{
          borderColor,
          boxShadow: `0 12px 40px ${isDanger ? 'rgba(255,49,49,0.35)' : 'rgba(246,168,37,0.35)'}`,
        }}
      >
        {/* Radar Pulse Background Ring */}
        <div className="absolute -right-10 -bottom-10 w-32 h-32 rounded-full pointer-events-none opacity-20 animate-ping" style={{ backgroundColor: borderColor }} />

        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${bgAccent} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${bgAccent}`}></span>
            </span>
            <span
              className={`text-xs font-black uppercase tracking-wider ${textAccent}`}
              style={{ fontFamily: "'Figtree', sans-serif", letterSpacing: '-0.0293em', fontWeight: 783 }}
            >
              EMERGENCY BROADCAST [{alert.hexId}]
            </span>
          </div>

          <button
            onClick={() => {
              setVisible(false);
              if (onDismiss) onDismiss();
            }}
            className="text-[#b8b8b8] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Location & Message */}
        <h4 className="text-white font-bold text-base mb-1" style={{ fontFamily: "'Figtree', sans-serif", letterSpacing: '-0.0570em', fontWeight: 577 }}>
          {alert.locality} — Flood Risk Warning
        </h4>
        <p className="text-[#b8b8b8] text-xs leading-relaxed mb-3" style={{ fontFamily: "'Figtree', sans-serif", letterSpacing: '-0.0475em' }}>
          {alert.message}
        </p>

        {/* Footer Meta & Action */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            {alert.channels.map((ch) => (
              <span
                key={ch}
                className="text-[10px] uppercase font-semibold bg-white/10 text-white/90 px-2 py-0.5 rounded"
              >
                {ch}
              </span>
            ))}
            <span className="text-[#b8b8b8] text-[10px] ml-1">
              Exposed: {alert.affectedPopulation.toLocaleString()}
            </span>
          </div>

          {onAction && (
            <button
              onClick={() => onAction(alert)}
              className="bg-[#38c6ec] text-black font-bold text-xs px-3 py-1 rounded-full hover:bg-white transition-all transform active:scale-95"
              style={{ fontFamily: "'Figtree', sans-serif", fontWeight: 577 }}
            >
              View Route Advice
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertNotification;
