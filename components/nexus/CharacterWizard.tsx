// components/nexus/CharacterWizard.tsx
import React, { useState } from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { CLASSES } from '../../data/classes';
import { RACES } from '../../data/races';
import { BACKGROUNDS } from '../../data/backgrounds';
import { useAppStore } from '../../store/appStore';
import { characterRepository } from '../../services/repository/characterRepository';
import { Character, Ability, ALL_ABILITIES, AbilityScores } from '../../types';
import { calculateNewCharacterFromWizard } from '../../services/rulesEngine';

interface CharacterWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = 'NAME' | 'RACE' | 'CLASS' | 'BACKGROUND' | 'STATS';
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const CharacterWizard: React.FC<CharacterWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<WizardStep>('NAME');
  const [formData, setFormData] = useState({
    name: '',
    raceId: '',
    classId: '',
    backgroundName: '',
    abilityScores: {} as Partial<AbilityScores>,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAppStore();

  const handleCreate = async () => {
    if (!user) return;

    const raceName = RACES.find(r => r.id === formData.raceId)?.name;
    const className = Object.values(CLASSES).find(c => c.id === formData.classId)?.name;

    if (!raceName || !className || !formData.backgroundName || Object.keys(formData.abilityScores).length !== 6) {
      alert("Harap lengkapi semua data termasuk Ability Scores.");
      return;
    }

    setIsSubmitting(true);
    try {
      const characterData = calculateNewCharacterFromWizard(
        formData.name,
        raceName,
        className,
        formData.backgroundName,
        formData.abilityScores as AbilityScores
      );

      // TODO: Implement starting equipment and spells based on choices
      await characterRepository.saveNewCharacter(characterData, [], [], user.id);
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
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
              {RACES.map((race) => (
                <div key={race.id} onClick={() => setFormData({ ...formData, raceId: race.id })} className={`p-2 border-2 cursor-pointer text-center hover:bg-white/5 transition-colors ${formData.raceId === race.id ? 'border-gold bg-gold/10' : 'border-wood'}`}>
                  <div className="font-pixel text-[10px] text-parchment">{race.name}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('NAME')} fullWidth />
              <RuneButton label="LANJUT" fullWidth disabled={!formData.raceId} onClick={() => setStep('CLASS')} />
            </div>
          </div>
        )}

        {step === 'CLASS' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
              {Object.values(CLASSES).map((cls) => (
                <div key={cls.id} onClick={() => setFormData({ ...formData, classId: cls.id })} className={`p-2 border-2 cursor-pointer text-center hover:bg-white/5 transition-colors ${formData.classId === cls.id ? 'border-gold bg-gold/10' : 'border-wood'}`}>
                  <div className="font-pixel text-[10px] text-gold">{cls.name}</div>
                  <div className="font-retro text-[10px] text-faded leading-tight mt-1">{cls.description.substring(0, 30)}...</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('RACE')} fullWidth />
              <RuneButton label="LANJUT" fullWidth disabled={!formData.classId} onClick={() => setStep('BACKGROUND')} />
            </div>
          </div>
        )}

        {step === 'BACKGROUND' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
              {BACKGROUNDS.map((bg) => (
                <div key={bg.name} onClick={() => setFormData({ ...formData, backgroundName: bg.name })} className={`p-2 border-2 cursor-pointer text-center hover:bg-white/5 transition-colors ${formData.backgroundName === bg.name ? 'border-gold bg-gold/10' : 'border-wood'}`}>
                  <div className="font-pixel text-[10px] text-gold">{bg.name}</div>
                  <div className="font-retro text-[10px] text-faded leading-tight mt-1">{bg.description.substring(0, 30)}...</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('CLASS')} fullWidth />
              <RuneButton label="LANJUT" fullWidth disabled={!formData.backgroundName} onClick={() => setStep('STATS')} />
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
              <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('BACKGROUND')} fullWidth />
              <RuneButton label={isSubmitting ? "MEMANGGIL..." : "BANGKITKAN"} variant="danger" fullWidth disabled={!isAllScoresAssigned || isSubmitting} onClick={handleCreate} />
            </div>
          </div>
        )}
      </PixelCard>
    </div>
  );
};