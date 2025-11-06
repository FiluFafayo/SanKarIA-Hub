// FASE 0: Rombak Total. Header ini JAUH lebih sederhana.
// Tidak lagi bertanggung jawab atas toggle panel mobile.
import React from 'react';
import { ThinkingState } from '../../types';

interface GameHeaderProps {
    title: string;
    thinkingState: ThinkingState;
    hasActiveRoll: boolean;
    onExit: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
    title,
    thinkingState,
    hasActiveRoll,
    onExit
}) => {
    const isSaving = thinkingState !== "idle" || hasActiveRoll;

    return (
        <header className="flex-shrink-0 bg-gray-800 p-3 flex items-center justify-between border-b-2 border-gray-700 z-20">
            {/* Tombol Kiri (Kosongkan untuk simetri) */}
            <div className="w-16"></div>

            {/* Judul (Tengah) */}
            <h1 className="font-cinzel text-xl text-purple-300 truncate px-2 text-center">
                {title}
            </h1>

            {/* Tombol Keluar (Kanan) */}
            <div className="flex items-center justify-end w-16">
                <button
                    onClick={onExit}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded flex-shrink-0 transition-colors
                               disabled:bg-gray-600 disabled:cursor-not-allowed"
                    disabled={isSaving}
                >
                    {isSaving ? "Tunggu..." : "Keluar"}
                </button>
            </div>
        </header>
    );
};