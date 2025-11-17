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
import { AbilityRoller } from '../profile/AbilityRoller';

// Constants untuk Stats
const ABILITY_INFO: Record<string, string> = {
    strength: "Fisik & Atletik",
    dexterity: "Refleks & Akurasi",
    constitution: "Stamina & HP",
    intelligence: "Logika & Memori",
    wisdom: "Intuisi & Persepsi",
    charisma: "Pesona & Kepemimpinan"
};

const POINT_BUY_COSTS: Record<number, number> = {
    8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
};

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

import { generationService } from '../../services/ai/generationService';

type WizardStep = 'NAME' | 'RACE' | 'CLASS' | 'BACKGROUND' | 'EQUIPMENT' | 'STATS' | 'REVIEW';
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const CharacterWizard: React.FC<CharacterWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<WizardStep>('NAME');
  const [selectedRaceData, setSelectedRaceData] = useState<RaceData | null>(null);
  
  // State Baru untuk Logika 5e
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [selectedSpells, setSelectedSpells] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Record<number, EquipmentChoice['options'][0]>>({});
  const [statsMethod, setStatsMethod] = useState<'STANDARD' | 'POINT_BUY' | 'MANUAL'>('STANDARD');
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

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
  const user = useAppStore(s => s.auth.user);
  const pushNotification = useAppStore(s => s.actions.pushNotification);

  const handleGenerateAvatar = async () => {
    if (!formData.raceId || !formData.classId) return;
    setIsGeneratingImage(true);
    try {
        // 1. Kumpulkan Data Konteks
        const equipList = Object.values(selectedEquipment).flatMap(e => e.itemNames);
        const contextData = {
            race: formData.raceId,
            gender: formData.gender,
            class: formData.classId,
            background: formData.backgroundName,
            skills: selectedSkills,
            equipment: equipList
        };

        // 2. Terjemahkan ke Visual Prompt (Smart Interpreter)
        const visualPrompt = await generationService.generateVisualDescription(contextData);
        console.log("🎨 [SMART PROMPT] AI Visual Interpretation:", visualPrompt); // LOG UTAMA

        // 3. Generate Gambar dengan Prompt Tersebut
        const url = await generationService.generateCharacterPortrait(visualPrompt, formData.raceId, formData.gender);
        setGeneratedAvatarUrl(url);
    } catch (e) {
        console.error("Avatar Gen Error:", e);
        pushNotification({ type: 'error', message: `Gagal memvisualisasikan jiwa: ${e instanceof Error ? e.message : 'Error misterius'}` });
    } finally {
        setIsGeneratingImage(false);
    }
  };

  const handleCreate = async () => {
    console.log("🔥 Tombol Bangkitkan Ditekan!"); // DEBUG LOG
    
    if (!user) {
        console.error("❌ User session tidak ditemukan!");
        pushNotification({ type: 'warning', message: "Sesi Anda habis atau tidak valid. Silakan refresh halaman." });
        return;
    }

    // Fix: Gunakan properti 'name' untuk pencarian karena 'id' tidak eksis di definisi Race
    const raceName = RACES.find(r => r.name === formData.raceId)?.name;
    const className = formData.classId; // classId is now the name itself

    if (!raceName || !className || !formData.backgroundName || Object.keys(formData.abilityScores).length !== 6) {
      pushNotification({ type: 'warning', message: "Harap lengkapi semua data termasuk Ability Scores." });
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
      // PRIORITAS: Gunakan Avatar AI jika sudah digenerate, jika tidak fallback ke static
      characterData.image = generatedAvatarUrl || getStaticAvatar(raceName, formData.gender); 
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
      pushNotification({ type: 'error', message: `Gagal memanggil jiwa baru: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Logic Point Buy
  const getPointCost = (score: number) => POINT_BUY_COSTS[score] ?? 0;
  const getRemainingPoints = () => {
    let totalUsed = 0;
    ALL_ABILITIES.forEach(a => {
        const s = formData.abilityScores[a] || 8;
        totalUsed += getPointCost(s);
    });
    return 27 - totalUsed;
  };

  const handlePointBuyChange = (ability: Ability, increment: boolean) => {
      const current = formData.abilityScores[ability] || 8;
      const next = increment ? current + 1 : current - 1;
      
      if (next < 8 || next > 15) return;
      
      if (increment) {
          const costDiff = getPointCost(next) - getPointCost(current);
          if (getRemainingPoints() - costDiff < 0) return; // Tidak cukup poin
      }

      setFormData(prev => ({
          ...prev, 
          abilityScores: { ...prev.abilityScores, [ability]: next }
      }));
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
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Tab Navigasi Stats */}
            <div className="flex border-b border-wood/30 pb-2 justify-center gap-2">
                {(['STANDARD', 'POINT_BUY', 'MANUAL'] as const).map(m => (
                    <button 
                        key={m}
                        onClick={() => {
                            setStatsMethod(m);
                            // Reset logic saat ganti metode
                            const resetScores: any = {};
                            if (m === 'POINT_BUY') {
                                ALL_ABILITIES.forEach(a => resetScores[a] = 8);
                            }
                            setFormData(prev => ({...prev, abilityScores: resetScores}));
                        }}
                        className={`text-[10px] font-pixel px-3 py-1 transition-all ${statsMethod === m ? 'bg-gold text-black' : 'text-faded hover:text-parchment'}`}
                    >
                        {m.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {/* Info Header */}
            <div className="text-center">
                {statsMethod === 'STANDARD' && <p className="text-xs text-parchment font-retro">Bagikan angka: <span className="text-gold">15, 14, 13, 12, 10, 8</span></p>}
                {statsMethod === 'POINT_BUY' && <p className="text-xs text-parchment font-retro">Sisa Poin: <span className="text-gold font-pixel text-lg">{getRemainingPoints()}/27</span></p>}
                {statsMethod === 'MANUAL' && <p className="text-xs text-parchment font-retro">Lempar dadu untuk nasibmu!</p>}
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {ALL_ABILITIES.map((ability) => {
                const currentScore = formData.abilityScores[ability] || (statsMethod === 'POINT_BUY' ? 8 : 0);
                
                return (
                  <div key={ability} className="flex items-center justify-between border-b border-wood/20 pb-1">
                    <div className="flex flex-col">
                        <span className="font-pixel text-parchment text-sm uppercase">{ability}</span>
                        <span className="text-[9px] text-faded italic">{ABILITY_INFO[ability]}</span>
                    </div>

                    {/* UI Controls per Method */}
                    <div className="w-32 flex justify-end">
                        {statsMethod === 'STANDARD' && (
                            <select
                              value={formData.abilityScores[ability] || ''}
                              onChange={(e) => handleScoreChange(ability, e.target.value)}
                              className="bg-black border border-wood p-1 font-pixel text-gold text-sm w-full text-center"
                            >
                              <option value="">-</option>
                              {/* Tampilkan skor saat ini + skor yang belum dipakai */}
                              {formData.abilityScores[ability] && <option value={formData.abilityScores[ability]}>{formData.abilityScores[ability]}</option>}
                              {STANDARD_ARRAY.filter(s => !Object.values(formData.abilityScores).includes(s)).map(s => (
                                  <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                        )}

                        {statsMethod === 'POINT_BUY' && (
                            <div className="flex items-center gap-2">
                                <button onClick={() => handlePointBuyChange(ability, false)} className="w-6 h-6 bg-red-900/50 text-red-200 border border-red-800 hover:bg-red-800">-</button>
                                <span className="font-pixel text-gold w-6 text-center">{currentScore}</span>
                                <button onClick={() => handlePointBuyChange(ability, true)} disabled={currentScore >= 15} className="w-6 h-6 bg-green-900/50 text-green-200 border border-green-800 hover:bg-green-800">+</button>
                            </div>
                        )}

                        {statsMethod === 'MANUAL' && (
                            <div className="flex justify-end">
                                {currentScore > 0 ? (
                                    <span className="font-pixel text-gold text-lg animate-land">{currentScore}</span>
                                ) : (
                                    <div className="scale-75 origin-right">
                                        <AbilityRoller ability={ability} currentScore={null} onRoll={(a, s) => {
                                            setFormData(prev => ({...prev, abilityScores: {...prev.abilityScores, [a]: s}}));
                                        }} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mt-2 relative z-20">
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('EQUIPMENT')} fullWidth />
              <RuneButton 
                label="LANJUT KE FINAL" 
                fullWidth 
                disabled={Object.keys(formData.abilityScores).length < 6} 
                onClick={() => setStep('REVIEW')} 
              />
            </div>
          </div>
        )}

        {step === 'REVIEW' && (
          <div className="flex flex-col gap-4 animate-fade-in">
             <div className="flex gap-4">
                {/* Kiri: Summary Text */}
                <div className="w-1/2 flex flex-col gap-2 text-xs text-faded border-r border-wood/30 pr-2">
                    <h3 className="font-pixel text-gold text-sm border-b border-wood/50 pb-1">RINGKASAN JIWA</h3>
                    <div><span className="text-parchment">Nama:</span> {formData.name}</div>
                    <div><span className="text-parchment">Ras:</span> {formData.raceId} ({formData.gender})</div>
                    <div><span className="text-parchment">Kelas:</span> {formData.classId}</div>
                    <div><span className="text-parchment">Latar:</span> {formData.backgroundName}</div>
                    
                    {/* New Context Info */}
                    <div className="mt-1 border-t border-wood/30 pt-1">
                        <span className="text-parchment">Skill Dominan:</span>
                        <p className="italic text-[9px]">{selectedSkills.slice(0, 3).join(', ')}{selectedSkills.length > 3 ? '...' : ''}</p>
                    </div>
                    <div>
                        <span className="text-parchment">Equipment:</span>
                        <p className="italic text-[9px]">
                            {Object.values(selectedEquipment).flatMap(e => e.itemNames).slice(0, 3).join(', ')}
                        </p>
                    </div>

                    <div className="mt-1 border-t border-wood/30 pt-1"><span className="text-parchment">Atribut:</span></div>
                    <div className="grid grid-cols-3 gap-1 text-[9px]">
                        {Object.entries(formData.abilityScores).map(([k, v]) => (
                            <div key={k} className="bg-black/40 px-1 rounded">{k.substring(0,3).toUpperCase()}: {v}</div>
                        ))}
                    </div>
                </div>

                {/* Kanan: Avatar Generator */}
                <div className="w-1/2 flex flex-col items-center justify-center gap-2">
                    {/* Ubah ke rasio Portrait (~3:4) agar serasi dengan gambar Ras */}
                    <div className="w-32 h-[170px] border-2 border-gold bg-black/50 flex items-center justify-center overflow-hidden relative shadow-pixel-glow">
                        {generatedAvatarUrl ? (
                            <img src={generatedAvatarUrl} alt="Generated Soul" className="w-full h-full object-cover animate-fade-in" />
                        ) : (
                            <div className="text-[9px] text-center text-faded px-2 font-retro">
                                {isGeneratingImage ? "Menenun Wajah..." : "Visual Belum Terbentuk"}
                            </div>
                        )}
                        {isGeneratingImage && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <div className="animate-spin w-6 h-6 border-2 border-gold border-t-transparent rounded-full"></div>
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={handleGenerateAvatar}
                        disabled={isGeneratingImage}
                        className="font-pixel text-[10px] px-3 py-1 bg-blue-900/50 border border-blue-500 text-blue-200 hover:bg-blue-800 transition-colors disabled:opacity-50 w-full"
                    >
                        {generatedAvatarUrl ? "GENERATE ULANG" : "VISUALISASIKAN"}
                    </button>
                </div>
             </div>

             <div className="flex gap-2 mt-4">
                <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('STATS')} fullWidth />
                <RuneButton 
                    label={isSubmitting ? "MENGIKAT JIWA..." : "BANGKITKAN"} 
                    variant="danger" 
                    fullWidth 
                    disabled={isSubmitting || isGeneratingImage} 
                    onClick={handleCreate} 
                />
             </div>
          </div>
        )}
      </PixelCard>
    </div>
  );
};