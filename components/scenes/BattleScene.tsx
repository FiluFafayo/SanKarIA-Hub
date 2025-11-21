// src/components/scenes/BattleScene.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useCampaign } from '../../hooks/useCampaign';
import { useCombatSystem } from '../../hooks/useCombatSystem';
import { BattleMapRenderer } from '../game/BattleMapRenderer';
import { LogDrawer } from '../grimoire/LogDrawer';
import { StatBar } from '../grimoire/StatBar';
import { AvatarFrame } from '../grimoire/AvatarFrame';
import { RuneButton } from '../grimoire/RuneButton';
import { SkillCard } from '../battle/SkillCard';
import { CharacterInventoryItem, SpellDefinition } from '../../types';

// Ikon SVG Sederhana
const IconSword = () => <span>⚔️</span>;
const IconEye = () => <span>👁️</span>;
const IconGrid = () => <span>▦</span>;

interface BattleSceneProps {
  onExit: () => void; // Callback saat combat selesai/kabur
}

type ViewMode = 'THEATER' | 'TACTICAL';

export const BattleScene: React.FC<BattleSceneProps> = ({ onExit }) => {
  // 1. Ambil Initial State dari Store (SSoT)
  const { playingCampaign, playingCharacter, runtimeSettings } = useGameStore(s => s.runtime);
  const _setRuntimeCampaignState = useGameStore(s => s.actions._setRuntimeCampaignState);
  const _setRuntimeCharacterState = useGameStore(s => s.actions._setRuntimeCharacterState);

  // Guard Clause
  if (!playingCampaign || !playingCharacter) {
    return <div className="p-10 text-red-500 font-pixel">FATAL: DATA BATTLE HILANG.</div>;
  }

  // 2. Inisialisasi Logic Engine (Reducer Lokal)
  const { campaign, campaignActions } = useCampaign(playingCampaign, playingCampaign.players);

  // 3. Inisialisasi Combat System
  const combatSystem = useCombatSystem({
    campaign,
    character: playingCharacter,
    players: campaign.players,
    campaignActions,
    onCharacterUpdate: (updatedChar) => {
        _setRuntimeCharacterState(updatedChar);
        // Kita juga perlu update karakter di dalam campaign state lokal agar sinkron
        campaignActions.updateCharacterInCampaign(updatedChar);
    }
  });

  // 4. Sinkronisasi Reducer -> Global Store
  useEffect(() => {
    _setRuntimeCampaignState(campaign);
    
    // Deteksi Akhir Kombat: Jika state berubah kembali ke 'exploration'
    if (campaign.gameState === 'exploration') {
        console.log("[BattleScene] Combat selesai, kembali ke Eksplorasi.");
        onExit();
    }
  }, [campaign, _setRuntimeCampaignState, onExit]);

  // 5. Local State UI
  const [viewMode, setViewMode] = useState<ViewMode>('TACTICAL');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null); // SISTEM TARGETING
  
  // Data Derivatif
  // Cari unit yang ditarget (Prioritas: Target Manual -> Monster Pertama Hidup)
  const targetedMonster = useMemo(() => {
      if (targetId) return campaign.monsters.find(m => m.instanceId === targetId);
      return campaign.monsters.find(m => m.currentHp > 0);
  }, [targetId, campaign.monsters]);

  const isMyTurn = campaign.currentPlayerId === playingCharacter.id;
  
  // Filter Logs
  const formattedLogs = campaign.eventLog.slice().reverse().map(l => ({
    sender: l.type === 'player_action' ? 'Anda' : (l.type === 'system' ? 'System' : 'DM'),
    message: l.text || "",
    type: (l.type === 'system' || l.type === 'roll_result') ? 'system' : 'chat' as 'system'|'chat'
  }));

  // --- HANDLERS ---
  
  const handlePerformAction = async () => {
      if (!selectedActionId) return;

      // Mapping ID tombol ke Fungsi Combat System
      switch (selectedActionId) {
          case 'ATTACK_MAIN':
             const weapon = playingCharacter.inventory.find(i => i.isEquipped && i.item.type === 'weapon');
             
             if (!targetedMonster) {
                 campaignActions.logEvent({type: 'system', text: 'Pilih target musuh di peta terlebih dahulu!'}, campaign.turnId || '');
                 return; 
             }

             if (weapon) {
                 combatSystem.handlePlayerAttack(targetedMonster.instanceId, weapon);
             } else {
                 campaignActions.logEvent({type: 'system', text: 'Anda tidak memegang senjata!'}, campaign.turnId || '');
             }
             break;
          case 'DASH':
             await combatSystem.handleDash();
             break;
          case 'DISENGAGE':
             await combatSystem.handleDisengage();
             break;
          case 'DODGE':
             await combatSystem.handleDodge();
             break;
          case 'HIDE':
             await combatSystem.handleHide();
             break;
          case 'SECOND_WIND':
             await combatSystem.handleSecondWind();
             break;
          default:
             // Cek apakah ini Spell ID?
             console.warn("Aksi tidak dikenal:", selectedActionId);
      }
      setSelectedActionId(null);
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-void overflow-hidden">
      
      {/* --- LAYER 1: BATTLE VIEWPORT (TOP 60%) --- */}
      <div className="flex-[3] relative bg-black border-b-4 border-wood overflow-hidden">
        
        {/* View Toggle */}
        <div className="absolute top-2 right-2 z-50 flex gap-2">
            <button 
                onClick={() => setViewMode('THEATER')}
                className={`p-2 rounded border ${viewMode === 'THEATER' ? 'bg-gold text-black border-gold' : 'bg-black/50 text-faded border-wood'}`}
                title="Theater of Mind"
            >
                <IconEye />
            </button>
            <button 
                onClick={() => setViewMode('TACTICAL')}
                className={`p-2 rounded border ${viewMode === 'TACTICAL' ? 'bg-gold text-black border-gold' : 'bg-black/50 text-faded border-wood'}`}
                title="Tactical Grid"
            >
                <IconGrid />
            </button>
        </div>

        {/* MODE: TACTICAL GRID */}
        {viewMode === 'TACTICAL' && (
            campaign.battleState ? (
                <BattleMapRenderer 
                    battleState={campaign.battleState}
                    campaignActions={campaignActions}
                    currentUserId={playingCharacter.id}
                    onMoveUnit={combatSystem.handleMovementWithOA}
                    onTargetTap={(unitId) => setTargetId(unitId)}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-faded font-pixel">
                    MENYIAPKAN MEDAN TEMPUR...
                </div>
            )
        )}

        {/* MODE: THEATER OF MIND */}
        {viewMode === 'THEATER' && (
             <div className="w-full h-full relative bg-[#050505] flex items-center justify-center">
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_#1a1921_0%,_#000000_100%)]" />
                {targetedMonster ? (
                    <div className="relative z-10 animate-[float_4s_ease-in-out_infinite] flex flex-col items-center">
                         {/* HP Bar Musuh */}
                         <div className="w-40 h-4 bg-black border border-wood mb-2 relative rounded overflow-hidden">
                            <div 
                                className="h-full bg-red-700 transition-all duration-500" 
                                style={{ width: `${(targetedMonster.currentHp / targetedMonster.definition.maxHp) * 100}%` }}
                            />
                            <span className="absolute inset-0 text-[10px] text-white flex items-center justify-center drop-shadow-md">
                                {targetedMonster.currentHp} / {targetedMonster.definition.maxHp} HP
                            </span>
                        </div>
                        
                        {/* Visual Musuh */}
                        <div className="w-64 h-64 border-4 border-red-900/50 shadow-[0_0_50px_rgba(200,0,0,0.2)] overflow-hidden bg-black rounded-lg relative">
                             <div className="w-full h-full flex items-center justify-center text-8xl">👹</div>
                             {/* Target Indicator */}
                             {targetId === targetedMonster.instanceId && (
                                 <div className="absolute top-2 right-2 text-red-500 text-xl animate-pulse">🎯</div>
                             )}
                        </div>

                        <span className="mt-4 bg-red-950/80 text-red-200 font-pixel text-sm px-4 py-1 border border-red-800 rounded">
                            {targetedMonster.name}
                        </span>
                        {/* Status Effects Badge */}
                        <div className="flex gap-1 mt-2">
                            {targetedMonster.conditions.map(c => (
                                <span key={c} className="text-[8px] bg-purple-900 text-purple-200 px-1 rounded border border-purple-700">{c}</span>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-faded font-pixel animate-pulse">
                        {campaign.monsters.length > 0 ? "PILIH TARGET..." : "MENUNGGU MUSUH..."}
                    </div>
                )}
             </div>
        )}

        {/* Overlay Status Player (Selalu Muncul) */}
        <div className="absolute top-2 left-2 z-40 flex gap-2 items-start pointer-events-none">
             <div className="pointer-events-auto">
                 <AvatarFrame 
                    name={playingCharacter.name} 
                    imageUrl={playingCharacter.avatar_url} 
                    size="md" 
                    status={isMyTurn ? "turn" : "online"}
                    hpPercentage={(playingCharacter.currentHp / playingCharacter.maxHp) * 100}
                />
             </div>
             <div className="flex flex-col bg-black/60 p-2 rounded border border-wood/30 backdrop-blur-sm">
                 <StatBar label="HP" current={playingCharacter.currentHp} max={playingCharacter.maxHp} color="blood" />
                 <div className="flex gap-2 mt-1">
                     <span className="text-[10px] text-blue-300 font-mono">AC: {playingCharacter.armorClass}</span>
                     <span className="text-[10px] text-green-300 font-mono">SPD: {playingCharacter.speed}</span>
                 </div>
             </div>
        </div>
      </div>

      {/* --- LAYER 2: CONTROL DECK (BOTTOM 40%) --- */}
      <div className="flex-[2] bg-[#15141a] relative z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] flex flex-col border-t border-wood">
         
         {/* A. Action Carousel */}
         <div className="flex-1 overflow-x-auto flex items-center gap-3 px-4 py-2 scrollbar-hide snap-x bg-[#0a0a0a]">
            {/* 1. Attack Card */}
            <SkillCard 
                name="Attack" 
                cost="Action" 
                type="attack" 
                description="Serang musuh dengan senjata utama."
                isSelected={selectedActionId === 'ATTACK_MAIN'} 
                onClick={() => setSelectedActionId('ATTACK_MAIN')} 
            />
            
            {/* 2. Common Actions */}
            <SkillCard name="Dash" cost="Action" type="utility" isSelected={selectedActionId === 'DASH'} onClick={() => setSelectedActionId('DASH')} />
            <SkillCard name="Disengage" cost="Action" type="utility" isSelected={selectedActionId === 'DISENGAGE'} onClick={() => setSelectedActionId('DISENGAGE')} />
            <SkillCard name="Dodge" cost="Action" type="utility" isSelected={selectedActionId === 'DODGE'} onClick={() => setSelectedActionId('DODGE')} />
            <SkillCard name="Hide" cost="Action" type="utility" isSelected={selectedActionId === 'HIDE'} onClick={() => setSelectedActionId('HIDE')} />

            {/* 3. Class Specific (Contoh Fighter) */}
            {playingCharacter.class === 'Fighter' && (
                 <SkillCard name="Second Wind" cost="Bonus" type="heal" isSelected={selectedActionId === 'SECOND_WIND'} onClick={() => setSelectedActionId('SECOND_WIND')} />
            )}
         </div>

         {/* B. Execution Bar */}
         <div className="p-3 bg-surface border-t border-wood flex gap-3 justify-center items-center flex-col">
             {/* Target Info (Polish: Feedback Visual) */}
             {isMyTurn && targetedMonster && (
                 <div className="w-full flex justify-between items-center mb-2 px-2">
                     <span className="text-[10px] text-faded">TARGET:</span>
                     <span className="text-xs text-red-400 font-bold font-pixel">{targetedMonster.name} ({targetedMonster.currentHp} HP)</span>
                 </div>
             )}

             <div className="flex w-full gap-3 items-center">
                 {isMyTurn ? (
                     <>
                        <div className="flex-1">
                            {selectedActionId ? (
                                 <RuneButton 
                                    label="EKSEKUSI AKSI" 
                                    variant="primary" 
                                    className="w-full animate-pulse" 
                                    onClick={handlePerformAction}
                                    disabled={selectedActionId === 'ATTACK_MAIN' && !targetedMonster}
                                />
                            ) : (
                                <div className="text-center text-[10px] text-faded font-pixel uppercase tracking-widest">
                                    PILIH KARTU AKSI
                                </div>
                            )}
                        </div>
                        <RuneButton 
                            label="END" 
                            variant="secondary" 
                            onClick={() => campaignActions.endTurn()}
                        />
                     </>
                 ) : (
                 <div className="w-full text-center py-2 bg-black/30 border border-dashed border-wood/30 rounded">
                     <span className="text-faded text-xs font-pixel animate-pulse">
                        MENUNGGU GILIRAN MUSUH...
                     </span>
                 </div>
             )}
         </div>

         {/* C. Log Drawer (Compact) */}
         <div className="h-32 relative">
             <LogDrawer logs={formattedLogs} />
         </div>
         
      </div>
    </div>
  );
};