// components/nexus/CharacterWizard.tsx
import React, { useState } from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { CLASSES } from '../../data/classes';
import { RACES } from '../../data/races';
import { useAppStore } from '../../store/appStore';
import { characterRepository } from '../../services/repository/characterRepository';

interface CharacterWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const CharacterWizard: React.FC<CharacterWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<'NAME' | 'RACE' | 'CLASS'>('NAME');
  const [formData, setFormData] = useState({ name: '', raceId: '', classId: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAppStore();

  const handleCreate = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Logic pembuatan karakter sesungguhnya
      await characterRepository.createCharacter({
        user_id: user.id,
        name: formData.name,
        race_id: formData.raceId,
        class_id: formData.classId,
        level: 1,
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, // Default stats
        hp: 10,
        max_hp: 10,
        experience: 0,
        gold: 0
      });
      onComplete();
    } catch (e) {
      console.error("Failed to summon soul:", e);
      alert("Gagal memanggil jiwa baru.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <PixelCard className="w-full max-w-md border-gold shadow-pixel-glow bg-surface">
        <h2 className="font-pixel text-gold text-center mb-6 text-xl">
          {step === 'NAME' && "IDENTITAS JIWA"}
          {step === 'RACE' && "ASAL USUL (RAS)"}
          {step === 'CLASS' && "TAKDIR (KELAS)"}
        </h2>

        {/* STEP 1: NAME */}
        {step === 'NAME' && (
          <div className="flex flex-col gap-4">
            <p className="text-parchment font-retro text-center">Siapa nama yang akan terukir di batu nisanmu?</p>
            <input 
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-black border-2 border-wood p-3 text-center font-pixel text-parchment focus:border-gold outline-none"
              placeholder="NAMA PAHLAWAN"
            />
            <div className="flex gap-2 mt-4">
              <RuneButton label="BATAL" variant="secondary" onClick={onCancel} fullWidth />
              <RuneButton 
                label="LANJUT" 
                fullWidth 
                disabled={!formData.name}
                onClick={() => setStep('RACE')} 
              />
            </div>
          </div>
        )}

        {/* STEP 2: RACE */}
        {step === 'RACE' && (
          <div className="flex flex-col gap-4">
             <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                {Object.values(RACES).map((race) => (
                  <div 
                    key={race.id}
                    onClick={() => setFormData({ ...formData, raceId: race.id })}
                    className={`p-2 border-2 cursor-pointer text-center hover:bg-white/5 transition-colors
                      ${formData.raceId === race.id ? 'border-gold bg-gold/10' : 'border-wood'}
                    `}
                  >
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

        {/* STEP 3: CLASS */}
        {step === 'CLASS' && (
          <div className="flex flex-col gap-4">
             <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                {Object.values(CLASSES).map((cls) => (
                  <div 
                    key={cls.id}
                    onClick={() => setFormData({ ...formData, classId: cls.id })}
                    className={`p-2 border-2 cursor-pointer text-center hover:bg-white/5 transition-colors
                      ${formData.classId === cls.id ? 'border-gold bg-gold/10' : 'border-wood'}
                    `}
                  >
                    <div className="font-pixel text-[10px] text-gold">{cls.name}</div>
                    <div className="font-retro text-[10px] text-faded leading-tight mt-1">{cls.description.substring(0, 30)}...</div>
                  </div>
                ))}
             </div>
             <div className="flex gap-2 mt-2">
               <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('RACE')} fullWidth />
               <RuneButton 
                  label={isSubmitting ? "MEMANGGIL..." : "BANGKITKAN"} 
                  variant="danger"
                  fullWidth 
                  disabled={!formData.classId || isSubmitting} 
                  onClick={handleCreate} 
               />
             </div>
          </div>
        )}

      </PixelCard>
    </div>
  );
};