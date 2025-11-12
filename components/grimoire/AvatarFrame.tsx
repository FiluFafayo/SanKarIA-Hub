// components/grimoire/AvatarFrame.tsx
import React from 'react';

interface AvatarFrameProps {
  imageUrl: string;
  name: string;
  status?: 'online' | 'offline' | 'afk' | 'turn';
  hpPercentage?: number; // 0 - 100
  size?: 'sm' | 'md' | 'lg';
}

export const AvatarFrame: React.FC<AvatarFrameProps> = ({
  imageUrl,
  name,
  status = 'online',
  hpPercentage = 100,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24'
  };

  const isAfkOrOffline = status === 'offline' || status === 'afk';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${sizeClasses[size]}`}>
        
        {/* Frame Border */}
        <div className={`absolute inset-0 border-2 z-20 pointer-events-none
          ${status === 'turn' ? 'border-gold shadow-pixel-glow animate-pulse' : 'border-wood'}
          ${hpPercentage < 30 ? 'border-blood animate-pulse' : ''}
        `}></div>

        {/* Avatar Image */}
        <img 
          src={imageUrl} 
          alt={name}
          className={`w-full h-full object-cover z-10 bg-black
            ${isAfkOrOffline ? 'grayscale opacity-50' : ''}
          `}
        />

        {/* Status Indicators (Multiplayer Vital) */}
        {status === 'afk' && (
           <div className="absolute inset-0 flex items-center justify-center z-30 text-white font-pixel text-xs animate-bounce">
             Zzz
           </div>
        )}
        
        {/* HP Bar Mini (Di bawah avatar) */}
        <div className="absolute -bottom-2 left-0 right-0 h-1 bg-black border border-black z-20">
          <div 
            className="h-full bg-blood transition-all duration-500" 
            style={{ width: `${hpPercentage}%` }}
          />
        </div>
      </div>
      
      {/* Name Tag */}
      <span className="text-[10px] font-pixel text-parchment uppercase tracking-tighter bg-black/50 px-1">
        {name}
      </span>
    </div>
  );
};