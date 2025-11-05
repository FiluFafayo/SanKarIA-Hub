// REFAKTOR G-4/G-3: Store ini sekarang mengelola SEMUA state UI global, 
// Navigasi, Form, DAN Sesi Game Runtime.

import { create } from 'zustand';
import { 
    Ability, Skill, AbilityScores, CharacterInventoryItem, SpellDefinition, 
    Character, MapMarker, Campaign, ItemDefinition, CampaignState
} from '../types';
// REFAKTOR G-5: Impor SSoT data statis dari registry
import { 
    getAllRaces,
    getAllClasses,
    getAllBackgrounds,
    getItemDef, // (helper getItemDef sekarang ada di registry)
    findRace, // (P0 FIX) Impor finder
    findClass, // (P0 FIX) Impor finder
    findBackground, // (P0 FIX) Impor finder
    RaceData, ClassData, BackgroundData, EquipmentChoice // (Ekspor tipe dari registry jika perlu, tapi kita impor dari types)
} from '../data/registry';
import { getAbilityModifier } from '../utils';
import { dataService } from '../services/dataService';
import { useDataStore } from './dataStore';
import { generationService } from '../services/ai/generationService'; // BARU
import { pixelRenderer } from '../services/pixelRenderer'; // BARU

// =================================================================
// Tipe Helper
// =================================================================
const createInvItem = (def: ItemDefinition, qty = 1, equipped = false): Omit<CharacterInventoryItem, 'instanceId'> => ({
    item: def,
    quantity: qty,
    isEquipped: equipped,
});

type View = Location | 'nexus' | 'character-selection';

// =================================================================
// Tipe State & Aksi
// =================================================================

// --- Slice 1: Navigation ---
interface NavigationState {
    currentView: View;
    campaignToJoinOrStart: Campaign | null; // Untuk alur join
}
const initialNavigationState: NavigationState = {
    currentView: 'nexus',
    campaignToJoinOrStart: null,
};
interface NavigationActions {
    navigateTo: (view: Location) => void;
    returnToNexus: () => void;
    startJoinFlow: (campaign: Campaign) => void;
}

// --- Slice 2: Game Runtime (G-4-R1) ---
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


// --- Slice 3: Character Creation ---
interface CharacterCreationState {
    step: number;
    statusMessage: string; // BARU: Untuk loading
    name: string;
    gender: 'Pria' | 'Wanita'; // BARU
    hair: string; // BARU
    facialHair: string; // BARU
    headAccessory: string; // BARU
    bodyType: string; // BARU
    scars: string[]; // BARU
    selectedRace: RaceData;
    selectedClass: ClassData;
    abilityScores: Partial<AbilityScores>;
    selectedBackground: BackgroundData;
    selectedSkills: Skill[];
    selectedEquipment: Record<number, EquipmentChoice['options'][0]>;
    isSaving: boolean;
}
const getDefaultEquipment = (charClass: ClassData): Record<number, EquipmentChoice['options'][0]> => {
    const initialEquipment: Record<number, EquipmentChoice['options'][0]> = {};
    charClass.startingEquipment.choices.forEach((choice, index) => {
        initialEquipment[index] = choice.options[0];
    });
    return initialEquipment;
};
const initialCharacterState: CharacterCreationState = {
    step: 0, // 0 = tidak aktif
    statusMessage: '',
    name: '',
    gender: 'Pria',
    hair: 'h_short_blond',
    facialHair: 'ff_none',
    headAccessory: 'ha_none',
    bodyType: 'bt_normal',
    scars: [],
    // (P0 FIX) Gunakan finder untuk memastikan referensi yang aman
    selectedRace: findRace('Human') || getAllRaces()[0],
    selectedClass: findClass('Fighter') || Object.values(getAllClasses())[0],
    abilityScores: {},
    selectedBackground: findBackground('Acolyte') || getAllBackgrounds()[0],
    selectedSkills: [],
    selectedEquipment: getDefaultEquipment(findClass('Fighter') || Object.values(getAllClasses())[0]),
    isSaving: false,
};
interface CharacterCreationActions {
    setCharacterStep: (step: number) => void;
    setStatusMessage: (message: string) => void; // BARU
    setName: (name: string) => void;
    setGender: (gender: 'Pria' | 'Wanita') => void; // BARU
    setHair: (partId: string) => void; // BARU
    setFacialHair: (partId: string) => void; // BARU
    setHeadAccessory: (partId: string) => void; // BARU
    setBodyType: (partId: string) => void; // BARU
    toggleScar: (partId: string) => void; // BARU
    setSelectedRace: (race: RaceData) => void;
    setSelectedClass: (charClass: ClassData) => void;
    setAbilityScore: (ability: Ability, score: number) => void;
    setAbilityScores: (scores: Partial<AbilityScores>) => void;
    setSelectedBackground: (background: BackgroundData) => void;
    toggleSkill: (skill: Skill) => void;
    setSelectedEquipment: (choiceIndex: number, option: EquipmentChoice['options'][0]) => void;
    resetCharacterCreation: () => void;
    finalizeCharacter: (userId: string) => Promise<void>;
}

// --- Slice 4: Campaign Creation ---
// (Tidak berubah dari G-3)
interface CampaignCreationPillars {
    premise: string;
    keyElements: string;
    endGoal: string;
}
interface CampaignFramework {
    proposedTitle: string;
    proposedMainQuest: { title: string, description: string };
    proposedMainNPCs: { name: string, description: string }[];
    potentialSideQuests: { title: string, description: string }[];
    description: string;
}
// (Poin 7) Slice state baru untuk UI Level Up
interface LevelUpState {
    characterToLevel: Character | null; // Karakter yang sedang naik level
}
const initialLevelUpState: LevelUpState = {
    characterToLevel: null,
};
interface LevelUpActions {
    triggerLevelUp: (character: Character) => void;
    closeLevelUp: () => void;
}


interface CampaignCreationState {
    step: number; // 0 = tidak aktif
    pillars: CampaignCreationPillars;
    framework: CampaignFramework | null;
    mapData: { imageUrl: string; markers: MapMarker[], startLocationId: string } | null;
    // campaignData dihapus (Poin 10)
}
const initialCampaignState: CampaignCreationState = {
    step: 0,
    pillars: { premise: '', keyElements: '', endGoal: '' },
    framework: null,
    mapData: null,
    // campaignData dihapus dan akan di-hardcode (Poin 10)
};
interface CampaignCreationActions {
    setCampaignStep: (step: number) => void;
    setPillars: (pillars: CampaignCreationPillars) => void;
    setFramework: (framework: CampaignFramework | null) => void;
    setMapData: (mapData: CampaignCreationState['mapData']) => void;
    // setCampaignData dihapus (Poin 10)
    resetCampaignCreation: () => void;
}

// --- Gabungan Store ---
type AppStore = {
    navigation: NavigationState;
    runtime: RuntimeState; // G-4-R1
    levelUp: LevelUpState; // (Poin 7)
    characterCreation: CharacterCreationState;
    campaignCreation: CampaignCreationState;
    actions: NavigationActions & RuntimeActions & LevelUpActions & CharacterCreationActions & CampaignCreationActions;
}

// =================================================================
// STORE DEFINITION
// =================================================================
export const useAppStore = create<AppStore>((set, get) => ({
    // === STATE ===
    navigation: initialNavigationState,
    runtime: initialRuntimeState,
    levelUp: initialLevelUpState, // (Poin 7)
    characterCreation: initialCharacterState,
    campaignCreation: initialCampaignState,

    // === ACTIONS ===
    actions: {
        // --- Navigation Actions ---
        navigateTo: (view) => {
            if (view !== Location.MirrorOfSouls) get().actions.resetCharacterCreation();
            if (view !== Location.StorytellersSpire) get().actions.resetCampaignCreation();
            if (view === Location.MirrorOfSouls) {
                set(state => ({ characterCreation: { ...state.characterCreation, step: 1 } }));
            }
            if (view === Location.StorytellersSpire) {
                set(state => ({ campaignCreation: { ...state.campaignCreation, step: 1 } }));
            }
            set(state => ({ navigation: { ...state.navigation, currentView: view } }));
        },
        returnToNexus: () => {
            get().actions.resetCharacterCreation();
            get().actions.resetCampaignCreation();
            set({ navigation: initialNavigationState });
        },
        startJoinFlow: (campaign) => set(state => ({
            navigation: { ...state.navigation, currentView: 'character-selection', campaignToJoinOrStart: campaign }
        })),

        // --- Runtime Actions (G-4-R1) ---
        loadGameSession: async (campaign, character) => {
            set(state => ({ runtime: { ...state.runtime, isGameLoading: true } }));
            try {
                const { eventLog, monsters, players } = await dataService.loadCampaignRuntimeData(campaign.id, campaign.playerIds);
                
                const campaignState: CampaignState = {
                    ...campaign, eventLog, monsters, players,
                    thinkingState: 'idle', activeRollRequest: null,
                    choices: [], turnId: null,
                };
                
                set({ 
                    runtime: { 
                        playingCampaign: campaignState, 
                        playingCharacter: character, 
                        isGameLoading: false 
                    }
                });
            } catch (e) {
                console.error("Gagal memuat data runtime campaign:", e);
                alert("Gagal memuat sesi permainan. Coba lagi.");
                set(state => ({ runtime: { ...state.runtime, isGameLoading: false } }));
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
                const finalCharacterState = playingCampaign?.players.find(p => p.id === playingCharacter.id);
                if (finalCharacterState) {
                    useDataStore.getState().actions.updateCharacter(finalCharacterState);
                }
            }
            
            // Reset state runtime
            set({ runtime: initialRuntimeState, navigation: initialNavigationState });
        },
        _setRuntimeCampaignState: (campaignState) => {
            set(state => ({ runtime: { ...state.runtime, playingCampaign: campaignState } }));
        },
        _setRuntimeCharacterState: (character) => {
            set(state => ({ runtime: { ...state.runtime, playingCharacter: character } }));
        },

        // --- Level Up Actions (Poin 7) ---
        triggerLevelUp: (character) => {
            // Cek untuk mencegah modal muncul berulang kali jika state belum di-save
            if (get().levelUp.characterToLevel) return;
            console.log(`[LevelUp] Memicu modal Level Up untuk ${character.name}`);
            set(state => ({ levelUp: { characterToLevel: character } }));
        },
        closeLevelUp: () => {
            set({ levelUp: initialLevelUpState });
        },

        // --- Character Actions ---
        setCharacterStep: (step) => set(state => ({ characterCreation: { ...state.characterCreation, step } })),
        setStatusMessage: (message) => set(state => ({ characterCreation: { ...state.characterCreation, statusMessage: message } })), // BARU
        setName: (name) => set(state => ({ characterCreation: { ...state.characterCreation, name } })),
        setGender: (gender) => set(state => ({ characterCreation: { ...state.characterCreation, gender } })), // BARU
        setHair: (partId) => set(state => ({ characterCreation: { ...state.characterCreation, hair: partId } })), // BARU
        setFacialHair: (partId) => set(state => ({ characterCreation: { ...state.characterCreation, facialHair: partId } })), // BARU
        setHeadAccessory: (partId) => set(state => ({ characterCreation: { ...state.characterCreation, headAccessory: partId } })), // BARU
        setBodyType: (partId) => set(state => ({ characterCreation: { ...state.characterCreation, bodyType: partId } })), // BARU
        toggleScar: (partId) => set(state => { // BARU
            const currentScars = state.characterCreation.scars;
            const newScars = currentScars.includes(partId)
                ? currentScars.filter(s => s !== partId)
                : [...currentScars, partId];
            return { characterCreation: { ...state.characterCreation, scars: newScars }};
        }),
        setSelectedRace: (selectedRace) => set(state => ({ characterCreation: { ...state.characterCreation, selectedRace } })),
        setSelectedClass: (selectedClass) => set(state => ({ 
            characterCreation: { 
                ...state.characterCreation, 
                selectedClass,
                selectedSkills: [],
                selectedEquipment: getDefaultEquipment(selectedClass),
            } 
        })),
        setAbilityScore: (ability, score) => set(state => ({
            characterCreation: { 
                ...state.characterCreation, 
                abilityScores: { ...state.characterCreation.abilityScores, [ability]: score }
            }
        })),
        setAbilityScores: (scores) => set(state => ({
            characterCreation: { ...state.characterCreation, abilityScores: scores }
        })),
        setSelectedBackground: (selectedBackground) => set(state => ({ characterCreation: { ...state.characterCreation, selectedBackground } })),
        toggleSkill: (skill) => set(state => {
            const currentSkills = state.characterCreation.selectedSkills;
            const limit = state.characterCreation.selectedClass.proficiencies.skills.choices;
            const newSkills = currentSkills.includes(skill)
                ? currentSkills.filter(s => s !== skill)
                : (currentSkills.length < limit ? [...currentSkills, skill] : currentSkills);
            
            if (newSkills.length > limit) {
                alert(`Anda hanya bisa memilih ${limit} skill.`);
                return state;
            }
            return { characterCreation: { ...state.characterCreation, selectedSkills: newSkills }};
        }),
        setSelectedEquipment: (choiceIndex, option) => set(state => ({
            characterCreation: {
                ...state.characterCreation,
                selectedEquipment: { ...state.characterCreation.selectedEquipment, [choiceIndex]: option }
            }
        })),
        resetCharacterCreation: () => set({ characterCreation: { ...initialCharacterState, step: 0 } }),
        
        finalizeCharacter: async (userId: string, onSaveNewCharacter: (
            charData: Omit<Character, "id" | "ownerId" | "inventory" | "knownSpells">,
            inventoryData: Omit<CharacterInventoryItem, "instanceId">[],
            spellData: SpellDefinition[],
            userId: string
        ) => Promise<void>) => { // (P0 FIX) Terima callback onSaveNewCharacter dari ProfileModal
            const { characterCreation } = get();
            const { 
                name, selectedRace, selectedClass, abilityScores, selectedBackground, 
                selectedSkills, selectedEquipment,
                // Ambil data visual BARU
                gender, hair, facialHair, headAccessory, bodyType, scars
            } = characterCreation;

            if (Object.keys(abilityScores).length !== 6) {
                alert("Selesaikan pelemparan semua dadu kemampuan.");
                return;
            }
            // --- Alur AI BARU ---
            set(state => ({ characterCreation: { ...state.characterCreation, isSaving: true, statusMessage: "Merakit jiwa..." } }));

            try {
                const baseScores = abilityScores as AbilityScores;
                const finalScores = { ...baseScores };
                for (const [ability, bonus] of Object.entries(selectedRace.abilityScoreBonuses)) {
                    if (typeof bonus === 'number') finalScores[ability as Ability] += bonus;
                }
                const profSkills = new Set<Skill>([
                    ...selectedBackground.skillProficiencies,
                    ...(selectedRace.proficiencies?.skills || []),
                    ...selectedSkills,
                ]);
                const conModifier = getAbilityModifier(finalScores.constitution);
                const dexModifier = getAbilityModifier(finalScores.dexterity);
                const maxHp = selectedClass.hpAtLevel1(conModifier);
                let inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[] = [];
                selectedClass.startingEquipment.fixed.forEach(item => inventoryData.push(createInvItem(item.item, item.quantity)));
                Object.values(selectedEquipment).forEach(chosenOption => {
                    chosenOption.items.forEach(itemDef => inventoryData.push(createInvItem(itemDef, chosenOption.quantity || 1)));
                });
                selectedBackground.equipment.forEach(itemName => {
                     try { inventoryData.push(createInvItem(getItemDef(itemName))); } catch (e) { console.warn(e); }
                });
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
                const spellSlots = selectedClass.spellcasting?.spellSlots || [];
                const spellData: SpellDefinition[] = [
                    ...(selectedClass.spellcasting?.knownCantrips || []),
                    ...(selectedClass.spellcasting?.knownSpells || []),
                ];
                const newCharData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'> = {
                    name, class: selectedClass.name, race: selectedRace.name, level: 1, xp: 0,
                    image: selectedRace.img, // INI AKAN DI-OVERWRITE
                    background: selectedBackground.name,
                    // Tambahkan data visual BARU
                    gender: gender,
                    bodyType: bodyType,
                    scars: scars,
                    hair: hair,
                    facialHair: facialHair,
                    headAccessory: headAccessory,
                    // Sisa data
                    personalityTrait: '', ideal: '', bond: '', flaw: '',
                    abilityScores: finalScores, maxHp: Math.max(1, maxHp), currentHp: Math.max(1, maxHp),
                    tempHp: 0, armorClass: armorClass, speed: selectedRace.speed,
                    hitDice: { [selectedClass.hitDice]: { max: 1, spent: 0 } },
                    deathSaves: { successes: 0, failures: 0}, conditions: [],
                    racialTraits: selectedRace.traits, classFeatures: selectedClass.features,
                    proficientSkills: Array.from(profSkills),
                    proficientSavingThrows: selectedClass.proficiencies.savingThrows,
                    spellSlots: spellSlots,
                };
                
                // (P0 FIX) Panggil callback yang dilewatkan, jangan panggil dataStore langsung
                // --- PANGGILAN AI BARU ---
                // 1. Render layout pixel
                const layout = pixelRenderer.renderCharacterLayout(newCharData as Character);
                
                // 2. Buat prompt
                set(state => ({ characterCreation: { ...state.characterCreation, statusMessage: "Menghubungi AI..." } }));
                const VISUAL_STYLE_PROMPT = "digital painting, fantasy art, detailed, high quality, vibrant colors, style of D&D 5e sourcebooks, character portrait, full body";
                const prompt = `Potret HD, ${newCharData.gender} ${newCharData.race} ${newCharData.class}, ${getPartName(SPRITE_PARTS.hair, newCharData.hair)}, ${getPartName(SPRITE_PARTS.facial_feature, newCharData.facialHair)}, ${newCharData.scars.map(id => getPartName(SPRITE_PARTS.facial_feature, id)).join(', ')}, ${VISUAL_STYLE_PROMPT}`;

                // 3. Panggil AI
                const imageUrl = await generationService.stylizePixelLayout(layout, prompt, 'Sprite');
                
                // 4. Update gambar di data karakter
                newCharData.image = imageUrl;
                // --- AKHIR PANGGILAN AI ---

                await onSaveNewCharacter(newCharData, inventoryData, spellData, userId);
                
                get().actions.resetCharacterCreation();
                get().actions.returnToNexus();

            } catch (e) {
                console.error("Gagal finalisasi karakter:", e);
                alert("Gagal menyimpan karakter baru. Coba lagi.");
            } finally {
                set(state => ({ characterCreation: { ...state.characterCreation, isSaving: false } }));
            }
        },

        // Helper untuk mengambil nama part
const getPartName = (arr: SpritePart[], id: string) => arr.find(p => p.id === id)?.name || '';

// --- Campaign Actions ---
        setCampaignStep: (step) => set(state => ({ campaignCreation: { ...state.campaignCreation, step } })),
        setPillars: (pillars) => set(state => ({ campaignCreation: { ...state.campaignCreation, pillars } })),
        setFramework: (framework) => set(state => ({ campaignCreation: { ...state.campaignCreation, framework } })),
        setMapData: (mapData) => set(state => ({ campaignCreation: { ...state.campaignCreation, mapData } })),
        // setCampaignData dihapus (Poin 10)
        resetCampaignCreation: () => set({ campaignCreation: { ...initialCampaignState, step: 0 } }),
    }
}));