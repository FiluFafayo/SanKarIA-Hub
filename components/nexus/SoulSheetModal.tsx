import React from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { AvatarFrame } from '../grimoire/AvatarFrame';
import { Character, ALL_ABILITIES } from '../../types';
import { getAbilityModifier } from '../../utils';

interface SoulSheetModalProps {
  character: Character;
  onSelect: () => void;
  onClose: () => void;
}

export const SoulSheetModal: React.FC<SoulSheetModalProps> = ({ character, onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
      <PixelCard variant="surface" className="w-full max-w-md border-gold shadow-pixel-lg relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="text-center border-b border-wood/50 pb-4 mb-4">
          <h2 className="font-pixel text-xl text-gold tracking-widest uppercase">{character.name}</h2>
          <p className="font-retro text-faded text-xs">
            Level {character.level} {character.race} {character.class}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6 pr-2">
          
          {/* Visual & Core Stats */}
          <div className="flex gap-4 items-center">
            <div className="flex-shrink-0">
              <AvatarFrame 
                name={character.name} 
                imageUrl={character.avatar_url} 
                size="lg" 
                status="online" // Cosmetic only in preview
              />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2 text-center">
              <div className="bg-black/40 p-2 border border-wood rounded">
                <div className="text-faded text-[10px] font-pixel">HP</div>
                <div className="text-green-400 font-pixel text-lg">{character.maxHp}</div>
              </div>
              <div className="bg-black/40 p-2 border border-wood rounded">
                <div className="text-faded text-[10px] font-pixel">AC</div>
                <div className="text-blue-400 font-pixel text-lg">{character.armorClass}</div>
              </div>
              <div className="bg-black/40 p-2 border border-wood rounded">
                <div className="text-faded text-[10px] font-pixel">SPEED</div>
                <div className="text-parchment font-pixel text-lg">{character.speed}</div>
              </div>
              <div className="bg-black/40 p-2 border border-wood rounded">
                <div className="text-faded text-[10px] font-pixel">PROF</div>
                <div className="text-parchment font-pixel text-lg">+{Math.ceil(1 + (character.level / 4))}</div>
              </div>
            </div>
          </div>

          {/* Ability Scores Grid */}
          <div>
            <h3 className="font-pixel text-gold text-xs mb-2 border-b border-wood/30 pb-1">ATRIBUT UTAMA</h3>
            <div className="grid grid-cols-3 gap-2">
              {ALL_ABILITIES.map((ability) => {
                const score = character.abilityScores[ability];
                const mod = getAbilityModifier(score);
                return (
                  <div key={ability} className="flex flex-col items-center bg-black/20 p-2 border border-wood/50 rounded hover:border-gold/50 transition-colors">
                    <span className="text-[8px] text-faded uppercase tracking-wider">{ability.substring(0, 3)}</span>
                    <span className="font-pixel text-parchment text-lg">{score}</span>
                    <span className="text-[10px] text-gold font-bold">{mod > 0 ? '+' : ''}{mod}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Background & Lore */}
          <div className="space-y-2">
            <h3 className="font-pixel text-gold text-xs mb-1 border-b border-wood/30 pb-1">LATAR BELAKANG</h3>
            <div className="bg-black/30 p-3 border border-wood/30 rounded">
                <p className="text-xs text-parchment font-retro mb-1">
                    <span className="text-faded">Background:</span> {character.background}
                </p>
                <p className="text-xs text-parchment font-retro italic">
                    "{character.personalityTrait || 'Seorang petualang misterius...'}"
                </p>
            </div>
          </div>

          {/* Equipment Summary */}
          <div>
             <h3 className="font-pixel text-gold text-xs mb-2 border-b border-wood/30 pb-1">PERLENGKAPAN</h3>
             <div className="flex flex-wrap gap-1">
                {character.inventory.slice(0, 6).map((inv, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-1 bg-black/50 border border-wood/40 text-faded rounded">
                        {inv.item.name} {inv.quantity > 1 ? `x${inv.quantity}` : ''}
                    </span>
                ))}
                {character.inventory.length > 6 && (
                    <span className="text-[10px] px-2 py-1 text-faded italic">+{character.inventory.length - 6} lainnya...</span>
                )}
             </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-wood flex gap-3">
          <RuneButton 
            label="KEMBALI" 
            variant="secondary" 
            onClick={onClose} 
            fullWidth 
          />
          <RuneButton 
            label="PILIH JIWA INI" 
            variant="primary" 
            onClick={onSelect} 
            fullWidth 
          />
        </div>

      </PixelCard>
    </div>
  );
};