import React from 'react';

export interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'white' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const CyberButton: React.FC<CyberButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'accent':
        return 'bg-[#38c6ec] text-[#000000] hover:bg-[#0db5ed] border border-[#38c6ec] shadow-[0_0_15px_rgba(56,198,236,0.35)]';
      case 'white':
        return 'bg-[#ffffff] text-[#000000] hover:bg-[#f2f2f2] border border-[#ededed] shadow-sm';
      case 'danger':
        return 'bg-[#ff3131] text-[#ffffff] hover:bg-[#d92626] border border-[#ff3131] shadow-[0_0_15px_rgba(255,49,49,0.35)]';
      case 'ghost':
        return 'bg-transparent text-[#000000] hover:bg-[#ededed] border border-transparent';
      case 'primary':
      default:
        return 'bg-[#000000] text-[#ffffff] hover:border-[#38c6ec] border border-[#2e2e2e] hover:shadow-[0_0_12px_rgba(56,198,236,0.25)]';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1 text-xs gap-1.5 min-h-[32px]';
      case 'lg':
        return 'px-6 py-3 text-base gap-2.5 min-h-[48px]';
      case 'md':
      default:
        return 'px-4 py-2 text-sm gap-2 min-h-[40px]';
    }
  };

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center font-bold transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${getVariantStyles()} ${getSizeStyles()} ${className}`}
      style={{
        borderRadius: '17px',
        fontFamily: "'Figtree', sans-serif",
        fontWeight: 577,
        letterSpacing: '-0.0080em',
      }}
      {...props}
    >
      {icon && <span className="flex items-center justify-center">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export default CyberButton;
