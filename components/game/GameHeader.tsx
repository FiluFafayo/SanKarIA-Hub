// FASE 1: Komponen Header BARU
// Menggantikan header statis lama di GameScreen.
// Menambahkan tombol pemicu untuk panel Info dan Karakter.

import React from 'react';
import { ThinkingState } from '../../types';

interface GameHeaderProps {
    title: string;
    thinkingState: ThinkingState;
    hasActiveRoll: boolean;
    onExit: () => void;
    onToggleInfo: () => void;
    onToggleCharacter: () => void;
}

// Icon SVG sederhana
const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
);

const CharacterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A1.5 1.5 0 0 1 18 21.75H6A1.5 1.5 0 0 1 4.501 20.118Z" />
    </svg>
);

export const GameHeader: React.FC<GameHeaderProps> = ({
    title,
    thinkingState,
    hasActiveRoll,
    onExit,
    onToggleInfo,
    onToggleCharacter
}) => {
    const isSaving = thinkingState !== "idle" || hasActiveRoll;

    return (
        <header className="flex-shrink-0 bg-gray-800 p-3 flex items-center justify-between border-b-2 border-gray-700 z-20">
            {/* Tombol Info (Kiri) - FASE 4: Sembunyikan di desktop */}
            <button
                onClick={onToggleInfo}
                className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-700 lg:hidden"
                aria-label="Toggle Info Panel"
            >
                <InfoIcon />
            </button>

            {/* Judul (Tengah) */}
            <h1 className="font-cinzel text-xl text-purple-300 truncate px-2 text-center">
                {title}
            </h1>

            {/* Tombol Karakter & Keluar (Kanan) */}
            <div className="flex items-center gap-2">
                 <button
                    onClick={onToggleCharacter}
                    className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-700 lg:hidden"
                    aria-label="Toggle Character Panel"
                >
                    <CharacterIcon />
                </button>
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