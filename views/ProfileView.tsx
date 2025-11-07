// REFAKTOR G-4: View ini sekarang menjadi "container" tipis
// yang mengambil data dari store dan meneruskannya ke Modal.
// FASE 1: Ganti nama impor ProfileModal -> ProfileWizard

import React from "react";
import { ProfileWizard } from "../components/profile/ProfileWizard"; // FASE 1
import { useAppStore } from "../store/appStore";
import { useDataStore } from "../store/dataStore";
import { useGameStore } from "../store/gameStore"; // FASE 1 FIX: Impor gameStore
import { ViewWrapper } from "../components/ViewWrapper"; // FASE 2: Impor ViewWrapper

interface ProfileViewProps {
	onClose: () => void;
	userId: string;
}

import { Character, CharacterInventoryItem, SpellDefinition } from "../types"; // FASE 2 FIX: Impor tipe

export const ProfileView: React.FC<ProfileViewProps> = ({
	onClose,
	userId,
}) => {
	// Ambil SSoT data dari dataStore
	const { characters } = useDataStore((s) => s.state);
	const { saveNewCharacter, addPlayerToCampaign } = useDataStore(
		(s) => s.actions
	);

	// Ambil aksi navigasi dari appStore
	const { returnToNexus } = useAppStore((s) => s.actions); // FASE 1 FIX: Ambil state alur join
	const { campaignToJoinOrStart } = useAppStore((s) => s.navigation);

	// FASE 1 FIX: Ambil aksi gameStore const { loadGameSession } = useGameStore(s => s.actions);

	const handleClose = () => {
		returnToNexus(); // Pastikan store navigasi di-reset
		onClose(); // (Prop onClose dari ViewManager)
	};

	// FASE 2 FIX: Buat handler yang menyuntikkan userId
	// FASE 1 FIX: Modifikasi handler untuk menyelesaikan alur join (dead-end)
	const handleSaveNewCharacter = async (
		charData: Omit<Character, "id" | "ownerId" | "inventory" | "knownSpells">,
		inventoryData: Omit<CharacterInventoryItem, "instanceId">[],
		spellData: SpellDefinition[]
	): Promise<Character> => {
		// Panggil aksi dataStore dengan userId yang sudah disuntikkan
		const newCharacter = await saveNewCharacter(
			charData,
			inventoryData,
			spellData,
			userId
		);
		// CEK ALUR JOIN (FIX DEAD-END)
		if (campaignToJoinOrStart) {
			// Kita dalam alur Join! Selesaikan alur join DARI SINI.
			const updatedCampaign = await addPlayerToCampaign(
				campaignToJoinOrStart.id,
				newCharacter.id
			);
			await loadGameSession(updatedCampaign, newCharacter);
			// loadGameSession akan memanggil returnToNexus (lihat fix Fase 1.C)
		} else {
			// Alur normal (buat karakter dari Nexus)
			handleClose(); // Tutup ProfileView
		}

		return newCharacter;
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
				characters={characters.filter((c) => c.ownerId === userId)} // Kirim SSoT karakter milikku
				userId={userId} // Tetap kirim userId untuk UI wizard
				// Aksi saveNewCharacter sekarang di-resolve DI SINI,
				// bukan di App.tsx
				onSaveNewCharacter={handleSaveNewCharacter} // FASE 2 FIX: Gunakan handler baru
			/>
		</ViewWrapper>
	);
};
