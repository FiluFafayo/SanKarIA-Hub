import React from 'react';
import { Character } from '../types';
import { ProfileModal } from '../components/modals/ProfileModal';

// createClassLoadout dihapus total dari sini.
// Logika itu akan dibangun ulang di dalam ProfileModalWizard di Fase 1.D

interface ProfileViewProps {
  onClose: () => void;
  characters: Character[]; // SSoT Characters
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>; // SSoT updater
  userId: string;
}

export const ProfileView: React.FC<ProfileViewProps> = (props) => {
  // Untuk saat ini, kita hanya meneruskan prop SSoT ke ProfileModal.
  // ProfileModal sendiri akan dirombak di Fase 1.D
  return <ProfileModal {...props} />;
};