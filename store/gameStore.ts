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

				// [FASE 3] ATLAS HYDRATION
                // Cek apakah campaign memiliki activeMapId dan apakah dataStore punya peta tersebut
                const activeMapId = campaign.activeMapId;
                let loadedMapData = undefined;

                if (activeMapId) {
                    // Kita akses dataStore secara langsung untuk mengambil 'world_maps' cache
                    // (Pastikan useDataStore sudah mengimpor world_maps di types/store nya, 
                    // jika belum, kita pakai fallback fetch)
                    const allMaps = useDataStore.getState().state.worldMaps || []; // Asumsi properti ada
                    const mapFound = allMaps.find(m => m.id === activeMapId);
                    
                    if (mapFound) {
                        loadedMapData = {
                            id: mapFound.id,
                            campaignId: mapFound.campaign_id, // Sesuaikan dengan nama properti DB/Type
                            name: mapFound.name,
                            gridData: mapFound.grid_data || mapFound.gridData,
                            fogData: mapFound.fog_data || mapFound.fogData,
                            markers: mapFound.markers || [],
                            isActive: true
                        };
                    } else {
                         console.warn(`[Atlas] Peta aktif ID ${activeMapId} tidak ditemukan di cache SSoT.`);
                    }
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
                    // Inject Active Map Data
                    activeMapData: loadedMapData,
                    // Pastikan explorationGrid sinkron dengan activeMapData jika ada
                    explorationGrid: loadedMapData ? loadedMapData.gridData : campaign.explorationGrid,
                    fogOfWar: loadedMapData ? loadedMapData.fogData : campaign.fogOfWar,
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
