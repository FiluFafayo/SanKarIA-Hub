// REFAKTOR G-3: File BARU.
// Menggunakan Zustand untuk state management global yang persisten
// untuk form multi-step (Character & Campaign creation).
// Ini MEMPERBAIKI P0 UX Bug (G-3) di mana state form hilang saat ganti tab.

import { create } from 'zustand';
import { 
    Ability, Skill, AbilityScores, CharacterInventoryItem, SpellDefinition, 
    Character, MapMarker, Campaign, CharacterSpellSlot, ItemDefinition
} from '../types';

// Impor data SSoT untuk default state
import { RACES, RaceData } from '../data/races';
import { CLASS_DEFINITIONS, ClassData, EquipmentChoice } from '../data/classes';
import { BACKGROUNDS, BackgroundData } from '../data/backgrounds';
import { getAbilityModifier } from '../utils';
import { dataService } from '../services/dataService'; // (Diperlukan untuk getItemDef)

// =================================================================
// Helper (Dipindah dari ProfileModal)
// =================================================================
const getItemDef = (name: string): ItemDefinition => {
    const definition = dataService.findItemDefinition(name);
    if (!definition) {
        console.error(`ItemDefinition not found in cache: ${name}`);
        return { id: name, name, type: 'other', isMagical: false, rarity: 'common', requiresAttunement: false };
    }
    return definition;
};
const createInvItem = (def: ItemDefinition, qty = 1, equipped = false): Omit<CharacterInventoryItem, 'instanceId'> => ({
    item: def,
    quantity: qty,
    isEquipped: equipped,
});

// =================================================================
// Tipe State & Aksi
// =================================================================

// --- Slice 1: Character Creation ---
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
        initialEquipment[index] = choice.options[0]; // Default ke pilihan pertama
    });
    return initialEquipment;
};

const initialCharacterState: CharacterCreationState = {
    step: 1,
    name: '',
    selectedRace: RACES[0],
    selectedClass: CLASS_DEFINITIONS['Fighter'],
    abilityScores: {},
    selectedBackground: BACKGROUNDS[0],
    selectedSkills: [],
    selectedEquipment: getDefaultEquipment(CLASS_DEFINITIONS['Fighter']),
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
    // Logika bisnis kompleks dipindah ke store
    finalizeCharacter: (
        userId: string,
        // Callback untuk memberi tahu App.tsx bahwa SSoT DB telah diperbarui
        onSaveSuccess: (
            charData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'>,
            inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[],
            spellData: SpellDefinition[]
        ) => Promise<void>
    ) => Promise<void>;
}

// --- Slice 2: Campaign Creation ---
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
    step: number;
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
    step: 1,
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
type CreationStore = {
    characterCreation: CharacterCreationState;
    campaignCreation: CampaignCreationState;
    actions: CharacterCreationActions & CampaignCreationActions;
}

// =================================================================
// STORE DEFINITION
// =================================================================
export const useCreationStore = create<CreationStore>((set, get) => ({
    // === STATE ===
    characterCreation: initialCharacterState,
    campaignCreation: initialCampaignState,

    // === ACTIONS ===
    actions: {
        // --- Character Actions ---
        setCharacterStep: (step) => set(state => ({ characterCreation: { ...state.characterCreation, step } })),
        setName: (name) => set(state => ({ characterCreation: { ...state.characterCreation, name } })),
        setSelectedRace: (selectedRace) => set(state => ({ characterCreation: { ...state.characterCreation, selectedRace } })),
        setSelectedClass: (selectedClass) => set(state => ({ 
            characterCreation: { 
                ...state.characterCreation, 
                selectedClass,
                selectedSkills: [], // Reset skill pilihan
                selectedEquipment: getDefaultEquipment(selectedClass), // Reset equipment pilihan
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
        resetCharacterCreation: () => set({ characterCreation: initialCharacterState }),
        
        finalizeCharacter: async (userId, onSaveSuccess) => {
            const { characterCreation } = get();
            const { name, selectedRace, selectedClass, abilityScores, selectedBackground, selectedSkills, selectedEquipment } = characterCreation;

            if (Object.keys(abilityScores).length !== 6) {
                alert("Selesaikan pelemparan semua dadu kemampuan.");
                return;
            }
            set(state => ({ characterCreation: { ...state.characterCreation, isSaving: true } }));

            try {
                const baseScores = abilityScores as AbilityScores;
                const finalScores = { ...baseScores };

                // 1. Terapkan Bonus Ras
                for (const [ability, bonus] of Object.entries(selectedRace.abilityScoreBonuses)) {
                    if (typeof bonus === 'number') {
                        finalScores[ability as Ability] += bonus;
                    }
                }
                
                // 2. Kumpulkan Proficiency
                const profSkills = new Set<Skill>([
                    ...selectedBackground.skillProficiencies,
                    ...(selectedRace.proficiencies?.skills || []),
                    ...selectedSkills,
                ]);
                
                // 3. Hitung Mekanika Inti
                const conModifier = getAbilityModifier(finalScores.constitution);
                const dexModifier = getAbilityModifier(finalScores.dexterity);
                const maxHp = selectedClass.hpAtLevel1(conModifier);
                
                // 4. Kumpulkan Equipment
                let inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[] = [];
                selectedClass.startingEquipment.fixed.forEach(item => {
                    inventoryData.push(createInvItem(item.item, item.quantity));
                });
                Object.values(selectedEquipment).forEach(chosenOption => {
                    chosenOption.items.forEach(itemDef => {
                        inventoryData.push(createInvItem(itemDef, chosenOption.quantity || 1));
                    });
                });
                selectedBackground.equipment.forEach(itemName => {
                     try {
                        inventoryData.push(createInvItem(getItemDef(itemName)));
                     } catch (e) { console.warn(e); }
                });
                
                // 5. Hitung AC
                let armorClass = 10 + dexModifier;
                let equippedArmorDef: ItemDefinition | null = null;
                const armorIndex = inventoryData.findIndex(i => i.item.type === 'armor' && i.item.armorType !== 'shield');
                const shieldIndex = inventoryData.findIndex(i => i.item.name === 'Shield');
                
                if (armorIndex > -1) {
                    inventoryData[armorIndex].isEquipped = true;
                    equippedArmorDef = inventoryData[armorIndex].item;
                }
                if (shieldIndex > -1) {
                    inventoryData[shieldIndex].isEquipped = true;
                }
                if (equippedArmorDef) {
                    const baseAc = equippedArmorDef.baseAc || 10;
                    if (equippedArmorDef.armorType === 'light') armorClass = baseAc + dexModifier;
                    else if (equippedArmorDef.armorType === 'medium') armorClass = baseAc + Math.min(2, dexModifier);
                    else if (equippedArmorDef.armorType === 'heavy') armorClass = baseAc;
                }
                if (shieldIndex > -1) armorClass += 2;

                // 6. Kumpulkan Spell
                const spellSlots = selectedClass.spellcasting?.spellSlots || [];
                const spellData: SpellDefinition[] = [
                    ...(selectedClass.spellcasting?.knownCantrips || []),
                    ...(selectedClass.spellcasting?.knownSpells || []),
                ];

                // 7. Buat Objek Karakter SSoT
                const newCharData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'> = {
                    name,
                    class: selectedClass.name,
                    race: selectedRace.name,
                    level: 1,
                    xp: 0,
                    image: selectedRace.img,
                    background: selectedBackground.name,
                    personalityTrait: '', ideal: '', bond: '', flaw: '',
                    abilityScores: finalScores,
                    maxHp: Math.max(1, maxHp), 
                    currentHp: Math.max(1, maxHp),
                    tempHp: 0,
                    armorClass: armorClass,
                    speed: selectedRace.speed,
                    hitDice: { [selectedClass.hitDice]: { max: 1, spent: 0 } },
                    deathSaves: { successes: 0, failures: 0}, 
                    conditions: [],
                    racialTraits: selectedRace.traits,
                    classFeatures: selectedClass.features,
                    proficientSkills: Array.from(profSkills),
                    proficientSavingThrows: selectedClass.proficiencies.savingThrows,
                    spellSlots: spellSlots,
                };

                // 8. Panggil Callback (dari App.tsx) untuk menyimpan ke DB
                await onSaveSuccess(newCharData, inventoryData, spellData);
                
                // 9. Reset state setelah sukses
                set({ characterCreation: initialCharacterState });

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
        resetCampaignCreation: () => set({ campaignCreation: initialCampaignState }),
    }
}));