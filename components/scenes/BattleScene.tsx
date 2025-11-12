// components/scenes/BattleScene.tsx
import React, { useState, useEffect } from 'react';
import { BattleStage } from '../battle/BattleStage';
import { StatBar } from '../grimoire/StatBar';
import { SkillCard } from '../battle/SkillCard';
import { RuneButton } from '../grimoire/RuneButton';
import { LogDrawer } from '../grimoire/LogDrawer';
import { AvatarFrame } from '../grimoire/AvatarFrame';

// LOGIC IMPORTS
import { useCombatSystem } from '../../hooks/useCombatSystem';
import { useGameStore } from '../../store/gameStore';
import { useAppStore } from '../../store/appStore';

interface BattleSceneProps {
  onExit: () => void;
}

export const BattleScene: React.FC<BattleSceneProps> = ({ onExit }) => {
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const { combatState, performAction, endTurn } = useCombatSystem();
  const { logs } = useGameStore(); 
  const { user, selectedCharacterId } = useAppStore();

  // Mocking character stats dari store (ideally useCharacter hook)
  // Di real implementation, pastikan data ini reaktif
  const characterData = useGameStore(state => 
    state.characters.find(c => c.id === selectedCharacterId)
  );

  // Convert logs to UI format
  const formattedLogs = logs.map(l => ({
    sender: l.source || 'System',
    message: l.message,
    type: (l.type === 'system' ? 'system' : 'chat') as 'system' | 'chat'
  })).reverse(); // Show newest first inside drawer logic usually

  const handleCast = async () => {
    if (selectedActionId) {
      await performAction(selectedActionId);
      setSelectedActionId(null);
    }
  };

  // Get current enemy visual (Theater of the Mind focus: Target Pertama)
  const currentEnemy = combatState.currentEnemies[0];

  return (
    <div className="flex flex-col h-full w-full relative bg-void">
      
      {/* 1. TOP SECTION: THE STAGE (Visual Monster & AI Gen Portrait) */}
      <div className="h-[40%] relative border-b-4 border-wood shadow-2xl z-0">
        <button onClick={onExit} className="absolute top-2 left-2 z-50 text-[10px] text-red-500 font-pixel bg-black px-2 border border-red-900">
            🏳️ FLEE
        </button>
        
        {/* Party Avatars (Overlay) */}
        <div className="absolute top-2 right-2 z-40 flex gap-2 scale-75 origin-top-right">
            {/* Render teman se-party jika ada (placeholder logic) */}
            <AvatarFrame name="Siti" imageUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Siti" size="sm" hpPercentage={90} />
        </div>

        {/* THEATER OF THE MIND (Render Enemy) */}
        <div className="w-full h-full relative bg-[#050505] overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at center, #1a1921 0%, #000000 100%)' }} />
            
            {currentEnemy ? (
                <div className="relative z-10 animate-[float_4s_ease-in-out_infinite] flex flex-col items-center">
                    {/* Enemy HP */}
                    <div className="w-32 h-2 bg-black border border-wood mb-2">
                        <div 
                          className="h-full bg-purple-600 transition-all duration-500" 
                          style={{ width: `${(currentEnemy.hp / currentEnemy.maxHp) * 100}%` }}
                        />
                    </div>
                    
                    {/* Enemy Visual (AI Generated or Placeholder) */}
                    <div className="w-48 h-48 bg-black border-4 border-red-900 shadow-[0_0_30px_rgba(200,0,0,0.2)] overflow-hidden">
                        {currentEnemy.imageUrl ? (
                           <img src={currentEnemy.imageUrl} className="w-full h-full object-cover" alt="Enemy" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-6xl">👹</div>
                        )}
                    </div>
                    
                    <span className="mt-2 bg-red-900/80 text-white font-pixel text-[10px] px-2 py-1 border border-red-500">
                        {currentEnemy.name}
                    </span>
                </div>
            ) : (
                <div className="text-faded font-pixel animate-pulse">MENCARI MUSUH...</div>
            )}
        </div>
      </div>

      {/* 2. MIDDLE SECTION: PLAYER VITALS */}
      <div className="flex-shrink-0 bg-surface p-2 border-b-2 border-wood z-10 shadow-lg">
         <div className="flex gap-2 items-end">
             <div className="flex-shrink-0 -mt-8 z-20">
                <AvatarFrame 
                    name={characterData?.name || "HERO"} 
                    imageUrl={`https://api.dicebear.com/7.x/bottts/svg?seed=${characterData?.name || 'hero'}`}
                    size="md" 
                    status={combatState.isPlayerTurn ? "turn" : "online"}
                />
             </div>
             
             <div className="flex-grow flex flex-col justify-end pb-1">
                <StatBar label="HP" current={characterData?.hp || 10} max={characterData?.maxHp || 10} color="blood" />
                <div className="flex gap-2">
                    <StatBar label="EXP" current={characterData?.experience || 0} max={100} color="xp" />
                    {/* Stamina/Action Points */}
                    <StatBar label="AP" current={1} max={1} color="stamina" /> 
                </div>
             </div>
         </div>
      </div>

      {/* 3. BOTTOM SECTION: CONTROL DECK (Real Actions) */}
      <div className="flex-1 bg-[#15141a] relative flex flex-col">
         
         {/* Card Carousel: Map from available actions */}
         <div className="flex-1 overflow-x-auto flex items-center gap-2 px-4 py-2 scrollbar-hide snap-x">
            {combatState.availableActions.length > 0 ? (
                combatState.availableActions.map((action) => (
                    <SkillCard 
                        key={action.id}
                        name={action.name} 
                        cost="1 AP" 
                        type={action.type === 'spell' ? 'spell' : 'attack'} 
                        description={action.description || "Lakukan aksi ini."}
                        isSelected={selectedActionId === action.id} 
                        onClick={() => setSelectedActionId(action.id)} 
                    />
                ))
            ) : (
                // Fallback Static Cards jika logic belum populate actions
                <div className="flex gap-2 opacity-50 grayscale">
                   <SkillCard name="Loading..." cost="-" type="utility" onClick={()=>{}} />
                </div>
            )}
         </div>

         {/* Action Trigger */}
         <div className="p-2 pb-12 bg-surface border-t border-wood flex gap-2 justify-center">
             {combatState.isPlayerTurn ? (
                 <>
                    <RuneButton 
                        label="AKSI" 
                        variant="primary" 
                        className="flex-1 animate-pulse" 
                        disabled={!selectedActionId}
                        onClick={handleCast}
                    />
                    <RuneButton 
                        label="END TURN" 
                        variant="secondary" 
                        onClick={endTurn}
                    />
                 </>
             ) : (
                 <div className="text-faded text-center text-[10px] font-pixel py-2 w-full bg-black border border-wood">
                     MUSUH SEDANG BERPIKIR...
                 </div>
             )}
         </div>

         {/* 4. THE REAL LOG DRAWER */}
         <LogDrawer logs={formattedLogs} />
         
      </div>
    </div>
  );
};