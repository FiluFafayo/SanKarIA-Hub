// FASE 1: Komponen BARU
// Wrapper untuk panel overlay (sliding) yang ergonomis di mobile.
// Bisa slide dari kiri atau kanan.

import React from 'react';

interface SidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    position: 'left' | 'right';
    children: React.ReactNode;
}

export const SidePanel: React.FC<SidePanelProps> = ({ isOpen, onClose, position, children }) => {
    const backdropClasses = isOpen
        ? 'opacity-100 visible'
        : 'opacity-0 invisible';
    
    const panelClasses = isOpen
        ? 'translate-x-0'
        : (position === 'left' ? '-translate-x-full' : 'translate-x-full');

    return (
        // Portal (Root)
        <div 
            className={`fixed inset-0 z-40 transition-opacity duration-300 ${backdropClasses}`}
            aria-hidden={!isOpen}
        >
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60"
                onClick={onClose}
            />

            {/* Konten Panel */}
            <div
                className={`absolute top-0 h-full w-full max-w-md bg-gray-800 shadow-2xl
                            flex flex-col transition-transform duration-300 ease-in-out
                            ${position === 'left' ? 'left-0' : 'right-0'}
                            ${panelClasses}`}
                role="dialog"
                aria-modal="true"
            >
                {/* Header Panel Sederhana */}
                <header className="flex-shrink-0 flex items-center justify-end p-2 border-b border-gray-700">
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"
                        aria-label="Tutup Panel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                {/* Konten Scrollable */}
                <div className="flex-grow overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};