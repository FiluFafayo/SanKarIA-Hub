import React, { useMemo, useRef, useState, useLayoutEffect, useCallback } from 'react';
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
    const containerRef = useRef<HTMLDivElement>(null);
    const sortedNpcs = useMemo(() => npcs, [npcs]);
    const [visibleCount, setVisibleCount] = useState<number>(Math.min(50, sortedNpcs.length));

    useLayoutEffect(() => {
        setVisibleCount(v => Math.min(Math.max(v, 50), sortedNpcs.length));
    }, [sortedNpcs.length]);

    const handleScroll = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
        if (nearBottom) {
            setVisibleCount(v => Math.min(v + 50, sortedNpcs.length));
        }
    }, [sortedNpcs.length]);

    return (
        <div ref={containerRef} onScroll={handleScroll} className="bg-gray-900/50 p-4 rounded-lg">
            <h2 className="font-cinzel text-2xl text-cyan-300 border-b border-gray-600 pb-2 mb-3">Karakter Ditemui</h2>
            
            {npcs.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {sortedNpcs.slice(-visibleCount).map(npc => (
                        <details key={npc.id} className="bg-gray-800/50 p-3 rounded-lg">
                            <summary className="font-bold cursor-pointer text-base flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    {npc.image ? (
                                        <img src={npc.image} alt={npc.name} className="w-8 h-8 rounded object-cover border border-gray-700" />
                                    ) : npc.imagePending ? (
                                        <div className="w-8 h-8 rounded bg-gray-700/50 border border-gray-600 animate-pulse" />
                                    ) : null}
                                    <span>{npc.name}</span>
                                    {npc.imagePending && (
                                        <span className="text-xs text-cyan-300 ml-2 animate-pulse">Membuat potret…</span>
                                    )}
                                </span>
                                <span className={`text-xs font-mono ${getDispositionColor(npc.disposition)}`}>
                                    {npc.disposition}
                                </span>
                            </summary>
                            <div className="mt-2 text-sm text-gray-300 border-t border-gray-700 pt-2">
                                {npc.image ? (
                                    <div className="flex justify-center mb-3 relative">
                                        <img src={npc.image} alt={npc.name} className="w-32 h-32 rounded-lg object-cover shadow border border-gray-700" />
                                        {npc.imagePending && (
                                            <span className="absolute bottom-2 right-2 text-[10px] bg-cyan-900/60 text-cyan-200 px-2 py-1 rounded animate-pulse">
                                                Memperindah potret…
                                            </span>
                                        )}
                                    </div>
                                ) : npc.imagePending ? (
                                    <div className="flex justify-center mb-3">
                                        <div className="w-32 h-32 rounded-lg bg-gray-700/50 border border-gray-600 animate-pulse" />
                                    </div>
                                ) : null}
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