// REFAKTOR G-4: File BARU.
// Komponen ini mengambil alih logika render level atas dari App.tsx.
// Ia memutuskan apakah akan menampilkan:
// 1. LoadingScreen (jika SSoT data belum dimuat)
// 2. GameScreen (jika ada state game aktif)
// 3. Tampilan Nexus/View (jika tidak sedang bermain)

import React, { useCallback } from "react"; // Hapus useState
import { GameScreen } from "./GameScreen";
import { NexusSanctum } from "./NexusSanctum";
import { ViewManager } from "./ViewManager";
import { useDataStore } from "../store/dataStore";
import { useAppStore } from "../store/appStore";
import { useGameStore } from "../store/gameStore"; // FASE 0: Impor gameStore
import { Character, Campaign, CampaignState } from "../types";
import { dataService } from "../services/dataService";

interface AppLayoutProps {
	userId: string;
	userEmail?: string;
	theme: string;
	setTheme: React.Dispatch<React.SetStateAction<string>>;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
	userId,
	userEmail,
	theme,
	setTheme,
}) => {
	// State SSoT (dari dataStore)
	const { isLoading, hasLoaded, characters } = useDataStore((s) => s.state);
	const { addPlayerToCampaign } = useDataStore((s) => s.actions); // Ambil aksi

	// State Navigasi (dari appStore)
	const { currentView, campaignToJoinOrStart, returnToNexus, startJoinFlow } =
		useAppStore((s) => ({
			...s.navigation,
			...s.actions,
		}));

	// FASE 0: State Runtime sekarang diambil dari gameStore
	const {
		playingCampaign,
		playingCharacter,
		isGameLoading,
		loadGameSession,
		exitGameSession,
	} = useGameStore((s) => ({
		...s.runtime,
		...s.actions,
	}));

	// =================================================================
	// Handler Sesi Game (Logika yang dulu ada di App.tsx)
	// =================================================================

	const handleSelectCampaign = async (campaign: Campaign) => {
		// Cek SSoT karakter dari dataStore
		const myCharacterInCampaign = characters.find((c) =>
			campaign.playerIds.includes(c.id)
		);

		if (!myCharacterInCampaign) {
			// Alur 'Join': Buka character selection
			startJoinFlow(campaign);
		} else {
			// Alur 'Load': Panggil aksi store
			await loadGameSession(campaign, myCharacterInCampaign);
		}
	};

	const handleCharacterSelection = async (character: Character) => {
		if (!campaignToJoinOrStart) return;
		const campaign = campaignToJoinOrStart;

		try {
			// FASE 1 FIX (RACE CONDITION):
			// 1. Panggil addPlayerToCampaign yang sekarang mengembalikan campaign konsisten
			const updatedCampaign = await addPlayerToCampaign(
				campaign.id,
				character.id
			);

			// 2. Ambil campaign yang sudah ter-update dari SSoT store
			// (Langkah ini tidak lagi diperlukan, updatedCampaign sudah konsisten)
			// const updatedCampaign = useDataStore.getState().state.campaigns.find(c => c.id === campaign.id);

			if (!updatedCampaign)
				throw new Error("Gagal menyinkronkan campaign setelah join.");

			// 3. Tutup view 'character-selection'
			// FASE 1 FIX (STATE BASI): Hapus returnToNexus(). Ini akan dipanggil oleh loadGameSession.
			// returnToNexus();

			// 4. Langsung muat game
			await loadGameSession(updatedCampaign, character);
		} catch (e) {
			console.error("Gagal join campaign:", e);
			// FASE 4: Hapus alert()
			console.error(
				"Gagal bergabung ke campaign. Mungkin Anda sudah bergabung?"
			);
			returnToNexus();
		}
	};

	// FASE 0: handleExitGame sekarang memanggil aksi dari gameStore
	const handleExitGame = (finalCampaignState: CampaignState) => {
		// Aksi exitGameSession di gameStore menangani
		// penyimpanan SSoT (Campaign + Character) DAN reset state runtime,
		// DAN reset navigasi (via appStore).
		exitGameSession();
	};

	// =================================================================
	// Render Logic
	// =================================================================

	const LoadingScreen = () => (
		<div
			className={`w-full h-full bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}
		>
			<h1 className="font-cinzel text-5xl animate-pulse">SanKarIA Hub</h1>
			<p className="mt-2">
				{isGameLoading ? "Memuat petualangan..." : "Memuat semesta..."}
			</p>
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
				onExit={handleExitGame} // Handler baru
				userId={userId}
			/>
		);
	}

	// 3. Tampilkan ViewManager.
	// FASE 0: Logika percabangan Nexus/ViewManager dihapus.
	// ViewManager sekarang menangani SEMUA view, termasuk 'nexus'.
	return (
		<ViewManager
			userId={userId}
			userEmail={userEmail}
			theme={theme}
			setTheme={setTheme}
			// Teruskan handler sesi game ke ViewManager
			onSelectCampaign={handleSelectCampaign}
			onCharacterSelection={handleCharacterSelection}
		/>
	);
};
