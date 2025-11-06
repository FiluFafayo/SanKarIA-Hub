// REFAKTOR G-4: File BARU.
// Store ini sekarang menjadi SSoT (Single Source of Truth) untuk data persisten
// (Campaigns dan Characters) dan logika untuk memuat/menyimpannya.
// Ini membongkar logic tersebut dari App.tsx (God Object).

import { create } from 'zustand';
import { 
    Campaign, Character, GameEvent, CampaignState, 
    CharacterInventoryItem, SpellDefinition, AbilityScores, ItemDefinition
} from '../types';
import { dataService } from '../services/dataService';
import { generationService } from '../services/ai/generationService';
// Impor baru untuk aksi template
import { 
    RawCharacterData, findClass, findRace, findBackground, 
    findSpell, getItemDef 
} from '../data/registry';
import { getAbilityModifier } from '../utils';
import { renderCharacterLayout } from '../services/pixelRenderer';
import { SPRITE_PARTS } from '../data/spriteParts';

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
copyCharacterFromTemplate: (templateData: RawCharacterData, userId: string) => Promise<Character>;
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
                const fetchedCampaigns = await dataService.getMyCampaigns(myCharacterIds);
                get().actions._setCampaigns(fetchedCampaigns);
                
                set(state => ({ state: { ...state.state, hasLoaded: true } }));
            } catch (error) {
                console.error("Gagal memuat data:", error);
                // FASE 4: Hapus alert()
                console.error("Gagal memuat data dari Supabase. Periksa koneksi internet Anda atau coba lagi nanti.");
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
                // FASE 4: Hapus alert()
                console.error("Gagal menyimpan progres kampanye. Periksa koneksi Anda.");
            }
        },

        updateCharacter: async (character) => {
            try {
                const savedCharacter = await dataService.saveCharacter(character);
                get().actions._updateCharacter(savedCharacter);
            } catch (e) {
                 console.error("Gagal menyimpan karakter (SSoT):", e);
                 // FASE 4: Hapus alert()
                 console.error("Gagal menyimpan progres karakter. Periksa koneksi Anda.");
            }
        },

        saveNewCharacter: async (charData, inventoryData, spellData, userId) => {
            try {
                const newCharacter = await dataService.saveNewCharacter(charData, inventoryData, spellData, userId);
                get().actions._addCharacter(newCharacter);
            } catch (e) {
                console.error("Gagal menyimpan karakter baru:", e);
                // FASE 4: Hapus alert()
                // UI (ProfileWizard) sekarang menangani ini dengan statusMessage
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
                // FASE 4: Hapus alert()
                console.error("Gagal membuat kampanye. Coba lagi.");
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
    },

    copyCharacterFromTemplate: async (templateData, userId) => {
        // Ini adalah gabungan dari handleSave di ProfileWizard dan logika AI
        const { 
            name, class: className, race: raceName, background: bgName,
            abilityScores, gender, bodyType, scars, hair, facialHair, headAccessory
        } = templateData;

        const selectedClass = findClass(className);
        const selectedRace = findRace(raceName);
        const selectedBackground = findBackground(bgName);

        if (!selectedClass || !selectedRace || !selectedBackground) {
            throw new Error("Definisi template (Class/Race/Background) tidak ditemukan.");
        }

        const baseScores = abilityScores as AbilityScores;
        const finalScores = { ...baseScores };

        // 1. Hitung Stats (sama seperti di ProfileWizard)
        const conModifier = getAbilityModifier(finalScores.constitution);
        const dexModifier = getAbilityModifier(finalScores.dexterity);
        const maxHp = selectedClass.hpAtLevel1(conModifier);

        // 2. Resolve Inventory (dari data mentah template)
        const inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[] = templateData.inventory.map(inv => ({
            ...inv,
            item: getItemDef(inv.item.name) // Resolve string ke full definition
        }));

        // 3. Hitung AC (sama seperti di ProfileWizard)
        let armorClass = 10 + dexModifier;
        let equippedArmorDef: ItemDefinition | null = null;
        const armorIndex = inventoryData.findIndex(i => i.item.type === 'armor' && i.item.armorType !== 'shield');
        const shieldIndex = inventoryData.findIndex(i => i.item.name === 'Shield');
        if (armorIndex > -1) { inventoryData[armorIndex].isEquipped = true; equippedArmorDef = inventoryData[armorIndex].item; }
        if (shieldIndex > -1) { inventoryData[shieldIndex].isEquipped = true; }
        if (equippedArmorDef) {
            const baseAc = equippedArmorDef.baseAc || 10;
            if (equippedArmorDef.armorType === 'light') armorClass = baseAc + dexModifier;
            else if (equippedArmorDef.armorType === 'medium') armorClass = baseAc + Math.min(2, dexModifier);
            else if (equippedArmorDef.armorType === 'heavy') armorClass = baseAc;
        }
        if (shieldIndex > -1) armorClass += 2;

        // 4. Resolve Spells (dari data mentah template)
        const spellData: SpellDefinition[] = templateData.knownSpells.map(s => findSpell(s.name)).filter(Boolean) as SpellDefinition[];

        // 5. Susun Data Karakter
        const newCharData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'> = {
            ...templateData, // Ambil semua data visual (gender, hair, dll)
            abilityScores: finalScores,
            maxHp: Math.max(1, maxHp),
            currentHp: Math.max(1, maxHp),
            armorClass: armorClass,
            speed: selectedRace.speed,
            hitDice: { [selectedClass.hitDice]: { max: 1, spent: 0 } },
            deathSaves: { successes: 0, failures: 0},
            conditions: [],
            racialTraits: selectedRace.traits,
            classFeatures: selectedClass.features,
            proficientSkills: templateData.proficientSkills, // Ambil dari template
            proficientSavingThrows: selectedClass.proficiencies.savingThrows,
            spellSlots: templateData.spellSlots,
        };

        // 6. Generate Gambar AI (PENTING)
        const layout = renderCharacterLayout(newCharData as Character);

        const VISUAL_STYLE_PROMPT = "digital painting, fantasy art, detailed, high quality, vibrant colors, style of D&D 5e sourcebooks, character portrait, full body";
        const getPartName = (arr: any[], id: string) => arr.find(p => p.id === id)?.name || '';
        const prompt = `Potret HD, ${newCharData.gender} ${newCharData.race} ${newCharData.class}, ${getPartName(SPRITE_PARTS.hair, newCharData.hair)}, ${getPartName(SPRITE_PARTS.facial_feature, newCharData.facialHair)}, ${newCharData.scars.map(id => getPartName(SPRITE_PARTS.facial_feature, id)).join(', ')}, ${VISUAL_STYLE_PROMPT}`;

        const imageUrl = await generationService.stylizePixelLayout(layout, prompt, 'Sprite');
        newCharData.image = imageUrl; // Ganti gambar placeholder

        // 7. Simpan ke DB
        const newCharacter = await dataService.saveNewCharacter(newCharData, inventoryData, spellData, userId);

        // 8. Update SSoT Store
        get().actions._addCharacter(newCharacter);

        // 9. Kembalikan karakter baru
        return newCharacter;
    }
}
}));