import React from 'react';
import { ViewWrapper } from '../components/ViewWrapper';
import { Character } from '../types';

interface CharacterSelectionViewProps {
  characters: Character[];
  onSelect: (character: Character) => void; // REFAKTOR: Kirim objek penuh
  onClose: () => void;
}

export const CharacterSelectionView: React.FC<CharacterSelectionViewProps> = ({ characters, onSelect, onClose }) => {
  return (
    <ViewWrapper onClose={onClose} title="Pilih Karakter Anda">
        <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-bg-secondary backdrop-blur-sm border border-amber-500/30 rounded-xl p-8 shadow-2xl max-w-2xl text-white">
                <h2 className="font-cinzel text-3xl text-amber-100 mb-4 text-center">Pilih Jiwamu</h2>
                <p className="text-center text-gray-300 mb-6">Pahlawan mana yang akan memulai petualangan ini?</p>
                
                {characters.length === 0 ? (
                <p className="text-center text-red-400">Anda tidak punya karakter. Mohon buat satu di Cermin Jiwa terlebih dahulu.</p>
                ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {characters.map(char => (
                    <div
                        key={char.id}
                        onClick={() => onSelect(char)} // REFAKTOR: Kirim objek char penuh
                        className="flex flex-col items-center p-4 bg-black/30 rounded-lg cursor-pointer border-2 border-transparent hover:border-amber-400 transition-colors transform hover:scale-105"
                    >
                        <img src={char.image} alt={char.name} className="w-24 h-24 rounded-full border-2 border-gray-500 mb-2" />
                        <h3 className="font-cinzel text-center">{char.name}</h3>
                        <p className="text-xs text-gray-400">{char.class} - Lvl {char.level}</p>
                    </div>
                    ))}
                </div>
                )}
            </div>
      </div>
    </ViewWrapper>
  );
};
