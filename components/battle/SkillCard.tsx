// components/battle/SkillCard.tsx
import React from 'react';

interface SkillCardProps {
  name: string;
  cost: string; // e.g. "2 AP" or "1 💧"
  type: 'attack' | 'spell' | 'utility';
  description?: string;
  isSelected?: boolean;
  onClick: () => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({ name, cost, type, description, isSelected, onClick }) => {
  const borderColors = {
    attack: 'border-red-900 bg-red-950/80',
    spell: 'border-blue-900 bg-blue-950/80',
    utility: 'border-green-900 bg-green-950/80',
  };

  return (
    <div 
      onClick={onClick}
      className={`
        relative w-28 h-36 flex-shrink-0 flex flex-col justify-between p-2
        border-2 cursor-pointer transition-all duration-200 select-none
        ${borderColors[type]}
        ${isSelected ? '-translate-y-6 shadow-pixel-glow z-10 scale-110' : 'hover:-translate-y-2 hover:z-10'}
        bg-surface shadow-pixel-sm
      `}
    >
      {/* Header: Cost & Name */}
      <div className="flex justify-between items-start border-b border-white/10 pb-1 mb-1">
        <span className="font-pixel text-[8px] text-gold bg-black px-1 rounded-sm">{cost}</span>
      </div>
      
      {/* Icon / Art Placeholder */}
      <div className="flex-1 flex items-center justify-center opacity-50">
         <span className="text-2xl">{type === 'attack' ? '⚔️' : type === 'spell' ? '🔥' : '🎒'}</span>
      </div>

      {/* Footer: Name */}
      <div className="text-center">
        <span className="font-bold font-retro text-sm text-parchment leading-none block">{name}</span>
        {isSelected && description && (
            <div className="absolute -top-16 left-0 right-0 bg-black border border-gold p-2 text-[10px] text-parchment z-50 animate-fade-in">
                {description}
            </div>
        )}
      </div>
    </div>
  );
};