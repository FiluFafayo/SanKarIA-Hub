// components/modals/ProfileModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { ModalWrapper } from '../ModalWrapper';
import { Character, Ability, Skill, ALL_ABILITIES, AbilityScores, InventoryItem, Spell, SpellSlot } from '../../types';
import { generateId, getAbilityModifier } from '../../utils';
import { RACES, RaceData } from '../../data/races'; // Pastikan path ini benar
import { Die } from '../Die'; // Pastikan path ini benar
import { dataService } from '../../services/dataService'; // Import dataService

// Interface Props untuk ProfileModal (sesuaikan jika perlu)
interface ProfileModalProps {
  onClose: () => void;
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  userId: string; // Tetap dibutuhkan untuk UI/filter awal, tapi tidak dikirim saat save
  createClassLoadout: (charClass: string, finalScores: AbilityScores) => {
    maxHp: number;
    hitDice: string;
    proficientSavingThrows: Ability[];
    proficientSkills: Skill[];
    armorClass: number;
    inventory: InventoryItem[];
    spellSlots: SpellSlot[];
    knownSpells: Spell[];
  };
}

// Komponen AbilityRoller (Tetap sama seperti sebelumnya)
const AbilityRoller: React.FC<{ ability: Ability; onRoll: (score: number) => void }> = ({ ability, onRoll }) => {
    const [phase, setPhase] = useState<'waiting' | 'rolling' | 'finished'>('waiting');
    const [rolls, setRolls] = useState([0, 0, 0, 0]);
    const [result, setResult] = useState(0);

    const handleRoll = () => {
        setPhase('rolling');
        const interval = setInterval(() => {
            setRolls([
                Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6),
                Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6),
            ]);
        }, 100);

        setTimeout(() => {
            clearInterval(interval);
            const finalRolls = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6));
            finalRolls.sort((a, b) => b - a); // Sort descending
            const finalResult = finalRolls[0] + finalRolls[1] + finalRolls[2]; // Sum top 3
            setRolls(finalRolls);
            setResult(finalResult);
            setPhase('finished');
            setTimeout(() => onRoll(finalResult), 2500); // Tunggu sebelum panggil onRoll
        }, 1500);
    };

    const sortedRolls = useMemo(() => [...rolls].sort((a, b) => a - b), [rolls]); // Sort ascending for display

    return (
        <div className="flex flex-col flex-grow items-center justify-center text-center p-4">
            <p className="text-lg text-blue-300">Tentukan takdir untuk...</p>
            <h3 className="font-cinzel text-5xl text-blue-100 my-4 capitalize">{ability}</h3>

            {phase !== 'finished' ? (
                 <div className="flex gap-4 my-6 h-20 items-center">
                    {[0,1,2,3].map((_, i) => (
                        <Die key={i} sides={6} value={rolls[i] > 0 ? rolls[i] : '?'} isRolling={phase === 'rolling'} size="md" status="neutral" />
                    ))}
                </div>
            ) : (
                 <div className="my-6 h-20 flex flex-col items-center">
                    <div className="flex gap-4">
                        {sortedRolls.map((r, i) => (
                            <Die key={i} sides={6} value={r} isLowest={i === 0} size="md" status="neutral" />
                        ))}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">Nilai terendah ({sortedRolls[0]}) dibuang.</p>
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
             {/* <div className="flex-grow"></div> */}
        </div>
    )
}

// Komponen CreateCharacterWizard (handleSave diupdate)
const CreateCharacterWizard: React.FC<{
    onSave: (charData: Omit<Character, 'id' | 'ownerId' | 'image'>) => void; // onSave hanya terima data inti
    onCancel: () => void;
    createClassLoadout: ProfileModalProps['createClassLoadout'];
}> = ({ onSave, onCancel, createClassLoadout }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [charClass, setCharClass] = useState('Fighter');
    const [charRace, setCharRace] = useState<RaceData>(RACES[0]);
    const [abilityScores, setAbilityScores] = useState<Partial<AbilityScores>>({});

    const abilitiesToRoll = useMemo(() => ALL_ABILITIES, []);
    const currentAbilityIndex = Object.keys(abilityScores).length;

    const handleRollComplete = (score: number) => {
        const ability = abilitiesToRoll[currentAbilityIndex];
        setAbilityScores(prev => ({...prev, [ability]: score}));
        if (currentAbilityIndex === abilitiesToRoll.length - 1) {
            setStep(3);
        }
    }

    // --- handleSave diupdate ---
    const handleSave = () => {
        if (Object.keys(abilityScores).length !== 6) {
            alert("Selesaikan pelemparan semua dadu kemampuan.");
            return;
        }

        const baseScores = abilityScores as AbilityScores;
        const finalScores = { ...baseScores };

        // Apply racial bonuses
        for (const [ability, bonus] of Object.entries(charRace.abilityScoreBonuses)) {
            // @ts-ignore memastikan bonus adalah number
            if (typeof bonus === 'number') {
                finalScores[ability as Ability] += bonus;
            }
        }

        const loadout = createClassLoadout(charClass, finalScores);

        // Data karakter inti, TANPA id, ownerId, image
        const newCharData: Omit<Character, 'id' | 'ownerId' | 'image'> = {
            name, class: charClass, race: charRace.name, level: 1,
            background: '', // Isi default jika perlu
            personalityTrait: '',
            ideal: '',
            bond: '',
            flaw: '',
            abilityScores: finalScores,
            maxHp: Math.max(1, loadout.maxHp), currentHp: Math.max(1, loadout.maxHp),
            armorClass: loadout.armorClass, speed: charRace.name === 'Dwarf' ? 25 : 30, // Contoh penyesuaian speed
            hitDice: loadout.hitDice, hitDiceSpent: 0,
            proficientSkills: loadout.proficientSkills, proficientSavingThrows: loadout.proficientSavingThrows,
            inventory: loadout.inventory, spellSlots: loadout.spellSlots, knownSpells: loadout.knownSpells,
            deathSaves: { successes: 0, failures: 0}, conditions: [],
        };

        onSave(newCharData); // Kirim data inti ke parent (ProfileModal)
    };
    // ----------------------------

    const handleBack = () => {
       if (step === 2) {
           const newScores = { ...abilityScores };
           const lastAbilityIndex = currentAbilityIndex - 1;
           if(lastAbilityIndex >= 0) {
               const lastAbility = abilitiesToRoll[lastAbilityIndex];
               delete newScores[lastAbility];
               setAbilityScores(newScores);
               // Tetap di step 2, AbilityRoller akan re-render untuk ability yang dihapus
           } else {
               setStep(1); // Kembali ke step 1 jika belum ada ability yg di-roll
           }
       } else if (step === 3) {
           setStep(2); // Kembali ke roll ability terakhir
       } else {
           onCancel(); // Batal dari step 1
       }
    }

    return (
        <div className="p-4 w-full h-full flex flex-col">
              <h3 className="font-cinzel text-2xl text-blue-200 mb-4 text-center">Ciptakan Jiwa Baru (Langkah {step}/3)</h3>

              {step === 1 && (
                  <div className="flex flex-col flex-grow">
                      <label className="block mb-1 font-cinzel text-sm">Nama</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4" />

                      <label className="block mb-1 font-cinzel text-sm">Ras</label>
                      <select value={charRace.name} onChange={e => setCharRace(RACES.find(r => r.name === e.target.value) || RACES[0])} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4">
                          {RACES.map(r => <option key={r.name}>{r.name}</option>)}
                      </select>

                      <label className="block mb-1 font-cinzel text-sm">Kelas</label>
                      <select value={charClass} onChange={e => setCharClass(e.target.value)} className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-6">
                         {['Fighter', 'Ranger', 'Barbarian', 'Cleric', 'Wizard', 'Rogue'].map(c => <option key={c}>{c}</option>)}
                      </select>
                      <div className="flex-grow"></div>
                      <div className="flex justify-between">
                          <button onClick={onCancel} className="font-cinzel text-gray-300 hover:text-white">Batal</button>
                          <button onClick={() => name.trim() && setStep(2)} disabled={!name.trim()} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500">Lanjutkan ke Ability Roll</button>
                      </div>
                  </div>
              )}

              {step === 2 && currentAbilityIndex < abilitiesToRoll.length && (
                 <AbilityRoller
                      key={abilitiesToRoll[currentAbilityIndex]} // Key penting untuk reset state roller
                      ability={abilitiesToRoll[currentAbilityIndex]}
                      onRoll={handleRollComplete}
                  />
                 // Tombol back akan otomatis ada di step 3, atau handleBack akan mengurusnya
              )}
             {/* Menampilkan score yang sudah di-roll di step 2 */}
             {step === 2 && currentAbilityIndex > 0 && (
                <div className="mt-4 text-center text-sm text-gray-400">
                    <p>Skor yang sudah didapat:</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                        {Object.entries(abilityScores).map(([ab, score]) => (
                            <span key={ab}>{ab.slice(0,3).toUpperCase()}: {score}</span>
                        ))}
                    </div>
                    {/* Tombol Back manual jika diperlukan */}
                    <button onClick={handleBack} className="mt-2 font-cinzel text-gray-300 hover:text-white text-xs">Ulangi Roll Terakhir ({abilitiesToRoll[currentAbilityIndex-1]})</button>
                </div>
             )}


              {step === 3 && (
                  <div className="flex flex-col flex-grow">
                      <p className="text-center text-lg text-gray-300 mb-4">Inilah takdirmu. Tinjau nilaimu (termasuk bonus ras).</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4 p-4 bg-black/20 rounded-lg overflow-y-auto max-h-[400px]">
                            {ALL_ABILITIES.map(ability => {
                                const score = abilityScores[ability] || 0;
                                // @ts-ignore
                                const raceBonus = charRace.abilityScoreBonuses[ability] || 0;
                                const finalScore = score + raceBonus;
                                const modifier = getAbilityModifier(finalScore);
                               return (
                                 <div key={ability} className="text-center">
                                    <p className="font-cinzel text-xl capitalize text-blue-200">{ability}</p>
                                    <p className="font-bold text-5xl">{finalScore}</p>
                                    <p className="text-sm text-gray-400">({score} + {raceBonus} Ras)</p>
                                    <p className="font-bold text-lg text-amber-300">Mod: {modifier >= 0 ? '+' : ''}{modifier}</p>
                                </div>
                               )
                            })}
                        </div>
                          <div className="flex-grow"></div>
                      <div className="flex justify-between mt-4">
                          <button onClick={handleBack} className="font-cinzel text-gray-300 hover:text-white">Kembali & Lempar Ulang</button>
                          <button onClick={handleSave} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded">Selesaikan Karakter</button>
                      </div>
                  </div>
              )}
        </div>
    );
};

// Komponen ProfileModal (handleCreateCharacter diupdate)
export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, characters, setCharacters, userId, createClassLoadout }) => {
  // `characters` di sini diasumsikan sudah difilter di App.tsx (hanya milik user)
  const myCharacters = characters;
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // State loading untuk save

  useEffect(() => {
    // Select karakter pertama jika ada dan tidak sedang membuat
    if (!isCreating && !selectedChar && myCharacters.length > 0) {
      setSelectedChar(myCharacters[0]);
    }
    // Reset selection jika tidak ada karakter atau masuk mode create
    if (myCharacters.length === 0 || isCreating) {
      setSelectedChar(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCharacters, isCreating]); // Jangan bergantung pada selectedChar agar tidak loop

  // --- handleCreateCharacter diupdate ---
  const handleCreateCharacter = async (charData: Omit<Character, 'id' | 'ownerId' | 'image'>) => {
    setIsLoading(true); // Mulai loading
    // Tambahkan ID dan gambar di sini
    const charWithIdAndImage: Omit<Character, 'ownerId'> = {
      ...charData,
      id: generateId('char'),
      image: `https://picsum.photos/seed/${generateId('charimg')}/100`, // Atau pakai generator avatar lain
    };

    try {
      // Panggil dataService.saveCharacter dengan data TANPA ownerId
      // Tipe Omit<Character, 'ownerId'> sudah sesuai dengan ekspektasi saveCharacter
      const savedChar = await dataService.saveCharacter(charWithIdAndImage);
      // Hasil dari Supabase (savedChar) sudah termasuk ownerId yang di-generate DB
      setCharacters(prev => [...prev, savedChar]); // Tambahkan karakter baru ke state global
      setSelectedChar(savedChar); // Pilih karakter yang baru dibuat
      setIsCreating(false); // Keluar dari mode create
    } catch (error) {
      console.error("Gagal menyimpan karakter baru:", error);
      alert(`Gagal menyimpan karakter: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Tetap di mode create jika gagal? Atau kembali?
    } finally {
      setIsLoading(false); // Selesai loading
    }
  };
  // ---------------------------------

  return (
    <ModalWrapper onClose={onClose} title="Cermin Jiwa">
      <div className="relative bg-gray-900/70 backdrop-blur-sm border border-blue-400/30 rounded-xl shadow-2xl w-[90vw] max-w-4xl text-white flex h-[80vh] max-h-[700px]">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-xl">
            <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-600 rounded-full animate-spin"></div>
            <p className="ml-4 text-lg">Menyimpan...</p>
          </div>
        )}

        {/* Left Panel: Mirror and Character Sheet */}
        <div className="w-2/3 p-6 flex flex-col items-center">
            <h2 className="font-cinzel text-3xl mb-4">Cermin Jiwa</h2>
            <div className="w-full h-full bg-black/30 border-2 border-blue-300/50 rounded-lg p-4 flex flex-col">
                {isCreating ? (
                    <CreateCharacterWizard
                        onSave={handleCreateCharacter}
                        onCancel={() => setIsCreating(false)}
                        createClassLoadout={createClassLoadout}
                    />
                ) : selectedChar ? (
                    <>
                    <div className="flex shrink-0 mb-4 pb-4 border-b border-blue-500/30">
                        <div className="w-1/3 flex flex-col items-center pt-4">
                            <img src={selectedChar.image.replace('/100','/400')} alt={selectedChar.name} className="w-40 h-40 rounded-full border-4 border-blue-400 shadow-lg shadow-blue-500/50" />
                            <h3 className="font-cinzel text-2xl text-blue-200 mt-4">{selectedChar.name}</h3>
                            <p className="text-lg text-gray-300">{selectedChar.race} {selectedChar.class} - Level {selectedChar.level}</p>
                            <div className="flex gap-4 mt-4 text-center">
                                <div><div className="font-bold text-xl">{selectedChar.armorClass}</div><div className="text-xs">AC</div></div>
                                <div><div className="font-bold text-xl">{selectedChar.currentHp}/{selectedChar.maxHp}</div><div className="text-xs">HP</div></div>
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
                            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs h-28 overflow-y-auto pr-2">
                                {Object.values(Skill).map(skill => {
                                    const isProficient = selectedChar.proficientSkills.includes(skill);
                                    // Hitung modifier skill (contoh, bisa dibuat fungsi util terpisah)
                                    // const ability = SKILL_ABILITY_MAP[skill];
                                    // const abilityMod = getAbilityModifier(selectedChar.abilityScores[ability]);
                                    // const profBonus = isProficient ? getProficiencyBonus(selectedChar.level) : 0;
                                    // const skillMod = abilityMod + profBonus;
                                    return <li key={skill} className={`${isProficient ? 'text-blue-300 font-bold' : 'text-gray-400'} flex justify-between`}>
                                        <span>{skill}</span>
                                        {/* <span>{skillMod >= 0 ? '+' : ''}{skillMod}</span> */}
                                    </li>
                                })}
                            </ul>
                        </div>
                    </div>
                    {/* Bagian bawah (Inventory, Spells) */}
                    <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-2 gap-4 text-xs">
                         <div>
                            <h4 className="font-cinzel text-lg text-blue-200 border-b border-blue-500/30 pb-1 mb-2">Inventory</h4>
                             {selectedChar.inventory.length > 0 ? (
                                 <ul className="space-y-1">
                                     {selectedChar.inventory.map(item => <li key={item.name}>{item.name} (x{item.quantity})</li>)}
                                 </ul>
                            ) : <p className="text-gray-400 italic">Kosong.</p>}
                        </div>
                        <div>
                           <h4 className="font-cinzel text-lg text-blue-200 border-b border-blue-500/30 pb-1 mb-2">Spells</h4>
                           {selectedChar.knownSpells.length > 0 ? (
                                <>
                                {selectedChar.spellSlots.map(slot => (
                                    <p key={slot.level} className="text-gray-400">Lvl {slot.level} Slots: {slot.max - slot.used}/{slot.max}</p>
                                ))}
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                    {selectedChar.knownSpells.map(spell => <li key={spell.name}>{spell.name} (Lvl {spell.level})</li>)}
                                </ul>
                                </>
                            ) : <p className="text-gray-400 italic">Tidak ada.</p>}
                        </div>
                    </div>
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col justify-center items-center">
                        <p className="text-gray-400">Tiada jiwa yang terpantul di cermin.</p>
                        <button onClick={() => setIsCreating(true)} className="mt-4 font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded">Ciptakan Karakter Pertamamu</button>
                    </div>
                )}
            </div>
        </div>
        {/* Right Panel: Soul Rack */}
        <div className="w-1/3 bg-black/20 border-l border-blue-400/30 p-6 flex flex-col">
            <h3 className="font-cinzel text-xl text-center mb-4">Rak Jiwa</h3>
            <div className="flex flex-wrap justify-center gap-4 mb-6 overflow-y-auto flex-grow pr-2">
                {myCharacters.length === 0 && !isCreating && (
                    <p className="text-gray-500 text-center text-sm italic mt-4">Belum ada karakter. Klik "Ciptakan Baru" untuk memulai.</p>
                )}
                {myCharacters.map(char => (
                    <div key={char.id} onClick={() => { setSelectedChar(char); setIsCreating(false); }} className={`flex flex-col items-center cursor-pointer transition-all duration-300 transform p-2 rounded-md ${selectedChar?.id === char.id && !isCreating ? 'scale-110 bg-blue-900/50' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}>
                        <img src={char.image} alt={char.name} className="w-16 h-16 rounded-full border-2 border-blue-400/50"/>
                        <p className="text-xs text-center mt-1 w-20 truncate">{char.name}</p>
                    </div>
                ))}
            </div>
             <button
                onClick={() => setIsCreating(true)}
                disabled={isCreating} // Disable jika sudah dalam mode create
                className="mt-auto w-full font-cinzel bg-blue-800/50 hover:bg-blue-700/50 py-2 rounded border border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                + Ciptakan Baru
             </button>
        </div>
      </div>
    </ModalWrapper>
  );
};