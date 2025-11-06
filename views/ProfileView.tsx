// REFAKTOR G-4: View ini sekarang menjadi "container" tipis
// yang mengambil data dari store dan meneruskannya ke Modal.

import React from 'react';
import { ProfileModal } from '../components/modals/ProfileModal';
import { useAppStore } from '../store/appStore';
import { useDataStore } from '../store/dataStore';
import { ViewWrapper } from '../components/ViewWrapper'; // FASE 2: Impor ViewWrapper

interface ProfileViewProps {
  onClose: () => void;
  userId: string;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onClose, userId }) => {
  // Ambil SSoT data dari dataStore
  const { characters } = useDataStore(s => s.state);
  const { saveNewCharacter } = useDataStore(s => s.actions);
  
  // Ambil aksi navigasi dari appStore
  const { returnToNexus } = useAppStore(s => s.actions);

  const handleClose = () => {
    returnToNexus(); // Pastikan store navigasi di-reset
    onClose(); // (Prop onClose dari ViewManager)
  };

  // FASE 2: ProfileModal sekarang di-render di dalam ViewWrapper (halaman),
  // bukan sebagai modalnya sendiri.
  return (
    <ViewWrapper onClose={handleClose} title="Cermin Jiwa">
      <ProfileModal 
        onClose={handleClose} // onClose tetap di-pass untuk tombol Batal/Selesai di Wizard
        characters={characters.filter(c => c.ownerId === userId)} // Kirim SSoT karakter milikku
        userId={userId}
        // Aksi saveNewCharacter sekarang di-resolve DI SINI,
        // bukan di App.tsx
        onSaveNewCharacter={saveNewCharacter}
      />
    </ViewWrapper>
  );
};