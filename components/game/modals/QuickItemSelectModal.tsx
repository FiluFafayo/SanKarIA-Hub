import React, { useMemo } from 'react';
import { Character, CharacterInventoryItem } from '../../../types';

interface QuickItemSelectModalProps {
  character: Character;
  onSelect: (item: CharacterInventoryItem) => void;
  onClose: () => void;
}

export const QuickItemSelectModal: React.FC<QuickItemSelectModalProps> = ({ character, onSelect, onClose }) => {
  const items = useMemo(() => character.inventory || [], [character.inventory]);
  const consumables = useMemo(() => items.filter(i => i.item.type === 'consumable' && i.quantity > 0), [items]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-800 border border-purple-500 rounded-lg shadow-xl w-96 max-w-[90vw] p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-purple-300">Pilih Item Cepat</h3>
          <button className="text-gray-300 hover:text-white" onClick={onClose}>×</button>
        </div>
        {consumables.length === 0 && (
          <div className="text-sm text-gray-300">Tidak ada item konsumsi yang tersedia.</div>
        )}
        <div className="max-h-64 overflow-y-auto space-y-1">
          {consumables.map(item => (
            <button
              key={item.instanceId}
              className="w-full text-left px-2 py-1 rounded bg-gray-700 hover:bg-purple-700 text-white"
              onClick={() => onSelect(item)}
            >
              <div className="flex justify-between">
                <span>{item.item.name}</span>
                <span className="text-xs">x{item.quantity}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};