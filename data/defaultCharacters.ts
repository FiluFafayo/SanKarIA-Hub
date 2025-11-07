// data/defaultCharacters.ts
import { Character, Ability, Skill, AbilityScores, CharacterSpellSlot, CharacterInventoryItem, ItemDefinition, SpellDefinition, CharacterFeature } from '../types';
import { generateId } from '../utils';
// REFAKTOR G-5: Hapus impor circular
// import { ITEM_DEFINITIONS } from './items';
// import { SPELL_DEFINITIONS } from './spells';
import { CLASS_DEFINITIONS } from './classes';
import { RACES } from './races';

// REFAKTOR: Helper sekarang HANYA mengembalikan data mentah yang dibutuhkan.
const invItem = (name: string, qty = 1, equipped = false): { itemName: string, quantity: number, isEquipped: boolean } => ({
    itemName: name,
    quantity: qty,
    isEquipped: equipped,
});

// REFAKTOR: Helper sekarang HANYA mengembalikan nama string.
const spell = (name: string): string => {
    return name;
};

// Tipe data mentah untuk seeding
export type RawCharacterData = Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'> & {
    inventory: { itemName: string, quantity: number, isEquipped: boolean }[];
    knownSpells: string[];
    startingEquipment: string[]; // FASE 4 FIX: Menambahkan data ini untuk pre-fill
};

const VALERIUS_DATA: RawCharacterData = {
    name: 'Valerius',
    class: 'Fighter',
    race: 'Human',
    level: 1,
    xp: 0,
    image: 'https://picsum.photos/seed/valerius/100',
    background: 'Soldier',
    personalityTrait: 'Saya selalu sopan dan hormat.',
    ideal: 'Rasa Hormat. Orang berhak diperlakukan dengan bermartabat.',
    bond: 'Saya masih setia pada komandan lama saya.',
    flaw: 'Saya buta terhadap kesalahan atasan saya.',
    abilityScores: {
        [Ability.Strength]: 16, [Ability.Dexterity]: 13, [Ability.Constitution]: 15,
        [Ability.Intelligence]: 9, [Ability.Wisdom]: 12, [Ability.Charisma]: 11,
    },
    maxHp: 12, // (10 + 2 CON)
    currentHp: 12,
    tempHp: 0,
    armorClass: 18, // (16 Chain Mail + 2 Shield)
    speed: 30, // (Human)
    hitDice: { 'd10': { max: 1, spent: 0 } },
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    proficientSkills: [Skill.Athletics, Skill.Intimidation],
    proficientSavingThrows: [Ability.Strength, Ability.Constitution],
    racialTraits: RACES.find(r => r.name === 'Human')?.traits || [],
    classFeatures: CLASS_DEFINITIONS['Fighter'].features,
    inventory: [
        invItem('Chain Mail', 1, true),
        invItem('Longsword', 1, true),
        invItem('Shield', 1, true),
        invItem('Light Crossbow', 1),
        invItem('Bolts', 20),
    ],
    // FASE 4 FIX: Data ini hilang, menyebabkan crash di ProfileWizard
    startingEquipment: [
        "Chain Mail", // Pilihan 0: (a) Chain Mail
        "Longsword & Shield", // Pilihan 1: (a) Longsword & Shield
        "Explorer's Pack" // Pilihan 2: (a) Explorer's Pack
    ],
    spellSlots: [],
    knownSpells: [],
};

const ELARA_DATA: RawCharacterData = {
    name: 'Elara',
    class: 'Rogue', // (Perbaikan: Ganti ke Rogue karena Ranger tidak terdefinisi)
    race: 'Elf',
    level: 1,
    xp: 0,
    image: 'https://picsum.photos/seed/elara/100',
    background: 'Outlander',
    personalityTrait: 'Saya tergerak oleh nafsu berkelana.',
    ideal: 'Alam itu lebih penting dari peradaban.',
    bond: 'Sebuah luka di hutan saya adalah luka bagi saya.',
    flaw: 'Saya sedikit terlalu menyukai minuman keras.',
    abilityScores: {
        [Ability.Strength]: 12, [Ability.Dexterity]: 17, [Ability.Constitution]: 13,
        [Ability.Intelligence]: 10, [Ability.Wisdom]: 15, [Ability.Charisma]: 8,
    },
    maxHp: 9, // (8 Rogue + 1 CON)
    currentHp: 9,
    tempHp: 0,
    armorClass: 14, // (11 Leather + 3 DEX)
    speed: 30, // (Elf)
    hitDice: { 'd8': { max: 1, spent: 0 } }, // (Perbaikan: Rogue d8)
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    proficientSkills: [Skill.Stealth, Skill.Survival, Skill.Perception, Skill.Acrobatics], // (Rogue dapat 4 skill)
    proficientSavingThrows: [Ability.Dexterity, Ability.Intelligence], // (Perbaikan: Rogue DEX/INT)
    racialTraits: RACES.find(r => r.name === 'Elf')?.traits || [],
    classFeatures: CLASS_DEFINITIONS['Rogue'].features, // (Perbaikan: Ambil fitur Rogue)
    inventory: [
        invItem('Leather Armor', 1, true),
        invItem('Shortbow', 1, true), // (Perbaikan: Rogue proficient Shortbow, bukan Longbow)
        invItem('Arrows', 20),
        invItem('Shortsword', 2, true), // (Equip satu)
    ],
    // FASE 4 FIX: Data ini hilang, menyebabkan crash di ProfileWizard
    startingEquipment: [
        "Rapier", // Pilihan 0: (a) Rapier
        "Shortbow & Arrows" // Pilihan 1: (a) Shortbow & Arrows
    ],
    spellSlots: [],
    knownSpells: [],
};

const BORIN_DATA: RawCharacterData = {
    name: 'Borin',
    class: 'Cleric',
    race: 'Dwarf',
    level: 1,
    xp: 0,
    image: 'https://picsum.photos/seed/borin/100',
    background: 'Acolyte',
    personalityTrait: 'Saya melihat pertanda dalam setiap peristiwa.',
    ideal: 'Keyakinan. Saya percaya pada dewa saya.',
    bond: 'Saya berutang nyawa kepada pendeta yang menolong saya.',
    flaw: 'Saya sangat mempercayai hierarki kuil saya.',
    abilityScores: {
        [Ability.Strength]: 14, [Ability.Dexterity]: 8, [Ability.Constitution]: 16,
        [Ability.Intelligence]: 10, [Ability.Wisdom]: 16, [Ability.Charisma]: 12,
    },
    maxHp: 11, // (8 + 3 CON)
    currentHp: 11,
    tempHp: 0,
    armorClass: 18, // (14 Scale Mail + 2 Shield + 2 (Life Domain Heavy Armor? -> Seharusnya 16 Scale + 2 Shield = 18 jika Heavy))
    // File lama bilang 16, mari kita ikuti 16 (Scale Mail 14 + DEX 0 (max 2) + Shield 2)
    speed: 25, // (Dwarf)
    hitDice: { 'd8': { max: 1, spent: 0 } },
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    proficientSkills: [Skill.Insight, Skill.Religion],
    proficientSavingThrows: [Ability.Wisdom, Ability.Charisma],
    racialTraits: RACES.find(r => r.name === 'Dwarf')?.traits || [],
    classFeatures: CLASS_DEFINITIONS['Cleric'].features,
    inventory: [
        invItem('Scale Mail', 1, true),
        invItem('Warhammer', 1, true),
        invItem('Shield', 1, true),
        invItem('Holy Symbol', 1),
    ],
    // FASE 4 FIX: Data ini hilang, menyebabkan crash di ProfileWizard
    startingEquipment: [
        "Mace", // Pilihan 0: (a) Mace
        "Scale Mail", // Pilihan 1: (a) Scale Mail
        "Priest's Pack" // Pilihan 2: (a) Priest's Pack
    ],
    spellSlots: [{ level: 1, max: 2, spent: 0 }], // (File lama salah, cleric Lvl 1 punya 2 slot)
    knownSpells: [
        spell('Guidance'),
        spell('Light'),
        spell('Cure Wounds'),
        spell('Guiding Bolt'),
        spell('Bless'),
    ],
};


export const RAW_DEFAULT_CHARACTERS: RawCharacterData[] = [
    VALERIUS_DATA,
    ELARA_DATA,
    BORIN_DATA,
];

/**
 * Fungsi ini mengubah data mentah menjadi data karakter lengkap 
 * dengan ID unik untuk instance inventory, siap untuk disimpan ke DB.
 * INI HANYA UNTUK SEEDING DATABASE BARU.
 */
/**
 * (Fungsi 'generateDefaultCharacters' dipindah ke data/registry.ts
 * untuk menyelesaikan circular dependency.)
 */

/**
 * (Fungsi seeding 'getRawCharactersForSeeding' dan 'getRawCharacterRelationsForSeeding'
 * telah dihapus karena tidak digunakan oleh aplikasi runtime.)
 */