// REFAKTOR G-4: Menggantikan creationStore.ts
// Store ini sekarang mengelola SEMUA state UI global, termasuk Navigasi dan Form.

import { create } from 'zustand';
import { 
    Ability, Skill, AbilityScores, CharacterInventoryItem, SpellDefinition, 
    Character, MapMarker, Campaign, ItemDefinition
} from '../types';
// REFAKTOR G-5: Impor SSoT data statis dari registry
import { 
    getAllRaces, findRace, // (findRace tidak dipakai di sini, tapi konsisten)
    getAllClasses, findClass,
    getAllBackgrounds, findBackground,
    getItemDef, // (helper getItemDef sekarang ada di registry)
    RaceData, ClassData, BackgroundData, EquipmentChoice // (Ekspor tipe dari registry jika perlu, tapi kita impor dari types)
} from '../data/registry';
import { getAbilityModifier } from '../utils';
// import { dataService } from '../services/dataService'; // (Dihapus)
import { useDataStore } from './dataStore'; // Import dataStore

// =================================================================
// Tipe Helper
// =================================================================
// (Helper getItemDef dan createInvItem sekarang menggunakan registry)

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

// --- Slice 2: Character Creation ---
interface CharacterCreationState {
    step: number;
    name: string;
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
// REFAKTOR G-5: Ambil default dari registry
const initialCharacterState: CharacterCreationState = {
    step: 0, // 0 = tidak aktif
    name: '',
    selectedRace: getAllRaces()[0],
    selectedClass: getAllClasses()['Fighter'],
    abilityScores: {},
    selectedBackground: getAllBackgrounds()[0],
    selectedSkills: [],
    selectedEquipment: getDefaultEquipment(getAllClasses()['Fighter']),
    isSaving: false,
};
interface CharacterCreationActions {
    setCharacterStep: (step: number) => void;
    setName: (name: string) => void;
    setSelectedRace: (race: RaceData) => void;
    setSelectedClass: (charClass: ClassData) => void;
    setAbilityScore: (ability: Ability, score: number) => void;
    setAbilityScores: (scores: Partial<AbilityScores>) => void;
    setSelectedBackground: (background: BackgroundData) => void;
    toggleSkill: (skill: Skill) => void;
    setSelectedEquipment: (choiceIndex: number, option: EquipmentChoice['options'][0]) => void;
    resetCharacterCreation: () => void;
    finalizeCharacter: (userId: string) => Promise<void>; // (Logika dipindah)
}

// --- Slice 3: Campaign Creation ---
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
interface CampaignCreationState {
    step: number; // 0 = tidak aktif
    pillars: CampaignCreationPillars;
    framework: CampaignFramework | null;
    mapData: { imageUrl: string; markers: MapMarker[], startLocationId: string } | null;
    campaignData: {
        dmPersonality: string;
        responseLength: Campaign['responseLength'];
        dmNarrationStyle: Campaign['dmNarrationStyle'];
    };
}
const initialCampaignState: CampaignCreationState = {
    step: 0,
    pillars: { premise: '', keyElements: '', endGoal: '' },
    framework: null,
    mapData: null,
    campaignData: {
        dmPersonality: 'Penyair Epik',
        responseLength: 'Standar',
        dmNarrationStyle: 'Deskriptif',
    },
};
interface CampaignCreationActions {
    setCampaignStep: (step: number) => void;
    setPillars: (pillars: CampaignCreationPillars) => void;
    setFramework: (framework: CampaignFramework | null) => void;
    setMapData: (mapData: CampaignCreationState['mapData']) => void;
    setCampaignData: (data: CampaignCreationState['campaignData']) => void;
    resetCampaignCreation: () => void;
}

// --- Gabungan Store ---
type AppStore = {
    navigation: NavigationState;
    characterCreation: CharacterCreationState;
    campaignCreation: CampaignCreationState;
    actions: NavigationActions & CharacterCreationActions & CampaignCreationActions;
}

// =================================================================
// STORE DEFINITION
// =================================================================
export const useAppStore = create<AppStore>((set, get) => ({
    // === STATE ===
    navigation: initialNavigationState,
    characterCreation: initialCharacterState,
    campaignCreation: initialCampaignState,

    // === ACTIONS ===
    actions: {
        // --- Navigation Actions ---
        navigateTo: (view) => {
            // Saat menavigasi, reset state form jika kita TIDAK ke view itu
            if (view !== Location.MirrorOfSouls) {
                get().actions.resetCharacterCreation();
            }
            if (view !== Location.StorytellersSpire) {
                get().actions.resetCampaignCreation();
            }
            // Mulai step 1 jika kita navigasi ke view tersebut
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

        // --- Character Actions ---
        setCharacterStep: (step) => set(state => ({ characterCreation: { ...state.characterCreation, step } })),
        setName: (name) => set(state => ({ characterCreation: { ...state.characterCreation, name } })),
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
        resetCharacterCreation: () => set({ characterCreation: { ...initialCharacterState, step: 0 } }), // Set step ke 0
        
        finalizeCharacter: async (userId) => {
            const { characterCreation } = get();
            const { name, selectedRace, selectedClass, abilityScores, selectedBackground, selectedSkills, selectedEquipment } = characterCreation;

            if (Object.keys(abilityScores).length !== 6) {
                alert("Selesaikan pelemparan semua dadu kemampuan.");
                return;
            }
            set(state => ({ characterCreation: { ...state.characterCreation, isSaving: true } }));

            try {
                // (Logika G-3 dari ProfileModal dipindah ke sini)
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
                    image: selectedRace.img, background: selectedBackground.name,
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

                // Panggil aksi SSoT dari dataStore (G-4)
                await useDataStore.getState().actions.saveNewCharacter(newCharData, inventoryData, spellData, userId);
                
                // Reset state G-3 setelah sukses
                get().actions.resetCharacterCreation();
                // Pindah kembali ke Nexus (G-4)
                get().actions.returnToNexus();

            } catch (e) {
                console.error("Gagal finalisasi karakter:", e);
                alert("Gagal menyimpan karakter baru. Coba lagi.");
            } finally {
                set(state => ({ characterCreation: { ...state.characterCreation, isSaving: false } }));
            }
        },

        // --- Campaign Actions ---
        setCampaignStep: (step) => set(state => ({ campaignCreation: { ...state.campaignCreation, step } })),
        setPillars: (pillars) => set(state => ({ campaignCreation: { ...state.campaignCreation, pillars } })),
        setFramework: (framework) => set(state => ({ campaignCreation: { ...state.campaignCreation, framework } })),
        setMapData: (mapData) => set(state => ({ campaignCreation: { ...state.campaignCreation, mapData } })),
        setCampaignData: (data) => set(state => ({ campaignCreation: { ...state.campaignCreation, campaignData: data } })),
        resetCampaignCreation: () => set({ campaignCreation: { ...initialCampaignState, step: 0 } }),
    }
}));