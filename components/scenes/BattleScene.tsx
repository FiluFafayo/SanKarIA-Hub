// src/components/scenes/BattleScene.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useCampaign } from '../../hooks/useCampaign';
import { useCombatSystem } from '../../hooks/useCombatSystem';
import { BattleMapRenderer } from '../game/BattleMapRenderer';
import { LogDrawer } from '../grimoire/LogDrawer';
import { StatBar } from '../grimoire/StatBar';
import { AvatarFrame } from '../grimoire/AvatarFrame';
import { RuneButton } from '../grimoire/RuneButton';
import { SkillCard } from '../battle/SkillCard';
import { CharacterInventoryItem } from '../../types';

interface BattleSceneProps {
  onExit: () => void;
}

export const BattleScene: React.FC<BattleSceneProps> = ({ onExit }) => {
  // 1. Inisialisasi Data dari Store (SSoT)
  const { playingCampaign, playingCharacter } = useGameStore(s => s.runtime);
  const _setRuntimeCampaignState = useGameStore(s => s.actions._setRuntimeCampaignState);
  const _setRuntimeCharacterState = useGameStore(s => s.actions._setRuntimeCharacterState);

  // Guard: Data tidak lengkap
  if (!playingCampaign || !playingCharacter) return <div className="p-10 text-red-500">FATAL: BATTLE DATA MISSING</div>;

  // 2. Inisialisasi Logic Engine (Local Reducer)
  const { campaign, campaignActions } = useCampaign(playingCampaign, playingCampaign.players);

  // 3. Inisialisasi Combat System
  const combatSystem = useCombatSystem({
    campaign,
    character: playingCharacter,
    players: campaign.players,
    campaignActions,
    onCharacterUpdate: (char) => {
        _setRuntimeCharacterState(char); // Sync karakter ke global
        campaignActions.updateCharacterInCampaign(char); // Sync ke reducer lokal
    }
  });

  // 4. Sinkronisasi State Campaign ke Global Store (Optimistic Update)
  useEffect(() => {
    _setRuntimeCampaignState(campaign);
    
    // Jika state kembali ke exploration (misal: combat selesai), keluar dari scene ini
    if (campaign.gameState === 'exploration') {
        onExit(); 
    }
  }, [campaign, _setRuntimeCampaignState, onExit]);

  // 5. Local UI State
  const [selectedAction, setSelectedAction] = useState<'ATTACK' | 'DASH' | 'DISENGAGE' | 'DODGE' | null>(null);

  // Format Logs untuk Drawer
  const formattedLogs = campaign.eventLog.map(l => ({
    sender: l.type === 'player_action' ? 'Anda' : (l.type === 'system' ? 'System' : 'DM'),
    message: l.text || "",
    type: (l.type === 'system' || l.type === 'roll_result') ? 'system' : 'chat'
  })).reverse();

  // Cek Giliran
  const isMyTurn = campaign.currentPlayerId === playingCharacter.id;
  const activeUnitId = campaign.battleState?.activeUnitId;
  const isMyUnitActive = activeUnitId === playingCharacter.id;

  // Handler: Tap pada Unit di Peta
  const handleTargetTap = (targetId: string) => {
      if (!isMyTurn) return;

      if (selectedAction === 'ATTACK') {
          // Cari senjata yang sedang dipakai
          const weapon = playingCharacter.inventory.find(i => i.isEquipped && i.item.type === 'weapon');
          if (weapon) {
             combatSystem.handlePlayerAttack(targetId, weapon);
             setSelectedAction(null); // Reset seleksi setelah serang
          } else {
             campaignActions.logEvent({ type: 'system', text: 'Anda tidak memegang senjata!' }, campaign.turnId || 'temp');
          }
      }
  };

  return (
    <div className="flex flex-col h-full w-full bg-void relative overflow-hidden">
      
      {/* --- LAYER 1: VISUAL MAP (TOP) --- */}
      <div className="flex-1 relative bg-black border-b-4 border-wood overflow-hidden">
        {campaign.battleState ? (
            <BattleMapRenderer
                battleState={campaign.battleState}
                campaignActions={campaignActions}
                currentUserId={playingCharacter.id}
                // Hubungkan logika gerak + OA
                onMoveUnit={(id, path, cost) => {
                    if (isMyTurn) combatSystem.handleMovementWithOA(id, path, cost);
                }}
                // Hubungkan logika target (Attack)
                onTargetTap={handleTargetTap}
            />
        ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-faded animate-pulse gap-2">
                <div className="text-4xl">⚔️</div>
                <div className="font-pixel text-xs">MENYIAPKAN MEDAN TEMPUR...</div>
            </div>
        )}

        {/* HUD Overlay */}
        <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/90 to-transparent z-20 flex justify-between items-start pointer-events-none">
             <div className="flex gap-2 pointer-events-auto">
                <AvatarFrame 
                    name={playingCharacter.name} 
                    imageUrl={playingCharacter.avatar_url} 
                    size="sm"
                    status={isMyTurn ? "turn" : "online"}
                />
                <div className="flex flex-col justify-center">
                    <StatBar label="HP" current={playingCharacter.currentHp} max={playingCharacter.maxHp} color="blood" />
                    <div className={`text-[10px] font-pixel mt-1 px-2 py-0.5 rounded border ${isMyTurn ? 'bg-green-900/50 text-green-400 border-green-500 animate-pulse' : 'bg-black/50 text-faded border-gray-700'}`}>
                        {isMyTurn ? "GILIRAN ANDA" : `GILIRAN: ${activeUnitId ? '...' : 'MENUNGGU'}`}
                    </div>
                </div>
             </div>
             
             {/* Tombol Kabur (Darurat) */}
             <button 
                onClick={() => {
                    // Paksa state kembali ke exploration lewat action (agar bersih)
                    campaignActions.setGameState('exploration');
                    // onExit dipanggil oleh useEffect
                }} 
                className="pointer-events-auto bg-red-950/80 border border-red-600 text-red-200 px-3 py-1 text-[10px] font-pixel hover:bg-red-900 transition-colors"
             >
                🏳️ FLEE
             </button>
        </div>
      </div>

      {/* --- LAYER 2: TACTICAL DECK (BOTTOM) --- */}
      <div className="h-[35%] bg-surface flex flex-col border-t-4 border-wood relative z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
         
         {/* Info Bar: Selected Action */}
         <div className="bg-black/80 text-center py-1 border-b border-white/10 min-h-[24px]">
             {selectedAction === 'ATTACK' && <span className="text-red-400 text-[10px] font-pixel animate-pulse">PILIH TARGET DI PETA UNTUK MENYERANG</span>}
             {!isMyTurn && <span className="text-faded text-[10px] font-pixel">MENUNGGU GILIRAN LAWAN...</span>}
         </div>

         {/* Card Carousel */}
         <div className="flex-1 overflow-x-auto p-2 flex items-center gap-2 scrollbar-hide">
            {/* 1. ATTACK CARD */}
            <SkillCard 
                name="ATTACK" 
                cost="1 ACT" 
                type="attack" 
                description="Serang musuh dengan senjata utama."
                isSelected={selectedAction === 'ATTACK'}
                onClick={() => isMyTurn && setSelectedAction(selectedAction === 'ATTACK' ? null : 'ATTACK')}
            />
            
            {/* 2. DASH */}
            <SkillCard 
                name="DASH" 
                cost="1 ACT" 
                type="utility" 
                description="Gandakan kecepatan gerak."
                onClick={() => isMyTurn && combatSystem.handleDash()}
            />

            {/* 3. DISENGAGE */}
            <SkillCard 
                name="DISENGAGE" 
                cost="1 ACT" 
                type="utility" 
                description="Gerak tanpa memicu serangan kesempatan."
                onClick={() => isMyTurn && combatSystem.handleDisengage()}
            />

            {/* 4. DODGE */}
            <SkillCard 
                name="DODGE" 
                cost="1 ACT" 
                type="utility" 
                description="Fokus menghindar. Musuh Disadvantage saat menyerang."
                onClick={() => isMyTurn && combatSystem.handleDodge()}
            />
         </div>

         {/* Action Trigger / End Turn */}
         <div className="p-3 bg-[#15141a] border-t border-wood flex gap-2">
            <RuneButton 
                label="AKHIRI GILIRAN" 
                variant={isMyTurn ? "primary" : "secondary"}
                disabled={!isMyTurn}
                onClick={campaignActions.endTurn}
                className="w-full shadow-lg"
            />
         </div>

         {/* Log Drawer (Hidden by default, can pull up) */}
         <LogDrawer logs={formattedLogs} />
      </div>
    </div>
  );
};