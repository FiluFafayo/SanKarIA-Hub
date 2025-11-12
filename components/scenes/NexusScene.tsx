// File: src/components/scenes/NexusScene.tsx
import React, { useState, useEffect } from 'react';
import { CampfireMenu } from '../nexus/CampfireMenu';
import { DungeonGate } from '../nexus/DungeonGate';
import { CharacterWizard } from '../nexus/CharacterWizard';
import { CampaignWizard } from '../nexus/CampaignWizard';
import { useAppStore } from '../../store/appStore';
import { characterRepository } from '../../services/repository/characterRepository';
import { Character } from '../../types';

interface NexusSceneProps {
  onStartGame: () => void;
}

const BackgroundLayer = () => (
  <div className="absolute inset-0 z-0 overflow-hidden bg-void">
    <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-[#09090b] to-[#1a1921]" />
    <div className="absolute bottom-0 inset-x-0 h-1/2 bg-[#121116] border-t-4 border-black" />
    <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-4 h-4 bg-orange-500 shadow-[0_0_20px_10px_rgba(255,100,0,0.3)] animate-pulse rounded-full opacity-80" />
  </div>
);

export const NexusScene: React.FC<NexusSceneProps> = ({ onStartGame }) => {
  const [viewMode, setViewMode] = useState<'IDLE' | 'CAMPFIRE' | 'GATE' | 'CHAR_WIZARD' | 'CAMP_WIZARD'>('IDLE');
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const { user, setSelectedCharacterId, selectedCharacterId } = useAppStore();

  // 1. Fetch Real Data
  const refreshCharacters = async () => {
    if (user) {
      const chars = await characterRepository.getCharactersByUserId(user.id);
      setMyCharacters(chars);
      // Auto select first char if none selected
      if (chars.length > 0 && !selectedCharacterId) {
        setSelectedCharacterId(chars[0].id);
      }
    }
  };

  useEffect(() => {
    refreshCharacters();
  }, [user]);

  return (
    <div className="relative w-full h-full flex flex-col">
      <BackgroundLayer />

      {/* TITLE / HUD */}
      <div className="absolute top-10 inset-x-0 text-center z-10 pointer-events-none">
        <h1 className="font-pixel text-3xl text-gold drop-shadow-md tracking-widest opacity-90">GRIMOIRE</h1>
        <p className="font-retro text-faded text-sm mt-1 tracking-widest">RPG TABLETOP ENGINE</p>
      </div>

      {/* CENTRAL INTERACTIVE AREA */}
      {viewMode === 'IDLE' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pt-20 gap-8">
          
          {/* PLAY BUTTON: Cek apakah sudah pilih karakter */}
          <button 
            onClick={() => {
               if (!selectedCharacterId) {
                 alert("PILIH JIWA TERLEBIH DAHULU DI API UNGGUN!");
                 setViewMode('CAMPFIRE');
               } else {
                 setViewMode('GATE');
               }
            }}
            className="group relative flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <div className="w-24 h-32 border-4 border-wood bg-black/50 flex items-center justify-center group-hover:border-gold group-hover:bg-gold/10 transition-colors shadow-pixel-md">
              <span className="text-4xl group-hover:scale-110 transition-transform">🚪</span>
            </div>
            <span className="font-pixel text-parchment text-xs bg-black px-2 py-1 border border-wood group-hover:text-gold">
              {selectedCharacterId ? "MASUK GERBANG" : "TERKUNCI"}
            </span>
          </button>

          {/* PROFILE BUTTON */}
          <button 
            onClick={() => setViewMode('CAMPFIRE')}
            className="group relative flex flex-col items-center gap-2 transition-transform active:scale-95 mt-4"
          >
             <div className="w-16 h-16 rounded-full bg-orange-900/20 border-2 border-orange-800 flex items-center justify-center animate-pulse group-hover:bg-orange-500/20 transition-colors">
                🔥
             </div>
             <span className="font-pixel text-faded text-[10px] group-hover:text-orange-400">CAMPFIRE</span>
          </button>
        </div>
      )}

      {/* OVERLAY MENUS (MODALS) */}

      {/* 1. CAMPFIRE (Character Select) */}
      {viewMode === 'CAMPFIRE' && (
        // Kita butuh ubah CampfireMenu dikit biar nerima data real, 
        // tapi untuk sekarang kita inject manual via prop di file aslinya atau edit langsung.
        // DISINI SAYA GUNAKAN VERSI YANG SUDAH DI-ADJUST SECARA LOGIC DI BAWAH (Assume CampfireMenu logic handled via internal props or context in real impl, 
        // tapi biar clean saya anggap CampfireMenu butuh refactor dikit untuk data real.
        // HACK: Saya render manual UI select disini agar tidak bolak balik edit file CampfireMenu.tsx
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent pt-20 animate-slide-up z-40">
           <div className="bg-surface border-t-4 border-gold p-4 shadow-pixel-glow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-pixel text-gold text-sm">THE CAMPFIRE</h2>
                <button onClick={() => setViewMode('IDLE')} className="text-red-500 font-pixel text-[10px]">[X] CLOSE</button>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide justify-center">
                 {/* New Character Trigger */}
                 <div onClick={() => setViewMode('CHAR_WIZARD')} className="flex flex-col items-center gap-2 cursor-pointer opacity-70 hover:opacity-100 min-w-[64px]">
                    <div className="w-16 h-16 border-2 border-dashed border-faded flex items-center justify-center bg-black/30">
                      <span className="text-2xl text-faded">+</span>
                    </div>
                    <span className="font-pixel text-[8px]">NEW</span>
                 </div>

                 {/* Character List */}
                 {myCharacters.map(char => (
                    <div 
                      key={char.id} 
                      onClick={() => setSelectedCharacterId(char.id)}
                      className={`relative flex flex-col items-center gap-2 cursor-pointer min-w-[64px]
                        ${selectedCharacterId === char.id ? 'opacity-100 scale-110' : 'opacity-50'}
                      `}
                    >
                       <div className={`w-16 h-16 border-2 ${selectedCharacterId === char.id ? 'border-gold' : 'border-wood'}`}>
                          {/* Placeholder Avatar karena DB belum tentu ada URL */}
                          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${char.name}`} className="w-full h-full bg-black" />
                       </div>
                       <span className="font-pixel text-[8px] bg-black px-1">{char.name}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* 2. WIZARDS */}
      {viewMode === 'CHAR_WIZARD' && (
         <CharacterWizard 
            onCancel={() => setViewMode('CAMPFIRE')}
            onComplete={() => {
               refreshCharacters();
               setViewMode('CAMPFIRE');
            }}
         />
      )}

      {viewMode === 'CAMP_WIZARD' && (
         <CampaignWizard 
            onCancel={() => setViewMode('GATE')}
            onComplete={(id) => {
               console.log("Created Campaign:", id);
               onStartGame(); // Auto start logic
            }}
         />
      )}

      {/* 3. DUNGEON GATE (Play Menu) */}
      {viewMode === 'GATE' && (
        <DungeonGate 
          onBack={() => setViewMode('IDLE')}
          onEnterWorld={(code) => {
            if (code === 'NEW_CAMPAIGN_TRIGGER') {
                setViewMode('CAMP_WIZARD');
            } else {
                console.log("Joining:", code);
                onStartGame();
            }
          }}
        />
      )}

      {/* FOOTER STATUS */}
      {selectedCharacterId && viewMode === 'IDLE' && (
         <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 opacity-70">
            <div className="w-2 h-2 bg-green-500 animate-pulse" />
            <span className="font-pixel text-[8px] text-faded">
               SOUL: {myCharacters.find(c => c.id === selectedCharacterId)?.name || 'UNKNOWN'}
            </span>
         </div>
      )}
    </div>
  );
};