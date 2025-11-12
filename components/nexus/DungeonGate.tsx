// components/nexus/DungeonGate.tsx
import React, { useState } from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';

interface DungeonGateProps {
  onEnterWorld: (code: string) => void;
  onBack: () => void;
}

export const DungeonGate: React.FC<DungeonGateProps> = ({ onEnterWorld, onBack }) => {
  const [roomCode, setRoomCode] = useState('');

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-sm p-6 animate-fade-in">
      <PixelCard className="w-full max-w-sm border-gold shadow-pixel-glow">
        <div className="text-center mb-6">
          <h2 className="font-pixel text-2xl text-gold mb-2">DUNGEON GATE</h2>
          <p className="font-retro text-faded">Masukkan Kode Rune untuk bergabung dengan Party.</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input 
              type="text" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="RUNE CODE (e.g. X7K9)"
              className="w-full bg-black border-2 border-wood p-3 font-pixel text-center text-parchment focus:border-gold outline-none tracking-[0.5em] placeholder:tracking-normal placeholder:text-faded/30"
              maxLength={6}
            />
          </div>

          <RuneButton 
            label="MASUK GERBANG" 
            fullWidth 
            disabled={!roomCode}
            onClick={() => onEnterWorld(roomCode)}
          />
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-wood/50"></div>
            <span className="flex-shrink mx-4 text-faded font-pixel text-[8px]">ATAU</span>
            <div className="flex-grow border-t border-wood/50"></div>
          </div>

          <RuneButton 
            label="CIPTAKAN DUNIA BARU" 
            variant="secondary" 
            fullWidth 
            onClick={() => console.log("Create Campaign Logic")}
          />

          <button onClick={onBack} className="w-full text-center text-red-500 font-pixel text-[10px] mt-4 hover:brightness-125">
            &lt; KEMBALI KE NEXUS
          </button>
        </div>
      </PixelCard>
    </div>
  );
};