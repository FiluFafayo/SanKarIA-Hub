// File: components/layout/GameLayout.tsx
// (Buat folder components/layout jika belum ada)

import React from 'react';

interface GameLayoutProps {
  children: React.ReactNode;
}

export const GameLayout: React.FC<GameLayoutProps> = ({ children }) => {
  return (
    // Outer Container: Fullscreen, gelap gulita (The Void)
    <div className="w-full h-full bg-void flex justify-center items-center overflow-hidden relative">
      
      {/* Background Image/Effect Layer (Global) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ 
             backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")',
             backgroundRepeat: 'repeat' 
           }} 
      />

      {/* The Game Viewport: Dipaksa rasio mobile atau full width di HP */}
      <div className="w-full h-full max-w-[450px] bg-surface relative shadow-2xl flex flex-col border-x-2 border-wood">
        
        {/* Top Status Bar (System Info like Connection/Battery/Time in RPG style) */}
        <div className="h-6 bg-black/50 flex justify-between items-center px-2 text-xs text-faded font-pixel z-50">
            <span>UNKOWN_REALM_v0.1</span>
            <span className="text-green-500">● LIVE</span> 
            {/* Nanti logika 'LIVE' ini diganti hook koneksi. Kalau DC jadi merah */}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>

      </div>
    </div>
  );
};