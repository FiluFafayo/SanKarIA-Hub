import React from 'react';
import { Character, CharacterInventoryItem, SpellDefinition } from '../types';
import { ProfileModal } from '../components/modals/ProfileModal';

interface ProfileViewProps {
  onClose: () => void;
  characters: Character[]; // SSoT Characters
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>; // SSoT updater (untuk delete)
  userId: string;
  onSaveNewCharacter: (
      charData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'>,
      inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[],
      spellData: SpellDefinition[]
  ) => Promise<void>; // Prop baru
}

export const ProfileView: React.FC<ProfileViewProps> = (props) => {
  // Hanya meneruskan prop SSoT ke ProfileModal.
  return <ProfileModal {...props} />;
};