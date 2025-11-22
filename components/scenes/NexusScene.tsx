// File: src/components/scenes/NexusScene.tsx
import React, { useState, useEffect } from 'react';
import { CampfireMenu } from '../nexus/CampfireMenu';
import { DungeonGate } from '../nexus/DungeonGate';
import { CharacterWizard } from '../nexus/CharacterWizard'; // Import wizard
import { CampaignWizard } from '../nexus/CampaignWizard';
import { SoulSheetModal } from '../nexus/SoulSheetModal'; // [FASE 3] Impor Modal Inspeksi
import { useAppStore } from '../../store/appStore';
import { useDataStore } from '../../store/dataStore'; // GANTI DENGAN DATASTORE
import { Character } from '../../types';
import { authRepository } from '../../services/repository/authRepository';
import { campaignRepository } from '../../services/repository/campaignRepository'; // [FASE 1] Import Repo

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

// Indikator loading yang lebih eksplisit
const LoadingIndicator = () => (
  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50">
    <div className="animate-pulse text-gold font-pixel text-lg">MEMUAT JIWA...</div>
    <div className="w-32 h-1 bg-gold/20 mt-4 overflow-hidden">
      <div className="w-1/3 h-full bg-gold animate-loading-bar" />
    </div>
  </div>
);


export const NexusScene: React.FC<NexusSceneProps> = ({ onStartGame }) => {
  const [viewMode, setViewMode] = useState<'IDLE' | 'CAMPFIRE' | 'GATE' | 'CHAR_WIZARD' | 'CAMP_WIZARD'>('IDLE');
  const [inspectingCharacter, setInspectingCharacter] = useState<Character | null>(null); // [FASE 3] State Inspeksi

  // HAPUS: State lokal untuk karakter dan status refresh
  // const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  // const [isRefreshing, setIsRefreshing] = useState(false);

  // [FASE 0] FIX: Menggunakan selector granular untuk menghindari "undefined" dan re-render massal
  const auth = useAppStore(s => s.auth);
  const selectedCharacterId = useAppStore(s => s.navigation.selectedCharacterId);
  const setSelectedCharacterId = useAppStore(s => s.actions.setSelectedCharacterId);
  const pushNotification = useAppStore(s => s.actions.pushNotification);
  
  const user = auth.user;

  const { state: dataState, actions: dataActions } = useDataStore();
  const { characters, isLoading, hasLoaded, error } = dataState;

  const handleLogout = async () => {
    await authRepository.signOut();
  };

  // [FIX CRITICAL] Pemicu Fetch Data
  useEffect(() => {
    // Cek error agar tidak infinite loop saat gagal
    if (user && !hasLoaded && !isLoading && !error) {
      console.log('[NexusScene] Memulai penarikan data jiwa untuk:', user.id);
      dataActions.fetchInitialData(user.id);
    }
  }, [user, hasLoaded, isLoading, error, dataActions]);

  // [REMOVED] Auto-redirect ke Wizard dihapus.
  // User harus melihat Nexus dulu (Game Feel), baru klik Campfire secara manual.

  // HAPUS: Semua logika fetching data lokal (refreshCharacters, refreshCharactersWithRetry, useEffect)
  // Logika ini sekarang ditangani secara global oleh App.tsx -> useDataStore.fetchInitialData

  // Logika untuk memicu fetch awal ada di App.tsx, bukan di sini.
  // useEffect(() => {
  //   if (user) {
  //     dataActions.fetchInitialData(user.id);
  //   }
  // }, [user, dataActions]); // Panggil fetchInitialData saat user berubah

  return (
    <div className="relative w-full h-full flex flex-col">
      <BackgroundLayer />

      {/* TITLE / HUD */}
      <div className="absolute top-10 inset-x-0 text-center z-10 pointer-events-none">
        <h1 className="font-pixel text-3xl text-gold drop-shadow-md tracking-widest opacity-90">GRIMOIRE</h1>
        <p className="font-retro text-faded text-sm mt-1 tracking-widest">RPG TABLETOP ENGINE</p>
      </div>

      {/* Tampilkan loading indicator berdasarkan state dari dataStore */}
      {(isLoading || (!hasLoaded && !error)) && <LoadingIndicator />}

      {/* ERROR STATE UI */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 gap-4 p-8 text-center">
          <h2 className="text-red-500 font-pixel text-xl animate-pulse">KONEKSI TERPUTUS</h2>
          <p className="text-red-200 font-retro text-sm max-w-md border border-red-900/50 p-4 bg-red-950/30">
            {error}
          </p>
          <button
            onClick={() => user && dataActions.fetchInitialData(user.id)}
            className="px-6 py-3 bg-red-900 border-2 border-red-500 text-white font-pixel hover:bg-red-800 transition-colors shadow-[0_0_10px_red]"
          >
            COBA LAGI
          </button>
          <button
            onClick={handleLogout}
            className="text-xs text-faded hover:text-white underline mt-8"
          >
            Keluar / Logout
          </button>
        </div>
      )}

      {/* CENTRAL INTERACTIVE AREA */}
      {viewMode === 'IDLE' && hasLoaded && !error && (
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
        <>
          <CampfireMenu
            characters={characters}
            onSelectCharacter={(id) => {
                // [FASE 3] Intercept seleksi untuk inspeksi
                const char = characters.find(c => c.id === id);
                if (char) setInspectingCharacter(char);
            }}
            onBack={() => setViewMode('IDLE')}
            onCreate={() => setViewMode('CHAR_WIZARD')}
          />
          
          {/* [FASE 3] Modal Inspeksi Jiwa */}
          {inspectingCharacter && (
            <SoulSheetModal
                character={inspectingCharacter}
                onClose={() => setInspectingCharacter(null)}
                onSelect={() => {
                    setSelectedCharacterId(inspectingCharacter.id);
                    setInspectingCharacter(null); // Tutup modal
                    // Opsional: Langsung kembali ke IDLE atau biarkan user di Campfire
                    // UX Choice: Tetap di Campfire agar user tahu "Sudah terpilih"
                }}
            />
          )}
        </>
      )}

      {/* 2. WIZARDS */}
      {viewMode === 'CHAR_WIZARD' && (
        <CharacterWizard
          onCancel={() => setViewMode('CAMPFIRE')}
          onComplete={async () => {
            console.log('[DEBUG] CharacterWizard onComplete called');
            // [FASE 2] Force Refresh: Kirim flag 'true' untuk menjebol cache store
            if (user) {
                console.log('[Nexus] Force refreshing character list...');
                await dataActions.fetchInitialData(user.id, true);
            }
            setViewMode('CAMPFIRE');
          }}
        />
      )}

      {viewMode === 'CAMP_WIZARD' && (
        <CampaignWizard
          onCancel={() => setViewMode('GATE')}
          onComplete={async (id) => {
            console.log("Created Campaign:", id);
            // [FASE 1] Refresh Data agar campaign baru muncul di list SSoT
            if (user) await dataActions.fetchInitialData(user.id, true);
            onStartGame(); 
          }}
        />
      )}

      {/* 3. DUNGEON GATE (Play Menu) */}
      {viewMode === 'GATE' && (
        <DungeonGate
          onBack={() => setViewMode('IDLE')}
          onEnterWorld={async (code) => {
            if (code === 'NEW_CAMPAIGN_TRIGGER') {
              setViewMode('CAMP_WIZARD');
            } else {
              // [FASE 1] Logic Join Real
              if (!selectedCharacterId || !user) return;
              
              try {
                  const campaign = await campaignRepository.getCampaignByJoinCode(code);
                  if (!campaign) {
                      pushNotification({ type: 'error', message: 'Rune tidak valid. Dunia tidak ditemukan.' });
                      return;
                  }
                  
                  // Auto Join logic
                  await campaignRepository.addPlayerToCampaign(campaign.id, selectedCharacterId);
                  pushNotification({ type: 'success', message: `Berhasil memasuki ${campaign.title}!` });
                  
                  // Refresh & Start
                  await dataActions.fetchInitialData(user.id, true);
                  onStartGame();
                  
              } catch (e) {
                  console.error(e);
                  pushNotification({ type: 'error', message: 'Gagal menembus gerbang dimensi.' });
              }
            }
          }}
        />
      )}

      {/* FOOTER STATUS */}
      {selectedCharacterId && viewMode === 'IDLE' && (
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 opacity-70">
          <div className="w-2 h-2 bg-green-500 animate-pulse" />
          <span className="font-pixel text-[8px] text-faded">
            SOUL: {characters.find(c => c.id === selectedCharacterId)?.name || 'UNKNOWN'}
          </span>
        </div>
      )}

      {/* LOGOUT BUTTON */}
      {viewMode === 'IDLE' && (
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={handleLogout}
            className="font-pixel text-faded text-[10px] hover:text-red-400 transition-colors bg-black/50 px-3 py-2 border border-wood/50 hover:border-red-500"
          >
            KELUAR
          </button>
        </div>
      )}
    </div>
  );
};