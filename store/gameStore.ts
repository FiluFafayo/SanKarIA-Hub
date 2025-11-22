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
    sessionAbortController: AbortController | null;
    runtimeSettings: {
        autoNpcPortraits: boolean;
        dmNarrationVoiceEnabled: boolean;
        narrationLang: 'id-ID' | 'en-US';
    };
    voice: {
        micRecording: boolean;
        sttPartial: string;
        sttFinal: string | null;
        error?: string;
        actionQueue: string[];
    };
}
const initialRuntimeState: RuntimeState = {
    playingCampaign: null,
    playingCharacter: null,
    isGameLoading: false,
    sessionAbortController: null,
    runtimeSettings: {
        autoNpcPortraits: true,
        dmNarrationVoiceEnabled: true,
        narrationLang: 'id-ID',
    },
    voice: {
        micRecording: false,
        sttPartial: '',
        sttFinal: null,
        error: undefined,
        actionQueue: [],
    },
};
interface RuntimeActions {
    loadGameSession: (campaign: Campaign, character: Character) => Promise<void>;
    exitGameSession: () => void;
    // Reset tanpa menyimpan, dipakai saat logout
    resetRuntimeOnLogout: () => void;
    // Aksi internal yang dipanggil oleh GameScreen/Hooks
    _setRuntimeCampaignState: (campaignState: CampaignState) => void;
    _setRuntimeCharacterState: (character: Character) => void;
    // Pembatalan level sesi
    cancelAllInFlight: () => void;
    setAutoNpcPortraits: (enabled: boolean) => void;
    setDmNarrationVoiceEnabled: (enabled: boolean) => void;
    setNarrationLang: (lang: 'id-ID' | 'en-US') => void;
    // Voice runtime
    setMicRecording: (recording: boolean) => void;
    setVoicePartial: (text: string) => void;
    setVoiceFinal: (text: string | null) => void;
    setVoiceError: (err?: string) => void;
    enqueueVoiceAction: (text: string) => void;
    dequeueVoiceAction: () => string | null;
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

				// [FASE FINAL FIX] ATLAS HYDRATION (Simplified)
                // Repository sudah melakukan mapping relational via 'mapDbCampaign'.
                // Kita cukup validasi dan pakai 'activeMapData' yang sudah ada di objek campaign.
                
                let finalActiveMapData = campaign.activeMapData;
                
                // Fallback: Jika repo belum mapping (legacy data), coba construct dari properti flat lama
                if (!finalActiveMapData && campaign.activeMapId) {
                     console.warn("[Atlas] Hydration Warning: activeMapData missing, attempting legacy reconstruction.");
                     // Construct dummy/legacy container if needed, or just rely on explorationGrid
                }

				const campaignState: CampaignState = {
					...campaign,
					eventLog,
					monsters,
					players,
					thinkingState: "idle",
					activeRollRequest: null,
					choices: [],
					turnId: null,
                    // [FIX] Trust the repository data. Jangan overwrite dengan undefined.
                    activeMapData: finalActiveMapData,
                    // Pastikan properti flat sinkron (Prioritas: Data Peta > Data Flat Campaign)
                    explorationGrid: finalActiveMapData ? finalActiveMapData.gridData : campaign.explorationGrid,
                    fogOfWar: finalActiveMapData ? finalActiveMapData.fogData : campaign.fogOfWar,
				};

				set({
					runtime: {
						playingCampaign: campaignState,
						playingCharacter: character,
						isGameLoading: false,
                        sessionAbortController: new AbortController(),
					},
				});

				// FASE 1 FIX (STATE BASI): Bersihkan state navigasi (termasuk campaignToJoinOrStart)
				useAppStore.getState().actions.returnToNexus();

				// Notifikasi sukses
				useAppStore.getState().actions.pushNotification({
					message: 'Sesi permainan dimulai.',
					type: 'success',
				});
			} catch (e) {
				console.error("Gagal memuat data runtime campaign:", e);
				// FASE 4: Hapus alert()
				console.error("Gagal memuat sesi permainan. Coba lagi.");
				set((state) => ({
					runtime: { ...state.runtime, isGameLoading: false },
				}));
				// Notifikasi error
				useAppStore.getState().actions.pushNotification({
					message: 'Gagal memuat sesi permainan.',
					type: 'error',
				});
			}
		},
		exitGameSession: () => {
            // Batalkan semua panggilan AI yang masih berjalan (level sesi)
            const controller = get().runtime.sessionAbortController;
            controller?.abort();

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

			// Notifikasi sukses
			useAppStore.getState().actions.pushNotification({
				message: 'Sesi berakhir. Kemajuan disimpan.',
				type: 'success',
			});
		},
        resetRuntimeOnLogout: () => {
            // Batalkan semua panggilan AI (jika ada)
            const controller = get().runtime.sessionAbortController;
            controller?.abort();
            // Jangan menyimpan apapun, hanya reset runtime state
            set({ runtime: initialRuntimeState });
            // Pulihkan navigasi global ke Nexus
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
        cancelAllInFlight: () => {
            const controller = get().runtime.sessionAbortController;
            controller?.abort();
            // Setelah abort, buat controller baru agar sesi tetap bisa lanjut jika tidak exit
            set((state) => ({
                runtime: { ...state.runtime, sessionAbortController: new AbortController() }
            }));
        },
        setAutoNpcPortraits: (enabled) => {
            set((state) => ({
                runtime: {
                    ...state.runtime,
                    runtimeSettings: { ...state.runtime.runtimeSettings, autoNpcPortraits: enabled },
                },
            }));
        },
        setDmNarrationVoiceEnabled: (enabled) => {
            set((state) => ({
                runtime: {
                    ...state.runtime,
                    runtimeSettings: { ...state.runtime.runtimeSettings, dmNarrationVoiceEnabled: enabled },
                },
            }));
        },
        setNarrationLang: (lang) => {
            set((state) => ({
                runtime: {
                    ...state.runtime,
                    runtimeSettings: { ...state.runtime.runtimeSettings, narrationLang: lang },
                },
            }));
        },
        setMicRecording: (recording) => {
            set((state) => ({
                runtime: { ...state.runtime, voice: { ...state.runtime.voice, micRecording: recording } },
            }));
        },
        setVoicePartial: (text) => {
            set((state) => ({
                runtime: { ...state.runtime, voice: { ...state.runtime.voice, sttPartial: text || '' } },
            }));
        },
        setVoiceFinal: (text) => {
            set((state) => ({
                runtime: { ...state.runtime, voice: { ...state.runtime.voice, sttFinal: text } },
            }));
        },
        setVoiceError: (err) => {
            set((state) => ({
                runtime: { ...state.runtime, voice: { ...state.runtime.voice, error: err } },
            }));
        },
        enqueueVoiceAction: (text) => {
            set((state) => ({
                runtime: { ...state.runtime, voice: { ...state.runtime.voice, actionQueue: [...state.runtime.voice.actionQueue, text] } },
            }));
        },
        dequeueVoiceAction: () => {
            const q = get().runtime.voice.actionQueue;
            if (!q.length) return null;
            const [first, ...rest] = q;
            set((state) => ({ runtime: { ...state.runtime, voice: { ...state.runtime.voice, actionQueue: rest } } }));
            return first;
        },
   	},
}));
