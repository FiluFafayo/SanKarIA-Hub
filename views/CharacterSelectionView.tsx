// REFAKTOR G-4: Disederhanakan, props data dihapus
import React, { useState } from 'react';
import { ViewWrapper } from '../components/ViewWrapper';
import { Character, Location } from '../types';
import { getRawCharacterTemplates, RawCharacterData } from '../data/registry'; // Impor template
// FASE 2: Hapus dataStore
// import { useDataStore } from '../store/dataStore'; 
import { useAppStore } from '../store/appStore'; // Impor appStore
import { SelectionCard } from '../components/SelectionCard'; // Impor SelectionCard

interface CharacterSelectionViewProps {
  characters: Character[]; // SSoT Karakter milikku (tetap di-pass dari ViewManager)
  onSelect: (character: Character) => void;
  onClose: () => void;
}

export const CharacterSelectionView: React.FC<CharacterSelectionViewProps> = ({ characters, onSelect, onClose }) => {
  const templates = getRawCharacterTemplates();
  // FASE 2: Ganti aksi dataStore dengan aksi appStore
  const { navigateTo, startTemplateFlow } = useAppStore(s => s.actions);
  const [isCopying, setIsCopying] = useState<string | null>(null); // State loading (tetap lokal)
  const [errorMessage, setErrorMessage] = useState(''); // State error (tetap lokal)

  const handleCopyAndSelect = (template: RawCharacterData) => {
    // FASE 2: Fungsi ini tidak lagi async.
    // Fungsi ini HANYA menavigasi ke Wizard Cermin Jiwa
    // dengan membawa data template. Alur "Join Campaign"
    // akan ditangani oleh Wizard (ProfileView/ProfileWizard).
    setIsCopying(template.name);
    setErrorMessage('');
    try {
      startTemplateFlow(template);
      // navigateTo(Location.MirrorOfSouls) TIDAK DIPERLUKAN,
      // startTemplateFlow sudah melakukannya.
    } catch (e: any) {
      console.error("Gagal memulai alur template:", e);
      setErrorMessage(`Gagal memuat template ${template.name}.`);
      setIsCopying(null);
    }
  };

  const handleCreateNew = () => {
    navigateTo(Location.MirrorOfSouls); // Arahkan ke Cermin Jiwa
    // FASE 1 FIX: Hapus onClose(). Memanggil onClose() akan me-reset alur join (returnToNexus)
    // onClose(); 
  };

  return (
    <ViewWrapper onClose={onClose} title="Pilih Karakter Anda">
      {/* FASE 0: Hapus h-full, biarkan padding ViewWrapper bekerja */}
      <div className="flex flex-col items-center justify-center">
        <div className="bg-bg-secondary backdrop-blur-sm border border-amber-500/30 rounded-xl p-8 shadow-2xl max-w-2xl text-white w-full">
          <h2 className="font-cinzel text-3xl text-amber-100 mb-4 text-center">Pilih Jiwamu</h2>
          <p className="text-center text-gray-300 mb-6">Pahlawan mana yang akan memulai petualangan ini?</p>

          {characters.length === 0 ? (
            <div className="text-center">
              <p className="text-amber-200 mb-4">Anda belum memiliki karakter untuk bergabung. <br />Pilih salah satu template siap pakai di bawah ini, atau buat karakter baru.</p>

              <h3 className="font-cinzel text-xl text-amber-100 mb-4">Pilih Template Siap Pakai</h3>
              {errorMessage && <p className="text-red-400 text-sm mb-2">{errorMessage}</p>}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {templates.map(template => (
                  <div key={template.name} className="relative">
                    <SelectionCard
                      title={template.name}
                      description={`${template.race} ${template.class}`}
                      imageUrl={template.image}
                      isSelected={isCopying === template.name}
                      onClick={() => !isCopying && handleCopyAndSelect(template)}
                    />
                    {isCopying === template.name && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg animate-fade-in-fast">
                        <div className="w-8 h-8 border-2 border-t-amber-400 border-gray-600 rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 my-4">
                <div className="flex-grow border-t border-amber-700/50"></div>
                <span className="text-amber-200/70 text-sm">ATAU</span>
                <div className="flex-grow border-t border-amber-700/50"></div>
              </div>

              <button
                onClick={handleCreateNew}
                disabled={!!isCopying}
                className="w-full bg-blue-600 hover:bg-blue-500 font-cinzel text-lg py-3 rounded-lg shadow-lg disabled:bg-gray-600"
              >
                Buat Karakter Baru
              </button>
            </div>
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
