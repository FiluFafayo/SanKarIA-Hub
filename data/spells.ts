// data/spells.ts
import { SpellDefinition, Ability } from '../types';

// Ini adalah SSoT untuk spell.
// Kita akan menggunakan 'name' sebagai ID unik sementara sebelum seeding ke DB.
export const SPELL_DEFINITIONS: Omit<SpellDefinition, 'id'>[] = [
    // === CLERIC SPELLS ===
    // Cantrips (Level 0)
    {
        name: 'Guidance',
        level: 0,
        school: 'Divination',
        castingTime: 'action',
        range: 'Touch',
        components: ['V', 'S'],
        duration: 'Concentration, 1 minute',
        effectType: 'buff',
        description: 'Target mendapat +1d4 untuk satu ability check pilihannya sebelum spell berakhir.',
    },
    {
        name: 'Light',
        level: 0,
        school: 'Evocation',
        castingTime: 'action',
        range: 'Touch',
        components: ['V', 'M'],
        duration: '1 hour',
        effectType: 'utility',
        description: 'Objek yang disentuh bersinar seperti obor (20ft bright, 20ft dim) selama 1 jam.'
    },
    {
        name: 'Sacred Flame',
        level: 0,
        school: 'Evocation',
        castingTime: 'action',
        range: '60 feet',
        components: ['V', 'S'],
        duration: 'Instantaneous',
        effectType: 'damage',
        damageDice: '1d8', // (Meningkat seiring level: 5, 11, 17)
        damageType: 'radiant',
        saveRequired: Ability.Dexterity,
        saveOnSuccess: 'no_effect',
        description: 'Target dalam jangkauan harus lolos DEX save atau terkena 1d8 radiant damage. Target tidak mendapat bonus dari cover.'
    },
    // Level 1
    {
        name: 'Cure Wounds',
        level: 1,
        school: 'Evocation',
        castingTime: 'action',
        range: 'Touch',
        components: ['V', 'S'],
        duration: 'Instantaneous',
        effectType: 'heal',
        damageDice: '1d8', // (+ spellcasting modifier)
        description: 'Makhluk yang disentuh memulihkan 1d8 + MOD HP.'
    },
    {
        name: 'Healing Word',
        level: 1,
        school: 'Evocation',
        castingTime: 'bonus_action', // (PENTING)
        range: '60 feet',
        components: ['V'],
        duration: 'Instantaneous',
        effectType: 'heal',
        damageDice: '1d4', // (+ spellcasting modifier)
        description: 'Makhluk yang terlihat memulihkan 1d4 + MOD HP.'
    },
    {
        name: 'Guiding Bolt',
        level: 1,
        school: 'Evocation',
        castingTime: 'action',
        range: '120 feet',
        components: ['V', 'S'],
        duration: '1 round',
        effectType: 'damage', // (Juga 'debuff')
        damageDice: '4d6',
        damageType: 'radiant',
        description: 'Ranged spell attack. Jika kena, 4d6 radiant damage, dan attack roll berikutnya terhadap target ini (sebelum akhir giliranmu berikutnya) memiliki advantage.'
    },
    {
        name: 'Bless',
        level: 1,
        school: 'Enchantment',
        castingTime: 'action',
        range: '30 feet',
        components: ['V', 'S', 'M'],
        duration: 'Concentration, 1 minute',
        effectType: 'buff',
        description: 'Hingga 3 makhluk pilihanmu mendapat +1d4 untuk Attack Roll dan Saving Throw.'
    },
    {
        name: 'Shield of Faith',
        level: 1,
        school: 'Abjuration',
        castingTime: 'bonus_action', // (PENTING)
        range: '60 feet',
        components: ['V', 'S', 'M'],
        duration: 'Concentration, 10 minutes',
        effectType: 'buff',
        description: 'Satu makhluk pilihanmu mendapat +2 AC selama durasi.'
    },

    // === WIZARD SPELLS ===
    // Cantrips (Level 0)
    {
        name: 'Fire Bolt',
        level: 0,
        school: 'Evocation',
        castingTime: 'action',
        range: '120 feet',
        components: ['V', 'S'],
        duration: 'Instantaneous',
        effectType: 'damage',
        damageDice: '1d10', // (Meningkat seiring level)
        damageType: 'fire',
        description: 'Ranged spell attack. Jika kena, 1d10 fire damage.'
    },
    {
        name: 'Mage Hand',
        level: 0,
        school: 'Conjuration',
        castingTime: 'action',
        range: '30 feet',
        components: ['V', 'S'],
        duration: '1 minute',
        effectType: 'utility',
        description: 'Membuat tangan spektral yang bisa memanipulasi objek dari jauh.'
    },
    {
        name: 'Ray of Frost',
        level: 0,
        school: 'Evocation',
        castingTime: 'action',
        range: '60 feet',
        components: ['V', 'S'],
        duration: 'Instantaneous',
        effectType: 'damage', // (Juga 'debuff')
        damageDice: '1d8', // (Meningkat seiring level)
        damageType: 'cold',
        description: 'Ranged spell attack. Jika kena, 1d8 cold damage dan speed target berkurang 10 kaki.'
    },
    // Level 1
    {
        name: 'Magic Missile',
        level: 1,
        school: 'Evocation',
        castingTime: 'action',
        range: '120 feet',
        components: ['V', 'S'],
        duration: 'Instantaneous',
        effectType: 'damage',
        damageDice: '3d4+3', // (Spesial: 3x (1d4+1))
        damageType: 'force',
        description: 'Membuat 3 panah sihir, masing-masing 1d4+1 force damage. Otomatis kena.'
    },
    {
        name: 'Shield',
        level: 1,
        school: 'Abjuration',
        castingTime: 'reaction', // (PENTING)
        range: 'Self',
        components: ['V', 'S'],
        duration: '1 round',
        effectType: 'buff',
        description: 'Sebagai reaksi saat terkena serangan, kamu mendapat +5 AC hingga awal giliranmu berikutnya.'
    },
    {
        name: 'Mage Armor',
        level: 1,
        school: 'Abjuration',
        castingTime: 'action',
        range: 'Touch',
        components: ['V', 'S', 'M'],
        duration: '8 hours',
        effectType: 'buff',
        description: 'Makhluk yang disentuh (tanpa armor) AC-nya menjadi 13 + DEX modifier.'
    },
    {
        name: 'Sleep',
        level: 1,
        school: 'Enchantment',
        castingTime: 'action',
        range: '90 feet',
        components: ['V', 'S', 'M'],
        duration: '1 minute',
        effectType: 'control',
        damageDice: '5d8', // (Bukan damage, tapi total HP yang terpengaruh)
        description: 'Menidurkan makhluk dalam radius 20 kaki, total 5d8 HP, dimulai dari HP terendah.'
    },
];