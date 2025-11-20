// REFAKTOR G-4: File BARU.
// Komponen ini mengambil alih logika render level atas dari App.tsx.
// Ia memutuskan apakah akan menampilkan:
// 1. LoadingScreen (jika SSoT data belum dimuat)
// 2. GameScreen (jika ada state game aktif)
// 3. Tampilan Nexus/View (jika tidak sedang bermain)

import React, { useCallback } from 'react'; // Hapus useState
import { GameScreen } from './GameScreen';
import { NexusSanctum } from './NexusSanctum';
import { ViewManager } from './ViewManager';
import { useDataStore } from '../store/dataStore';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore'; // FASE 0: Impor gameStore
import { Character, Campaign, CampaignState } from '../types';

interface AppLayoutProps {
    userId: string;
    userEmail?: string;
    theme: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
}

// FASE 2: Modifikasi LoadingScreen untuk menangani status error
const LoadingScreen: React.FC<{ theme: string; message: string; isError?: boolean; onRetry?: () => void }> = ({
    theme, message, isError = false, onRetry
}) => (
    <div className={`w-full h-full bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}>
        <h1 className={`font-cinzel text-5xl ${!isError ? 'animate-pulse' : 'text-red-400'}`}>
            {isError ? "Koneksi Terputus" : "SanKarIA Hub"}
        </h1>
        <div className={`mt-4 p-4 border ${isError ? 'border-red-800 bg-red-900/20' : 'border-transparent'} max-w-md text-center`}>
            <p className={`${isError ? 'text-red-300 font-mono text-sm' : 'text-faded'}`}>{message}</p>
        </div>
        {isError && (
            <button
                onClick={() => {
                    if (onRetry) onRetry();
                    else window.location.reload();
                }}
                className="mt-6 font-cinzel text-sm uppercase tracking-widest bg-red-900/50 border border-red-500 hover:bg-red-800 text-white px-8 py-3 shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all"
            >
                Bangkitkan Ulang
            </button>
        )}
    </div>
);

export const AppLayout: React.FC<AppLayoutProps> = ({ userId, userEmail, theme, setTheme }) => {

    // State SSoT (dari dataStore)
    const { isLoading, hasLoaded, characters, error } = useDataStore(s => s.state);
    const { addPlayerToCampaign, fetchInitialData } = useDataStore(s => s.actions); // Ambil aksi & fetcher

    // State Navigasi (dari appStore)
    const { currentView, campaignToJoinOrStart, returnToNexus, startJoinFlow, notifications, pushNotification } = useAppStore(s => ({
        ...s.navigation,
        notifications: s.notifications.notifications,
        pushNotification: s.actions.pushNotification,
        ...s.actions
    }));

    // FASE 0: State Runtime sekarang diambil dari gameStore
    const { playingCampaign, playingCharacter, isGameLoading, loadGameSession, exitGameSession } = useGameStore(s => ({
        ...s.runtime,
        ...s.actions
    }));

    // =================================================================
    // Handler Sesi Game (Logika yang dulu ada di App.tsx)
    // =================================================================

    const handleSelectCampaign = async (campaign: Campaign) => {
        // Cek SSoT karakter dari dataStore
        const myCharacterInCampaign = characters.find(c => campaign.playerIds.includes(c.id));

        if (!myCharacterInCampaign) {
            // Alur 'Join': Buka character selection
            startJoinFlow(campaign);
            pushNotification({ message: 'Pilih karakter untuk bergabung ke campaign.', type: 'info' });
        } else {
            // Alur 'Load': Panggil aksi store
            await loadGameSession(campaign, myCharacterInCampaign);
            pushNotification({ message: 'Sesi permainan dimulai.', type: 'success' });
        }
    };

    const handleCharacterSelection = async (character: Character) => {
        if (!campaignToJoinOrStart) return;
        const campaign = campaignToJoinOrStart;

        try {
            // FASE 1 FIX (RACE CONDITION): 
            // 1. Panggil addPlayerToCampaign yang sekarang mengembalikan campaign konsisten
            const updatedCampaign = await addPlayerToCampaign(campaign.id, character.id);

            // 2. Ambil campaign yang sudah ter-update dari SSoT store
            // (Langkah ini tidak lagi diperlukan, updatedCampaign sudah konsisten)
            // const updatedCampaign = useDataStore.getState().state.campaigns.find(c => c.id === campaign.id);

            if (!updatedCampaign) throw new Error("Gagal menyinkronkan campaign setelah join.");

            // 3. Tutup view 'character-selection'
            // FASE 1 FIX (STATE BASI): Hapus returnToNexus(). Ini akan dipanggil oleh loadGameSession.
            // returnToNexus(); 

            // 4. Langsung muat game
            await loadGameSession(updatedCampaign, character);
            pushNotification({ message: 'Berhasil bergabung ke campaign.', type: 'success' });

        } catch (e) {
            console.error("Gagal join campaign:", e);
            // FASE 4: Hapus alert()
            console.error("Gagal bergabung ke campaign. Mungkin Anda sudah bergabung?");
            pushNotification({ message: 'Gagal bergabung ke campaign.', type: 'error' });
            returnToNexus();
        }
    };

    // FASE 0: handleExitGame sekarang memanggil aksi dari gameStore
    const handleExitGame = (finalCampaignState: CampaignState) => {
        // Aksi exitGameSession di gameStore menangani
        // penyimpanan SSoT (Campaign + Character) DAN reset state runtime,
        // DAN reset navigasi (via appStore).
        exitGameSession();
        pushNotification({ message: 'Sesi berakhir. Kemajuan disimpan.', type: 'success' });
    };

    // =================================================================
    // Render Logic
    // =================================================================

    // 1. Tampilkan loading jika SSoT data belum dimuat ATAU sedang memuat game
    if (isGameLoading) {
        return <LoadingScreen theme={theme} message="Memuat petualangan..." />;
    }

    if (isLoading) {
        return <LoadingScreen theme={theme} message="Memuat semesta..." />;
    }

    // Tambahkan prop onRetry ke render error state di bawah

    // FASE 2: Tangani Gagal Load SSoT
    if (error) {
        return <LoadingScreen
            theme={theme}
            message={error}
            isError={true}
            onRetry={() => userId && fetchInitialData(userId)} // Retry fetch
        />;
    }

    // Fallback jika stuck (tidak loading, belum loaded, tapi tidak ada error)
    if (!isLoading && !hasLoaded) {
        return <LoadingScreen theme={theme} message="Menyiapkan koneksi..." />;
    }

    // 2. Tampilkan GameScreen jika sesi game aktif
    if (playingCampaign && playingCharacter) {
        return (
            <GameScreen
                key={playingCampaign.id}
                initialCampaign={playingCampaign}
                character={playingCharacter}
                players={playingCampaign.players}
                onExit={handleExitGame} // Handler baru
                userId={userId}
            />
        );
    }

    // 3. Tampilkan ViewManager.
    // FASE 0: Logika percabangan Nexus/ViewManager dihapus.
    // ViewManager sekarang menangani SEMUA view, termasuk 'nexus'.
    return (
        <div className="relative w-full h-full">
            {/* Global toaster */}
            <div className="pointer-events-none fixed top-4 right-4 z-50 space-y-2">
                {notifications.map((n) => {
                    const baseStyle =
                        n.type === 'error'
                            ? 'bg-red-800/70 border-red-600 text-red-100'
                            : n.type === 'success'
                                ? 'bg-emerald-800/70 border-emerald-600 text-emerald-100'
                                : n.type === 'warning'
                                    ? 'bg-amber-800/70 border-amber-600 text-amber-100'
                                    : 'bg-slate-800/70 border-amber-800 text-amber-100';

                    const icon =
                        n.type === 'error' ? '✖' :
                            n.type === 'success' ? '✓' :
                                n.type === 'warning' ? '⚠' : 'ℹ';

                    return (
                        <div
                            key={n.id}
                            className={`pointer-events-auto px-4 py-2 rounded shadow-md font-cinzel border ${baseStyle}`}
                        >
                            <div className="flex items-center gap-2">
                                <span aria-hidden className="text-lg leading-none">{icon}</span>
                                <span className="leading-tight">{n.message}</span>
                                {n.count && n.count > 1 && (
                                    <span className="ml-2 text-xs opacity-80">x{n.count}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <ViewManager
                userId={userId}
                userEmail={userEmail}
                theme={theme}
                setTheme={setTheme}
                // Teruskan handler sesi game ke ViewManager
                onSelectCampaign={handleSelectCampaign}
                onCharacterSelection={handleCharacterSelection}
            />
        </div>
    );
};