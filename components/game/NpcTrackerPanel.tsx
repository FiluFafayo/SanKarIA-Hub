import React from 'react';
import { NPC } from '../../types';

interface NpcTrackerPanelProps {
    npcs: NPC[];
}

const getDispositionColor = (disposition: NPC['disposition']) => {
    switch (disposition) {
        case 'Friendly': return 'text-green-400';
        case 'Hostile': return 'text-red-400';
        case 'Neutral': return 'text-yellow-400';
        default: return 'text-gray-400';
    }
};

export const NpcTrackerPanel: React.FC<NpcTrackerPanelProps> = ({ npcs }) => {
    return (
        <div className="bg-gray-900/50 p-4 rounded-lg">
            <h2 className="font-cinzel text-2xl text-cyan-300 border-b border-gray-600 pb-2 mb-3">Karakter Ditemui</h2>
            
            {npcs.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {npcs.map(npc => (
                        <details key={npc.id} className="bg-gray-800/50 p-3 rounded-lg">
                            <summary className="font-bold cursor-pointer text-base flex justify-between items-center">
                                <span>{npc.name}</span>
                                <span className={`text-xs font-mono ${getDispositionColor(npc.disposition)}`}>
                                    {npc.disposition}
                                </span>
                            </summary>
                            <div className="mt-2 text-sm text-gray-300 border-t border-gray-700 pt-2">
                                <p><strong className="text-gray-400">Deskripsi:</strong> {npc.description}</p>
                                <p><strong className="text-gray-400">Lokasi:</strong> {npc.location}</p>
                                <div className="mt-2">
                                    <strong className="text-gray-400">Catatan Interaksi:</strong>
                                    <ul className="list-disc list-inside pl-2 text-gray-400">
                                        {npc.interactionHistory.map((note, index) => (
                                            <li key={index} className="italic">"{note}"</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </details>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-400 italic mt-1">Belum bertemu siapa pun.</p>
            )}
        </div>
    );
};