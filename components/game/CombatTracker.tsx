import React from 'react';
import { Character, Monster } from '../../types';

interface CombatTrackerProps {
  players: Character[];
  monsters: Monster[];
  initiativeOrder: string[];
  currentPlayerId: string | null;
}

const HealthBar: React.FC<{ current: number, max: number }> = ({ current, max }) => {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    const color = percentage > 50 ? 'bg-green-500' : percentage > 25 ? 'bg-yellow-500' : 'bg-red-500';
    return (
        <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div className={color} style={{ width: `${percentage}%`, height: '100%', borderRadius: 'inherit' }}></div>
        </div>
    )
}

export const CombatTracker: React.FC<CombatTrackerProps> = ({ players, monsters, initiativeOrder, currentPlayerId }) => {
  if (initiativeOrder.length === 0) {
    return null; // Don't render if not in combat or initiative not set
  }

  const combatants = [...players, ...monsters]
    .filter(c => initiativeOrder.includes(c.id))
    .sort((a, b) => initiativeOrder.indexOf(a.id) - initiativeOrder.indexOf(b.id));

  return (
    <div className="bg-gray-900/50 p-3 rounded-lg">
      <h2 className="font-cinzel text-lg border-b border-gray-600 pb-2 mb-2 text-amber-300">Urutan Pertarungan</h2>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {combatants.map(c => {
          const isPlayer = 'ownerId' in c;
          const isActive = c.id === currentPlayerId;
          return (
            <div key={c.id} className={`p-2 rounded transition-colors ${isActive ? 'bg-amber-600/30' : 'bg-gray-800/50'}`}>
              <div className="flex justify-between items-center text-sm">
                <span className={`font-bold ${isPlayer ? 'text-blue-300' : 'text-red-300'}`}>{c.name}</span>
                <span className="text-xs text-gray-400">HP: {c.currentHp}/{c.maxHp}</span>
              </div>
              <HealthBar current={c.currentHp} max={c.maxHp} />
            </div>
          );
        })}
      </div>
    </div>
  );
};