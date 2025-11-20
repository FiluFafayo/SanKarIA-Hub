// File: src/components/scenes/NexusScene.tsx
import React, { useState, useEffect } from 'react';
import { CampfireMenu } from '../nexus/CampfireMenu';
import { DungeonGate } from '../nexus/DungeonGate';
import { CharacterWizard } from '../nexus/CharacterWizard';
import { CampaignWizard } from '../nexus/CampaignWizard';
import { useAppStore } from '../../store/appStore';
import { characterRepository } from '../../services/repository/characterRepository';
import { dataService } from '../../services/dataService';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, setSelectedCharacterId, selectedCharacterId } = useAppStore();

  // 1. Fetch Real Data
  const refreshCharacters = async () => {
    if (user) {
      console.log('[DEBUG] refreshCharacters called with user:', user);
      try {
        const chars = await characterRepository.getMyCharacters(user.id);
        console.log('[DEBUG] Characters fetched:', chars);
        setMyCharacters(chars);
        if (chars.length > 0 && !selectedCharacterId) {
          setSelectedCharacterId(chars[0].id);
        }
        return true;
      } catch (error) {
        console.error('[DEBUG] Error fetching characters:', error);
        return false;
      }
    } else {
      console.log('[DEBUG] refreshCharacters called but no user available');
      return false;
    }
  };

  // Retry mechanism untuk refresh characters dengan delay
  const refreshCharactersWithRetry = async (maxRetries = 3, delayMs = 1000) => {
    setIsRefreshing(true);
    try {
      for (let i = 0; i < maxRetries; i++) {
        console.log(`[DEBUG] refreshCharactersWithRetry attempt ${i + 1}/${maxRetries}`);
        
        // Jika user tidak tersedia di state, coba ambil dari auth service
        let currentUser = user;
        if (!currentUser) {
          console.log('[DEBUG] User not available in state, trying to get from auth service...');
          try {
            const { data: { session } } = await dataService.getClient().auth.getSession();
            if (session?.user) {
              currentUser = session.user;
              console.log('[DEBUG] Got user from auth service:', currentUser);
            }
          } catch (authError) {
            console.error('[DEBUG] Failed to get user from auth service:', authError);
          }
        }
        
        if (currentUser) {
          try {
            const chars = await characterRepository.getMyCharacters(currentUser.id);
            console.log('[DEBUG] Characters fetched:', chars);
            setMyCharacters(chars);
            if (chars.length > 0 && !selectedCharacterId) {
              setSelectedCharacterId(chars[0].id);
            }
            return true;
          } catch (error) {
            console.error('[DEBUG] Error fetching characters:', error);
          }
        }
        
        if (i < maxRetries - 1) {
          console.log(`[DEBUG] Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      console.error('[DEBUG] refreshCharacters failed after all retries');
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      console.log('[DEBUG] User changed, refreshing characters...');
      refreshCharactersWithRetry(3, 1000);
    }
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
                 useAppStore.getState().actions.pushNotification({ type: 'info', message: 'Pilih jiwa terlebih dahulu di Api Unggun.' });
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
        <div className="relative">
          <CampfireMenu
            characters={myCharacters}
            onSelectCharacter={(id) => {
              setSelectedCharacterId(id);
            }}
            onBack={() => setViewMode('IDLE')}
            onCreate={() => setViewMode('CHAR_WIZARD')}
          />
          {/* Refresh button */}
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={() => refreshCharactersWithRetry(3, 1000)}
              disabled={isRefreshing}
              className={`px-3 py-1 text-xs font-pixel border ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-600'} bg-orange-800 text-white border-orange-600`}
            >
              {isRefreshing ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      )}

      {/* 2. WIZARDS */}
      {viewMode === 'CHAR_WIZARD' && (
         <CharacterWizard 
            onCancel={() => setViewMode('CAMPFIRE')}
            onComplete={async () => {
               console.log('[DEBUG] CharacterWizard onComplete called');
               const success = await refreshCharactersWithRetry(3, 1000);
               setViewMode('CAMPFIRE');
               // Note: Character selection will be handled by the refreshCharacters function
               // which calls setSelectedCharacterId if there are characters and no character is selected
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