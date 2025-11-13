// components/nexus/CharacterWizard.tsx
import React, { useState } from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { RACES, RaceData } from '../../data/races';
import { BACKGROUNDS } from '../../data/backgrounds';
import { useAppStore } from '../../store/appStore';
import { characterRepository } from '../../services/repository/characterRepository';
import { Character, Ability, ALL_ABILITIES, AbilityScores } from '../../types';
import { calculateNewCharacterFromWizard } from '../../services/rulesEngine';
import { getStaticAvatar, getAbilityModifier } from '../../utils';
import { Skill, SpellDefinition, CharacterInventoryItem, EquipmentChoice } from '../../types';
import { findClass, findSpell, getItemDef, getAllClasses } from '../../data/registry';

// Helper untuk Inventory
const createInvItem = (name: string, qty = 1, equipped = false) => {
  try {
    const def = getItemDef(name);
    return { item: def, quantity: qty, isEquipped: equipped };
  } catch (e) { return null; }
};

interface CharacterWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = 'NAME' | 'RACE' | 'CLASS' | 'BACKGROUND' | 'EQUIPMENT' | 'STATS';
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const CharacterWizard: React.FC<CharacterWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<WizardStep>('NAME');
  const [selectedRaceData, setSelectedRaceData] = useState<RaceData | null>(null);
  
  // State Baru untuk Logika 5e
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [selectedSpells, setSelectedSpells] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Record<number, EquipmentChoice['options'][0]>>({});
  
  const [formData, setFormData] = useState({
    name: '',
    gender: 'Pria',
    raceId: '',
    classId: '',
    backgroundName: '',
    abilityScores: {} as Partial<AbilityScores>,
  });

  // Helper: Toggle Skill
  const toggleSkill = (skill: Skill, max: number) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(prev => prev.filter(s => s !== skill));
    } else {
      if (selectedSkills.length < max) setSelectedSkills(prev => [...prev, skill]);
    }
  };

  // Helper: Toggle Spell
  const toggleSpell = (spellName: string, max: number) => {
    if (selectedSpells.includes(spellName)) {
      setSelectedSpells(prev => prev.filter(s => s !== spellName));
    } else {
      if (selectedSpells.length < max) setSelectedSpells(prev => [...prev, spellName]);
    }
  };

  // Helper: Get Item Details for UI
  const getItemDetails = (name: string) => {
    try {
      const def = getItemDef(name);
      if (!def) return "";
      const parts = [];
      if (def.type === 'armor') parts.push(`AC ${def.baseAc}`);
      if (def.type === 'weapon') parts.push(`${def.damageDice} ${def.damageType}`);
      if (def.description) parts.push(def.description.substring(0, 20) + (def.description.length > 20 ? '...' : '')); 
      return parts.length > 0 ? `(${parts.join(', ')})` : "";
    } catch (e) { return ""; }
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAppStore();

  const handleCreate = async () => {
    if (!user) return;

    // Fix: Gunakan properti 'name' untuk pencarian karena 'id' tidak eksis di definisi Race
    const raceName = RACES.find(r => r.name === formData.raceId)?.name;
    const className = formData.classId; // classId is now the name itself

    if (!raceName || !className || !formData.backgroundName || Object.keys(formData.abilityScores).length !== 6) {
      alert("Harap lengkapi semua data termasuk Ability Scores.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Hitung Data Dasar
      const characterData = calculateNewCharacterFromWizard(
        formData.name,
        raceName,
        className,
        formData.backgroundName,
        formData.abilityScores as AbilityScores
      );

      // 2. Inject Data Tambahan (Manual Override)
      characterData.proficientSkills = [...characterData.proficientSkills, ...selectedSkills];
      characterData.image = getStaticAvatar(raceName, formData.gender); // Pakai static avatar
      characterData.gender = formData.gender as "Pria" | "Wanita";
      
      // 3. Susun Inventory
      const inventory: Omit<CharacterInventoryItem, "instanceId">[] = [];
      const cls = findClass(className);
      
      // a. Fixed Equipment
      cls?.startingEquipment.fixed.forEach(fix => {
        const item = createInvItem(fix.itemName, fix.quantity);
        if (item) inventory.push(item);
      });
      
      // b. Chosen Equipment
      Object.values(selectedEquipment).forEach(opt => {
        opt.itemNames.forEach(name => {
           const item = createInvItem(name);
           if (item) inventory.push(item);
        });
      });

      // 4. Susun Spells
      const spells: SpellDefinition[] = [];
      selectedSpells.forEach(name => {
        const sp = findSpell(name);
        if (sp) spells.push(sp);
      });
      // Tambah default known spells dari kelas
      cls?.spellcasting?.knownSpells?.forEach(name => {
         const sp = findSpell(name);
         if (sp && !selectedSpells.includes(name)) spells.push(sp);
      });

      await characterRepository.saveNewCharacter(characterData, inventory, spells, user.id);
      onComplete();
    } catch (e) {
      console.error("Failed to summon soul:", e);
      alert(`Gagal memanggil jiwa baru: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScoreChange = (ability: Ability, newScoreStr: string) => {
    const newScores = { ...formData.abilityScores };
    const newScore = newScoreStr ? parseInt(newScoreStr, 10) : undefined;

    const existingAbilityForNewScore = Object.entries(newScores).find(
      ([, score]) => score === newScore
    )?.[0] as Ability | undefined;

    const oldScore = newScores[ability];

    if (newScore) {
      newScores[ability] = newScore;
    } else {
      delete newScores[ability];
    }

    if (existingAbilityForNewScore) {
      if (oldScore) {
        newScores[existingAbilityForNewScore] = oldScore;
      } else {
        delete newScores[existingAbilityForNewScore];
      }
    }
    
    setFormData({ ...formData, abilityScores: newScores });
  };
  
  const handleRaceSelect = (race: RaceData) => {
    setFormData({ ...formData, raceId: race.name }); // Fix: Gunakan name karena id tidak ada di data/races.ts
    setSelectedRaceData(race);
  };

  const isAllScoresAssigned = Object.keys(formData.abilityScores).length === 6 && 
                              Object.values(formData.abilityScores).every(s => s && s > 0);

  return (
    <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <PixelCard className="w-full max-w-md border-gold shadow-pixel-glow bg-surface">
        <h2 className="font-pixel text-gold text-center mb-6 text-xl">
          {step === 'NAME' && "IDENTITAS JIWA"}
          {step === 'RACE' && "ASAL USUL (RAS)"}
          {step === 'CLASS' && "TAKDIR (KELAS)"}
          {step === 'BACKGROUND' && "LATAR BELAKANG"}
          {step === 'STATS' && "ATRIBUT KEKUATAN"}
        </h2>

        {step === 'NAME' && (
          <div className="flex flex-col gap-4">
            <p className="text-parchment font-retro text-center">Siapa nama yang akan terukir di batu nisanmu?</p>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-black border-2 border-wood p-3 text-center font-pixel text-parchment focus:border-gold outline-none" placeholder="NAMA PAHLAWAN" />
            <div className="flex gap-2 mt-4">
              <RuneButton label="BATAL" variant="secondary" onClick={onCancel} fullWidth />
              <RuneButton label="LANJUT" fullWidth disabled={!formData.name} onClick={() => setStep('RACE')} />
            </div>
          </div>
        )}

        {step === 'RACE' && (
          <>
            {!selectedRaceData ? (
              <div className="flex flex-col gap-2 animate-fade-in">
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
                  {RACES.map((race) => (
                    <div 
                      key={race.name}
                      onClick={() => handleRaceSelect(race)} 
                      className={`p-3 border-2 cursor-pointer text-center hover:bg-white/5 transition-colors ${formData.raceId === race.name ? 'border-gold bg-gold/10' : 'border-wood'}`}
                    >
                      <div className="font-pixel text-lg text-parchment">{race.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="p-3 bg-black/50 border-2 border-wood">
                  <h3 className="font-pixel text-lg text-gold text-center mb-4">{selectedRaceData.name}</h3>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <h4 className="font-pixel text-gold text-sm mb-2">VISUALISASI</h4>
                      
                      {/* Gender Selector */}
                      <div className="flex gap-2 mb-2 justify-center">
                         {['Pria', 'Wanita'].map(g => (
                           <div 
                             key={g}
                             onClick={() => setFormData({ ...formData, gender: g })}
                             className={`px-2 py-1 text-[10px] cursor-pointer border ${formData.gender === g ? 'bg-gold text-black border-gold' : 'bg-black text-faded border-wood'}`}
                           >
                             {g.toUpperCase()}
                           </div>
                         ))}
                      </div>

                      <div className="mt-1 flex justify-center">
                        <img 
                          src={getStaticAvatar(selectedRaceData.name, formData.gender)} 
                          onError={(e) => {
                            // Fallback aman jika gambar belum digenerate
                            e.currentTarget.src = `https://placehold.co/200x300/1a1a1a/ffffff/png?text=${formData.gender === 'Pria' ? 'Male' : 'Female'}%0A${selectedRaceData.name}`;
                          }}
                          alt={`${formData.gender} ${selectedRaceData.name}`}
                          className="border-2 border-wood h-[200px] w-full object-cover bg-black"
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-pixel text-gold text-sm">BONUS SKOR</h4>
                      <ul className="list-disc list-inside font-retro text-parchment text-xs mt-1">
                        {Object.entries(selectedRaceData.abilityScoreBonuses).map(([ability, bonus]) => (
                          <li key={ability}>{ability}: +{bonus}</li>
                        ))}
                        <li>Speed: {selectedRaceData.speed}ft</li>
                      </ul>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-pixel text-gold text-sm">CIRI KHAS</h4>
                    <ul className="space-y-2 mt-1 max-h-[150px] overflow-y-auto pr-2">
                      {selectedRaceData.traits.map(trait => (
                        <li key={trait.name} className="font-retro text-parchment text-xs">
                          <strong className="text-gold/80">{trait.name}:</strong> {trait.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <RuneButton label="Pilih Ras Lain" variant="secondary" onClick={() => setSelectedRaceData(null)} fullWidth />
              </div>
            )}
            <div className="flex gap-2 mt-4 relative z-20">
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('NAME')} fullWidth />
              <RuneButton 
                label="LANJUT" 
                fullWidth 
                disabled={!formData.raceId} 
                onClick={(e) => {
                  e.stopPropagation(); // Fix: Mencegah click event tertelan oleh container
                  setStep('CLASS');
                }} 
              />
            </div>
          </>
        )}

        {step === 'CLASS' && (
          <>
            {!formData.classId ? (
               <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
                    {Object.values(CLASS_DEFINITIONS).map((cls) => (
                      <div key={cls.name} onClick={() => {
                          setFormData({ ...formData, classId: cls.name });
                          setSelectedSkills([]);
                          setSelectedSpells([]);
                      }} className="p-3 border-2 border-wood cursor-pointer text-center hover:bg-white/5 transition-colors">
                        <div className="font-pixel text-lg text-parchment">{cls.name}</div>
                        <div className="text-xs text-faded italic">{cls.description.substring(0, 50)}...</div>
                      </div>
                    ))}
                  </div>
               </div>
            ) : (
               <div className="flex flex-col gap-4 animate-fade-in">
                  <div className="p-3 bg-black/50 border-2 border-wood">
                     <h3 className="font-pixel text-lg text-gold text-center mb-2">{formData.classId}</h3>
                     <p className="text-xs text-faded italic text-center mb-4">{CLASS_DEFINITIONS[formData.classId].description}</p>
                     
                     {/* Skill Selection */}
                     <div className="mb-3">
                        <p className="font-pixel text-xs text-gold mb-2 text-center">
                            PILIH {CLASS_DEFINITIONS[formData.classId].proficiencies.skills.choices} SKILL
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {CLASS_DEFINITIONS[formData.classId].proficiencies.skills.options.map(skill => (
                                <div key={skill} onClick={() => toggleSkill(skill, CLASS_DEFINITIONS[formData.classId].proficiencies.skills.choices)}
                                     className={`text-[10px] px-2 py-1 border cursor-pointer text-center ${selectedSkills.includes(skill) ? 'bg-gold text-black border-gold' : 'border-wood text-faded hover:bg-white/5'}`}>
                                    {skill}
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-center mt-1 text-faded">
                           Terpilih: {selectedSkills.length} / {CLASS_DEFINITIONS[formData.classId].proficiencies.skills.choices}
                        </p>
                     </div>

                     {/* Spells if any */}
                     {CLASS_DEFINITIONS[formData.classId].spellcasting && (
                        <div className="border-t border-wood/30 pt-2">
                            <p className="font-pixel text-xs text-gold mb-1 text-center">CANTRIPS (OTOMATIS)</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {CLASS_DEFINITIONS[formData.classId].spellcasting?.knownCantrips?.map(spell => (
                                    <span key={spell} className="text-[10px] px-2 py-1 border border-wood/30 text-faded rounded">
                                        {spell}
                                    </span>
                                ))}
                            </div>
                        </div>
                     )}
                  </div>
                  <RuneButton label="Pilih Kelas Lain" variant="secondary" onClick={() => {
                      setFormData({ ...formData, classId: '' });
                      setSelectedSkills([]);
                      setSelectedSpells([]);
                  }} fullWidth />
               </div>
            )}
            <div className="flex gap-2 mt-4 relative z-20">
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('RACE')} fullWidth />
              <RuneButton label="LANJUT" fullWidth 
                disabled={!formData.classId || selectedSkills.length < (CLASS_DEFINITIONS[formData.classId]?.proficiencies.skills.choices || 0)} 
                onClick={() => setStep('BACKGROUND')} 
              />
            </div>
          </>
        )}

        {step === 'BACKGROUND' && (
          <>
            {!formData.backgroundName ? (
               <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
                    {BACKGROUNDS.map((bg) => (
                        <div key={bg.name} onClick={() => setFormData({ ...formData, backgroundName: bg.name })} 
                             className="p-3 border-2 border-wood cursor-pointer text-center hover:bg-white/5 transition-colors">
                          <div className="font-pixel text-lg text-parchment">{bg.name}</div>
                          <div className="font-retro text-xs text-faded mt-1">{bg.description.substring(0, 40)}...</div>
                        </div>
                    ))}
                  </div>
               </div>
            ) : (
                <div className="flex flex-col gap-4 animate-fade-in">
                   {(() => {
                      const bg = BACKGROUNDS.find(b => b.name === formData.backgroundName);
                      if (!bg) return null;
                      return (
                        <div className="p-3 bg-black/50 border-2 border-wood">
                           <h3 className="font-pixel text-lg text-gold text-center mb-2">{bg.name}</h3>
                           <p className="text-xs text-parchment font-retro text-center mb-4">"{bg.description}"</p>
                           
                           <div className="space-y-3">
                              <div>
                                 <h4 className="font-pixel text-gold text-xs border-b border-wood/30 pb-1 mb-1">FEATURE: {bg.feature.name}</h4>
                                 <p className="text-[10px] text-faded">{bg.feature.description}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                 <div>
                                    <h4 className="font-pixel text-gold text-xs mb-1">SKILLS</h4>
                                    <ul className="list-disc list-inside text-[10px] text-faded">
                                       {bg.skillProficiencies.map(s => <li key={s}>{s}</li>)}
                                    </ul>
                                 </div>
                                 <div>
                                    <h4 className="font-pixel text-gold text-xs mb-1">TOOLS/LANGS</h4>
                                    <p className="text-[10px] text-faded">
                                       {bg.toolProficiencies.length > 0 ? bg.toolProficiencies.join(', ') : '-'}
                                       <br/>
                                       {Array.isArray(bg.languages) ? bg.languages.join(', ') : (bg.languages === 'any_one' ? '1 Bahasa Bebas' : '2 Bahasa Bebas')}
                                    </p>
                                 </div>
                              </div>
                              <div>
                                 <h4 className="font-pixel text-gold text-xs mb-1">EQUIPMENT</h4>
                                 <p className="text-[10px] text-faded italic">{bg.equipment.join(', ')}</p>
                              </div>
                           </div>
                        </div>
                      );
                   })()}
                   <RuneButton label="Pilih Latar Belakang Lain" variant="secondary" onClick={() => setFormData({ ...formData, backgroundName: '' })} fullWidth />
                </div>
            )}
            <div className="flex gap-2 mt-4 relative z-20">
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('CLASS')} fullWidth />
              <RuneButton label="LANJUT" fullWidth disabled={!formData.backgroundName} onClick={() => setStep('EQUIPMENT')} />
            </div>
          </>
        )}

        {step === 'EQUIPMENT' && (
          <div className="flex flex-col gap-4 animate-fade-in">
             <div className="text-center border-b border-wood/30 pb-2">
                 <h3 className="font-pixel text-lg text-gold mb-1">PERLENGKAPAN (EQUIPMENT)</h3>
                 <p className="text-parchment font-retro text-xs">
                    Pilih paket perlengkapan awalmu.
                 </p>
             </div>
             
             <div className="flex flex-col gap-3 overflow-y-auto max-h-[350px] pr-2">
                {formData.classId && CLASS_DEFINITIONS[formData.classId].startingEquipment.choices.map((choice, idx) => (
                    <div key={idx} className="border border-wood p-3 bg-black/40">
                        <p className="font-pixel text-xs text-gold mb-2 uppercase border-b border-wood/30 pb-1">
                            OPSI {idx + 1}
                        </p>
                        <div className="flex flex-col gap-2">
                            {choice.options.map((opt, optIdx) => {
                                const isSelected = selectedEquipment[idx]?.name === opt.name;
                                return (
                                    <div key={optIdx} 
                                         onClick={() => setSelectedEquipment(prev => ({...prev, [idx]: opt}))}
                                         className={`p-2 border transition-all cursor-pointer ${isSelected ? 'border-gold bg-gold/10' : 'border-wood/40 hover:bg-white/5'}`}>
                                        
                                        <div className={`font-pixel text-xs ${isSelected ? 'text-parchment' : 'text-faded'}`}>
                                            {opt.name}
                                        </div>

                                        {/* Detail Item dalam Paket */}
                                        <div className="mt-1 pl-2 border-l-2 border-wood/20 space-y-1">
                                            {opt.itemNames.map((itemName, iItem) => {
                                                const details = getItemDetails(itemName);
                                                return (
                                                    <div key={iItem} className="text-[10px] text-faded flex justify-between items-center">
                                                        <span>• {itemName}</span>
                                                        {details && <span className="text-gold/60 text-[9px] ml-2">{details}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
             </div>
             <div className="flex gap-2 mt-2 relative z-20">
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('BACKGROUND')} fullWidth />
              <RuneButton label="LANJUT" fullWidth onClick={() => setStep('STATS')} />
            </div>
          </div>
        )}

        {step === 'STATS' && (
          <div className="flex flex-col gap-4">
            <p className="text-parchment font-retro text-center">Bagikan skor ini: <span className="font-pixel text-gold">{STANDARD_ARRAY.join(', ')}</span></p>
            <div className="space-y-2">
              {ALL_ABILITIES.map((ability) => {
                const assignedScores = Object.values(formData.abilityScores);
                const availableScores = STANDARD_ARRAY.filter(s => !assignedScores.includes(s));
                const currentScore = formData.abilityScores[ability];

                return (
                  <div key={ability} className="flex items-center justify-between">
                    <label className="font-pixel text-parchment capitalize text-lg">{ability.substring(0,3)}</label>
                    <select
                      value={currentScore || ''}
                      onChange={(e) => handleScoreChange(ability, e.target.value)}
                      className="bg-black border-2 border-wood p-2 font-retro text-parchment focus:border-gold outline-none w-28 text-center"
                    >
                      <option value="">-</option>
                      {currentScore && <option value={currentScore}>{currentScore}</option>}
                      {availableScores.map(score => <option key={score} value={score}>{score}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-4">
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('EQUIPMENT')} fullWidth />
              <RuneButton label={isSubmitting ? "MEMANGGIL..." : "BANGKITKAN"} variant="danger" fullWidth disabled={!isAllScoresAssigned || isSubmitting} onClick={handleCreate} />
            </div>
          </div>
        )}
      </PixelCard>
    </div>
  );
};