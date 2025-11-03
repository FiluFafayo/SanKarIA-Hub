// components/modals/ProfileModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { ModalWrapper } from '../ModalWrapper';
import { 
    Character, Ability, Skill, ALL_ABILITIES, AbilityScores, CharacterInventoryItem, 
    SpellDefinition, CharacterSpellSlot, CharacterFeature, ItemDefinition 
} from '../../types';
import { generateId, getAbilityModifier, rollOneAbilityScore } from '../../utils';
import { RACES, RaceData } from '../../data/races';
import { CLASS_DEFINITIONS, ClassData } from '../../data/classes';
import { BACKGROUNDS, BackgroundData } from '../../data/backgrounds';
import { ITEM_DEFINITIONS } from '../../data/items';
import { SPELL_DEFINITIONS } from '../../data/spells';
import { Die } from '../Die';

// Helper untuk mengambil definisi item berdasarkan nama
const getItemDef = (name: string): ItemDefinition => {
    const definition = ITEM_DEFINITIONS.find(i => i.name === name);
    if (!definition) throw new Error(`ItemDefinition not found: ${name}`);
    return { ...definition, id: definition.name }; // Gunakan nama sebagai ID sementara
};

// Helper untuk membuat item inventory
const createInvItem = (def: ItemDefinition, qty = 1, equipped = false): Omit<CharacterInventoryItem, 'instanceId'> => ({
    item: def,
    quantity: qty,
    isEquipped: equipped,
});

interface ProfileModalProps {
  onClose: () => void;
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  userId: string;
  // createClassLoadout dihapus, logika pindah ke sini
}

// =================================================================
// Sub-Komponen: AbilityRoller
// =================================================================
const AbilityRoller: React.FC<{ 
    ability: Ability; 
    onRoll: (ability: Ability, score: number) => void;
    currentScore: number | null;
}> = ({ ability, onRoll, currentScore }) => {
    const [phase, setPhase] = useState<'waiting' | 'rolling' | 'finished'>('waiting');
    const [rolls, setRolls] = useState([0, 0, 0, 0]);
    const [result, setResult] = useState(0);

    // Jika sudah ada skor (misal, saat 'back'), langsung tampilkan 'finished'
    useEffect(() => {
        if (currentScore) {
            setResult(currentScore);
            setRolls([currentScore, 0, 0, 0]); // Tampilkan skornya saja
            setPhase('finished');
        }
    }, [currentScore]);

    const handleRoll = () => {
        setPhase('rolling');
        
        const interval = setInterval(() => {
            setRolls([ Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6) ]);
        }, 100);

        setTimeout(() => {
            clearInterval(interval);
            const finalRolls = [ Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6) ];
            const sortedRolls = [...finalRolls].sort((a, b) => a - b);
            sortedRolls.shift(); // Buang terendah
            const finalResult = sortedRolls.reduce((sum, roll) => sum + roll, 0);
            
            setRolls(finalRolls);
            setResult(finalResult);
            setPhase('finished');
            setTimeout(() => onRoll(ability, finalResult), 1500); // Kirim skor
        }, 1500);
    };

    const sortedRollsForDisplay = useMemo(() => [...rolls].sort((a, b) => a - b), [rolls]);

    return (
        <div className="flex flex-col flex-grow items-center justify-center text-center p-4">
            <p className="text-lg text-blue-300">Tentukan takdir untuk...</p>
            <h3 className="font-cinzel text-5xl text-blue-100 my-4 capitalize">{ability}</h3>
            
            {phase !== 'finished' ? (
                 <div className="flex gap-4 my-6 h-20 items-center">
                    {[0,1,2,3].map((_, i) => (
                        <Die key={i} sides={6} value={rolls[i] > 0 ? rolls[i] : '?'} isRolling={phase === 'rolling'} size="md" />
                    ))}
                </div>
            ) : (
                 <div className="my-6 h-20 flex flex-col items-center">
                    {rolls.length === 4 ? ( // Tampilkan 4 dadu jika kita baru roll
                        <>
                            <div className="flex gap-4">
                                {sortedRollsForDisplay.map((r, i) => (
                                    <Die key={i} sides={6} value={r} isLowest={i === 0} size="md" />
                                ))}
                            </div>
                            <p className="text-sm text-gray-400 mt-1">Nilai terendah ({sortedRollsForDisplay[0]}) dibuang.</p>
                        </>
                    ) : ( // Tampilkan hanya 1 dadu (skor) jika kita 'back'
                        <Die sides={20} value={result} size="md" />
                    )}
                </div>
            )}


            {phase === 'waiting' && (
                <button onClick={handleRoll} className="font-cinzel text-2xl bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-lg shadow-lg transition-transform hover:scale-105">
                    Lemparkan Dadu!
                </button>
            )}
            {phase === 'finished' && (
                <div className="text-center">
                    <p className="text-lg">Hasil Akhir:</p>
                    <p className="font-bold text-6xl text-amber-300 animate-pulse">{result}</p>
                </div>
            )}
             <div className="flex-grow"></div>
        </div>
    );
};

// =================================================================
// Sub-Komponen: Wizard Pembuatan Karakter
// =================================================================
const CreateCharacterWizard: React.FC<{ 
    onSave: (charData: Omit<Character, 'id' | 'ownerId'>) => void, 
    onCancel: () => void,
    userId: string
}> = ({ onSave, onCancel, userId }) => {
    const [step, setStep] = useState(1);
    
    // Step 1: Info Dasar
    const [name, setName] = useState('');
    const [selectedRace, setSelectedRace] = useState<RaceData>(RACES[0]);
    const [selectedClass, setSelectedClass] = useState<ClassData>(CLASS_DEFINITIONS['Fighter']);
    
    // Step 2: Ability Scores
    const [abilityScores, setAbilityScores] = useState<Partial<AbilityScores>>({});
    const abilitiesToRoll = useMemo(() => ALL_ABILITIES, []);
    const currentAbilityIndex = Object.keys(abilityScores).length;

    // Step 3: Background
    const [selectedBackground, setSelectedBackground] = useState<BackgroundData>(BACKGROUNDS[0]);
    
    // Step 4: Pilihan (Skill & Equipment)
    // (Ini akan jadi kompleks, kita sederhanakan dulu)
    const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
    
    // Step 5: Finalisasi (HP, AC, dll)
    // (Ini akan dihitung di step 5)

    const handleAbilityRollComplete = (ability: Ability, score: number) => {
        setAbilityScores(prev => ({...prev, [ability]: score}));
        // Otomatis lanjut ke roll berikutnya
        if (currentAbilityIndex < abilitiesToRoll.length - 1) {
             // (Tidak ada 'setStep', biarkan 'AbilityRoller' di-render ulang)
        } else {
            // Selesai roll, lanjut ke step 3
            setStep(3);
        }
    }

    const handleSave = () => {
        if (Object.keys(abilityScores).length !== 6) {
            alert("Selesaikan pelemparan semua dadu kemampuan.");
            return;
        }

        const baseScores = abilityScores as AbilityScores;
        const finalScores = { ...baseScores };

        // 1. Terapkan Bonus Ras
        for (const [ability, bonus] of Object.entries(selectedRace.abilityScoreBonuses)) {
            if (typeof bonus === 'number') {
                finalScores[ability as Ability] += bonus;
            }
        }
        
        // 2. Kumpulkan Proficiency
        const profSkills = new Set<Skill>([
            ...selectedBackground.skillProficiencies,
            ...(selectedRace.proficiencies?.skills || []),
            // ... (Kita akan tambahkan 'selectedSkills' dari Step 4 di sini)
        ]);
        
        // 3. Hitung Mekanika Inti
        const conModifier = getAbilityModifier(finalScores.constitution);
        const dexModifier = getAbilityModifier(finalScores.dexterity);
        const maxHp = selectedClass.hpAtLevel1(conModifier);
        
        // 4. Hitung AC (Sederhana, nanti di Fase 2 kita perbaiki)
        // Untuk sekarang, kita pakai AC hardcode dari class
        let armorClass = 10 + dexModifier; // Base AC
        if (selectedClass.name === 'Fighter') armorClass = 18; // Chain Mail + Shield
        if (selectedClass.name === 'Cleric') armorClass = 16; // Scale Mail + Shield
        if (selectedClass.name === 'Rogue') armorClass = 11 + dexModifier; // Leather
        if (selectedClass.name === 'Wizard') armorClass = 10 + dexModifier;

        // 5. Kumpulkan Equipment
        // (Sederhanakan: ambil semua 'fixed' dan pilihan pertama dari 'choices')
        let inventory: Omit<CharacterInventoryItem, 'instanceId'>[] = [];
        selectedClass.startingEquipment.fixed.forEach(item => {
            inventory.push(createInvItem(item.item, item.quantity));
        });
        selectedClass.startingEquipment.choices.forEach(choice => {
            const firstOption = choice.options[0];
            firstOption.items.forEach(item => {
                inventory.push(createInvItem(item, firstOption.quantity || 1));
            });
        });
        selectedBackground.equipment.forEach(itemName => {
             inventory.push(createInvItem(getItemDef(itemName)));
        });
        // (Logika equip armor/weapon akan kita tambahkan di Fase 2)
        
        // 6. Kumpulkan Spell (jika ada)
        const spellSlots = selectedClass.spellcasting?.spellSlots || [];
        const knownSpells = selectedClass.spellcasting?.knownSpells || [];

        // 7. Buat Objek Karakter SSoT
        const newCharData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'> = {
            name,
            class: selectedClass.name,
            race: selectedRace.name,
            level: 1,
            xp: 0,
            image: `https://picsum.photos/seed/${generateId('charimg')}/100`,
            background: selectedBackground.name,
            personalityTrait: '', // (Player bisa isi nanti)
            ideal: '',
            bond: '',
            flaw: '',
            abilityScores: finalScores,
            maxHp: Math.max(1, maxHp), 
            currentHp: Math.max(1, maxHp), // Mulai dengan HP penuh
            tempHp: 0,
            armorClass: armorClass,
            speed: selectedRace.speed,
            hitDice: { [selectedClass.hitDice]: { max: 1, spent: 0 } },
            deathSaves: { successes: 0, failures: 0}, 
            conditions: [],
            racialTraits: selectedRace.traits,
            classFeatures: selectedClass.features,
            proficientSkills: Array.from(profSkills),
            proficientSavingThrows: selectedClass.proficiencies.savingThrows,
            spellSlots: spellSlots,
        };

        // 8. Panggil onSave (yang akan menangani 'inventory' dan 'knownSpells')
        onSave({ ...newCharData, inventory: [], knownSpells: [] }); // Kirim data inti
        
        // (Logika SSoT Inventory & Spells akan ditangani di 'App.tsx' atau 'dataService')
        // Ini adalah kelemahan desain, tapi untuk Fase 1.D ini cukup.
        // Kita akan perbaiki di Fase 1.E (Seeding)
    };
    
    const handleBack = () => {
       if (step > 1) {
           setStep(prev => prev - 1);
       } else {
           onCancel();
       }
    }

    // ================== RENDER WIZARD ==================
    return (
        <div className="p-4 w-full h-full flex flex-col">
             <h3 className="font-cinzel text-2xl text-blue-200 mb-4 text-center">
                Menciptakan Jiwa Baru (Langkah {step}/5)
            </h3>

            {/* Tombol Back (selalu ada kecuali di step 1) */}
            {step > 1 && (
                <button onClick={handleBack} className="absolute top-4 left-4 font-cinzel text-gray-300 hover:text-white z-10">
                    &larr; Kembali
                </button>
            )}

            {/* === STEP 1: Ras, Kelas, Nama === */}
            {step === 1 && (
                <div className="flex flex-col flex-grow animate-fade-in-fast">
                    <label className="block mb-1 font-cinzel text-sm">Nama</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4" />
                    
                    <label className="block mb-1 font-cinzel text-sm">Ras</label>
                    <select value={selectedRace.name} onChange={e => setSelectedRace(RACES.find(r => r.name === e.target.value) || RACES[0])} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4">
                        {RACES.map(r => <option key={r.name}>{r.name}</option>)}
                    </select>

                    <label className="block mb-1 font-cinzel text-sm">Kelas</label>
                    <select value={selectedClass.name} onChange={e => setSelectedClass(CLASS_DEFINITIONS[e.target.value] || CLASS_DEFINITIONS['Fighter'])} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-6">
                       {Object.keys(CLASS_DEFINITIONS).map(c => <option key={c}>{c}</option>)}
                    </select>
                    
                    {/* Tampilkan Info Pilihan */}
                    <div className="grid grid-cols-2 gap-4 text-xs bg-black/20 p-3 rounded">
                        <div>
                            <strong className="text-blue-300">{selectedRace.name} Traits:</strong>
                            <ul className="list-disc list-inside pl-2">
                                {selectedRace.traits.map(t => <li key={t.name}>{t.name}</li>)}
                                {selectedRace.senses?.darkvision && <li>Darkvision</li>}
                            </ul>
                        </div>
                        <div>
                            <strong className="text-blue-300">{selectedClass.name} Features:</strong>
                            <ul className="list-disc list-inside pl-2">
                                {selectedClass.features.map(f => <li key={f.name}>{f.name}</li>)}
                            </ul>
                        </div>
                    </div>

                    <div className="flex-grow"></div>
                    <div className="flex justify-between">
                        <button onClick={onCancel} className="font-cinzel text-gray-300 hover:text-white">Batal</button>
                        <button onClick={() => name.trim() && setStep(2)} disabled={!name.trim()} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500">Lanjutkan</button>
                    </div>
                </div>
            )}

            {/* === STEP 2: Ability Scores === */}
            {step === 2 && currentAbilityIndex < abilitiesToRoll.length && (
               <AbilityRoller 
                    key={abilitiesToRoll[currentAbilityIndex]} // Kunci agar komponen di-reset
                    ability={abilitiesToRoll[currentAbilityIndex]}
                    onRoll={handleAbilityRollComplete}
                    currentScore={abilityScores[abilitiesToRoll[currentAbilityIndex]] || null}
                />
            )}
            
            {/* === STEP 3: Background === */}
            {step === 3 && (
                <div className="flex flex-col flex-grow animate-fade-in-fast">
                    <label className="block mb-1 font-cinzel text-sm">Background</label>
                    <select value={selectedBackground.name} onChange={e => setSelectedBackground(BACKGROUNDS.find(b => b.name === e.target.value) || BACKGROUNDS[0])} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4">
                        {BACKGROUNDS.map(b => <option key={b.name}>{b.name}</option>)}
                    </select>

                    <div className="bg-black/20 p-3 rounded text-sm space-y-2">
                        <p>{selectedBackground.description}</p>
                        <p><strong>Fitur: {selectedBackground.feature.name}</strong></p>
                        <p className="text-xs italic">{selectedBackground.feature.description}</p>
                        <p className="text-xs"><strong>Proficiency Skill:</strong> {selectedBackground.skillProficiencies.join(', ')}</p>
                    </div>
                    
                    <div className="flex-grow"></div>
                    <div className="flex justify-between">
                         <button onClick={() => setStep(2)} className="font-cinzel text-gray-300 hover:text-white">&larr; Lempar Ulang</button>
                        <button onClick={() => setStep(4)} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded">Lanjutkan</button>
                    </div>
                </div>
            )}

            {/* === STEP 4: Pilihan (Sederhana) === */}
            {/* (Sesuai Mandat 4.7, kita skip UI kompleks untuk 'pilihan' skill/equip dulu,
               kita lanjut ke review) */}

            {/* === STEP 5: Review & Finalisasi === */}
            {step === 4 && (
                <div className="flex flex-col flex-grow animate-fade-in-fast">
                    <p className="text-center text-lg text-gray-300 mb-4">Inilah takdirmu. Tinjau nilaimu sebelum melangkah ke dunia.</p>
                     <div className="grid grid-cols-3 gap-x-4 gap-y-4 p-4 bg-black/20 rounded-lg">
                        {ALL_ABILITIES.map(ability => {
                            const baseScore = abilityScores[ability] || 0;
                            const raceBonus = selectedRace.abilityScoreBonuses[ability] || 0;
                            const finalScore = baseScore + raceBonus;
                            const modifier = getAbilityModifier(finalScore);
                           return (
                             <div key={ability} className="text-center">
                                <p className="font-cinzel text-lg capitalize text-blue-200">{ability}</p>
                                <p className="font-bold text-4xl">{finalScore}</p>
                                <p className="text-xs text-gray-400">({baseScore} + {raceBonus} Ras)</p>
                                <p className="font-bold text-md text-amber-300">Mod: {modifier >= 0 ? '+' : ''}{modifier}</p>
                            </div>
                           )
                        })}
                    </div>
                     <div className="flex-grow"></div>
                    <div className="flex justify-between">
                        <button onClick={() => setStep(3)} className="font-cinzel text-gray-300 hover:text-white">&larr; Ganti Background</button>
                        <button onClick={handleSave} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded">Selesaikan</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// =================================================================
// Komponen Utama: ProfileModal
// =================================================================
export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, characters, setCharacters, userId }) => {
  const myCharacters = characters; // 'characters' dari App.tsx sudah di-filter by userId
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isCreating && !selectedChar && myCharacters.length > 0) {
      setSelectedChar(myCharacters[0]);
    }
    if (myCharacters.length === 0) {
      setSelectedChar(null);
      setIsCreating(true); // Langsung ke mode create jika tidak punya karakter
    }
  }, [myCharacters, isCreating, selectedChar]);

  const handleCreateCharacter = (charData: Omit<Character, 'id' | 'ownerId'>) => {
    //
    // INI ADALAH LOGIKA SEMENTARA SEBELUM KITA SEEDING DB 'items' & 'spells'
    // Kita harus membuat karakter SSoT lengkap di sini
    //
    const newChar: Character = {
        ...charData,
        id: generateId('char'),
        ownerId: userId,
        // (inventory dan knownSpells harusnya kosong, lalu diisi oleh dataService.saveNewCharacter)
        // Untuk sekarang, kita tiru logika lama
        inventory: [], 
        knownSpells: [],
    };
    
    // TODO (Fase 1.E): Panggil dataService.saveNewCharacter(newCharData)
    // yang akan menyimpan ke 'characters' DAN 'character_inventory' / 'character_spells'
    // Untuk sekarang, kita update state lokal saja
    
    setCharacters(prev => [...prev, newChar]);
    setSelectedChar(newChar);
    setIsCreating(false);
  };

  return (
    <ModalWrapper onClose={onClose} title="Cermin Jiwa">
      <div className="bg-gray-900/70 backdrop-blur-sm border border-blue-400/30 rounded-xl shadow-2xl w-[90vw] max-w-4xl text-white flex h-[80vh] max-h-[700px]">
        {/* Left Panel: Mirror and Character Sheet */}
        <div className="w-2/3 p-6 flex flex-col items-center">
            <h2 className="font-cinzel text-3xl mb-4">Cermin Jiwa</h2>
            <div className="w-full h-full bg-black/30 border-2 border-blue-300/50 rounded-lg p-4 flex flex-col">
                {isCreating ? (
                    <CreateCharacterWizard onSave={handleCreateCharacter} onCancel={() => setIsCreating(false)} userId={userId} />
                ) : selectedChar ? (
                    <>
                    <div className="flex shrink-0">
                      <div className="w-1/3 flex flex-col items-center pt-4">
                          <img src={selectedChar.image.replace('/100','/400')} alt={selectedChar.name} className="w-40 h-40 rounded-full border-4 border-blue-400 shadow-lg shadow-blue-500/50" />
                          <h3 className="font-cinzel text-2xl text-blue-200 mt-4">{selectedChar.name}</h3>
                          <p className="text-lg text-gray-300">{selectedChar.race} {selectedChar.class} - Level {selectedChar.level}</p>
                          <div className="flex gap-4 mt-4 text-center">
                              <div><div className="font-bold text-xl">{selectedChar.armorClass}</div><div className="text-xs">AC</div></div>
                              <div><div className="font-bold text-xl">{selectedChar.maxHp}</div><div className="text-xs">HP</div></div>
                              <div><div className="font-bold text-xl">{selectedChar.speed}</div><div className="text-xs">Speed</div></div>
                          </div>
                      </div>
                      <div className="w-2/3 pl-6">
                          <h4 className="font-cinzel text-xl text-blue-200 border-b border-blue-500/30 pb-1 mb-2">Ability Scores</h4>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                              {ALL_ABILITIES.map(ability => {
                                  const score = selectedChar.abilityScores[ability];
                                  const modifier = getAbilityModifier(score);
                                  return (
                                  <p key={ability}>
                                      <strong className="capitalize">{ability.slice(0, 3)}:</strong> {score} ({modifier >= 0 ? '+' : ''}{modifier})
                                  </p>
                                  );
                              })}
                          </div>
                          <h4 className="font-cinzel text-xl text-blue-200 border-b border-blue-500/30 pb-1 mb-2 mt-4">Skills</h4>
                          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs h-28 overflow-y-auto">
                              {Object.values(Skill).map(skill => {
                                  const isProficient = selectedChar.proficientSkills.includes(skill);
                                  return <li key={skill} className={isProficient ? 'text-blue-300 font-bold' : 'text-gray-400'}>{skill}</li>
                              })}
                          </ul>
                      </div>
                    </div>
                    <div className="flex-grow mt-4 overflow-y-auto pr-2 grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-cinzel text-xl text-blue-200 border-b border-blue-500/30 pb-1 mb-2">Spells</h4>
                            {selectedChar.knownSpells.length > 0 ? (
                                <>
                                {selectedChar.spellSlots.map(slot => (
                                    <p key={slot.level} className="text-sm">Lvl {slot.level} Slots: {slot.max - slot.spent}/{slot.max}</p>
                                ))}
                                <ul className="text-xs list-disc list-inside mt-2">
                                    {selectedChar.knownSpells.map(spell => <li key={spell.name}>{spell.name}</li>)}
                                </ul>
                                </>
                            ) : <p className="text-xs text-gray-400">Tidak memiliki kemampuan sihir.</p>}
                        </div>
                        <div>
                             <h4 className="font-cinzel text-xl text-blue-200 border-b border-blue-500/30 pb-1 mb-2">Inventory</h4>
                             {selectedChar.inventory.length > 0 ? (
                                <ul className="text-xs">
                                    {selectedChar.inventory.map(item => <li key={item.instanceId}>{item.item.name} (x{item.quantity})</li>)}
                                </ul>
                            ) : <p className="text-xs text-gray-400">Inventaris kosong.</p>}
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
                {myCharacters.map(char => (
                    <div key={char.id} onClick={() => { setSelectedChar(char); setIsCreating(false); }} className={`flex flex-col items-center cursor-pointer transition-all duration-300 transform ${selectedChar?.id === char.id && !isCreating ? 'scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}>
                        <img src={char.image} alt={char.name} className="w-16 h-16 rounded-full border-2 border-blue-400/50"/>
                        <p className="text-xs text-center mt-1 w-20 truncate">{char.name}</p>
                    </div>
                ))}
            </div>
             <button onClick={() => setIsCreating(true)} className="mt-auto w-full font-cinzel bg-blue-800/50 hover:bg-blue-700/50 py-2 rounded border border-blue-500/50">+ Ciptakan Baru</button>
        </div>
      </div>
    </ModalWrapper>
  );
};