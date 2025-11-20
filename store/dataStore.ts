// REFAKTOR G-4: File BARU.
// Store ini sekarang menjadi SSoT (Single Source of Truth) untuk data persisten
// (Campaigns dan Characters) dan logika untuk memuat/menyimpannya.
// Ini membongkar logic tersebut dari App.tsx (God Object).

import { create } from "zustand";
import {
	Campaign,
	Character,
	GameEvent,
	CampaignState,
	CharacterInventoryItem,
	SpellDefinition,
	AbilityScores,
	ItemDefinition,
} from "../types";
import { getRepositories } from "../services/repository";
import { useAppStore } from "./appStore";
import { generationService } from "../services/ai/generationService";
// Impor baru untuk aksi template
import {
	RawCharacterData,
	findClass,
	findRace,
	findBackground,
	findSpell,
	getItemDef,
} from "../data/registry";
import { getAbilityModifier } from "../utils";
import { renderCharacterLayout } from "../services/pixelRenderer";
import { SPRITE_PARTS } from "../data/spriteParts";

// =================================================================
// Tipe State & Aksi
// =================================================================

interface DataState {
	campaigns: Campaign[];
	characters: Character[];
	isLoading: boolean;
	hasLoaded: boolean;
	error: string | null;
}

const initialState: DataState = {
	campaigns: [],
	characters: [],
	isLoading: false,
	hasLoaded: false,
	error: null,
};

interface DataActions {
	// Aksi internal untuk memodifikasi state
	_setLoading: (status: boolean) => void;
	_setError: (error: string | null) => void;
	_setCampaigns: (campaigns: Campaign[]) => void;
	_setCharacters: (characters: Character[]) => void;
	_addCampaign: (campaign: Campaign) => void;
	_updateCampaign: (campaign: Campaign) => void;
	_addCharacter: (character: Character) => void;
	_updateCharacter: (character: Character) => void;

	// Aksi publik (thunks) yang dipanggil oleh UI/App
	fetchInitialData: (userId: string) => Promise<void>;
	saveCampaign: (campaign: Campaign | CampaignState) => Promise<void>;
	updateCharacter: (character: Character) => Promise<void>;
	saveNewCharacter: (
		charData: Omit<Character, "id" | "ownerId" | "inventory" | "knownSpells">,
		inventoryData: Omit<CharacterInventoryItem, "instanceId">[],
		spellData: SpellDefinition[],
		userId: string
    ) => Promise<Character>; // FASE 1 FIX: Kembalikan karakter baru
    createCampaign: (
		campaignData: Omit<
			Campaign,
			| "id"
			| "ownerId"
			| "eventLog"
			| "monsters"
			| "players"
			| "playerIds"
			| "choices"
			| "turnId"
			| "initiativeOrder"
		>,
        userId: string
    ) => Promise<Campaign>; // Kembalikan campaign untuk alur join
    getPublishedCampaigns: () => Promise<Campaign[]>;
    signOut: () => Promise<void>;
    addPlayerToCampaign: (
        campaignId: string,
        characterId: string
    ) => Promise<Campaign>; // FASE 1 FIX: Kembalikan campaign
	copyCharacterFromTemplate: (
		templateData: RawCharacterData,
		userId: string
	) => Promise<Character>;
}

type DataStore = {
	state: DataState;
	actions: DataActions;
};

// =================================================================
// STORE DEFINITION
// =================================================================
export const useDataStore = create<DataStore>((set, get) => ({
	// === STATE ===
	state: initialState,

	// === ACTIONS ===
	actions: {
		// --- Aksi Internal ---
		_setLoading: (status) =>
			set((state) => ({ state: { ...state.state, isLoading: status } })),
		_setError: (error) =>
			set((state) => ({ state: { ...state.state, error } })),
		_setCampaigns: (campaigns) =>
			set((state) => ({ state: { ...state.state, campaigns } })),
		_setCharacters: (characters) =>
			set((state) => ({ state: { ...state.state, characters } })),
		_addCampaign: (campaign) =>
			set((state) => ({
				state: {
					...state.state,
					campaigns: [...state.state.campaigns, campaign],
				},
			})),

        // --- Aksi util publik (harus berada di level actions, bukan di dalam set() di atas) ---
        getPublishedCampaigns: async () => {
            try {
                const { campaign } = getRepositories();
                const campaigns = await campaign.getPublishedCampaigns();
                return campaigns;
            } catch (e) {
                console.error("Gagal memuat kampanye terbit:", e);
                throw e;
            }
        },

        signOut: async () => {
            try {
                const { auth } = getRepositories();
                await auth.signOut();

                // Reset SSoT state to avoid stale data after re-login
                // This ensures App.tsx's fetchInitialData runs again for the next session
                set({ state: initialState });
            } catch (e) {
                console.error("Gagal keluar:", e);
                throw e;
            }
        },
		_updateCampaign: (campaign) =>
			set((state) => ({
				state: {
					...state.state,
					campaigns: state.state.campaigns.map((c) =>
						c.id === campaign.id ? campaign : c
					),
				},
			})),
		_addCharacter: (character) =>
			set((state) => ({
				state: {
					...state.state,
					characters: [...state.state.characters, character],
				},
			})),
		_updateCharacter: (character) =>
			set((state) => ({
				state: {
					...state.state,
					characters: state.state.characters.map((c) =>
						c.id === character.id ? character : c
					),
				},
			})),

		// --- Aksi Publik (Thunks) ---
		fetchInitialData: async (userId) => {
			if (get().state.hasLoaded || get().state.isLoading) return;

			get().actions._setLoading(true);
			get().actions._setError(null);

            try {
                const { globalData, auth, character, campaign } = getRepositories();

                // LANGKAH 1: Pastikan profil ada SEBELUM mengambil data lain.
                const profile = await auth.getOrCreateProfile();
                if (!profile) {
                    throw new Error("Gagal memverifikasi atau membuat profil pengguna.");
                }

                // LANGKAH 2: Lanjutkan alur normal
                await globalData.cacheGlobalData();
                let fetchedCharacters = await character.getMyCharacters(userId);
                get().actions._setCharacters(fetchedCharacters);

                const myCharacterIds = fetchedCharacters.map((c) => c.id);
                const fetchedCampaigns = await campaign.getMyCampaigns(
                    myCharacterIds
                );
                get().actions._setCampaigns(fetchedCampaigns);

				set((state) => ({ state: { ...state.state, hasLoaded: true } }));
			} catch (error: any) {
				console.error("Gagal memuat data:", error);
				get().actions._setError(error.message || "Gagal memuat data semesta.");
			} finally {
				get().actions._setLoading(false);
			}
		},

		saveCampaign: async (campaign) => {
            try {
                const { activeRollRequest, thinkingState, players, ...campaignToSave } =
                    campaign as CampaignState;

                const { campaign: campaignRepo } = getRepositories();
                const savedCampaign = await campaignRepo.saveCampaign(campaignToSave);

				// Update SSoT store
				get().actions._updateCampaign({
					...savedCampaign,
					eventLog: [],
					monsters: [],
					players: [],
					playerIds: campaignToSave.playerIds, // Pastikan playerIds tetap ada
					choices: [],
					turnId: null,
				});

                // Notifikasi sukses
                useAppStore.getState().actions.pushNotification({
                    type: "success",
                    message: "Kampanye berhasil disimpan.",
                });
            } catch (e) {
                console.error("Gagal menyimpan kampanye:", e);
                // FASE 4: Hapus alert()
                console.error(
                    "Gagal menyimpan progres kampanye. Periksa koneksi Anda."
                );
                // Notifikasi gagal
                useAppStore.getState().actions.pushNotification({
                    type: "error",
                    message: "Gagal menyimpan progres kampanye. Periksa koneksi Anda.",
                });
            }
        },

		updateCharacter: async (character) => {
            try {
                const { character: characterRepo } = getRepositories();
                const savedCharacter = await characterRepo.saveCharacter(character);
                get().actions._updateCharacter(savedCharacter);
                // Notifikasi sukses
                useAppStore.getState().actions.pushNotification({
                    type: "success",
                    message: "Karakter berhasil disimpan.",
                });
            } catch (e) {
                console.error("Gagal menyimpan karakter (SSoT):", e);
                // FASE 4: Hapus alert()
                console.error(
                    "Gagal menyimpan progres karakter. Periksa koneksi Anda."
                );
                // Notifikasi gagal
                useAppStore.getState().actions.pushNotification({
                    type: "error",
                    message: "Gagal menyimpan progres karakter. Periksa koneksi Anda.",
                });
            }
        },

		saveNewCharacter: async (charData, inventoryData, spellData, userId) => {
            try {
                const { character: characterRepo } = getRepositories();
                const newCharacter = await characterRepo.saveNewCharacter(
                    charData,
                    inventoryData,
                    spellData,
                    userId
                );
                get().actions._addCharacter(newCharacter);
                // Notifikasi sukses
                useAppStore.getState().actions.pushNotification({
                    type: "success",
                    message: "Karakter baru berhasil dibuat.",
                });
                return newCharacter; // FASE 1 FIX: Kembalikan karakter baru
            } catch (e) {
                console.error("Gagal menyimpan karakter baru:", e);
                // FASE 4: Hapus alert()
                // UI (ProfileWizard) sekarang menangani ini dengan statusMessage
                // Notifikasi gagal
                useAppStore.getState().actions.pushNotification({
                    type: "error",
                    message: "Gagal menyimpan karakter baru.",
                });
                throw e; // Lemparkan error agar UI (store G-3) tahu
            }
        },

		createCampaign: async (campaignData, userId) => {
            try {
                const { campaign: campaignRepo } = getRepositories();
                const newCampaign = await campaignRepo.createCampaign(
                    campaignData,
                    userId
                );
                const openingScene = await generationService.generateOpeningScene(
                    newCampaign
                );

				const openingEvent: Omit<GameEvent, "id" | "timestamp"> & {
					campaignId: string;
				} = {
					campaignId: newCampaign.id,
					type: "dm_narration",
					text: openingScene,
					turnId: "turn-0",
					characterId: null,
				};
                await campaignRepo.logGameEvent(openingEvent);

                get().actions._addCampaign(newCampaign);
                // Notifikasi sukses
                useAppStore.getState().actions.pushNotification({
                    type: "success",
                    message: "Kampanye berhasil dibuat.",
                });
                return newCampaign; // Kembalikan untuk alur join
            } catch (e) {
                console.error("Gagal membuat kampanye atau adegan pembuka:", e);
                // FASE 4: Hapus alert()
                console.error("Gagal membuat kampanye. Coba lagi.");
                // Notifikasi gagal
                useAppStore.getState().actions.pushNotification({
                    type: "error",
                    message: "Gagal membuat kampanye. Coba lagi.",
                });
                throw e;
            }
        },

		addPlayerToCampaign: async (campaignId, characterId) => {
            try {
                const { campaign: campaignRepo } = getRepositories();
                await campaignRepo.addPlayerToCampaign(campaignId, characterId);

				// Update SSoT campaign lokal untuk merefleksikan player baru
				const campaign = get().state.campaigns.find((c) => c.id === campaignId);
				if (campaign) {
					const updatedCampaign = {
						...campaign,
						playerIds: [...campaign.playerIds, characterId],
					};
					// Set player pertama sebagai giliran pertama jika belum ada
                    if (
                        updatedCampaign.playerIds.length === 1 &&
                        !updatedCampaign.currentPlayerId
                    ) {
                        updatedCampaign.currentPlayerId = characterId;
                        await campaignRepo.saveCampaign(updatedCampaign); // Simpan perubahan ini ke DB
                    }
                    get().actions._updateCampaign(updatedCampaign);
                    // Notifikasi sukses
                    useAppStore.getState().actions.pushNotification({
                        type: "success",
                        message: "Berhasil bergabung ke kampanye.",
                    });
                    return updatedCampaign; // FASE 1 FIX: Kembalikan campaign yang konsisten
                }
                // FASE 1 FIX: Fallback jika campaign tidak ditemukan di state
                throw new Error(
                    "Campaign tidak ditemukan di SSoT setelah menambahkan player."
                );
            } catch (e) {
                console.error("Gagal menambahkan player ke campaign:", e);
                // Notifikasi gagal
                useAppStore.getState().actions.pushNotification({
                    type: "error",
                    message: "Gagal bergabung ke kampanye.",
                });
                throw e;
            }
        },
	},

	// FASE 2 REFAKTOR: Fungsi ini (copyCharacterFromTemplate) dihapus
	// untuk menghilangkan duplikasi logika (DRY violation).
	// Seluruh logika pembuatan karakter (manual DAN template)
	// sekarang dikonsolidasikan di dalam `components/profile/ProfileWizard.tsx`
	// dan alur penyimpanannya (saveNewCharacter) di atas.
	// Alur UI "Pilih Template" (di CharacterSelectionView/ProfileWizard)
	// sekarang akan me-pre-fill state Wizard dan memanggil `saveNewCharacter`.
	copyCharacterFromTemplate: async (templateData, userId) => {
		// Logika ini mati dan tidak boleh dipanggil.
		console.error("[DEPRECATED] copyCharacterFromTemplate dipanggil. Alur ini rusak.");
		throw new Error("Fungsi copyCharacterFromTemplate telah dihapus dan tidak digunakan lagi.");
	},
}));