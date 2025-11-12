// components/battle/BattleStage.tsx
import React from 'react';
import { AvatarFrame } from '../grimoire/AvatarFrame';

export const BattleStage: React.FC = () => {
  return (
    <div className="w-full h-full relative bg-[#050505] overflow-hidden flex items-center justify-center">
        {/* Background Ambiance */}
        <div className="absolute inset-0 opacity-30" 
             style={{ backgroundImage: 'radial-gradient(circle at center, #1a1921 0%, #000000 100%)' }} 
        />

        {/* THE MONSTER (Boss) */}
        <div className="relative z-10 animate-[float_4s_ease-in-out_infinite]">
            {/* Monster HP Floating Bar */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-2 bg-black border border-wood">
                <div className="h-full bg-purple-600 w-[75%]"></div>
            </div>
            
            {/* Monster Sprite (Placeholder) */}
            <div className="w-48 h-48 bg-black border-4 border-red-900 shadow-[0_0_30px_rgba(200,0,0,0.2)] flex items-center justify-center">
                 <span className="text-6xl filter drop-shadow-[0_0_10px_red]">👹</span>
            </div>
            
            <div className="text-center mt-2">
                <span className="bg-red-900/80 text-white font-pixel text-[10px] px-2 py-1 border border-red-500">
                    LV.10 DUNGEON BOSS
                </span>
            </div>
        </div>

        {/* Damage Floating Text (Contoh Visual Effect) */}
        <div className="absolute top-1/3 left-2/3 text-gold font-pixel text-2xl animate-[bounce_0.5s_infinite]">
            CRIT!
        </div>
    </div>
  );
};