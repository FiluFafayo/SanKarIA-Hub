// data/defaultCharacters.ts
import { Character, Ability, Skill, AbilityScores, CharacterSpellSlot, CharacterInventoryItem, ItemDefinition, SpellDefinition, CharacterFeature } from '../types';
import { generateId } from '../utils';
// REFAKTOR G-5: File data statis tidak boleh saling impor, 
// tapi karena ini adalah file definisi, kita izinkan impor definisi dasar.
import { ITEM_DEFINITIONS } from './items';
import { SPELL_DEFINITIONS } from './spells';
import { CLASS_DEFINITIONS } from './classes';
import { RACES } from './races';

// Helper untuk mengambil definisi item berdasarkan nama
const item = (name: string): ItemDefinition => {
    const definition = ITEM_DEFINITIONS.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (!definition) {
        console.warn(`[G-5 DefaultChars] ItemDefinition not found for seeding: ${name}. Using a placeholder.`);
        return { 
            id: generateId('item-fallback'), 
            name: name, type: 'other', isMagical: false, 
            rarity: 'common', requiresAttunement: false 
        };
    }
    return { ...definition, id: definition.id || name };
};

// Helper untuk mengambil definisi spell berdasarkan nama
const spell = (name: string): SpellDefinition => {
    const definition = SPELL_DEFINITIONS.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!definition) throw new Error(`[G-5 DefaultChars] SpellDefinition not found for seeding: ${name}`);
    return { ...definition, id: definition.id || name };
};

// Helper untuk membuat item inventory
const invItem = (def: ItemDefinition, qty = 1, equipped = false): Omit<CharacterInventoryItem, 'instanceId'> => ({
    item: def,
    quantity: qty,
    isEquipped: equipped,
});

// Tipe data mentah untuk seeding
type RawCharacterData = Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'> & {
    inventory: Omit<CharacterInventoryItem, 'instanceId'>[];
    knownSpells: SpellDefinition[];
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
      invItem(item('Chain Mail'), 1, true),
      invItem(item('Longsword'), 1, true),
      invItem(item('Shield'), 1, true),
      invItem(item('Light Crossbow'), 1),
      invItem(item('Bolts'), 20),
    ],
    spellSlots: [],
    knownSpells: [],
};

const ELARA_DATA: RawCharacterData = {
    name: 'Elara',
    class: 'Ranger', // (Kita asumsikan Ranger ada di data/classes.ts, jika tidak, ganti ke Fighter)
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
    maxHp: 11, // (10 + 1 CON)
    currentHp: 11,
    tempHp: 0,
    armorClass: 14, // (11 Leather + 3 DEX)
    speed: 30, // (Elf)
    hitDice: { 'd10': { max: 1, spent: 0 } },
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    proficientSkills: [Skill.Stealth, Skill.Survival, Skill.Perception],
    proficientSavingThrows: [Ability.Strength, Ability.Dexterity],
    racialTraits: RACES.find(r => r.name === 'Elf')?.traits || [],
    classFeatures: [ { name: 'Favored Enemy', description: 'Kamu ahli melawan satu tipe musuh.'}, { name: 'Natural Explorer', description: 'Kamu ahli di satu tipe medan.'} ], // (Contoh fitur Ranger)
    inventory: [
      invItem(item('Leather Armor'), 1, true),
      invItem(item('Longbow'), 1, true),
      invItem(item('Arrows'), 20),
      invItem(item('Shortsword'), 2),
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
      invItem(item('Scale Mail'), 1, true),
      invItem(item('Warhammer'), 1, true),
      invItem(item('Shield'), 1, true),
      invItem(item('Holy Symbol'), 1),
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


const RAW_DEFAULT_CHARACTERS: RawCharacterData[] = [
    VALERIUS_DATA,
    ELARA_DATA,
    BORIN_DATA,
];

/**
 * Fungsi ini mengubah data mentah menjadi data karakter lengkap 
 * dengan ID unik untuk instance inventory, siap untuk disimpan ke DB.
 * INI HANYA UNTUK SEEDING DATABASE BARU.
 */
export const generateDefaultCharacters = (ownerId: string): Omit<Character, 'id'>[] => {
    return RAW_DEFAULT_CHARACTERS.map(rawChar => {
        
        // Buat inventory relasional
        const newInventory: CharacterInventoryItem[] = rawChar.inventory.map(inv => ({
            ...inv,
            instanceId: generateId('inv'), // ID unik untuk baris 'character_inventory'
        }));
        
        // Buat spell relasional
        const newSpells: SpellDefinition[] = rawChar.knownSpells.map(s => ({
            ...s,
            // (ID sudah di-set dari helper 'spell()')
        }));

        // Gabungkan
        return {
            ...rawChar,
            ownerId: ownerId,
            inventory: newInventory,
            knownSpells: newSpells
        };
    });
};

/**
 * Fungsi ini HANYA untuk seeding tabel 'characters'
 */
export const getRawCharactersForSeeding = (ownerId: string): Omit<DbCharacter, 'id'>[] => {
    return RAW_DEFAULT_CHARACTERS.map(rawChar => {
        const { inventory, knownSpells, ...coreData } = rawChar;
        return {
            ...coreData,
            owner_id: ownerId,
            ability_scores: coreData.abilityScores,
            max_hp: coreData.maxHp,
            current_hp: coreData.currentHp,
            temp_hp: coreData.tempHp,
            armor_class: coreData.armorClass,
            hit_dice: coreData.hitDice,
            death_saves: coreData.deathSaves,
            racial_traits: coreData.racialTraits,
            class_features: coreData.classFeatures,
            proficient_skills: coreData.proficientSkills,
            proficient_saving_throws: coreData.proficientSavingThrows,
            spell_slots: coreData.spellSlots,
            personality_trait: coreData.personalityTrait,
        };
    });
};

/**
 * Fungsi ini HANYA untuk seeding tabel 'character_inventory' dan 'character_spells'
 */
export const getRawCharacterRelationsForSeeding = (characterId: string, characterName: string): {
    inventory: Omit<DbCharacterInventory, 'id' | 'character_id'>[],
    spells: Omit<DbCharacterSpell, 'id' | 'character_id'>[]
} => {
    const rawChar = RAW_DEFAULT_CHARACTERS.find(c => c.name === characterName);
    if (!rawChar) return { inventory: [], spells: [] };

    const inventory = rawChar.inventory.map(inv => ({
        item_id: inv.item.id, // (Kita pakai nama sebagai ID sementara)
        quantity: inv.quantity,
        is_equipped: inv.isEquipped,
    }));
    
    const spells = rawChar.knownSpells.map(sp => ({
        spell_id: sp.id, // (Kita pakai nama sebagai ID sementara)
    }));

    return { inventory, spells };
};