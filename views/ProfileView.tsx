// Fix: Added component implementation.
import React from 'react';
import { Character, Ability, Skill, ALL_ABILITIES, AbilityScores, InventoryItem, ItemType, Spell, SpellSlot } from '../types';
import { ProfileModal } from '../components/modals/ProfileModal';
import { getAbilityModifier } from '../utils';

// Helper function to create equipment and spells, keeping ProfileView clean.
// INI PERLU DI-UPDATE DI FASE 1 (ROADMAP) UNTUK MENDUKUNG PILIHAN USER
const createClassLoadout = (charClass: string, finalScores: AbilityScores): {
    maxHp: number;
    hitDice: string;
    proficientSavingThrows: Ability[];
    proficientSkills: Skill[];
    armorClass: number;
    inventory: InventoryItem[];
    spellSlots: SpellSlot[];
    knownSpells: Spell[];
} => {
    const conModifier = getAbilityModifier(finalScores.constitution);
    const dexModifier = getAbilityModifier(finalScores.dexterity);
    const wisModifier = getAbilityModifier(finalScores.wisdom);
    const intModifier = getAbilityModifier(finalScores.intelligence);

    let loadout = {
        maxHp: 0, hitDice: '', proficientSavingThrows: [] as Ability[], 
        proficientSkills: [] as Skill[], armorClass: 10 + dexModifier,
        inventory: [] as InventoryItem[], spellSlots: [] as SpellSlot[], knownSpells: [] as Spell[]
    };

     switch(charClass) {
        case 'Fighter':
            loadout.maxHp = 10 + conModifier; loadout.hitDice = '1d10'; loadout.proficientSavingThrows = [Ability.Strength, Ability.Constitution]; loadout.proficientSkills = [Skill.Athletics, Skill.Intimidation, Skill.Perception, Skill.Survival]; loadout.armorClass = 18;
            loadout.inventory = [
                { id: generateId('item'), name: 'Chain Mail', quantity: 1, type: 'armor', isEquipped: true },
                { id: generateId('item'), name: 'Longsword', quantity: 1, type: 'weapon', toHitBonus: 5, damageDice: '1d8+3', isEquipped: true }, 
                { id: generateId('item'), name: 'Shield', quantity: 1, type: 'armor', isEquipped: true},
                { id: generateId('item'), name: 'Potion of Healing', quantity: 1, type: 'consumable', effect: { type: 'heal', dice: '2d4+2' }}
            ];
            break;
        case 'Barbarian':
            loadout.maxHp = 12 + conModifier; loadout.hitDice = '1d12'; loadout.proficientSavingThrows = [Ability.Strength, Ability.Constitution]; loadout.proficientSkills = [Skill.Athletics, Skill.Intimidation, Skill.Perception, Skill.Survival];
            loadout.inventory = [{ id: generateId('item'), name: 'Greataxe', quantity: 1, type: 'weapon', toHitBonus: 5, damageDice: '1d12+3' }, { id: generateId('item'), name: "Explorer's Pack", quantity: 1, type: 'other'}, { id: generateId('item'), name: 'Javelin', quantity: 4, type: 'weapon', toHitBonus: 5, damageDice: '1d6+3'}];
            break;
        case 'Cleric':
            loadout.maxHp = 8 + conModifier; loadout.hitDice = '1d8'; loadout.proficientSavingThrows = [Ability.Wisdom, Ability.Charisma]; loadout.proficientSkills = [Skill.Insight, Skill.Religion, Skill.Medicine, Skill.Persuasion]; loadout.armorClass = 16;
            loadout.inventory = [
                { id: generateId('item'), name: 'Mace', quantity: 1, type: 'weapon', toHitBonus: 4, damageDice: '1d6+2'}, 
                { id: generateId('item'), name: 'Scale Mail', quantity: 1, type: 'armor'}, 
                { id: generateId('item'), name: 'Shield', quantity: 1, type: 'armor'}, 
                { id: generateId('item'), name: 'Holy Symbol', quantity: 1, type: 'other'}
            ];
            loadout.spellSlots = [{ level: 1, max: 2 + wisModifier, used: 0 }]; 
            // TODO: Ini harus menggunakan tipe Spell baru dari types.ts
            loadout.knownSpells = [
                { id: 'spell-cure-wounds', name: 'Cure Wounds', level: 1, description: 'Heal a creature.', target: 'creature', effectType: 'heal', damageDice: `1d8+${wisModifier}`, castingTime: 'action', range: 'touch', components: ['V', 'S'], duration: 'instantaneous' },
                { id: 'spell-guiding-bolt', name: 'Guiding Bolt', level: 1, description: 'Radiant damage.', target: 'creature', effectType: 'damage', damageDice: '4d6', castingTime: 'action', range: 120, components: ['V', 'S'], duration: '1_round' },
            ] as any; // 'as any' untuk sementara
            break;
        case 'Wizard':
            loadout.maxHp = 6 + conModifier; loadout.hitDice = '1d6'; loadout.proficientSavingThrows = [Ability.Intelligence, Ability.Wisdom]; loadout.proficientSkills = [Skill.Arcana, Skill.History, Skill.Investigation, Skill.Insight];
            loadout.inventory = [{ id: generateId('item'), name: 'Quarterstaff', quantity: 1, type: 'weapon', toHitBonus: 2, damageDice: '1d6'}, { id: generateId('item'), name: 'Spellbook', quantity: 1, type: 'other'}]; 
            loadout.spellSlots = [{ level: 1, max: 2 + intModifier, used: 0 }]; 
            loadout.knownSpells = [
                 { id: 'spell-magic-missile', name: 'Magic Missile', level: 1, description: 'Force damage.', target: 'creature', effectType: 'damage', damageDice: '3d4+3', castingTime: 'action', range: 120, components: ['V', 'S'], duration: 'instantaneous' },
                 { id: 'spell-shield', name: 'Shield', level: 1, description: 'Increase AC.', target: 'self', effectType: 'buff', bonusType: 'ac', bonusValue: '+5', castingTime: 'reaction', range: 'self', components: ['V', 'S'], duration: '1_round' }
            ] as any; // 'as any' untuk sementara
            break;
        case 'Rogue':
            loadout.maxHp = 8 + conModifier; loadout.hitDice = '1d8'; loadout.proficientSavingThrows = [Ability.Dexterity, Ability.Intelligence]; loadout.proficientSkills = [Skill.Acrobatics, Skill.Stealth, Skill.SleightOfHand, Skill.Perception]; loadout.armorClass = 11 + dexModifier;
            loadout.inventory = [{ id: generateId('item'), name: 'Rapier', quantity: 1, type: 'weapon', toHitBonus: 5, damageDice: '1d8+3'}, { id: generateId('item'), name: 'Shortbow', quantity: 1, type: 'weapon', toHitBonus: 5, damageDice: '1d6+3'}, { id: generateId('item'), name: 'Arrows', quantity: 20, type: 'other'}, { id: generateId('item'), name: "Thieves' Tools", quantity: 1, type: 'tool'}];
            break;
        default: // Ranger
            loadout.maxHp = 10 + conModifier; loadout.hitDice = '1d10'; loadout.proficientSavingThrows = [Ability.Strength, Ability.Dexterity]; loadout.proficientSkills = [Skill.Survival, Skill.Nature, Skill.AnimalHandling, Skill.Stealth]; loadout.armorClass = 12 + dexModifier;
            loadout.inventory = [{ id: generateId('item'), name: 'Longbow', quantity: 1, type: 'weapon', toHitBonus: 5, damageDice: '1d8+3'}, { id: generateId('item'), name: 'Arrows', quantity: 20, type: 'other'}, { id: generateId('item'), name: 'Shortsword', quantity: 2, type: 'weapon', toHitBonus: 5, damageDice: '1d6+3'}];
            break;
    }
    // Pastikan semua item punya ID
    loadout.inventory = loadout.inventory.map(item => ({ ...item, id: item.id || generateId('item') }));
    return loadout;
}


interface ProfileViewProps {
  onClose: () => void;
  characters: Character[];
  // Prop 'setCharacters' sekarang menerima BATCH update
  setCharacters: (characters: Character[]) => Promise<void>;
  userId: string;
}

export const ProfileView: React.FC<ProfileViewProps> = (props) => {
  return <ProfileModal {...props} createClassLoadout={createClassLoadout} />;
};