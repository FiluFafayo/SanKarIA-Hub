import React, { useMemo } from 'react';
import { Character, SpellDefinition } from '../../../types';

interface QuickSpellSelectModalProps {
  character: Character;
  onSelect: (spell: SpellDefinition) => void;
  onClose: () => void;
}

export const QuickSpellSelectModal: React.FC<QuickSpellSelectModalProps> = ({ character, onSelect, onClose }) => {
  const spells = useMemo(() => character.knownSpells || [], [character.knownSpells]);

  const hasSlotsForLevel = (level: number) => {
    if (level === 0) return true; // cantrip
    const idx = character.spellSlots.findIndex(s => s.level === level && s.spent < s.max);
    return idx > -1;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-800 border border-purple-500 rounded-lg shadow-xl w-96 max-w-[90vw] p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-purple-300">Pilih Spell Cepat</h3>
          <button className="text-gray-300 hover:text-white" onClick={onClose}>×</button>
        </div>
        {spells.length === 0 && (
          <div className="text-sm text-gray-300">Tidak ada spell dikenal.</div>
        )}
        <div className="max-h-64 overflow-y-auto space-y-1">
          {spells.map(spell => {
            const usable = hasSlotsForLevel(spell.level);
            return (
              <button
                key={spell.id}
                className={`w-full text-left px-2 py-1 rounded ${usable ? 'bg-gray-700 hover:bg-purple-700 text-white' : 'bg-gray-700/40 text-gray-400 cursor-not-allowed'}`}
                disabled={!usable}
                onClick={() => usable && onSelect(spell)}
              >
                <div className="flex justify-between">
                  <span>{spell.name}</span>
                  <span className="text-xs">Lvl {spell.level}</span>
                </div>
                {spell.duration && (
                  <div className="text-[11px] text-gray-300">{spell.duration}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};