import React from 'react';

export interface CyberLabelProps {
  children: React.ReactNode;
  variant?: 'display' | 'title' | 'heading' | 'body' | 'eyebrow' | 'ui';
  color?: 'ink' | 'inkSoft' | 'muted' | 'accent' | 'danger' | 'warning' | 'white';
  as?: React.ElementType;
  className?: string;
}

export const CyberLabel: React.FC<CyberLabelProps> = ({
  children,
  variant = 'body',
  color = 'ink',
  as: Component = 'span',
  className = '',
}) => {
  const getTrackingAndWeight = () => {
    switch (variant) {
      case 'display':
        return { letterSpacing: '-0.0572em', fontWeight: 783, fontSize: '2.25rem', lineHeight: '2.5rem' };
      case 'title':
        return { letterSpacing: '-0.0570em', fontWeight: 577, fontSize: '1.25rem', lineHeight: '1.75rem' };
      case 'heading':
        return { letterSpacing: '-0.0200em', fontWeight: 511, fontSize: '1rem', lineHeight: '1.5rem' };
      case 'eyebrow':
        return { letterSpacing: '-0.0293em', fontWeight: 388, fontSize: '0.75rem', lineHeight: '1rem', textTransform: 'uppercase' as const };
      case 'ui':
        return { letterSpacing: '-0.0080em', fontWeight: 500, fontSize: '0.875rem', lineHeight: '1.25rem' };
      case 'body':
      default:
        return { letterSpacing: '-0.0475em', fontWeight: 470, fontSize: '0.875rem', lineHeight: '1.25rem' };
    }
  };

  const getColorClass = () => {
    switch (color) {
      case 'inkSoft':
        return 'text-[#2e2e2e]';
      case 'muted':
        return 'text-[#b8b8b8]';
      case 'accent':
        return 'text-[#38c6ec]';
      case 'danger':
        return 'text-[#ff3131]';
      case 'warning':
        return 'text-[#f6a825]';
      case 'white':
        return 'text-[#ffffff]';
      case 'ink':
      default:
        return 'text-[#000000]';
    }
  };

  const { letterSpacing, fontWeight, fontSize, lineHeight, textTransform } = getTrackingAndWeight();

  return (
    <Component
      className={`${getColorClass()} ${className}`}
      style={{
        fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        letterSpacing,
        fontWeight,
        fontSize: className.includes('text-') ? undefined : fontSize,
        lineHeight: className.includes('leading-') ? undefined : lineHeight,
        textTransform,
      }}
    >
      {children}
    </Component>
  );
};

export default CyberLabel;
