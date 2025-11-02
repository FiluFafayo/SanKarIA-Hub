import React, { useState, useEffect, useMemo } from 'react';
import { ModalWrapper } from '../ModalWrapper';
import { Character, Ability, Skill, ALL_ABILITIES, AbilityScores, InventoryItem, Spell, SpellSlot } from '../../types';
import { generateId, getAbilityModifier } from '../../utils';
import { RACES, RaceData } from '../../data/races';
import { Die } from '../Die';

interface ProfileModalProps {
  onClose: () => void;
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  userId: string;
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

const AbilityRoller: React.FC<{ ability: Ability; onRoll: (score: number) => void }> = ({ ability, onRoll }) => {
    const [phase, setPhase] = useState<'waiting' | 'rolling' | 'finished'>('waiting');
    const [rolls, setRolls] = useState([0, 0, 0, 0]);
    const [result, setResult] = useState(0);

    const handleRoll = () => {
        setPhase('rolling');
        
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
            finalRolls.sort((a, b) => b - a); // Sort descending to easily find lowest
            const finalResult = finalRolls[0] + finalRolls[1] + finalRolls[2];
            setRolls(finalRolls);
            setResult(finalResult);
            setPhase('finished');
            setTimeout(() => onRoll(finalResult), 2500);
        }, 1500);
    };

    const sortedRolls = useMemo(() => [...rolls].sort((a, b) => a - b), [rolls]);

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
                    <div className="flex gap-4">
                        {sortedRolls.map((r, i) => (
                            <Die key={i} sides={6} value={r} isLowest={i === 0} size="md" />
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
             <div className="flex-grow"></div>
        </div>
    )
}


const CreateCharacterWizard: React.FC<{ onSave: (char: Omit<Character, 'id' | 'ownerId' | 'image'>) => void, onCancel: () => void, createClassLoadout: ProfileModalProps['createClassLoadout'] }> = ({ onSave, onCancel, createClassLoadout }) => {
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
        // If it's the last ability, move to review step
        if (currentAbilityIndex === abilitiesToRoll.length - 1) {
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

        // Apply racial bonuses
        for (const [ability, bonus] of Object.entries(charRace.abilityScoreBonuses)) {
            if (typeof bonus === 'number') {
                finalScores[ability as Ability] += bonus;
            }
        }
        
        const loadout = createClassLoadout(charClass, finalScores);

        const newCharData: Omit<Character, 'id' | 'ownerId' | 'image'> = {
            name, class: charClass, race: charRace.name, level: 1, 
            background: '',
            personalityTrait: '',
            ideal: '',
            bond: '',
            flaw: '',
            abilityScores: finalScores,
            maxHp: Math.max(1, loadout.maxHp), currentHp: Math.max(1, loadout.maxHp),
            armorClass: loadout.armorClass, speed: 30, hitDice: loadout.hitDice, hitDiceSpent: 0,
            proficientSkills: loadout.proficientSkills, proficientSavingThrows: loadout.proficientSavingThrows, 
            inventory: loadout.inventory, spellSlots: loadout.spellSlots, knownSpells: loadout.knownSpells,
            deathSaves: { successes: 0, failures: 0}, conditions: [],
        };
        onSave(newCharData);
    };
    
    const handleBack = () => {
       if (step === 2) {
           const newScores = { ...abilityScores };
           const lastAbility = abilitiesToRoll[currentAbilityIndex - 1];
           if(lastAbility) {
               delete newScores[lastAbility];
               setAbilityScores(newScores);
           } else {
               setStep(1);
           }
       } else if (step === 3) {
           setStep(2)
       } else {
           onCancel();
       }
    }


    return (
        <div className="p-4 w-full h-full flex flex-col">
             <h3 className="font-cinzel text-2xl text-blue-200 mb-4 text-center">Ciptakan Jiwa Baru</h3>

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
                        <button onClick={() => name.trim() && setStep(2)} disabled={!name.trim()} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500">Lanjutkan</button>
                    </div>
                </div>
            )}

            {step === 2 && currentAbilityIndex < abilitiesToRoll.length && (
               <AbilityRoller 
                    key={abilitiesToRoll[currentAbilityIndex]} // FIX: Add key to force re-mount and reset state
                    ability={abilitiesToRoll[currentAbilityIndex]}
                    onRoll={handleRollComplete}
                />
            )}
            
            {step === 3 && (
                <div className="flex flex-col flex-grow">
                    <p className="text-center text-lg text-gray-300 mb-4">Inilah takdirmu. Tinjau nilaimu sebelum melangkah ke dunia.</p>
                     <div className="grid grid-cols-2 gap-x-8 gap-y-4 p-4 bg-black/20 rounded-lg">
                        {ALL_ABILITIES.map(ability => {
                            const score = abilityScores[ability] || 0;
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
                    <div className="flex justify-between">
                        <button onClick={() => setStep(2)} className="font-cinzel text-gray-300 hover:text-white">Kembali & Lempar Ulang</button>
                        <button onClick={handleSave} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded">Selesaikan</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, characters, setCharacters, userId, createClassLoadout }) => {
  const myCharacters = characters.filter(c => c.ownerId === userId);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isCreating && !selectedChar && myCharacters.length > 0) {
      setSelectedChar(myCharacters[0]);
    }
    if (myCharacters.length === 0) {
      setSelectedChar(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters, userId, isCreating]);

  const handleCreateCharacter = (charData: Omit<Character, 'id' | 'ownerId' | 'image'>) => {
    const newChar: Character = {
        ...charData,
        id: generateId('char'),
        ownerId: userId,
        image: `https://picsum.photos/seed/${generateId('charimg')}/100`,
    };
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
                    <CreateCharacterWizard onSave={handleCreateCharacter} onCancel={() => setIsCreating(false)} createClassLoadout={createClassLoadout}/>
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
                                    <p key={slot.level} className="text-sm">Lvl {slot.level} Slots: {slot.max - slot.used}/{slot.max}</p>
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
                                    {selectedChar.inventory.map(item => <li key={item.name}>{item.name} (x{item.quantity})</li>)}
                                </ul>
                            ) : <p className="text-xs text-gray-400">Inventaris kosong.</p>}
                        </div>
                    </div>
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col justify-center items-center">
                        <p className="text-gray-400">Tiada jiwa yang terpantul di cermin.</p>
                        <button onClick={() => setIsCreating(true)} className="mt-4 font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded">Ciptakan Karakter pertamamu</button>
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