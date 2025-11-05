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
// import { dataService } from "../../services/dataService"; // (Tidak digunakan langsung di sini)
import { SPRITE_PARTS } from "../../data/spriteParts"; // BARU
import { Die } from "../Die";
import { SelectionCard } from "../SelectionCard"; // Import SelectionCard

// FASE 2: Impor SSoT Data Statis dari Registry
import { 
    getAllRaces,
    getAllClasses,
    getAllBackgrounds,
    getItemDef,
    findRace,
    findClass,
    findBackground,
    RaceData, 
    ClassData, 
    BackgroundData, 
    EquipmentChoice
} from "../../data/registry";
// FASE 2: Impor utilitas AI
import { renderCharacterLayout } from "../../services/pixelRenderer";
import { generationService } from "../../services/ai/generationService";

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
	characters: Character[]; // SSoT Karakter milikku
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
// REFAKTOR FASE 2: State Wizard sekarang dikelola secara lokal.

// Helper untuk mengambil equipment default (dipindah dari appStore)
const getDefaultEquipment = (charClass: ClassData): Record<number, EquipmentChoice['options'][0]> => {
    const initialEquipment: Record<number, EquipmentChoice['options'][0]> = {};
    charClass.startingEquipment.choices.forEach((choice, index) => {
        initialEquipment[index] = choice.options[0];
    });
    return initialEquipment;
};

const CreateCharacterWizard: React.FC<{
	onCancel: () => void;
	userId: string;
    // FASE 2: Ambil prop onSaveNewCharacter (dari dataStore)
    onSaveNewCharacter: (
		charData: Omit<Character, "id" | "ownerId" | "inventory" | "knownSpells">,
		inventoryData: Omit<CharacterInventoryItem, "instanceId">[],
		spellData: SpellDefinition[]
	) => Promise<void>;
}> = ({ onCancel, userId, onSaveNewCharacter }) => {
	// FASE 2: Ambil data SSoT statis dari registry, bukan (window)
	const RACES: RaceData[] = useMemo(() => getAllRaces() || [], []);
	const CLASS_DEFINITIONS: Record<string, ClassData> = useMemo(
		() => getAllClasses() || {},
		[]
	);
	const BACKGROUNDS: BackgroundData[] = useMemo(
		() => getAllBackgrounds() || [],
		[]
	);

	// FASE 2: State sekarang lokal menggunakan useState, bukan zustand
    const [step, setStep] = useState(1);
    const [statusMessage, setStatusMessage] = useState('');
    const [name, setName] = useState('');
    const [gender, setGender] = useState<'Pria' | 'Wanita'>('Pria');
    const [hair, setHair] = useState('h_short_blond');
    const [facialHair, setFacialHair] = useState('ff_none');
    const [headAccessory, setHeadAccessory] = useState('ha_none');
    const [bodyType, setBodyType] = useState('bt_normal');
    const [scars, setScars] = useState<string[]>([]);

    // Pastikan RACES, dll. dimuat sebelum inisialisasi state
    const [selectedRace, setSelectedRace] = useState<RaceData>(() => findRace('Human') || RACES[0]);
    const [selectedClass, setSelectedClass] = useState<ClassData>(() => findClass('Fighter') || Object.values(CLASS_DEFINITIONS)[0]);
    const [abilityScores, setAbilityScores] = useState<Partial<AbilityScores>>({});
    const [selectedBackground, setSelectedBackground] = useState<BackgroundData>(() => findBackground('Acolyte') || BACKGROUNDS[0]);
    const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<Record<number, EquipmentChoice['options'][0]>>(() => getDefaultEquipment(findClass('Fighter') || Object.values(CLASS_DEFINITIONS)[0]));
    const [isSaving, setIsSaving] = useState(false);

    // Aksi Store sekarang menjadi handler lokal
    const setCharacterStep = setStep;
    const setAbilityScore = (ability: Ability, score: number) => {
        setAbilityScores(prev => ({ ...prev, [ability]: score }));
    };
    const toggleScar = (partId: string) => {
        setScars(currentScars => {
            const newScars = currentScars.includes(partId)
                ? currentScars.filter(s => s !== partId)
                : [...currentScars, partId];
            return newScars;
        });
    };
    const handleClassChange = (className: string) => {
        const newClass = CLASS_DEFINITIONS[className] || CLASS_DEFINITIONS["Fighter"];
        setSelectedClass(newClass);
        setSelectedSkills([]); // Reset skill pilihan
        setSelectedEquipment(getDefaultEquipment(newClass)); // Reset equipment pilihan
    };

	const abilitiesToRoll = useMemo(() => ALL_ABILITIES, []);
	const currentAbilityIndex = Object.keys(abilityScores).length;

	// FASE 2: Event handler sekarang memanggil state lokal
	const handleAbilityRollComplete = (ability: Ability, score: number) => {
		setAbilityScore(ability, score);
		if (currentAbilityIndex === abilitiesToRoll.length - 1) {
			setCharacterStep(3); // Lanjut ke Background
		}
	};

	// FASE 2: Logika finalizeCharacter (dari appStore) dipindahkan ke sini
	const handleSave = async () => {
        if (Object.keys(abilityScores).length !== 6) {
            alert("Selesaikan pelemparan semua dadu kemampuan.");
            return;
        }

        setIsSaving(true);
        setStatusMessage("Merakit jiwa...");

        try {
            const baseScores = abilityScores as AbilityScores;
            const finalScores = { ...baseScores };
            for (const [ability, bonus] of Object.entries(selectedRace.abilityScoreBonuses)) {
                if (typeof bonus === 'number') finalScores[ability as Ability] += bonus;
            }
            const profSkills = new Set<Skill>([
                ...selectedBackground.skillProficiencies,
                ...(selectedRace.proficiencies?.skills || []),
                ...selectedSkills,
            ]);
            const conModifier = getAbilityModifier(finalScores.constitution);
            const dexModifier = getAbilityModifier(finalScores.dexterity);
            const maxHp = selectedClass.hpAtLevel1(conModifier);
            let inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[] = [];

            selectedClass.startingEquipment.fixed.forEach(item => inventoryData.push(createInvItem(item.item, item.quantity)));
            Object.values(selectedEquipment).forEach(chosenOption => {
                chosenOption.items.forEach(itemDef => inventoryData.push(createInvItem(itemDef, chosenOption.quantity || 1)));
            });
            selectedBackground.equipment.forEach(itemName => {
                 // FASE 2: Gunakan getItemDef dari registry
                 try { inventoryData.push(createInvItem(getItemDef(itemName))); } catch (e) { console.warn(e); }
            });

            let armorClass = 10 + dexModifier;
            let equippedArmorDef: ItemDefinition | null = null;
            const armorIndex = inventoryData.findIndex(i => i.item.type === 'armor' && i.item.armorType !== 'shield');
            const shieldIndex = inventoryData.findIndex(i => i.item.name === 'Shield');
            if (armorIndex > -1) { inventoryData[armorIndex].isEquipped = true; equippedArmorDef = inventoryData[armorIndex].item; }
            if (shieldIndex > -1) { inventoryData[shieldIndex].isEquipped = true; }
            if (equippedArmorDef) {
                const baseAc = equippedArmorDef.baseAc || 10;
                if (equippedArmorDef.armorType === 'light') armorClass = baseAc + dexModifier;
                else if (equippedArmorDef.armorType === 'medium') armorClass = baseAc + Math.min(2, dexModifier);
                else if (equippedArmorDef.armorType === 'heavy') armorClass = baseAc;
            }
            if (shieldIndex > -1) armorClass += 2;

            const spellSlots = selectedClass.spellcasting?.spellSlots || [];
            const spellData: SpellDefinition[] = [
                ...(selectedClass.spellcasting?.knownCantrips || []),
                ...(selectedClass.spellcasting?.knownSpells || []),
            ];

            const newCharData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'> = {
                name, class: selectedClass.name, race: selectedRace.name, level: 1, xp: 0,
                image: selectedRace.img, // INI AKAN DI-OVERWRITE
                background: selectedBackground.name,
                gender: gender,
                bodyType: bodyType,
                scars: scars,
                hair: hair,
                facialHair: facialHair,
                headAccessory: headAccessory,
                personalityTrait: '', ideal: '', bond: '', flaw: '',
                abilityScores: finalScores, maxHp: Math.max(1, maxHp), currentHp: Math.max(1, maxHp),
                tempHp: 0, armorClass: armorClass, speed: selectedRace.speed,
                hitDice: { [selectedClass.hitDice]: { max: 1, spent: 0 } },
                deathSaves: { successes: 0, failures: 0}, conditions: [],
                racialTraits: selectedRace.traits, classFeatures: selectedClass.features,
                proficientSkills: Array.from(profSkills),
                proficientSavingThrows: selectedClass.proficiencies.savingThrows,
                spellSlots: spellSlots,
            };

            // --- PANGGILAN AI BARU ---
            // 1. Render layout pixel
            setStatusMessage("Merender layout piksel...");
            const layout = renderCharacterLayout(newCharData as Character);

            // 2. Buat prompt
            setStatusMessage("Menghubungi AI untuk visual...");
            const VISUAL_STYLE_PROMPT = "digital painting, fantasy art, detailed, high quality, vibrant colors, style of D&D 5e sourcebooks, character portrait, full body";
            // FASE 2: Ambil nama part dari SPRITE_PARTS
            const getPartName = (arr: any[], id: string) => arr.find(p => p.id === id)?.name || '';
            const prompt = `Potret HD, ${newCharData.gender} ${newCharData.race} ${newCharData.class}, ${getPartName(SPRITE_PARTS.hair, newCharData.hair)}, ${getPartName(SPRITE_PARTS.facial_feature, newCharData.facialHair)}, ${newCharData.scars.map(id => getPartName(SPRITE_PARTS.facial_feature, id)).join(', ')}, ${VISUAL_STYLE_PROMPT}`;

            // 3. Panggil AI
            const imageUrl = await generationService.stylizePixelLayout(layout, prompt, 'Sprite');

            // 4. Update gambar di data karakter
            newCharData.image = imageUrl;
            // --- AKHIR PANGGILAN AI ---

            setStatusMessage("Menyimpan ke database...");
            await onSaveNewCharacter(newCharData, inventoryData, spellData, userId);

            onCancel(); // Sukses, tutup wizard

        } catch (e) {
            console.error("Gagal finalisasi karakter:", e);
            alert("Gagal menyimpan karakter baru. Coba lagi.");
        } finally {
            setIsSaving(false);
            setStatusMessage("");
        }
	};

	const handleBack = () => {
		if (step > 1) {
			setCharacterStep(step - 1);
		} else {
			onCancel();
		}
	};

	// FASE 2: Helper untuk Pilihan Skill (Step 4)
	const handleSkillToggle = (skill: Skill) => {
        const limit = selectedClass.proficiencies.skills.choices;
        setSelectedSkills(currentSkills => {
            const newSkills = currentSkills.includes(skill)
                ? currentSkills.filter(s => s !== skill)
                : (currentSkills.length < limit ? [...currentSkills, skill] : currentSkills);

            if (newSkills.length > limit) {
                alert(`Anda hanya bisa memilih ${limit} skill.`);
                return currentSkills;
            }
            return newSkills;
        });
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

			{/* === STEP 1: Ras, Kelas, Nama & Visual === */}
			{step === 1 && (
				<div className="flex flex-col flex-grow animate-fade-in-fast">
                    {/* Grid 2 Kolom untuk Info Dasar */}
                    <div className="grid grid-cols-2 gap-x-4">
                        <div>
                            <label className="block mb-1 font-cinzel text-sm">Nama</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
                            />
                        </div>
                        <div>
                            <label className="block mb-1 font-cinzel text-sm">Jenis Kelamin</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value as 'Pria' | 'Wanita')}
                                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
                            >
                                <option value="Pria">Pria</option>
                                <option value="Wanita">Wanita</option>
                            </select>
                        </div>
                    </div>

					<label className="block mb-1 font-cinzel text-sm">Ras</label>
					<div className="grid grid-cols-5 gap-2 mb-4">
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

					{/* Grid 2 Kolom untuk Info RPG */}
                    <div className="grid grid-cols-2 gap-x-4">
                        <div>
                            <label className="block mb-1 font-cinzel text-sm">Kelas</label>
                            {/* REFAKTOR G-3: Gunakan setSelectedClass */}
                            <select
                                value={selectedClass.name}
                                onChange={(e) => handleClassChange(e.target.value)}
                                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
                            >
                                {Object.keys(CLASS_DEFINITIONS).map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 font-cinzel text-sm">Tipe Tubuh</label>
                            <select
                                value={bodyType}
                                onChange={(e) => setBodyType(e.target.value)}
                                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
                            >
                                {SPRITE_PARTS.body_type.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Grid 3 Kolom untuk Visual Kustom */}
                    <div className="grid grid-cols-3 gap-x-4">
                        <div>
                            <label className="block mb-1 font-cinzel text-sm">Rambut</label>
                            <select value={hair} onChange={e => setHair(e.target.value)} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4">
                                {SPRITE_PARTS.hair.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 font-cinzel text-sm">Fitur Wajah</label>
                            <select value={facialHair} onChange={e => setFacialHair(e.target.value)} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4">
                                {SPRITE_PARTS.facial_feature.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 font-cinzel text-sm">Aksesori Kepala</label>
                            <select value={headAccessory} onChange={e => setHeadAccessory(e.target.value)} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4">
                                {SPRITE_PARTS.head_accessory.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <label className="block mb-1 font-cinzel text-sm">Luka & Tanda</label>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {SPRITE_PARTS.facial_feature.filter(p => p.name.includes('Luka') || p.name.includes('Buta')).map(p => (
                             <label key={p.id} className={`p-2 rounded-lg cursor-pointer text-xs ${scars.includes(p.id) ? "bg-blue-600" : "bg-black/30 hover:bg-black/50"}`}>
                                <input type="checkbox" className="mr-2" checked={scars.includes(p.id)} onChange={() => toggleScar(p.id)} />
                                {p.name}
                            </label>
                        ))}
                    </div>

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
							onClick={() => setCharacterStep(3)}
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
						<button
							onClick={() => setCharacterStep(5)}
							className="font-cinzel text-gray-300 hover:text-white"
							disabled={isSaving}
						>
							&larr; Ganti Equipment
						</button>
						{/* Tampilkan Status Loading BARU */}
                        {isSaving && <p className="text-center text-amber-300 animate-pulse">{statusMessage || "Menyimpan..."}</p>}
						<button
							onClick={handleSave}
							className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500"
							disabled={isSaving}
						>
							{isSaving ? "Memproses..." : "Selesaikan"}
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
	// setCharacters DIHAPUS
	userId,
	onSaveNewCharacter,
}) => {
	// REFAKTOR G-4: myCharacters sekarang adalah prop 'characters'
	const myCharacters = characters;
	const [selectedChar, setSelectedChar] = useState<Character | null>(null);
	// FASE 2: isCreating sekarang adalah state lokal
    const [isCreating, setIsCreating] = useState(false);

	useEffect(() => {
		if (!isCreating && !selectedChar && myCharacters.length > 0) {
			setSelectedChar(myCharacters[0]);
		}
		if (myCharacters.length === 0 && !isCreating) {
			setSelectedChar(null);
			setIsCreating(true); // Paksa masuk mode create jika tidak ada karakter
		}
	}, [myCharacters, isCreating, selectedChar]);

	// FASE 2: Fungsi ini sekarang hanya sebagai prop pass-through
	const handleCreateCharacter = async (
		charData: Omit<Character, "id" | "ownerId" | "inventory" | "knownSpells">,
		inventoryData: Omit<CharacterInventoryItem, "instanceId">[],
		spellData: SpellDefinition[]
	) => {
		// Logika dipindahkan ke handleSave di dalam wizard
        // Prop onSaveNewCharacter akan diteruskan ke wizard
	};

	// FASE 2: Bungkus onClose untuk mereset state LOKAL
	const handleClose = () => {
		setIsCreating(false);
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
							// FASE 2: onCancel mereset state lokal, onSaveNewCharacter diteruskan
							<CreateCharacterWizard
								onCancel={() => setIsCreating(false)}
								userId={userId}
                                onSaveNewCharacter={onSaveNewCharacter}
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
							// FASE 2: onClick sekarang mereset state lokal
							<div
								key={char.id}
								onClick={() => {
									setSelectedChar(char);
									setIsCreating(false);
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
					{/* FASE 2: onClick sekarang memicu state lokal */}
					<button
						onClick={() => setIsCreating(true)}
						className="mt-auto w-full font-cinzel bg-blue-800/50 hover:bg-blue-700/50 py-2 rounded border border-blue-500/50"
					>
						+ Ciptakan Baru
					</button>
				</div>
			</div>
		</ModalWrapper>
	);
};
