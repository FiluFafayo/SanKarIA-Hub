// REFAKTOR G-4: File BARU.
// Store ini sekarang menjadi SSoT (Single Source of Truth) untuk data persisten
// (Campaigns dan Characters) dan logika untuk memuat/menyimpannya.
// Ini membongkar logic tersebut dari App.tsx (God Object).

import { create } from 'zustand';
import { 
    Campaign, Character, GameEvent, CampaignState, 
    CharacterInventoryItem, SpellDefinition 
} from '../types';
import { dataService } from '../services/dataService';
import { generationService } from '../services/ai/generationService';
// TAMBAHAN: Impor data default
import { DEFAULT_CAMPAIGNS } from '../data/defaultCampaigns';
import { generateDefaultCharacters } from '../data/defaultCharacters';

// =================================================================
// Tipe State & Aksi
// =================================================================

interface DataState {
    campaigns: Campaign[];
    characters: Character[];
    isLoading: boolean;
    hasLoaded: boolean;
}

const initialState: DataState = {
    campaigns: [],
    characters: [],
    isLoading: false,
    hasLoaded: false,
};

interface DataActions {
    // Aksi internal untuk memodifikasi state
    _setLoading: (status: boolean) => void;
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
        charData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'>,
        inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[],
        spellData: SpellDefinition[],
        userId: string
    ) => Promise<void>;
    createCampaign: (
        campaignData: Omit<Campaign, 'id' | 'ownerId' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId' | 'initiativeOrder'>, 
        userId: string
    ) => Promise<Campaign>; // Kembalikan campaign untuk alur join
    addPlayerToCampaign: (campaignId: string, characterId: string) => Promise<void>;
}

type DataStore = {
    state: DataState;
    actions: DataActions;
}

// =================================================================
// STORE DEFINITION
// =================================================================
export const useDataStore = create<DataStore>((set, get) => ({
    // === STATE ===
    state: initialState,

    // === ACTIONS ===
    actions: {
        // --- Aksi Internal ---
        _setLoading: (status) => set(state => ({ state: { ...state.state, isLoading: status } })),
        _setCampaigns: (campaigns) => set(state => ({ state: { ...state.state, campaigns } })),
        _setCharacters: (characters) => set(state => ({ state: { ...state.state, characters } })),
        _addCampaign: (campaign) => set(state => ({ 
            state: { ...state.state, campaigns: [...state.state.campaigns, campaign] } 
        })),
        _updateCampaign: (campaign) => set(state => ({
            state: {
                ...state.state,
                campaigns: state.state.campaigns.map(c => c.id === campaign.id ? campaign : c)
            }
        })),
        _addCharacter: (character) => set(state => ({
            state: { ...state.state, characters: [...state.state.characters, character] }
        })),
        _updateCharacter: (character) => set(state => ({
            state: {
                ...state.state,
                characters: state.state.characters.map(c => c.id === character.id ? character : c)
            }
        })),

        // --- Aksi Publik (Thunks) ---
        fetchInitialData: async (userId) => {
            if (get().state.hasLoaded || get().state.isLoading) return; // Mencegah load ganda
            
            get().actions._setLoading(true);
            
            try {
                await dataService.cacheGlobalData();
                let fetchedCharacters = await dataService.getMyCharacters(userId); // Ganti jadi 'let'
                get().actions._setCharacters(fetchedCharacters);

                const myCharacterIds = fetchedCharacters.map(c => c.id);
                let fetchedCampaigns = await dataService.getMyCampaigns(myCharacterIds); // Jadikan 'let'
                
                // --- LOGIKA SEEDING OTOMATIS JIKA KOSONG ---
                
                // 1. Seed Default Campaigns jika kosong
                if (fetchedCampaigns.length === 0) {
                    console.log("[DataStore] Tidak ada campaign. Menjalankan seeding default campaigns...");
                    const newCampaigns: Campaign[] = [];
                    for (const campaignData of DEFAULT_CAMPAIGNS) {
                        try {
                            // Gunakan createCampaign yang sudah ada (termasuk generate opening scene)
                            const newCampaign = await get().actions.createCampaign(campaignData, userId);
                            newCampaigns.push(newCampaign);
                        } catch (e) {
                            console.error("Gagal seed campaign:", campaignData.title, e);
                        }
                    }
                    fetchedCampaigns = newCampaigns; // Tampilkan campaign yang baru dibuat
                }

                // 2. Seed Default Characters jika kosong
                if (fetchedCharacters.length === 0) {
                    console.log("[DataStore] Tidak ada karakter. Menjalankan seeding default characters...");
                    const rawCharsData = generateDefaultCharacters(userId); // Ini mengembalikan Omit<Character, 'id'>[]
                    
                    for (const rawChar of rawCharsData) {
                        try {
                            // Ambil Omit<Character>
                            const { inventory, knownSpells, ...charData } = rawChar;
                            
                            // Konversi Omit<CharacterInventoryItem>
                            const inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[] = inventory.map(inv => ({
                                item: inv.item, // Definisinya sudah lengkap dari defaultCharacters.ts
                                quantity: inv.quantity,
                                isEquipped: inv.isEquipped,
                            }));
                            
                            const spellData: SpellDefinition[] = knownSpells; // Definisinya sudah lengkap
                            
                            // Panggil saveNewCharacter
                            await get().actions.saveNewCharacter(
                                charData, 
                                inventoryData, 
                                spellData, 
                                userId
                            );
                        } catch (e) {
                            console.error("Gagal seed character:", rawChar.name, e);
                        }
                    }
                    // Ambil ulang karakter setelah seeding
                    fetchedCharacters = await dataService.getMyCharacters(userId);
                }
                // --- AKHIR LOGIKA SEEDING ---

                get().actions._setCharacters(fetchedCharacters); // Set karakter (terbaru)
                get().actions._setCampaigns(fetchedCampaigns); // Set campaign (terbaru)
                
                set(state => ({ state: { ...state.state, hasLoaded: true } }));
            } catch (error) {
                console.error("Gagal memuat data:", error);
                alert("Gagal memuat data dari Supabase. Periksa koneksi internet Anda atau coba lagi nanti.");
            } finally {
                get().actions._setLoading(false);
            }
        },

        saveCampaign: async (campaign) => {
            try {
                const {
                    activeRollRequest, thinkingState, players,
                    ...campaignToSave
                } = campaign as CampaignState;

                const savedCampaign = await dataService.saveCampaign(campaignToSave);
                
                // Update SSoT store
                get().actions._updateCampaign({
                    ...savedCampaign, 
                    eventLog: [], monsters: [], players: [], 
                    playerIds: campaignToSave.playerIds, // Pastikan playerIds tetap ada
                    choices: [], turnId: null 
                });
            } catch (e) {
                console.error("Gagal menyimpan kampanye:", e);
                alert("Gagal menyimpan progres kampanye. Periksa koneksi Anda.");
            }
        },

        updateCharacter: async (character) => {
            try {
                const savedCharacter = await dataService.saveCharacter(character);
                get().actions._updateCharacter(savedCharacter);
            } catch (e) {
                 console.error("Gagal menyimpan karakter (SSoT):", e);
                 alert("Gagal menyimpan progres karakter. Periksa koneksi Anda.");
            }
        },

        saveNewCharacter: async (charData, inventoryData, spellData, userId) => {
            try {
                const newCharacter = await dataService.saveNewCharacter(charData, inventoryData, spellData, userId);
                get().actions._addCharacter(newCharacter);
            } catch (e) {
                console.error("Gagal menyimpan karakter baru:", e);
                alert("Gagal menyimpan karakter baru. Coba lagi.");
                throw e; // Lemparkan error agar UI (store G-3) tahu
            }
        },

        createCampaign: async (campaignData, userId) => {
            try {
                const newCampaign = await dataService.createCampaign(campaignData, userId);
                const openingScene = await generationService.generateOpeningScene(newCampaign);
                
                const openingEvent: Omit<GameEvent, 'id' | 'timestamp'> & { campaignId: string } = {
                   campaignId: newCampaign.id,
                   type: 'dm_narration',
                   text: openingScene,
                   turnId: 'turn-0',
                   characterId: null
                };
                await dataService.logGameEvent(openingEvent);

                get().actions._addCampaign(newCampaign);
                return newCampaign; // Kembalikan untuk alur join
            } catch (e) {
                console.error("Gagal membuat kampanye atau adegan pembuka:", e);
                alert("Gagal membuat kampanye. Coba lagi.");
                throw e;
            }
        },

        addPlayerToCampaign: async (campaignId, characterId) => {
            try {
                await dataService.addPlayerToCampaign(campaignId, characterId);
                
                // Update SSoT campaign lokal untuk merefleksikan player baru
                const campaign = get().state.campaigns.find(c => c.id === campaignId);
                if (campaign) {
                    const updatedCampaign = {
                        ...campaign,
                        playerIds: [...campaign.playerIds, characterId]
                    };
                    // Set player pertama sebagai giliran pertama jika belum ada
                    if (updatedCampaign.playerIds.length === 1 && !updatedCampaign.currentPlayerId) {
                        updatedCampaign.currentPlayerId = characterId;
                        await dataService.saveCampaign(updatedCampaign); // Simpan perubahan ini ke DB
                    }
                    get().actions._updateCampaign(updatedCampaign);
                }
            } catch (e) {
                console.error("Gagal menambahkan player ke campaign:", e);
                throw e;
            }
        }
    }
}));