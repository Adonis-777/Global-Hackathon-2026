import React, { useState } from 'react';

export interface NavLinkItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface QuantumNavProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  ctaText?: string;
  onCtaClick?: () => void;
  customLinks?: NavLinkItem[];
  subtitle?: string;
}

export const QuantumNav: React.FC<QuantumNavProps> = ({
  activeTab = 'map',
  onTabChange,
  ctaText = 'Broadcast Alert',
  onCtaClick,
  customLinks,
  subtitle = 'HYD.NOWCAST',
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const defaultLinks: NavLinkItem[] = [
    { label: 'Map HUD', href: 'map', active: activeTab === 'map' },
    { label: 'Mobilization Queue', href: 'queue', active: activeTab === 'queue' },
    { label: 'Telemetry', href: 'telemetry', active: activeTab === 'telemetry' },
    { label: 'Citizen Uplink', href: 'uplink', active: activeTab === 'uplink' },
  ];

  const links = customLinks || defaultLinks;

  const handleLinkClick = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (onTabChange) {
      onTabChange(href);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-4 z-50 w-full max-w-7xl mx-auto px-4 pointer-events-auto font-sans">
      <nav
        className="relative flex items-center justify-between px-5 bg-[#000000] text-white shadow-2xl transition-all duration-300"
        style={{
          height: '52px',
          borderRadius: '26px',
          border: '1px solid rgba(56, 198, 236, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 12px rgba(56, 198, 236, 0.15)',
        }}
      >
        {/* Brand & Logo Section */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 bg-[#000000] border border-[#38c6ec]/40 rounded-full shadow-[0_0_8px_rgba(56,198,236,0.5)]">
            <svg
              width="26"
              height="25"
              viewBox="0 0 26 25"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-[#38c6ec]"
            >
              <polygon points="13,2 24,8 24,17 13,23 2,17 2,8" stroke="#38c6ec" strokeWidth="2" fill="none" />
              <circle cx="13" cy="12.5" r="4" fill="#38c6ec" />
              <path d="M13 2.5 L13 8.5 M13 16.5 L13 22.5" stroke="#38c6ec" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-white tracking-tight font-black text-base"
              style={{
                fontFamily: "'Figtree', sans-serif",
                fontWeight: 783,
                letterSpacing: '-0.0572em',
              }}
            >
              Quantum<sup className="text-[#38c6ec] font-bold text-xs ml-0.5">²</sup>
            </span>
            <span
              className="text-[#b8b8b8] text-[10px] tracking-wider uppercase bg-[#2e2e2e]/80 px-2 py-0.5 rounded-full border border-white/10"
              style={{
                letterSpacing: '-0.0293em',
                fontWeight: 388,
              }}
            >
              [{subtitle}]
            </span>
          </div>
        </div>

        {/* Desktop Links Bar */}
        <div className="hidden md:flex items-center space-x-1 bg-[#2e2e2e]/40 px-3 py-1 rounded-full border border-white/5">
          {links.map((link) => (
            <a
              key={link.href}
              href={`#${link.href}`}
              onClick={(e) => handleLinkClick(link.href, e)}
              className={`px-3 py-1 text-xs transition-all duration-200 cursor-pointer ${
                link.active || activeTab === link.href
                  ? 'text-[#38c6ec] font-bold bg-[#38c6ec]/10 border border-[#38c6ec]/30 shadow-[0_0_8px_rgba(56,198,236,0.2)]'
                  : 'text-[#b8b8b8] hover:text-white font-medium hover:bg-white/5'
              }`}
              style={{
                borderRadius: '14px',
                fontFamily: "'Figtree', sans-serif",
                letterSpacing: '-0.0080em',
                fontWeight: link.active || activeTab === link.href ? 577 : 500,
              }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Action CTA & Mobile Burger Toggle */}
        <div className="flex items-center gap-3">
          {ctaText && (
            <button
              onClick={onCtaClick}
              className="bg-[#38c6ec] text-[#000000] hover:bg-white font-bold text-xs px-4 py-1.5 transition-all duration-200 transform hover:scale-[1.03] active:scale-95 shadow-[0_0_12px_rgba(56,198,236,0.4)]"
              style={{
                borderRadius: '17px',
                fontFamily: "'Figtree', sans-serif",
                fontWeight: 577,
                letterSpacing: '-0.0080em',
              }}
            >
              {ctaText}
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-[#b8b8b8] hover:text-white p-1 focus:outline-none"
            aria-label="Toggle mobile menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 bg-[#000000] border border-[#38c6ec]/30 rounded-2xl p-3 shadow-2xl flex flex-col space-y-1 backdrop-blur-md">
          {links.map((link) => (
            <a
              key={link.href}
              href={`#${link.href}`}
              onClick={(e) => handleLinkClick(link.href, e)}
              className={`px-4 py-2 text-sm rounded-xl transition-colors ${
                link.active || activeTab === link.href
                  ? 'text-[#38c6ec] font-bold bg-[#38c6ec]/15 border border-[#38c6ec]/30'
                  : 'text-[#b8b8b8] hover:text-white hover:bg-white/5 font-medium'
              }`}
              style={{
                fontFamily: "'Figtree', sans-serif",
                letterSpacing: '-0.0080em',
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
};

export default QuantumNav;
