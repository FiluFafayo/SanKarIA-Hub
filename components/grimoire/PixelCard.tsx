// components/grimoire/PixelCard.tsx
import React from 'react';

interface PixelCardProps {
  children: React.ReactNode;
  variant?: 'surface' | 'paper' | 'danger';
  className?: string;
  onClick?: () => void;
}

export const PixelCard: React.FC<PixelCardProps> = ({ 
  children, 
  variant = 'surface', 
  className = '',
  onClick
}) => {
  const bgColors = {
    surface: 'bg-surface border-wood text-parchment',
    paper: 'bg-parchment border-wood text-void',
    danger: 'bg-blood border-black text-white',
  };

  return (
    <div 
      onClick={onClick}
      className={`
        ${bgColors[variant]} 
        border-2 
        shadow-pixel-md 
        p-4 
        relative
        ${onClick ? 'cursor-pointer active:translate-y-1 active:shadow-pixel-sm transition-all' : ''}
        ${className}
      `}
    >
      {/* Optional: Corner decoration pixels for extra retro feel */}
      <div className="absolute top-0 left-0 w-1 h-1 bg-inherit -translate-x-1 -translate-y-1" />
      <div className="absolute top-0 right-0 w-1 h-1 bg-inherit translate-x-1 -translate-y-1" />
      <div className="absolute bottom-0 left-0 w-1 h-1 bg-inherit -translate-x-1 translate-y-1" />
      <div className="absolute bottom-0 right-0 w-1 h-1 bg-inherit translate-x-1 translate-y-1" />
      
      {children}
    </div>
  );
};