// components/grimoire/RuneButton.tsx
import React from 'react';

interface RuneButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  label: string;
  icon?: React.ReactNode; // Bisa pass icon SVG nanti
  fullWidth?: boolean;
}

export const RuneButton: React.FC<RuneButtonProps> = ({ 
  variant = 'primary', 
  label, 
  icon,
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "font-pixel text-xs py-3 px-4 border-b-4 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase tracking-wider";
  
  const variants = {
    primary: "bg-gold text-void border-orange-800 hover:brightness-110",
    secondary: "bg-wood text-parchment border-black hover:bg-opacity-90",
    danger: "bg-blood text-white border-red-900 hover:brightness-110",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} shadow-pixel-sm ${className}`}
      {...props}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {label}
    </button>
  );
};