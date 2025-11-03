import React from 'react';
import { Character, MonsterInstance } from '../../types'; // REFAKTOR: Monster -> MonsterInstance

interface CombatTrackerProps {
  players: Character[];
  monsters: MonsterInstance[]; // REFAKTOR: Monster -> MonsterInstance
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
    return null;
  }

  // REFAKTOR: Gabungkan Character dan MonsterInstance
  const combatants: (Character | MonsterInstance)[] = [...players, ...monsters]
    // REFAKTOR: Cek ID berdasarkan tipe
    .filter(c => initiativeOrder.includes('ownerId' in c ? c.id : c.instanceId))
    .sort((a, b) => {
        const aId = 'ownerId' in a ? a.id : a.instanceId;
        const bId = 'ownerId' in b ? b.id : b.instanceId;
        return initiativeOrder.indexOf(aId) - initiativeOrder.indexOf(bId);
    });

  return (
    <div className="bg-gray-900/50 p-3 rounded-lg">
      <h2 className="font-cinzel text-lg border-b border-gray-600 pb-2 mb-2 text-amber-300">Urutan Pertarungan</h2>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {combatants.map(c => {
          const isPlayer = 'ownerId' in c;
          const id = isPlayer ? c.id : c.instanceId;
          const isActive = id === currentPlayerId;
          // REFAKTOR: maxHp sekarang bisa di c.maxHp atau c.definition.maxHp
          const maxHp = isPlayer ? c.maxHp : c.definition.maxHp;

          return (
            <div key={id} className={`p-2 rounded transition-colors ${isActive ? 'bg-amber-600/30' : 'bg-gray-800/50'}`}>
              <div className="flex justify-between items-center text-sm">
                <span className={`font-bold ${isPlayer ? 'text-blue-300' : 'text-red-300'}`}>{c.name}</span>
                <span className="text-xs text-gray-400">HP: {c.currentHp}/{maxHp}</span>
              </div>
              <HealthBar current={c.currentHp} max={maxHp} />
            </div>
          );
        })}
      </div>
    </div>
  );
};