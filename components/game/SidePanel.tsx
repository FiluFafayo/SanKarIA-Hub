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
    // FASE 4: Kelas ini sekarang HANYA berlaku untuk mobile (non-lg)
    const backdropClasses = isOpen
        ? 'opacity-100 visible lg:invisible'
        : 'opacity-0 invisible';
    
    // FASE 4: Kelas ini sekarang HANYA berlaku untuk mobile (non-lg)
    const panelClasses = isOpen
        ? 'translate-x-0'
        : (position === 'left' ? '-translate-x-full lg:translate-x-0' : 'translate-x-full lg:translate-x-0');

    return (
        // Portal (Root)
        // FASE 4: Di desktop (lg), ini bukan lagi modal 'fixed'
        // Kita juga tambahkan 'pointer-events-none' saat tertutup agar tidak memblokir layout desktop
        // FASE 4 (FIX): Tambahkan 'lg:pointer-events-auto' untuk memastikan panel desktop BISA diklik
        <div 
            className={`lg:static fixed inset-0 z-40 transition-opacity duration-300 ${backdropClasses} ${!isOpen ? 'pointer-events-none' : 'pointer-events-auto'} lg:pointer-events-auto`}
            aria-hidden={!isOpen}
        >
            {/* Backdrop (Hanya Mobile) */}
            <div 
                className="absolute inset-0 bg-black/60 lg:hidden"
                onClick={onClose}
            />

            {/* Konten Panel */}
            {/* FASE 4: Di desktop (lg), ini menjadi panel statis 'relative' */}
            {/* Tambahkan 'pointer-events-auto' agar panel di dalamnya bisa diklik */}
            <div
                className={`absolute lg:relative top-0 h-full w-full max-w-md lg:max-w-none bg-gray-800 shadow-2xl lg:shadow-none
                            flex flex-col transition-transform duration-300 ease-in-out
                            ${position === 'left' ? 'left-0' : 'right-0'}
                            ${panelClasses}
                            lg:h-full lg:w-full pointer-events-auto`} // Pastikan mengisi area grid di desktop
                role="dialog"
                aria-modal={!isOpen} // FASE 4: Hanya modal di mobile
            >
                {/* Header Panel Sederhana (Hanya Mobile) */}
                <header className="flex-shrink-0 flex items-center justify-end p-2 border-b border-gray-700 lg:hidden">
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