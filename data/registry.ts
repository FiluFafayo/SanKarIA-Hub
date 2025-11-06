// REFAKTOR G-5: File BARU.
// Ini adalah SSoT Registry terpusat untuk SEMUA data statis (definisi aturan).
// Semua bagian aplikasi (Store, Hooks, Services) HARUS mengimpor dari sini,
// BUKAN dari file data individual atau (window).

import { RaceData, RACES } from './races';
import { ClassData, CLASS_DEFINITIONS } from './classes';
import { BackgroundData, BACKGROUNDS } from './backgrounds';
import { ItemDefinition, ITEM_DEFINITIONS } from './items';
import { SpellDefinition, SPELL_DEFINITIONS } from './spells';
import { MonsterDefinition, MONSTER_DEFINITIONS } from './monsters';
import { Ability, Skill, Character, CharacterInventoryItem, SpellDefinition, ItemDefinition } from '@/types';
import { RawCharacterData, RAW_DEFAULT_CHARACTERS } from './defaultCharacters';

// Ekspor tipe agar file lain bisa pakai
export type { RawCharacterData };

// Helper internal
const findByName = <T extends { name: string }>(arr: T[], name: string): T | undefined => {
    if (!name) return undefined;
    return arr.find(item => item.name.toLowerCase() === name.toLowerCase());
};

// === API Registry ===

// Races
export const getAllRaces = (): RaceData[] => RACES;
export const findRace = (name: string): RaceData | undefined => findByName(RACES, name);

// Classes
export const getAllClasses = (): Record<string, ClassData> => CLASS_DEFINITIONS;
export const findClass = (name: string): ClassData | undefined => CLASS_DEFINITIONS[name];

// Backgrounds
export const getAllBackgrounds = (): BackgroundData[] => BACKGROUNDS;
export const findBackground = (name: string): BackgroundData | undefined => findByName(BACKGROUNDS, name);

// Items
export const getAllItems = (): ItemDefinition[] => ITEM_DEFINITIONS;
export const findItem = (name: string): ItemDefinition | undefined => findByName(ITEM_DEFINITIONS, name);

// Spells
export const getAllSpells = (): SpellDefinition[] => SPELL_DEFINITIONS;
export const findSpell = (name: string): SpellDefinition | undefined => findByName(SPELL_DEFINITIONS, name);

// Monsters
export const getAllMonsters = (): MonsterDefinition[] => MONSTER_DEFINITIONS;
export const findMonster = (name: string): MonsterDefinition | undefined => findByName(MONSTER_DEFINITIONS, name);

// API baru untuk mengambil template mentah
export const getRawCharacterTemplates = (): RawCharacterData[] => RAW_DEFAULT_CHARACTERS;

// Helper fallback (digunakan oleh appStore)
export const getItemDef = (name: string): ItemDefinition => {
    const definition = findItem(name);
    if (!definition) {
        console.error(`[G-5 Registry] ItemDefinition not found: ${name}. Menggunakan fallback.`);
        // Buat fallback agar UI tidak crash
        return { 
            id: name, name, type: 'other', isMagical: false, 
            rarity: 'common', requiresAttunement: false 
        };
    }
    return definition;
};