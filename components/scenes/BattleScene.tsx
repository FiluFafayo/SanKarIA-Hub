// components/scenes/BattleScene.tsx
import React, { useState } from 'react';
import { BattleStage } from '../battle/BattleStage';
import { StatBar } from '../grimoire/StatBar';
import { SkillCard } from '../battle/SkillCard';
import { RuneButton } from '../grimoire/RuneButton';
import { LogDrawer } from '../grimoire/LogDrawer'; // Reuse dari Fase 1
import { AvatarFrame } from '../grimoire/AvatarFrame';

interface BattleSceneProps {
  onExit: () => void;
}

export const BattleScene: React.FC<BattleSceneProps> = ({ onExit }) => {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  // Dummy Logs
  const battleLogs = [
    { sender: "System", message: "Combat Started!", type: 'system' as const },
    { sender: "Boss", message: "ROAAARR!!", type: 'chat' as const },
  ];

  return (
    <div className="flex flex-col h-full w-full relative bg-void">
      
      {/* 1. TOP SECTION: THE STAGE (40%) */}
      <div className="h-[40%] relative border-b-4 border-wood shadow-2xl z-0">
        <button onClick={onExit} className="absolute top-2 left-2 z-50 text-[10px] text-red-500 font-pixel bg-black px-2 border border-red-900">
            🏳️ FLEE
        </button>
        
        {/* Party Avatars (Overlay di atas Stage) */}
        <div className="absolute top-2 right-2 z-40 flex gap-2 scale-75 origin-top-right">
            <AvatarFrame name="Budi" imageUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Budi" size="sm" hpPercentage={40} />
            <AvatarFrame name="Siti" imageUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Siti" size="sm" hpPercentage={90} />
        </div>

        <BattleStage />
      </div>

      {/* 2. MIDDLE SECTION: PLAYER VITALS (15%) */}
      <div className="flex-shrink-0 bg-surface p-2 border-b-2 border-wood z-10 shadow-lg">
         <div className="flex gap-2 items-end">
             {/* Player Avatar Besar */}
             <div className="flex-shrink-0 -mt-8 z-20">
                <AvatarFrame 
                    name="HERO" 
                    imageUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Hero" 
                    size="md" 
                    status="turn"
                />
             </div>
             
             {/* Stats Grid */}
             <div className="flex-grow flex flex-col justify-end pb-1">
                <StatBar label="HP" current={75} max={100} color="blood" />
                <div className="flex gap-2">
                    <StatBar label="MP" current={30} max={50} color="mana" />
                    <StatBar label="AP" current={3} max={5} color="stamina" />
                </div>
             </div>
         </div>
      </div>

      {/* 3. BOTTOM SECTION: CONTROL DECK (Sisa Layar) */}
      <div className="flex-1 bg-[#15141a] relative flex flex-col">
         
         {/* Card Carousel Area */}
         <div className="flex-1 overflow-x-auto flex items-center gap-2 px-4 py-2 scrollbar-hide snap-x">
            <SkillCard 
                name="Fireball" cost="2 MP" type="spell" 
                description="Deal 20 DMG area."
                isSelected={selectedCard === 0} 
                onClick={() => setSelectedCard(0)} 
            />
            <SkillCard 
                name="Slash" cost="1 AP" type="attack" 
                description="Melee attack 8 DMG."
                isSelected={selectedCard === 1} 
                onClick={() => setSelectedCard(1)} 
            />
            <SkillCard 
                name="Heal" cost="3 MP" type="utility" 
                description="Restore 15 HP."
                isSelected={selectedCard === 2} 
                onClick={() => setSelectedCard(2)} 
            />
            <SkillCard 
                name="Shield" cost="2 AP" type="utility" 
                description="Block 10 DMG."
                isSelected={selectedCard === 3} 
                onClick={() => setSelectedCard(3)} 
            />
         </div>

         {/* Action Trigger (Muncul jika kartu dipilih) */}
         <div className="p-2 pb-12 bg-surface border-t border-wood flex justify-center">
             {selectedCard !== null ? (
                 <RuneButton label="CAST ABILITY" variant="primary" className="w-full max-w-xs animate-pulse" />
             ) : (
                 <div className="text-faded text-center text-[10px] font-pixel py-2">
                     PILIH KARTU UNTUK BERAKSI
                     <br/>
                     <span className="text-[8px] opacity-50">Giliranmu: 30 detik tersisa</span>
                 </div>
             )}
         </div>

         {/* 4. THE HIDDEN DRAWER (Chat Log) */}
         <LogDrawer logs={battleLogs} />
         
      </div>
    </div>
  );
};