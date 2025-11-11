import React, { useMemo } from 'react';
import { Ability, Character, Skill, SKILL_ABILITY_MAP } from '../../types';

export type CardAction = 'Attack' | 'Skill' | 'Spell' | 'Item' | 'Defend' | 'Custom';

interface CardActionBarProps {
  disabled?: boolean;
  currentCharacter: Character | null;
  onSelect: (action: CardAction) => void;
  onQuickSkill?: (skill: Skill) => void;
}

const ACTIONS: CardAction[] = ['Attack', 'Skill', 'Spell', 'Item', 'Defend', 'Custom'];

export const CardActionBar: React.FC<CardActionBarProps> = ({ disabled, currentCharacter, onSelect, onQuickSkill }) => {
  const proficientSkills = useMemo(() => currentCharacter?.proficientSkills || [], [currentCharacter]);

  return (
    <div className="flex-shrink-0 p-2 md:p-3 bg-gray-900 border-t border-gray-700">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a}
            disabled={!!disabled}
            title={a}
            onClick={() => onSelect(a)}
            className={`flex items-center justify-center rounded-lg px-2 py-3 text-sm font-semibold border ${disabled ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-800 text-white border-gray-600 hover:border-purple-400 hover:bg-gray-700'}`}
          >
            {a}
          </button>
        ))}
      </div>
      {/* Quick Skill row (proficiencies) */}
      {proficientSkills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {proficientSkills.slice(0, 6).map((s) => (
            <button
              key={s}
              disabled={!!disabled}
              onClick={() => onQuickSkill && onQuickSkill(s)}
              className={`text-xs rounded-md px-2 py-1 border ${disabled ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-800 text-purple-300 border-gray-600 hover:text-white hover:border-purple-400'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};