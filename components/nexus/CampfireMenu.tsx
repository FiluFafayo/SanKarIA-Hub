// components/nexus/CampfireMenu.tsx
import React from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { AvatarFrame } from '../grimoire/AvatarFrame';
import { RuneButton } from '../grimoire/RuneButton';
import { Character } from '../../types';

interface CampfireMenuProps {
  characters?: Character[];
  onSelectCharacter: (id: string) => void;
  onBack: () => void;
  onCreate?: () => void;
}

export const CampfireMenu: React.FC<CampfireMenuProps> = ({ characters = [], onSelectCharacter, onBack, onCreate }) => {
  return (
    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent pt-20 animate-slide-up">
      <PixelCard variant="surface" className="border-t-4 border-gold">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-pixel text-gold text-sm">THE CAMPFIRE</h2>
          <button onClick={onBack} className="text-red-500 font-pixel text-[10px] hover:underline">[X] CLOSE</button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide justify-center">
          {/* Tombol Buat Karakter Baru */}
          <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 cursor-pointer transition-all"
               onClick={() => onCreate ? onCreate() : console.log('Create New Character')}>
            <div className="w-16 h-16 border-2 border-dashed border-faded flex items-center justify-center bg-black/30 rounded-none">
              <span className="text-2xl text-faded">+</span>
            </div>
            <span className="font-pixel text-[8px] text-faded">NEW SOUL</span>
          </div>

          {/* List Karakter (dari prop) */}
          {characters.map((char) => (
            <div key={char.id} onClick={() => onSelectCharacter(char.id)} className="cursor-pointer group relative">
               <AvatarFrame 
                 name={char.name}
                 imageUrl={char.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(char.name)}`}
                 size="md" 
                 status="online"
               />
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-wood px-2 py-1 pointer-events-none min-w-max z-50">
                 <span className="text-[10px] text-gold font-retro">Lvl {char.level} {char.class}</span>
               </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-faded font-retro text-sm italic">
          "Pilih jiwa yang akan menanggung takdirmu..."
        </div>
      </PixelCard>
    </div>
  );
};