// views/ProfileView.tsx
import React from 'react';
import { Character, AbilityScores, InventoryItem, SpellSlot, Spell, Ability, Skill } from '../types'; // Import tipe tambahan
import { ProfileModal } from '../components/modals/ProfileModal';
// import { getAbilityModifier, getProficiencyBonus } from '../utils'; // Uncomment jika createClassLoadout dipindah ke sini

// Definisikan tipe untuk createClassLoadout function
type CreateClassLoadoutFn = (charClass: string, finalScores: AbilityScores) => {
    maxHp: number;
    hitDice: string;
    proficientSavingThrows: Ability[];
    proficientSkills: Skill[]; // Pastikan Skill diimport
    armorClass: number;
    inventory: InventoryItem[];
    spellSlots: SpellSlot[];
    knownSpells: Spell[];
};

// Update interface ProfileViewProps
interface ProfileViewProps {
  onClose: () => void;
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  userId: string;
  createClassLoadout: CreateClassLoadoutFn; // <<< TAMBAHKAN PROPERTI INI
}

// Komponen ProfileView sekarang hanya meneruskan props
export const ProfileView: React.FC<ProfileViewProps> = (props) => {
  // Fungsi createClassLoadout sekarang diterima dari props (App.tsx)
  // Tidak perlu didefinisikan lagi di sini
  return <ProfileModal {...props} />;
};