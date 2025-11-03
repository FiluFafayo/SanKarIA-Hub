// data/items.ts
import { ItemDefinition } from '../types';

// Ini adalah SSoT untuk item.
// Kita akan menggunakan 'name' sebagai ID unik sementara sebelum seeding ke DB.
export const ITEM_DEFINITIONS: Omit<ItemDefinition, 'id'>[] = [
    // === Armor ===
    {
        name: 'Padded Armor',
        type: 'armor',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        baseAc: 11,
        armorType: 'light',
        stealthDisadvantage: true,
        strengthRequirement: 0
    },
    {
        name: 'Leather Armor',
        type: 'armor',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        baseAc: 11,
        armorType: 'light',
        stealthDisadvantage: false,
        strengthRequirement: 0
    },
    {
        name: 'Studded Leather',
        type: 'armor',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        baseAc: 12,
        armorType: 'light',
        stealthDisadvantage: false,
        strengthRequirement: 0
    },
    {
        name: 'Hide Armor',
        type: 'armor',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        baseAc: 12,
        armorType: 'medium',
        stealthDisadvantage: false,
        strengthRequirement: 0
    },
    {
        name: 'Chain Shirt',
        type: 'armor',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        baseAc: 13,
        armorType: 'medium',
        stealthDisadvantage: false,
        strengthRequirement: 0
    },
    {
        name: 'Scale Mail',
        type: 'armor',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        baseAc: 14,
        armorType: 'medium',
        stealthDisadvantage: true,
        strengthRequirement: 0
    },
    {
        name: 'Chain Mail',
        type: 'armor',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        baseAc: 16,
        armorType: 'heavy',
        stealthDisadvantage: true,
        strengthRequirement: 13
    },
    {
        name: 'Plate Armor',
        type: 'armor',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        baseAc: 18,
        armorType: 'heavy',
        stealthDisadvantage: true,
        strengthRequirement: 15
    },
    {
        name: 'Shield',
        type: 'armor',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        baseAc: 2, // Perhatikan: Shield memberi bonus +2, bukan AC dasar
        armorType: 'shield',
        stealthDisadvantage: false,
        strengthRequirement: 0
    },

    // === Weapons ===
    {
        name: 'Dagger',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d4',
        damageType: 'piercing',
    },
    {
        name: 'Mace',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d6',
        damageType: 'bludgeoning',
    },
    {
        name: 'Quarterstaff',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d6', // Versatile (1d8)
        damageType: 'bludgeoning',
    },
    {
        name: 'Light Crossbow',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d8',
        damageType: 'piercing',
    },
    {
        name: 'Longsword',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d8', // Versatile (1d10)
        damageType: 'slashing',
    },
    {
        name: 'Warhammer',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d8', // Versatile (1d10)
        damageType: 'bludgeoning',
    },
    {
        name: 'Rapier',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d8',
        damageType: 'piercing',
    },
    {
        name: 'Shortsword',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d6',
        damageType: 'piercing',
    },
    {
        name: 'Shortbow',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d6',
        damageType: 'piercing',
    },
    {
        name: 'Longbow',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d8',
        damageType: 'piercing',
    },
    {
        name: 'Small Knife',
        type: 'weapon',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        damageDice: '1d4',
        damageType: 'piercing',
        description: 'Pisau kecil serbaguna.'
    },
    
    // === Amunisi ===
    {
        name: 'Bolts',
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Arrows',
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },

    // === Consumables ===
    {
        name: 'Potion of Healing',
        type: 'consumable',
        rarity: 'common',
        isMagical: true,
        requiresAttunement: false,
        effect: { type: 'heal', dice: '2d4+2' }
    },
    
    // === Lain-lain / Focus / Tools ===
    {
        name: 'Holy Symbol',
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Arcane Focus',
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: "Thieves' Tools",
        type: 'tool',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: "Explorer's Pack",
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: "Priest's Pack",
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: "Scholar's Pack",
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Bottle of Black Ink',
        type: 'tool',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        description: 'Satu botol tinta hitam standar.'
    },
    {
        name: 'Quill',
        type: 'tool',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
        description: 'Pena bulu untuk menulis.'
    },
    // (PERBAIKAN DATA ENTRY - SEMUA ITEM BACKGROUND YANG HILANG)
    {
        name: 'Crowbar',
        type: 'tool',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Common Clothes (Dark)',
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: "Artisan's Tools (Tinker's Tools)",
        type: 'tool',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Shovel',
        type: 'tool',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Iron Pot',
        type: 'tool',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Fine Clothes',
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Signet Ring',
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Scroll of Pedigree',
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Insignia of Rank',
        type: 'other',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Trophy (Dagger)',
        type: 'other', // Ini adalah 'other' (trofi), BUKAN 'weapon'
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Gaming Set (Dice)',
        type: 'tool',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    },
    {
        name: 'Gaming Set (Chess)',
        type: 'tool',
        rarity: 'common',
        isMagical: false,
        requiresAttunement: false,
    }
];