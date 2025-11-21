// src/components/grimoire/InventoryDrawer.tsx
import React from 'react';
import { CharacterInventoryItem } from '../../types';
import { PixelCard } from './PixelCard'; // Asumsi komponen ini ada/reusable, atau kita buat simpel div
import { RuneButton } from './RuneButton';

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: CharacterInventoryItem[];
  gold?: number; // Opsional, jika ada sistem uang nanti
}

export const InventoryDrawer: React.FC<InventoryDrawerProps> = ({ isOpen, onClose, inventory, gold = 0 }) => {
  // Filter: Pisahkan Equipped dan Backpack
  const equippedItems = inventory.filter(i => i.isEquipped);
  const backpackItems = inventory.filter(i => !i.isEquipped);

  return (
    <>
      {/* Backdrop (Klik luar untuk tutup) */}
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
        
        {/* Header */}
        <div className="p-4 border-b border-wood/30 flex justify-between items-center bg-[#15141a]">
            <div>
                <h2 className="text-gold font-pixel text-lg tracking-widest">TAS PENJELAJAH</h2>
                <p className="text-faded text-xs font-retro">Keping Emas: {gold} GP</p>
            </div>
            <button onClick={onClose} className="text-red-500 font-pixel border border-red-900 px-2 hover:bg-red-900/20">
                X TUTUP
            </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* Section 1: Equipped */}
            {equippedItems.length > 0 && (
                <div>
                    <h3 className="text-parchment text-xs font-bold uppercase mb-2 border-b border-white/10 pb-1">
                        SEDANG DIPAKAI
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                        {equippedItems.map((slot) => (
                            <div key={slot.instanceId} className="flex items-center gap-3 bg-black/30 p-2 border border-green-900 rounded">
                                <div className="w-10 h-10 bg-slate-800 border border-slate-600 flex items-center justify-center text-xl">
                                    ⚔️
                                </div>
                                <div className="flex-1">
                                    <div className="text-green-400 font-bold text-sm">{slot.item.name}</div>
                                    <div className="text-[10px] text-faded">{slot.item.type} • {slot.item.rarity}</div>
                                </div>
                                <div className="text-xs text-green-500 font-pixel">EQP</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Section 2: Backpack */}
            <div>
                <h3 className="text-parchment text-xs font-bold uppercase mb-2 border-b border-white/10 pb-1">
                    ISI TAS ({backpackItems.length} Item)
                </h3>
                {backpackItems.length === 0 ? (
                    <div className="text-center text-faded py-8 italic text-sm">
                        Tas Anda kosong melompong...
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {backpackItems.map((slot) => (
                            <div key={slot.instanceId} className="bg-[#0a0a0a] border border-wood/50 p-2 rounded hover:border-gold transition-colors group relative">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-400">x{slot.quantity}</span>
                                    {slot.item.isMagical && <span className="text-[8px] text-purple-400 animate-pulse">✨</span>}
                                </div>
                                <div className="text-parchment text-sm font-bold leading-tight">{slot.item.name}</div>
                                <div className="text-[10px] text-faded mt-1 truncate">{slot.item.type}</div>
                                
                                {/* Quick Action (Future Proofing) */}
                                {/* <button className="absolute bottom-1 right-1 text-[10px] bg-wood px-1 text-black opacity-0 group-hover:opacity-100">GUNAKAN</button> */}
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
      </div>
    </>
  );
};