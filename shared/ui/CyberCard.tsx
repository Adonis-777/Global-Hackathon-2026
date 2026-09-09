import React from 'react';

export interface CyberCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showAccentBar?: boolean;
  showLivePulse?: boolean;
  statusText?: string;
  badge?: string;
  badgeVariant?: 'accent' | 'danger' | 'warning' | 'muted';
  className?: string;
  headerAction?: React.ReactNode;
  variant?: 'dark' | 'light';
}

export const CyberCard: React.FC<CyberCardProps> = ({
  children,
  title,
  subtitle,
  showAccentBar = true,
  showLivePulse = false,
  statusText = 'LIVE UPDATING',
  badge,
  badgeVariant = 'accent',
  className = '',
  headerAction,
  variant = 'dark',
}) => {
  const getBadgeStyle = () => {
    switch (badgeVariant) {
      case 'danger':
        return 'bg-[#ff3131]/15 text-[#ff3131] border-[#ff3131]/40 font-bold';
      case 'warning':
        return 'bg-[#f6a825]/15 text-[#f6a825] border-[#f6a825]/40 font-bold';
      case 'muted':
        return 'bg-[#2e2e2e]/40 text-[#b8b8b8] border-white/10 font-medium';
      case 'accent':
      default:
        return 'bg-[#38c6ec]/15 text-[#38c6ec] border-[#38c6ec]/40 font-bold';
    }
  };

  const isLight = variant === 'light';
  const baseBg = isLight ? 'bg-[#f2f2f2] text-[#000000] border-[#ededed]' : 'bg-[#0e0e0e] text-white border-[#242424]';

  return (
    <div
      className={`relative ${baseBg} border p-5 sm:p-6 shadow-xl transition-all duration-300 ${
        showAccentBar ? 'pl-6 sm:pl-7' : ''
      } ${className}`}
      style={{
        borderRadius: '16px',
        boxShadow: isLight
          ? '0 12px 40px rgba(2, 72, 105, 0.12)'
          : '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 1px rgba(56, 198, 236, 0.15)',
      }}
    >
      {/* Vertical Cyan Accent Bar */}
      {showAccentBar && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#38c6ec] rounded-l-2xl shadow-[0_0_12px_#38c6ec]" />
      )}

      {/* Header Bar if title/badge provided */}
      {(title || subtitle || badge || showLivePulse || headerAction) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            {showLivePulse && (
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38c6ec] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#38c6ec]"></span>
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h3
                  className={`${isLight ? 'text-[#000000]' : 'text-white'} font-semibold text-base leading-tight truncate`}
                  style={{
                    fontFamily: "'Figtree', sans-serif",
                    fontWeight: 511,
                    letterSpacing: '-0.0200em',
                  }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p
                  className="text-[#b8b8b8] text-xs mt-0.5 leading-normal"
                  style={{
                    fontFamily: "'Figtree', sans-serif",
                    fontWeight: 388,
                    letterSpacing: '-0.0293em',
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {showLivePulse && (
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider text-[#38c6ec] bg-[#38c6ec]/10 px-2 py-0.5 rounded border border-[#38c6ec]/30">
                {statusText}
              </span>
            )}
            {badge && (
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full border ${getBadgeStyle()}`}
                style={{
                  fontFamily: "'Figtree', sans-serif",
                  letterSpacing: '-0.0080em',
                }}
              >
                {badge}
              </span>
            )}
            {headerAction}
          </div>
        </div>
      )}

      {/* Card Body */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default CyberCard;
