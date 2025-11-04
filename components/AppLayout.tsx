// REFAKTOR G-4: File BARU.
// Komponen ini mengambil alih logika render level atas dari App.tsx.
// Ia memutuskan apakah akan menampilkan:
// 1. LoadingScreen (jika SSoT data belum dimuat)
// 2. GameScreen (jika ada state game aktif)
// 3. Tampilan Nexus/View (jika tidak sedang bermain)

import React, { useState, useCallback } from 'react';
import { GameScreen } from './GameScreen';
import { NexusSanctum } from './NexusSanctum';
import { ViewManager } from './ViewManager';
import { useDataStore } from '../store/dataStore';
import { useAppStore } from '../store/appStore';
import { Character, Campaign, CampaignState } from '../types';
import { dataService } from '../services/dataService';

interface AppLayoutProps {
    userId: string;
    userEmail?: string;
    theme: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ userId, userEmail, theme, setTheme }) => {
    
    // State SSoT (dari dataStore)
    const { isLoading, hasLoaded, characters } = useDataStore(s => s.state);
    const { saveCampaign, updateCharacter, addPlayerToCampaign } = useDataStore(s => s.actions);

    // State Navigasi (dari appStore)
    const { currentView, campaignToJoinOrStart, returnToNexus, startJoinFlow } = useAppStore(s => ({
        ...s.navigation,
        ...s.actions
    }));

    // State Runtime (LOKAL di AppLayout, karena ini merepresentasikan SESI AKTIF)
    const [playingCampaign, setPlayingCampaign] = useState<CampaignState | null>(null);
    const [playingCharacter, setPlayingCharacter] = useState<Character | null>(null);
    const [isGameLoading, setIsGameLoading] = useState(false);

    // =================================================================
    // Handler Sesi Game (Logika yang dulu ada di App.tsx)
    // =================================================================

    const handleSelectCampaign = async (campaign: Campaign) => {
        setIsGameLoading(true);
        try {
            const myCharacterInCampaign = characters.find(c => campaign.playerIds.includes(c.id));
            
            if (!myCharacterInCampaign) {
                // Alur 'Join': Buka character selection
                startJoinFlow(campaign);
                setIsGameLoading(false);
                return;
            }
            
            // Alur 'Load': Muat data runtime
            const { eventLog, monsters, players } = await dataService.loadCampaignRuntimeData(campaign.id, campaign.playerIds);
            
            const campaignState: CampaignState = {
                ...campaign, eventLog, monsters, players,
                thinkingState: 'idle', activeRollRequest: null,
                choices: [], turnId: null,
            };
            
            setPlayingCampaign(campaignState);
            setPlayingCharacter(myCharacterInCampaign);
        
        } catch (e) {
            console.error("Gagal memuat data runtime campaign:", e);
            alert("Gagal memuat sesi permainan. Coba lagi.");
        } finally {
            setIsGameLoading(false);
        }
    };
    
    const handleCharacterSelection = async (character: Character) => {
        if (!campaignToJoinOrStart) return;
        const campaign = campaignToJoinOrStart;

        try {
            // Tambah player ke SSoT (via dataStore)
            await addPlayerToCampaign(campaign.id, character.id);
            // Ambil campaign yang sudah ter-update dari store
            const updatedCampaign = useDataStore.getState().state.campaigns.find(c => c.id === campaign.id);
            
            if (!updatedCampaign) throw new Error("Gagal menyinkronkan campaign setelah join.");

            returnToNexus(); // Tutup view 'character-selection'
            await handleSelectCampaign(updatedCampaign); // Langsung muat game

        } catch (e) {
             console.error("Gagal join campaign:", e);
             alert("Gagal bergabung ke campaign. Mungkin Anda sudah bergabung?");
             returnToNexus();
        }
    };

    const handleExitGame = (finalCampaignState: CampaignState) => {
        // 1. Simpan SSoT Campaign (state non-player)
        saveCampaign(finalCampaignState);
        
        // 2. Simpan SSoT Karakter kita
        if (playingCharacter) {
            // Ambil state karakter terbaru dari dalam finalCampaignState
            const finalCharacterState = finalCampaignState.players.find(p => p.id === playingCharacter.id);
            if (finalCharacterState) {
                updateCharacter(finalCharacterState);
            }
        }
        
        // 3. Reset state runtime
        setPlayingCampaign(null);
        setPlayingCharacter(null);
        returnToNexus(); // Kembali ke Nexus
    };

    // =================================================================
    // Render Logic
    // =================================================================
    
    const LoadingScreen = () => (
       <div className={`w-full h-full bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}>
          <h1 className="font-cinzel text-5xl animate-pulse">SanKarIA Hub</h1>
          <p className="mt-2">{isGameLoading ? "Memuat petualangan..." : "Memuat semesta..."}</p>
      </div>
    );

    // 1. Tampilkan loading jika SSoT data belum dimuat ATAU sedang memuat game
    if ((!hasLoaded && isLoading) || isGameLoading) {
        return <LoadingScreen />;
    }

    // 2. Tampilkan GameScreen jika sesi game aktif
    if (playingCampaign && playingCharacter) {
        return (
            <GameScreen 
              key={playingCampaign.id}
              initialCampaign={playingCampaign} 
              character={playingCharacter} 
              players={playingCampaign.players}
              onExit={handleExitGame}
              // updateCharacter (SSoT) sekarang dipanggil DARI DALAM GameScreen
              // (Lihat modifikasi GameScreen)
              userId={userId}
            />
        );
    }

    // 3. Tampilkan Nexus (jika view = 'nexus') atau ViewManager (jika view != 'nexus')
    return (
        <>
            {currentView === 'nexus' && <NexusSanctum userEmail={userEmail} />}
            {currentView !== 'nexus' && 
                <ViewManager 
                    userId={userId}
                    userEmail={userEmail}
                    theme={theme}
                    setTheme={setTheme}
                    // Teruskan handler sesi game ke ViewManager
                    onSelectCampaign={handleSelectCampaign}
                    onCharacterSelection={handleCharacterSelection}
                />
            }
        </>
    );
};