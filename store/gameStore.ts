// FASE 0: File BARU.
// Store ini HANYA mengelola state runtime game session.
// Dipisahkan dari appStore (navigasi) dan dataStore (SSoT).

import { create } from "zustand";
import { Character, Campaign, CampaignState } from "../types";
import { getRepositories } from "../services/repository";
import { useDataStore } from "./dataStore";
import { useAppStore } from "./appStore"; // Diperlukan untuk reset navigasi

// =================================================================
// Tipe State & Aksi
// =================================================================

interface RuntimeState {
	playingCampaign: CampaignState | null;
	playingCharacter: Character | null;
	isGameLoading: boolean;
}
const initialRuntimeState: RuntimeState = {
	playingCampaign: null,
	playingCharacter: null,
	isGameLoading: false,
};
interface RuntimeActions {
	loadGameSession: (campaign: Campaign, character: Character) => Promise<void>;
	exitGameSession: () => void;
	// Aksi internal yang dipanggil oleh GameScreen/Hooks
	_setRuntimeCampaignState: (campaignState: CampaignState) => void;
	_setRuntimeCharacterState: (character: Character) => void;
}

// --- Gabungan Store ---
type GameStore = {
	runtime: RuntimeState;
	actions: RuntimeActions;
};

// =================================================================
// STORE DEFINITION
// =================================================================
export const useGameStore = create<GameStore>((set, get) => ({
	// === STATE ===
	runtime: initialRuntimeState,

	// === ACTIONS ===
	actions: {
		// --- Runtime Actions (Dipindah dari appStore) ---
		loadGameSession: async (campaign, character) => {
			set((state) => ({ runtime: { ...state.runtime, isGameLoading: true } }));
            try {
                const { runtime } = getRepositories();
                const { eventLog, monsters, players } =
                    await runtime.loadCampaignRuntimeData(
                        campaign.id,
                        campaign.playerIds
                    );

				const campaignState: CampaignState = {
					...campaign,
					eventLog,
					monsters,
					players,
					thinkingState: "idle",
					activeRollRequest: null,
					choices: [],
					turnId: null,
				};

				set({
					runtime: {
						playingCampaign: campaignState,
						playingCharacter: character,
						isGameLoading: false,
					},
				});

				// FASE 1 FIX (STATE BASI): Bersihkan state navigasi (termasuk campaignToJoinOrStart)
				useAppStore.getState().actions.returnToNexus();
			} catch (e) {
				console.error("Gagal memuat data runtime campaign:", e);
				// FASE 4: Hapus alert()
				console.error("Gagal memuat sesi permainan. Coba lagi.");
				set((state) => ({
					runtime: { ...state.runtime, isGameLoading: false },
				}));
			}
		},
		exitGameSession: () => {
			const { playingCampaign, playingCharacter } = get().runtime;

			if (playingCampaign) {
				// Simpan SSoT Campaign
				useDataStore.getState().actions.saveCampaign(playingCampaign);
			}
			if (playingCharacter) {
				// Simpan SSoT Karakter (ambil state terbaru dari dalam campaign)
				const finalCharacterState = playingCampaign?.players.find(
					(p) => p.id === playingCharacter.id
				);
				if (finalCharacterState) {
					useDataStore.getState().actions.updateCharacter(finalCharacterState);
				}
			}

			// Reset state runtime
			set({ runtime: initialRuntimeState });
			// Reset navigasi global
			useAppStore.getState().actions.returnToNexus();
		},
		_setRuntimeCampaignState: (campaignState) => {
			set((state) => ({
				runtime: { ...state.runtime, playingCampaign: campaignState },
			}));
		},
		_setRuntimeCharacterState: (character) => {
			set((state) => ({
				runtime: { ...state.runtime, playingCharacter: character },
			}));
		},
	},
}));
