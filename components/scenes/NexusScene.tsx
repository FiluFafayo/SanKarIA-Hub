// components/scenes/NexusScene.tsx
import React, { useState } from 'react';
import { CampfireMenu } from '../nexus/CampfireMenu';
import { DungeonGate } from '../nexus/DungeonGate';

// Simple visual background components
const BackgroundLayer = () => (
  <div className="absolute inset-0 z-0 overflow-hidden bg-void">
    {/* Langit */}
    <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-[#09090b] to-[#1a1921]" />
    
    {/* Tanah/Ground */}
    <div className="absolute bottom-0 inset-x-0 h-1/2 bg-[#121116] border-t-4 border-black" />

    {/* Visual Api Unggun (CSS Only Pixel Art) */}
    <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-4 h-4 bg-orange-500 shadow-[0_0_20px_10px_rgba(255,100,0,0.3)] animate-pulse rounded-full opacity-80" />
  </div>
);

interface NexusSceneProps {
  onStartGame: () => void;
}

export const NexusScene: React.FC<NexusSceneProps> = ({ onStartGame }) => {
  const [viewMode, setViewMode] = useState<'IDLE' | 'CAMPFIRE' | 'GATE'>('IDLE');
  const [activeChar, setActiveChar] = useState<string | null>(null);

  return (
    <div className="relative w-full h-full flex flex-col">
      <BackgroundLayer />

      {/* TITLE / HUD */}
      <div className="absolute top-10 inset-x-0 text-center z-10 pointer-events-none">
        <h1 className="font-pixel text-3xl text-gold drop-shadow-md tracking-widest opacity-90">GRIMOIRE</h1>
        <p className="font-retro text-faded text-sm mt-1 tracking-widest">RPG TABLETOP ENGINE</p>
      </div>

      {/* CENTRAL INTERACTIVE AREA (Jika IDLE) */}
      {viewMode === 'IDLE' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pt-20 gap-8">
          
          {/* Tombol Pintu Gerbang (Utama) */}
          <button 
            onClick={() => setViewMode('GATE')}
            className="group relative flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <div className="w-24 h-32 border-4 border-wood bg-black/50 flex items-center justify-center group-hover:border-gold group-hover:bg-gold/10 transition-colors shadow-pixel-md">
              <span className="text-4xl group-hover:scale-110 transition-transform">🚪</span>
            </div>
            <span className="font-pixel text-parchment text-xs bg-black px-2 py-1 border border-wood group-hover:text-gold">PLAY</span>
          </button>

          {/* Tombol Api Unggun (Profile) */}
          <button 
            onClick={() => setViewMode('CAMPFIRE')}
            className="group relative flex flex-col items-center gap-2 transition-transform active:scale-95 mt-4"
          >
             <div className="w-16 h-16 rounded-full bg-orange-900/20 border-2 border-orange-800 flex items-center justify-center animate-pulse group-hover:bg-orange-500/20 transition-colors">
                🔥
             </div>
             <span className="font-pixel text-faded text-[10px] group-hover:text-orange-400">CAMPFIRE</span>
          </button>
          
        </div>
      )}

      {/* OVERLAY MENUS */}
      {viewMode === 'CAMPFIRE' && (
        <CampfireMenu 
          onBack={() => setViewMode('IDLE')} 
          onSelectCharacter={(id) => {
            console.log("Selected:", id);
            setActiveChar(id);
            setViewMode('IDLE'); // Atau langsung ke Gate?
          }} 
        />
      )}

      {viewMode === 'GATE' && (
        <DungeonGate 
          onBack={() => setViewMode('IDLE')}
          onEnterWorld={(code) => {
            // Di sini logika validasi room code nanti
            console.log(`Connecting to World: ${code}`);
            // Panggil fungsi untuk memulai game
            onStartGame();
          }} 
        />
      )}

      {/* FOOTER STATUS */}
      {activeChar && viewMode === 'IDLE' && (
         <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 opacity-70">
            <div className="w-2 h-2 bg-green-500 animate-pulse" />
            <span className="font-pixel text-[8px] text-faded">READY AS: {activeChar}</span>
         </div>
      )}

    </div>
  );
};