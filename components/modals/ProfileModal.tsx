// components/modals/ProfileModal.tsx
import React, { useState, useEffect, useMemo } from "react";
import { ModalWrapper } from "../ModalWrapper";
import {
	Character,
	Ability,
	Skill,
	ALL_ABILITIES,
	AbilityScores,
	CharacterInventoryItem,
	SpellDefinition,
	CharacterSpellSlot,
	CharacterFeature,
	ItemDefinition,
} from "../../types";
import {
	generateId,
	getAbilityModifier,
	getProficiencyBonus,
} from "../../utils";
import { dataService } from "../../services/dataService";
import { Die } from "../Die";
import { SelectionCard } from "../SelectionCard"; // Import SelectionCard
import { RaceData } from "../../data/races"; // Import Tipe Data
import { ClassData, EquipmentChoice } from "../../data/classes"; // Import Tipe Data
import { BackgroundData } from "../../data/backgrounds"; // Import Tipe Data

// Helper untuk membuat item inventory
const createInvItem = (
	def: ItemDefinition,
	qty = 1,
	equipped = false
): Omit<CharacterInventoryItem, "instanceId"> => ({
	item: def,
	quantity: qty,
	isEquipped: equipped,
});

interface ProfileModalProps {
	onClose: () => void;
	characters: Character[];
	setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
	userId: string;
	onSaveNewCharacter: (
		charData: Omit<Character, "id" | "ownerId" | "inventory" | "knownSpells">,
		inventoryData: Omit<CharacterInventoryItem, "instanceId">[],
		spellData: SpellDefinition[]
	) => Promise<void>;
}

// =================================================================
// Sub-Komponen: AbilityRoller (Tidak Berubah)
// =================================================================
const AbilityRoller: React.FC<{
	ability: Ability;
	onRoll: (ability: Ability, score: number) => void;
	currentScore: number | null;
}> = ({ ability, onRoll, currentScore }) => {
	const [phase, setPhase] = useState<"waiting" | "rolling" | "finished">(
		"waiting"
	);
	const [rolls, setRolls] = useState([0, 0, 0, 0]);
	const [result, setResult] = useState(0);

	useEffect(() => {
		if (currentScore) {
			setResult(currentScore);
			setRolls([currentScore, 0, 0, 0]);
			setPhase("finished");
		}
	}, [currentScore]);

	const handleRoll = () => {
		setPhase("rolling");

		const interval = setInterval(() => {
			setRolls([
				Math.ceil(Math.random() * 6),
				Math.ceil(Math.random() * 6),
				Math.ceil(Math.random() * 6),
				Math.ceil(Math.random() * 6),
			]);
		}, 100);

		setTimeout(() => {
			clearInterval(interval);
			const finalRolls = [
				Math.ceil(Math.random() * 6),
				Math.ceil(Math.random() * 6),
				Math.ceil(Math.random() * 6),
				Math.ceil(Math.random() * 6),
			];
			const sortedRolls = [...finalRolls].sort((a, b) => a - b);
			sortedRolls.shift();
			const finalResult = sortedRolls.reduce((sum, roll) => sum + roll, 0);

			setRolls(finalRolls);
			setResult(finalResult);
			setPhase("finished");
			setTimeout(() => onRoll(ability, finalResult), 1500);
		}, 1500);
	};

	const sortedRollsForDisplay = useMemo(
		() => [...rolls].sort((a, b) => a - b),
		[rolls]
	);

	return (
		<div className="flex flex-col flex-grow items-center justify-center text-center p-4">
			<p className="text-lg text-blue-300">Tentukan takdir untuk...</p>
			<h3 className="font-cinzel text-5xl text-blue-100 my-4 capitalize">
				{ability}
			</h3>

			{phase !== "finished" ? (
				<div className="flex gap-4 my-6 h-20 items-center">
					{[0, 1, 2, 3].map((_, i) => (
						<Die
							key={i}
							sides={6}
							value={rolls[i] > 0 ? rolls[i] : "?"}
							isRolling={phase === "rolling"}
							size="md"
						/>
					))}
				</div>
			) : (
				<div className="my-6 h-20 flex flex-col items-center">
					{rolls.length === 4 ? (
						<>
							<div className="flex gap-4">
								{sortedRollsForDisplay.map((r, i) => (
									<Die
										key={i}
										sides={6}
										value={r}
										isLowest={i === 0}
										size="md"
									/>
								))}
							</div>
							<p className="text-sm text-gray-400 mt-1">
								Nilai terendah ({sortedRollsForDisplay[0]}) dibuang.
							</p>
						</>
					) : (
						<Die sides={20} value={result} size="md" />
					)}
				</div>
			)}

			{phase === "waiting" && (
				<button
					onClick={handleRoll}
					className="font-cinzel text-2xl bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-lg shadow-lg transition-transform hover:scale-105"
				>
					Lemparkan Dadu!
				</button>
			)}
			{phase === "finished" && (
				<div className="text-center">
					<p className="text-lg">Hasil Akhir:</p>
					<p className="font-bold text-6xl text-amber-300 animate-pulse">
						{result}
					</p>
				</div>
			)}
			<div className="flex-grow"></div>
		</div>
	);
};

// =================================================================
// Sub-Komponen: Wizard Pembuatan Karakter (REFAKTORISASI BESAR)
// =================================================================
// REFAKTOR G-3: Seluruh state lokal wizard dipindah ke zustand
// Logika handleSave juga dipindah ke store (finalizeCharacter)

const CreateCharacterWizard: React.FC<{
	onSave: (
		charData: Omit<Character, "id" | "ownerId" | "inventory" | "knownSpells">,
		inventoryData: Omit<CharacterInventoryItem, "instanceId">[],
		spellData: SpellDefinition[]
	) => Promise<void>;
	onCancel: () => void;
	userId: string;
}> = ({ onSave, onCancel, userId }) => {
	// Ambil data SSoT statis (RACES, CLASSES, BACKGROUNDS) dari global (dimuat di App.tsx)
	const RACES: RaceData[] = useMemo(() => (window as any).RACES_DATA || [], []);
	const CLASS_DEFINITIONS: Record<string, ClassData> = useMemo(
		() => (window as any).CLASS_DEFINITIONS_DATA || {},
		[]
	);
	const BACKGROUNDS: BackgroundData[] = useMemo(
		() => (window as any).BACKGROUNDS_DATA || [],
		[]
	);

	// REFAKTOR G-3: Ambil state dari Zustand Store
	const {
		step,
		name,
		selectedRace,
		selectedClass,
		abilityScores,
		selectedBackground,
		selectedSkills,
		selectedEquipment,
		isSaving,
		setCharacterStep,
		setName,
		setSelectedRace,
		setSelectedClass,
		setAbilityScore,
		toggleSkill,
		setSelectedEquipment,
		resetCharacterCreation,
		finalizeCharacter,
	} = useCreationStore((s) => ({
		...s.characterCreation,
		...s.actions,
	}));

	const abilitiesToRoll = useMemo(() => ALL_ABILITIES, []);
	const currentAbilityIndex = Object.keys(abilityScores).length;

	// REFAKTOR G-3: Event handler sekarang memanggil aksi store
	const handleAbilityRollComplete = (ability: Ability, score: number) => {
		setAbilityScore(ability, score);
		if (currentAbilityIndex === abilitiesToRoll.length - 1) {
			setCharacterStep(3); // Lanjut ke Background
		}
	};

	// REFAKTOR G-3: handleSave sekarang hanya delegasi ke store
	const handleSave = async () => {
		await finalizeCharacter(userId, onSave);
	};

	const handleBack = () => {
		if (step > 1) {
			setCharacterStep(step - 1);
		} else {
			onCancel(); // Ini akan memanggil resetCharacterCreation dari parent
		}
	};

	// REFAKTOR G-3: Helper untuk Pilihan Skill (Step 4)
	const handleSkillToggle = (skill: Skill) => {
		// Logika limit sekarang ada di dalam aksi 'toggleSkill' di store
		toggleSkill(skill);
	};

	// REFAKTOR G-3: Helper untuk Pilihan Equipment (Step 5)
	const handleEquipmentSelect = (choiceIndex: number, optionIndex: number) => {
		const choice = selectedClass.startingEquipment.choices[choiceIndex];
		const selectedOption = choice.options[optionIndex];
		setSelectedEquipment(choiceIndex, selectedOption);
	};

	// ================== RENDER WIZARD ==================
	return (
		<div className="p-4 w-full h-full flex flex-col">
			<h3 className="font-cinzel text-2xl text-blue-200 mb-4 text-center">
				Menciptakan Jiwa Baru (Langkah {step}/6)
			</h3>

			{step > 1 && (
				<button
					onClick={handleBack}
					className="absolute top-4 left-4 font-cinzel text-gray-300 hover:text-white z-10"
				>
					&larr; Kembali
				</button>
			)}

			{/* === STEP 1: Ras, Kelas, Nama === */}
			{step === 1 && (
				<div className="flex flex-col flex-grow animate-fade-in-fast">
					<label className="block mb-1 font-cinzel text-sm">Nama</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
					/>

					<label className="block mb-1 font-cinzel text-sm">Ras</label>
					<div className="grid grid-cols-3 gap-2 mb-4">
						{RACES.map((r) => (
							<SelectionCard
								key={r.name}
								title={r.name}
								imageUrl={r.img}
								isSelected={selectedRace.name === r.name}
								onClick={() => setSelectedRace(r)}
							/>
						))}
					</div>

					<label className="block mb-1 font-cinzel text-sm">Kelas</label>
					{/* REFAKTOR G-3: Gunakan setSelectedClass */}
					<select
						value={selectedClass.name}
						onChange={(e) =>
							setSelectedClass(
								CLASS_DEFINITIONS[e.target.value] ||
									CLASS_DEFINITIONS["Fighter"]
							)
						}
						className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
					>
						{Object.keys(CLASS_DEFINITIONS).map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>

					<div className="text-xs bg-black/20 p-3 rounded">
						<p>{selectedClass.description}</p>
						<p className="mt-2">
							<strong>Proficiency:</strong>{" "}
							{selectedClass.proficiencies.armor.join(", ") || "None"},{" "}
							{selectedClass.proficiencies.weapons.join(", ")}.
						</p>
						<p>
							<strong>Saving Throw:</strong>{" "}
							{selectedClass.proficiencies.savingThrows.join(", ")}.
						</p>
					</div>

					<div className="flex-grow"></div>
					<div className="flex justify-between">
						<button
							onClick={onCancel}
							className="font-cinzel text-gray-300 hover:text-white"
						>
							Batal
						</button>
						{/* REFAKTOR G-3: Gunakan setCharacterStep */}
						<button
							onClick={() => name.trim() && setCharacterStep(2)}
							disabled={!name.trim()}
							className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500"
						>
							Lanjutkan
						</button>
					</div>
				</div>
			)}

			{/* === STEP 2: Ability Scores === */}
			{step === 2 && currentAbilityIndex < abilitiesToRoll.length && (
				<AbilityRoller
					key={abilitiesToRoll[currentAbilityIndex]}
					ability={abilitiesToRoll[currentAbilityIndex]}
					onRoll={handleAbilityRollComplete}
					currentScore={
						abilityScores[abilitiesToRoll[currentAbilityIndex]] || null
					}
				/>
			)}

			{/* === STEP 3: Background === */}
			{step === 3 && (
				<div className="flex flex-col flex-grow animate-fade-in-fast">
					<label className="block mb-1 font-cinzel text-sm">Background</label>
					<div className="grid grid-cols-3 gap-2 mb-4 max-h-80 overflow-y-auto">
						{BACKGROUNDS.map((b) => (
							<SelectionCard
								key={b.name}
								title={b.name}
								imageUrl={`https://picsum.photos/seed/${b.name.toLowerCase()}/200`}
								isSelected={selectedBackground.name === b.name}
								// REFAKTOR G-3: Gunakan setSelectedBackground
								onClick={() => setSelectedBackground(b)}
							/>
						))}
					</div>

					<div className="bg-black/20 p-3 rounded text-sm space-y-2">
						<p>{selectedBackground.description}</p>
						<p>
							<strong>Fitur: {selectedBackground.feature.name}</strong>
						</p>
						<p className="text-xs italic">
							{selectedBackground.feature.description}
						</p>
						<p className="text-xs">
							<strong>Proficiency Skill:</strong>{" "}
							{selectedBackground.skillProficiencies.join(", ")}
						</p>
					</div>

					<div className="flex-grow"></div>
					<div className="flex justify-between">
						{/* REFAKTOR G-3: Gunakan setCharacterStep */}
						<button
							onClick={() => setCharacterStep(2)}
							className="font-cinzel text-gray-300 hover:text-white"
						>
							&larr; Lempar Ulang
						</button>
						<button
							onClick={() => setCharacterStep(4)}
							className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded"
						>
							Lanjutkan
						</button>
					</div>
				</div>
			)}

			{/* === STEP 4: Pilihan Skill (BARU) === */}
			{step === 4 && (
				<div className="flex flex-col flex-grow animate-fade-in-fast">
					<h4 className="font-cinzel text-xl text-blue-200 mb-2">
						Pilihan Skill Kelas
					</h4>
					<p className="text-sm mb-4">
						Sebagai {selectedClass.name}, pilih{" "}
						<strong>{selectedClass.proficiencies.skills.choices}</strong> skill
						berikut:
					</p>
					<div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
						{selectedClass.proficiencies.skills.options.map((skill) => (
							<label
								key={skill}
								className={`p-3 rounded-lg cursor-pointer ${
									selectedSkills.includes(skill)
										? "bg-blue-600"
										: "bg-black/30 hover:bg-black/50"
								}`}
							>
								<input
									type="checkbox"
									className="mr-2"
									checked={selectedSkills.includes(skill)}
									onChange={() => handleSkillToggle(skill)}
								/>
								{skill}
							</label>
						))}
					</div>
					<div className="flex-grow"></div>
					<div className="flex justify-between">
						<button
							onClick={() => setStep(3)}
							className="font-cinzel text-gray-300 hover:text-white"
						>
							&larr; Ganti Background
						</button>
						<button
							onClick={() => setStep(5)}
							disabled={
								selectedSkills.length !==
								selectedClass.proficiencies.skills.choices
							}
							className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500"
						>
							Lanjutkan
						</button>
					</div>
				</div>
			)}

			{/* === STEP 5: Pilihan Equipment (BARU) === */}
			{step === 5 && (
				<div className="flex flex-col flex-grow animate-fade-in-fast">
					<h4 className="font-cinzel text-xl text-blue-200 mb-2">
						Pilihan Equipment
					</h4>
					<p className="text-sm mb-4">Pilih equipment awal Anda:</p>
					<div className="space-y-4 max-h-72 overflow-y-auto pr-2">
						{selectedClass.startingEquipment.choices.map(
							(choice, choiceIndex) => (
								<div key={choiceIndex}>
									<label className="block mb-1 text-sm text-gray-300">
										{choice.description}
									</label>
									<select
										value={choice.options.findIndex(
											(opt) => opt.name === selectedEquipment[choiceIndex]?.name
										)}
										onChange={(e) =>
											handleEquipmentSelect(
												choiceIndex,
												parseInt(e.target.value, 10)
											)
										}
										className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1"
									>
										{choice.options.map((option, optionIndex) => (
											<option key={option.name} value={optionIndex}>
												{option.name}
											</option>
										))}
									</select>
								</div>
							)
						)}
					</div>
					<div className="flex-grow"></div>
					<div className="flex justify-between">
						{/* REFAKTOR G-3: Gunakan setCharacterStep */}
						<button
							onClick={() => setCharacterStep(4)}
							className="font-cinzel text-gray-300 hover:text-white"
						>
							&larr; Ganti Skill
						</button>
						<button
							onClick={() => setCharacterStep(6)}
							className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded"
						>
							Lanjutkan
						</button>
					</div>
				</div>
			)}

			{/* === STEP 6: Review & Finalisasi (Dulu Step 4) === */}
			{step === 6 && (
				<div className="flex flex-col flex-grow animate-fade-in-fast">
					<p className="text-center text-lg text-gray-300 mb-4">
						Inilah takdirmu. Tinjau nilaimu sebelum melangkah ke dunia.
					</p>
					<div className="grid grid-cols-3 gap-x-4 gap-y-4 p-4 bg-black/20 rounded-lg">
						{ALL_ABILITIES.map((ability) => {
							const baseScore = abilityScores[ability] || 0;
							const raceBonus = selectedRace.abilityScoreBonuses[ability] || 0;
							const finalScore = baseScore + raceBonus;
							const modifier = getAbilityModifier(finalScore);
							return (
								<div key={ability} className="text-center">
									<p className="font-cinzel text-lg capitalize text-blue-200">
										{ability}
									</p>
									<p className="font-bold text-4xl">{finalScore}</p>
									<p className="text-xs text-gray-400">
										({baseScore} + {raceBonus} Ras)
									</p>
									<p className="font-bold text-md text-amber-300">
										Mod: {modifier >= 0 ? "+" : ""}
										{modifier}
									</p>
								</div>
							);
						})}
					</div>
					<div className="flex-grow"></div>
					<div className="flex justify-between">
						{/* REFAKTOR G-3: Gunakan setCharacterStep */}
						<button
							onClick={() => setCharacterStep(5)}
							className="font-cinzel text-gray-300 hover:text-white"
							disabled={isSaving}
						>
							&larr; Ganti Equipment
						</button>
						<button
							onClick={handleSave}
							className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500"
							disabled={isSaving}
						>
							{isSaving ? "Menyimpan..." : "Selesaikan"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

// =================================================================
// Komponen Utama: ProfileModal (Tidak Berubah)
// =================================================================
export const ProfileModal: React.FC<ProfileModalProps> = ({
	onClose,
	characters,
	setCharacters,
	userId,
	onSaveNewCharacter,
}) => {
	const myCharacters = characters;
	const [selectedChar, setSelectedChar] = useState<Character | null>(null);
	// REFAKTOR G-3: 'isCreating' sekarang dikontrol oleh state 'step' di store
	const isCreating = useCreationStore((s) => s.characterCreation.step > 0);
	// Ambil aksi reset
	const resetCharacterCreation = useCreationStore(
		(s) => s.actions.resetCharacterCreation
	);
	const setCharacterStep = useCreationStore((s) => s.actions.setCharacterStep);

	useEffect(() => {
		if (!isCreating && !selectedChar && myCharacters.length > 0) {
			setSelectedChar(myCharacters[0]);
		}
		if (myCharacters.length === 0 && !isCreating) {
			setSelectedChar(null);
			setCharacterStep(1); // Paksa masuk mode create jika tidak ada karakter
		}
	}, [myCharacters, isCreating, selectedChar, setCharacterStep]);

	const handleCreateCharacter = async (
		charData: Omit<Character, "id" | "ownerId" | "inventory" | "knownSpells">,
		inventoryData: Omit<CharacterInventoryItem, "instanceId">[],
		spellData: SpellDefinition[]
	) => {
		try {
			await onSaveNewCharacter(charData, inventoryData, spellData);
			// Reset state G-3 di-handle oleh finalizeCharacter di store
			// setIsCreating(false); // (Tidak perlu lagi)
		} catch (e) {
			// Error di-handle di wizard
		}
	};

	// REFAKTOR G-3: Bungkus onClose untuk mereset state
	const handleClose = () => {
		resetCharacterCreation();
		onClose();
	};

	return (
		<ModalWrapper onClose={handleClose} title="Cermin Jiwa">
			<div className="bg-gray-900/70 backdrop-blur-sm border border-blue-400/30 rounded-xl shadow-2xl w-[90vw] max-w-4xl text-white flex h-[80vh] max-h-[700px]">
				{/* Left Panel: Mirror and Character Sheet */}
				<div className="w-2/3 p-6 flex flex-col items-center">
					<h2 className="font-cinzel text-3xl mb-4">Cermin Jiwa</h2>
					<div className="w-full h-full bg-black/30 border-2 border-blue-300/50 rounded-lg p-4 flex flex-col">
						{isCreating ? (
							// REFAKTOR G-3: onCancel sekarang mereset store
							<CreateCharacterWizard
								onSave={handleCreateCharacter}
								onCancel={() => resetCharacterCreation()}
								userId={userId}
							/>
						) : selectedChar ? (
							<>
								<div className="flex shrink-0">
									<div className="w-1/3 flex flex-col items-center pt-4">
										<img
											src={selectedChar.image.replace("/100", "/400")}
											alt={selectedChar.name}
											className="w-40 h-40 rounded-full border-4 border-blue-400 shadow-lg shadow-blue-500/50"
										/>
										<h3 className="font-cinzel text-2xl text-blue-200 mt-4">
											{selectedChar.name}
										</h3>
										<p className="text-lg text-gray-300">
											{selectedChar.race} {selectedChar.class} - Level{" "}
											{selectedChar.level}
										</p>
										<div className="flex gap-4 mt-4 text-center">
											<div>
												<div className="font-bold text-xl">
													{selectedChar.armorClass}
												</div>
												<div className="text-xs">AC</div>
											</div>
											<div>
												<div className="font-bold text-xl">
													{selectedChar.maxHp}
												</div>
												<div className="text-xs">HP</div>
											</div>
											<div>
												<div className="font-bold text-xl">
													{selectedChar.speed}
												</div>
												<div className="text-xs">Speed</div>
											</div>
										</div>
									</div>
									<div className="w-2/3 pl-6">
										<h4 className="font-cinzel text-xl text-blue-200 border-b border-blue-500/30 pb-1 mb-2">
											Ability Scores
										</h4>
										<div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
											{ALL_ABILITIES.map((ability) => {
												const score = selectedChar.abilityScores[ability];
												const modifier = getAbilityModifier(score);
												return (
													<p key={ability}>
														<strong className="capitalize">
															{ability.slice(0, 3)}:
														</strong>{" "}
														{score} ({modifier >= 0 ? "+" : ""}
														{modifier})
													</p>
												);
											})}
										</div>
										<h4 className="font-cinzel text-xl text-blue-200 border-b border-blue-500/30 pb-1 mb-2 mt-4">
											Skills
										</h4>
										<ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs h-28 overflow-y-auto">
											{Object.values(Skill).map((skill) => {
												const isProficient =
													selectedChar.proficientSkills.includes(skill);
												return (
													<li
														key={skill}
														className={
															isProficient
																? "text-blue-300 font-bold"
																: "text-gray-400"
														}
													>
														{skill}
													</li>
												);
											})}
										</ul>
									</div>
								</div>
								<div className="flex-grow mt-4 overflow-y-auto pr-2 grid grid-cols-2 gap-4">
									<div>
										<h4 className="font-cinzel text-xl text-blue-200 border-b border-blue-500/30 pb-1 mb-2">
											Spells
										</h4>
										{selectedChar.knownSpells.length > 0 ? (
											<>
												{selectedChar.spellSlots.map((slot) => (
													<p key={slot.level} className="text-sm">
														Lvl {slot.level} Slots: {slot.max - slot.spent}/
														{slot.max}
													</p>
												))}
												<ul className="text-xs list-disc list-inside mt-2">
													{selectedChar.knownSpells.map((spell) => (
														<li key={spell.name}>
															{spell.name} (Lvl {spell.level})
														</li>
													))}
												</ul>
											</>
										) : (
											<p className="text-xs text-gray-400">
												Tidak memiliki kemampuan sihir.
											</p>
										)}
									</div>
									<div>
										<h4 className="font-cinzel text-xl text-blue-200 border-b border-blue-500/30 pb-1 mb-2">
											Inventory
										</h4>
										{selectedChar.inventory.length > 0 ? (
											<ul className="text-xs">
												{selectedChar.inventory.map((item) => (
													<li key={item.instanceId}>
														{item.item.name} (x{item.quantity}){" "}
														{item.isEquipped ? "[E]" : ""}
													</li>
												))}
											</ul>
										) : (
											<p className="text-xs text-gray-400">
												Inventaris kosong.
											</p>
										)}
									</div>
								</div>
							</>
						) : (
							<div className="w-full h-full flex flex-col justify-center items-center">
								<p className="text-gray-400">Paksa ke mode 'create'...</p>
							</div>
						)}
					</div>
				</div>
				{/* Right Panel: Soul Rack */}
				<div className="w-1/3 bg-black/20 border-l border-blue-400/30 p-6 flex flex-col">
					<h3 className="font-cinzel text-xl text-center mb-4">Rak Jiwa</h3>
					<div className="flex flex-wrap justify-center gap-4 mb-6 overflow-y-auto">
						{myCharacters.map((char) => (
							// REFAKTOR G-3: onClick sekarang mereset store
							<div
								key={char.id}
								onClick={() => {
									setSelectedChar(char);
									resetCharacterCreation();
								}}
								className={`flex flex-col items-center cursor-pointer transition-all duration-300 transform ${
									selectedChar?.id === char.id && !isCreating
										? "scale-110"
										: "opacity-60 hover:opacity-100 hover:scale-105"
								}`}
							>
								<img
									src={char.image}
									alt={char.name}
									className="w-16 h-16 rounded-full border-2 border-blue-400/50"
								/>
								<p className="text-xs text-center mt-1 w-20 truncate">
									{char.name}
								</p>
							</div>
						))}
					</div>
					{/* REFAKTOR G-3: onClick sekarang memicu store */}
					<button
						onClick={() => setCharacterStep(1)}
						className="mt-auto w-full font-cinzel bg-blue-800/50 hover:bg-blue-700/50 py-2 rounded border border-blue-500/50"
					>
						+ Ciptakan Baru
					</button>
				</div>
			</div>
		</ModalWrapper>
	);
};
