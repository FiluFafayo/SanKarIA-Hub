// src/components/scenes/ExplorationScene.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useCampaign } from '../../hooks/useCampaign';
import { useExplorationSystem } from '../../hooks/useExplorationSystem';
import { ExplorationMap } from '../game/ExplorationMap';
import { LogDrawer } from '../grimoire/LogDrawer';
import { StatBar } from '../grimoire/StatBar';
import { AvatarFrame } from '../grimoire/AvatarFrame';
import { RuneButton } from '../grimoire/RuneButton';
import { InventoryDrawer } from '../grimoire/InventoryDrawer'; // FASE 5
import { CharacterSheetDrawer } from '../grimoire/CharacterSheetDrawer'; // FASE 5

interface ExplorationSceneProps {
  onEncounter: () => void; // Callback jika state berubah jadi combat
}

export const ExplorationScene: React.FC<ExplorationSceneProps> = ({ onEncounter }) => {
  // 1. Ambil Initial State dari Store (SSoT)
  const { playingCampaign, playingCharacter, runtimeSettings } = useGameStore(s => s.runtime);
  const _setRuntimeCampaignState = useGameStore(s => s.actions._setRuntimeCampaignState);
  const _setRuntimeCharacterState = useGameStore(s => s.actions._setRuntimeCharacterState);
  const exitGameSession = useGameStore(s => s.actions.exitGameSession); // [FASE 4] Exit Action

  // Guard Clause: Paranoid Check
  if (!playingCampaign || !playingCharacter) {
    return <div className="p-10 text-red-500 font-pixel">FATAL: DATA CAMPAIGN/CHARACTER HILANG.</div>;
  }

  // 2. Inisialisasi Logic Engine (Reducer Lokal)
  // Kita menggunakan initial state dari Store, tapi logic berjalan di reducer lokal useCampaign.
  const { campaign, campaignActions } = useCampaign(playingCampaign, playingCampaign.players);

  // 3. Inisialisasi AI System
  const { handlePlayerAction } = useExplorationSystem({
    campaign,
    character: playingCharacter,
    players: campaign.players,
    campaignActions,
    onCharacterUpdate: (updatedChar) => {
        // Update character di local reducer sudah otomatis, 
        // kita perlu update store global jika ada perubahan stats
        _setRuntimeCharacterState(updatedChar);
    }
  });

  // 4. Sinkronisasi Reducer -> Global Store (CRITICAL)
  // Setiap kali campaign berubah (karena aksi/AI), simpan ke Global Store
  // agar App.tsx atau BattleScene bisa mengambil state terbaru.
  useEffect(() => {
    _setRuntimeCampaignState(campaign);

    // Deteksi State Jump: Jika logic mengubah state menjadi 'combat'
    if (campaign.gameState === 'combat') {
      onEncounter();
    }
  }, [campaign, _setRuntimeCampaignState, onEncounter]);

  // 5. Local State untuk UI
  const [inputVal, setInputVal] = useState("");
  const [activeDrawer, setActiveDrawer] = useState<'NONE' | 'INVENTORY' | 'CHARACTER'>('NONE'); // FASE 5
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log (bisa dipindah ke LogDrawer sebenernya, tapi manual trigger lebih aman)
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [campaign.eventLog]);

  const handleSubmit = async () => {
    if (!inputVal.trim()) return;
    const action = inputVal;
    setInputVal(""); // Clear UI dulu biar responsif
    await handlePlayerAction(action, null);
  };

  // Convert logs ke format UI
  const formattedLogs = campaign.eventLog.map(l => ({
    sender: l.type === 'player_action' ? 'Anda' : (l.type === 'system' ? 'System' : 'DM'),
    message: l.text || "",
    type: (l.type === 'system' || l.type === 'roll_result') ? 'system' : 'chat'
  })).reverse(); // LogDrawer expects newest first usually, or handled internally. Let's assume standard.

  return (
    <div className="flex flex-col h-full w-full relative bg-void overflow-hidden">
      
      {/* --- LAYER 1: MAP VIEW (TOP HALF) --- */}
      <div className="flex-1 relative bg-black border-b-4 border-wood overflow-hidden">
         {/* [FASE 3] ATLAS RENDERER */}
         {/* Render Map hanya jika data grid valid DAN activeMapId ada */}
         {(campaign.activeMapId && campaign.explorationGrid && campaign.explorationGrid.length > 0) ? (
             <>
                 <ExplorationMap 
                    grid={campaign.explorationGrid} 
                    fog={campaign.fogOfWar} 
                    playerPos={campaign.playerGridPosition || {x:0, y:0}} 
                 />
                 {/* Debug Info (Dev Only - Optional) */}
                 {/* <div className="absolute bottom-2 left-2 text-[8px] text-green-500 font-mono bg-black/80 p-1">
                     MAP: {campaign.activeMapData?.name || campaign.activeMapId}
                 </div> */}
             </>
         ) : (
             // Fallback Visual jika tidak ada Peta
             <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 opacity-50">
                 <div className="text-6xl animate-pulse">🗺️</div>
                 <div className="font-pixel text-faded text-xs">PETA TIDAK TERSEDIA (THEATER OF MIND)</div>
             </div>
         )}

         {/* Overlay Stats Header */}
         <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start">
            <div className="flex gap-2">
                <AvatarFrame 
                    name={playingCharacter.name} 
                    imageUrl={playingCharacter.avatar_url} 
                    size="sm"
                />
                <div className="flex flex-col justify-center">
                    <StatBar label="HP" current={playingCharacter.currentHp} max={playingCharacter.maxHp} color="blood" />
                    <div className="text-[10px] text-faded font-pixel mt-1">LVL {playingCharacter.level} {playingCharacter.class}</div>
                </div>
            </div>
            
            {/* World Clock / Weather Badge & EXIT BUTTON */}
            <div className="flex flex-col items-end gap-2">
                {/* Tombol Keluar [FASE 4] */}
                <button 
                    onClick={exitGameSession}
                    className="bg-red-900/80 border border-red-500 text-red-100 px-2 py-1 rounded text-[10px] font-pixel hover:bg-red-700 transition-colors shadow-lg z-50"
                >
                    💾 KELUAR & SIMPAN
                </button>

                <div className="bg-black/50 border border-wood px-2 py-1 rounded text-[10px] text-gold font-pixel">
                    {campaign.currentWeather?.toUpperCase() || "CERAH"}
                </div>
            </div>
         </div>
      </div>

      {/* --- LAYER 2: INTERACTION DECK (BOTTOM HALF) --- */}
      <div className="h-[45%] flex flex-col bg-surface relative z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        
        {/* Log Area (Mini) */}
        <div className="flex-1 p-4 overflow-hidden relative">
             <div className="absolute inset-0 overflow-y-auto p-4 space-y-2" ref={scrollRef}>
                {campaign.eventLog.slice(-10).map((log, i) => (
                    <div key={i} className={`text-sm border-l-2 pl-2 ${
                        log.type === 'player_action' ? 'border-blue-500 text-blue-200' : 
                        log.type === 'dm_narration' ? 'border-purple-500 text-parchment' : 
                        'border-gray-500 text-faded'
                    }`}>
                        <span className="font-bold text-[10px] uppercase opacity-70 block mb-1">
                            {log.type.replace('_', ' ')}
                        </span>
                        {log.text}
                    </div>
                ))}
                {/* Typing Indicator & Force Reset [FASE 4] */}
                {campaign.thinkingState === 'thinking' && (
                    <div className="flex items-center gap-2 mt-2">
                        <div className="text-xs text-gold animate-pulse font-pixel">
                            DM SEDANG MENULIS KISAH...
                        </div>
                        <button 
                            onClick={() => {
                                console.warn("⚠️ [User] Mengguncang DM (Force Reset)");
                                // 1. Matikan Network Request
                                useGameStore.getState().actions.cancelAllInFlight();
                                // 2. Reset UI State
                                campaignActions.setThinkingState('idle');
                                // 3. Beri Feedback Visual
                                campaignActions.logEvent({ type: 'system', text: "⚡ [SYSTEM] Anda membangunkan DM secara paksa. Koneksi di-reset." }, campaign.turnId || 'force-reset');
                            }}
                            className="text-[8px] bg-red-900/40 border border-red-500/50 px-2 py-0.5 text-red-200 hover:bg-red-700 hover:text-white transition-all font-pixel flex items-center gap-1"
                            title="Klik untuk memutus paksa koneksi AI yang macet"
                        >
                            <span>⚡</span> GUNCANG DM
                        </button>
                    </div>
                )}
             </div>
        </div>

        {/* Action Bar */}
        <div className="p-2 border-t border-wood bg-[#15141a] flex gap-2 items-center">
            <input 
                type="text" 
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Apa yang ingin Anda lakukan?"
                className="flex-1 bg-black/50 border border-wood/50 text-parchment text-sm px-3 py-3 rounded focus:border-gold focus:outline-none font-retro"
                disabled={campaign.thinkingState === 'thinking'}
            />
            <RuneButton 
                label="KIRIM" 
                onClick={handleSubmit} 
                variant="primary"
                disabled={campaign.thinkingState === 'thinking' || !inputVal}
            />
        </div>

        {/* Drawer Access (Fase 5: Connected) */}
        <div className="absolute top-0 right-0 transform -translate-y-1/2 flex gap-2 px-4 z-30">
             <button 
                onClick={() => setActiveDrawer('INVENTORY')}
                className="w-10 h-10 rounded-full bg-wood border-2 border-gold text-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg active:scale-95" 
                title="Inventory"
             >
                🎒
             </button>
             <button 
                onClick={() => setActiveDrawer('CHARACTER')}
                className="w-10 h-10 rounded-full bg-wood border-2 border-gold text-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg active:scale-95" 
                title="Character"
             >
                📜
             </button>
        </div>

        {/* FASE 5: THE GRIMOIRES (Modal/Drawer Injection) */}
        <InventoryDrawer 
            isOpen={activeDrawer === 'INVENTORY'} 
            onClose={() => setActiveDrawer('NONE')}
            inventory={playingCharacter.inventory}
        />
        <CharacterSheetDrawer
            isOpen={activeDrawer === 'CHARACTER'}
            onClose={() => setActiveDrawer('NONE')}
            character={playingCharacter}
        />

        {/* Full Log Drawer (Optional Overlap) */}
        <LogDrawer logs={formattedLogs} />
      </div>
    </div>
  );
};