// components/grimoire/StatBar.tsx
import React from 'react';

interface StatBarProps {
  label: string;
  current: number;
  max: number;
  color: 'blood' | 'mana' | 'stamina' | 'xp';
  showValue?: boolean;
}

export const StatBar: React.FC<StatBarProps> = ({ label, current, max, color, showValue = true }) => {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  
  const colors = {
    blood: 'bg-blood',
    mana: 'bg-mana',
    stamina: 'bg-stamina',
    xp: 'bg-purple-600'
  };

  return (
    <div className="w-full mb-1">
      <div className="flex justify-between text-[8px] font-pixel text-faded uppercase mb-1 px-1">
        <span>{label}</span>
        {showValue && <span>{current}/{max}</span>}
      </div>
      
      {/* Container Bar */}
      <div className="relative h-4 w-full bg-black border-2 border-wood shadow-pixel-inset">
        {/* Ghost Bar (Putih/Kuning untuk efek damage delay) */}
        <div 
          className="absolute top-0 left-0 h-full bg-red-300 transition-all duration-1000 ease-out" 
          style={{ width: `${percentage}%` }} 
        />
        {/* Main Bar */}
        <div 
          className={`absolute top-0 left-0 h-full ${colors[color]} transition-all duration-300 ease-out border-r-2 border-black/30`} 
          style={{ width: `${percentage}%` }} 
        />
        
        {/* Gloss Effect (Kilau Kaca) */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/20" />
      </div>
    </div>
  );
};