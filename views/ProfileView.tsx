// REFAKTOR G-4: View ini sekarang menjadi "container" tipis
// yang mengambil data dari store dan meneruskannya ke Modal.
// FASE 1: Ganti nama impor ProfileModal -> ProfileWizard

import React from 'react';
import { ProfileWizard } from '../components/profile/ProfileWizard'; // FASE 1
import { useAppStore } from '../store/appStore';
import { useDataStore } from '../store/dataStore';
import { ViewWrapper } from '../components/ViewWrapper'; // FASE 2: Impor ViewWrapper

interface ProfileViewProps {
  onClose: () => void;
  userId: string;
}

import { Character, CharacterInventoryItem, SpellDefinition } from '../types'; // FASE 2 FIX: Impor tipe

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

  // FASE 2 FIX: Buat handler yang menyuntikkan userId
  // (Sesuai definisi di dataStore.ts: (charData, inventoryData, spellData, userId))
  const handleSaveNewCharacter = (
    charData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'>,
    inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[],
    spellData: SpellDefinition[]
  ) => {
    // Panggil aksi dataStore dengan userId yang sudah disuntikkan
    return saveNewCharacter(charData, inventoryData, spellData, userId);
  };

  // FASE 2: ProfileModal sekarang di-render di dalam ViewWrapper (halaman),
  // bukan sebagai modalnya sendiri.
  return (
    <ViewWrapper onClose={handleClose} title="Cermin Jiwa">
      {/* FASE 1: Ganti nama komponen */}
      {/* FASE 0: ProfileWizard sekarang mengatur layout internalnya sendiri (flex)
          dan akan mengisi parent (ViewWrapper main area) */}
      <ProfileWizard 
        onClose={handleClose} // onClose tetap di-pass untuk tombol Batal/Selesai di Wizard
        characters={characters.filter(c => c.ownerId === userId)} // Kirim SSoT karakter milikku
        userId={userId} // Tetap kirim userId untuk UI wizard
        // Aksi saveNewCharacter sekarang di-resolve DI SINI,
        // bukan di App.tsx
        onSaveNewCharacter={handleSaveNewCharacter} // FASE 2 FIX: Gunakan handler baru
      />
    </ViewWrapper>
  );
};