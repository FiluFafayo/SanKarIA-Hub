// src/components/grimoire/CharacterSheetDrawer.tsx
import React, { useState } from 'react';
import { Character, ALL_ABILITIES, Ability, SKILL_ABILITY_MAP } from '../../types';
import { StatBar } from './StatBar';

interface CharacterSheetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
}

type Tab = 'STATS' | 'SKILLS' | 'SPELLS';

export const CharacterSheetDrawer: React.FC<CharacterSheetDrawerProps> = ({ isOpen, onClose, character }) => {
  const [activeTab, setActiveTab] = useState<Tab>('STATS');

  // Helper: Hitung Modifier (Score - 10) / 2, floor
  const getMod = (score: number) => Math.floor((score - 10) / 2);
  const formatMod = (mod: number) => (mod >= 0 ? `+${mod}` : `${mod}`);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
            className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
            onClick={onClose}
        />
      )}

      {/* Drawer Panel */}
      <div className={`absolute inset-x-0 bottom-0 h-[85%] bg-surface border-t-4 border-wood z-50 transform transition-transform duration-300 flex flex-col ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        
        {/* Header Portrait Area */}
        <div className="p-4 bg-[#100f14] flex gap-4 border-b border-wood">
             <div className="w-16 h-16 bg-black border-2 border-gold rounded overflow-hidden shadow-lg">
                 <img src={character.avatar_url} alt={character.name} className="w-full h-full object-cover" />
             </div>
             <div className="flex-1">
                 <h2 className="text-xl font-pixel text-gold">{character.name}</h2>
                 <p className="text-xs text-faded font-retro mb-2">Level {character.level} {character.race} {character.class}</p>
                 <StatBar label="HP" current={character.currentHp} max={character.maxHp} color="blood" />
             </div>
             <button onClick={onClose} className="text-red-500 h-8 w-8 flex items-center justify-center border border-red-900 rounded hover:bg-red-900/20">X</button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-wood/30 bg-black/20">
            {(['STATS', 'SKILLS', 'SPELLS'] as Tab[]).map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-xs font-pixel tracking-widest transition-colors ${
                        activeTab === tab 
                        ? 'bg-wood/20 text-gold border-b-2 border-gold' 
                        : 'text-faded hover:text-parchment'
                    }`}
                >
                    {tab}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
            
            {/* --- TAB: STATS --- */}
            {activeTab === 'STATS' && (
                <div className="space-y-6">
                    {/* Ability Scores Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        {ALL_ABILITIES.map((ability) => {
                            const score = character.abilityScores[ability];
                            const mod = getMod(score);
                            return (
                                <div key={ability} className="bg-black/40 border border-wood/30 rounded p-2 text-center flex flex-col items-center">
                                    <span className="text-[10px] text-faded uppercase mb-1">{ability.slice(0,3)}</span>
                                    <span className="text-2xl font-bold text-parchment leading-none">{formatMod(mod)}</span>
                                    <span className="text-[10px] text-slate-500 bg-black px-1 rounded mt-1">{score}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Vitals */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#1a1921] p-3 rounded border border-wood/30 flex flex-col items-center">
                            <span className="text-xs text-faded uppercase">Armor Class</span>
                            <span className="text-3xl font-pixel text-blue-300">{character.armorClass}</span>
                        </div>
                        <div className="bg-[#1a1921] p-3 rounded border border-wood/30 flex flex-col items-center">
                            <span className="text-xs text-faded uppercase">Speed</span>
                            <span className="text-3xl font-pixel text-green-300">{character.speed} ft</span>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: SKILLS --- */}
            {activeTab === 'SKILLS' && (
                <div className="space-y-1">
                    {Object.entries(SKILL_ABILITY_MAP).map(([skillName, ability]) => {
                        // Simple Logic: Proficiency Bonus (+2 for Level 1, simplified)
                        // Di sistem nyata, hitung berdasarkan level. Kita anggap PB = 2 + Math.floor((level-1)/4)
                        const pb = 2 + Math.floor((character.level - 1) / 4);
                        const isProficient = character.proficientSkills.includes(skillName as any);
                        const abilityMod = getMod(character.abilityScores[ability]);
                        const totalMod = abilityMod + (isProficient ? pb : 0);

                        return (
                            <div key={skillName} className={`flex justify-between items-center p-2 rounded ${isProficient ? 'bg-gold/10 border border-gold/30' : 'border-b border-white/5'}`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${isProficient ? 'bg-gold' : 'bg-slate-700'}`} />
                                    <span className={`text-sm ${isProficient ? 'text-gold font-bold' : 'text-slate-300'}`}>{skillName}</span>
                                    <span className="text-[8px] text-slate-500 uppercase">({ability.slice(0,3)})</span>
                                </div>
                                <span className="font-mono text-parchment">{formatMod(totalMod)}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- TAB: SPELLS --- */}
            {activeTab === 'SPELLS' && (
                <div>
                    {character.knownSpells.length === 0 ? (
                        <div className="text-center text-faded mt-10 italic">
                            Karakter ini tidak menghafal mantra apapun.
                        </div>
                    ) : (
                        <div className="space-y-4">
                             {/* Kelompokkan per Level Spell jika mau, tapi list flat dulu cukup utk Fase 5 */}
                             {character.knownSpells.map((spell) => (
                                 <div key={spell.id} className="bg-[#15121c] border-l-2 border-purple-500 p-3 rounded hover:bg-[#1e1a26] transition-colors">
                                     <div className="flex justify-between items-start">
                                         <h4 className="text-purple-200 font-bold text-sm">{spell.name}</h4>
                                         <span className="text-[10px] bg-black px-1 border border-purple-900 text-purple-400 rounded">
                                            {spell.level === 0 ? 'CANTRIP' : `LVL ${spell.level}`}
                                         </span>
                                     </div>
                                     <p className="text-xs text-faded mt-1 line-clamp-2">{spell.description}</p>
                                     <div className="mt-2 flex gap-2 text-[9px] text-slate-400 uppercase tracking-wider">
                                         <span>⏱ {spell.castingTime}</span>
                                         <span>📏 {spell.range}</span>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    )}
                </div>
            )}

        </div>
      </div>
    </>
  );
};