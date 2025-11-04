import React, { Dispatch, SetStateAction, useState } from 'react';
import { ModalWrapper } from '../ModalWrapper';

interface SettingsModalProps {
  onClose: () => void;
  apiKeys: string[];
  setApiKeys: Dispatch<SetStateAction<string[]>>;
  currentTheme: string;
  setTheme: Dispatch<SetStateAction<string>>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, apiKeys, setApiKeys, currentTheme, setTheme }) => {
    const [activeStation, setActiveStation] = useState('Connection');
    const [masterVolume, setMasterVolume] = useState(100);
    const [musicVolume, setMusicVolume] = useState(75);

    const handleKeyChange = (index: number, value: string) => {
        const newKeys = [...apiKeys];
        newKeys[index] = value;
        setApiKeys(newKeys);
    };

    const addKeySlot = () => {
        setApiKeys([...apiKeys, '']);
    };
    
    const removeKeySlot = (index: number) => {
        if (apiKeys.length > 1) {
            const newKeys = apiKeys.filter((_, i) => i !== index);
            setApiKeys(newKeys);
        }
    };

  return (
    <ModalWrapper onClose={onClose} title="Bengkel Juru Cipta">
      <div className="bg-[#2a2a2a] backdrop-blur-sm border border-yellow-700/50 rounded-lg shadow-2xl w-[90vw] max-w-3xl text-amber-100 flex min-h-[500px]">
        {/* Sidebar */}
        <div className="w-1/3 bg-black/30 p-4 border-r border-yellow-800/30">
            <h2 className="font-cinzel text-3xl mb-6">Bengkel Juru Cipta</h2>
            <nav className="flex flex-col gap-2">
                <button onClick={() => setActiveStation('Connection')} className={`p-2 rounded text-left font-cinzel transition-colors ${activeStation === 'Connection' ? 'bg-amber-700 text-white' : 'hover:bg-amber-800/50'}`}>Koneksi Alkimia</button>
                <button onClick={() => setActiveStation('Audio')} className={`p-2 rounded text-left font-cinzel transition-colors ${activeStation === 'Audio' ? 'bg-amber-700 text-white' : 'hover:bg-amber-800/50'}`}>Gramofon Ajaib</button>
                <button onClick={() => setActiveStation('Display')} className={`p-2 rounded text-left font-cinzel transition-colors ${activeStation === 'Display' ? 'bg-amber-700 text-white' : 'hover:bg-amber-800/50'}`}>Astrolab Optik</button>
            </nav>
        </div>
        {/* Content */}
        <div className="w-2/3 p-8">
            {activeStation === 'Connection' && (
                <div>
                    <h3 className="text-2xl font-cinzel mb-2">Meja Koneksi Alkimia</h3>
                    <p className="text-sm text-amber-200/70 mb-4">Masukkan kristal Kunci API Gemini Anda. Sistem akan berotasi untuk memastikan koneksi yang stabil.</p>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {apiKeys.map((key, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full ${key ? 'bg-green-400 animate-pulse' : 'bg-gray-600'} border-2 border-gray-400`}></div>
                            <input 
                                type="password"
                                value={key}
                                onChange={(e) => handleKeyChange(index, e.target.value)}
                                placeholder={`Slot Kristal ${index + 1}`}
                                className="flex-grow bg-black/30 border border-amber-800 rounded px-3 py-1 text-amber-100 focus:outline-none focus:border-amber-500"
                            />
                            {apiKeys.length > 1 && <button onClick={() => removeKeySlot(index)} className="text-red-500 hover:text-red-400 text-xl">&times;</button>}
                        </div>
                    ))}
                    </div>
                    <button onClick={addKeySlot} className="mt-4 text-sm font-cinzel text-amber-300 hover:text-amber-100">+ Tambah slot kunci</button>
                </div>
            )}
            {activeStation === 'Audio' && (
                 <div>
                    <h3 className="text-2xl font-cinzel mb-2">Gramofon Ajaib</h3>
                     <p className="text-sm text-amber-200/70 mb-4">Sesuaikan suasana pendengaran dari pengalaman Anda.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block mb-1">Volume Utama</label>
                            <input type="range" className="w-full" value={masterVolume} onChange={e => setMasterVolume(parseInt(e.target.value, 10))}/>
                        </div>
                         <div>
                            <label className="block mb-1">Volume Musik</label>
                            <input type="range" className="w-full" value={musicVolume} onChange={e => setMusicVolume(parseInt(e.target.value, 10))} />
                        </div>
                         <div>
                            <label className="block mb-1">Suara AI DM</label>
                            <select className="w-full bg-black/30 border border-amber-800 rounded px-3 py-1">
                                <option>Piringan Kristal - 'Sejarawan'</option>
                                <option>Piringan Obsidian - 'Pelawak'</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
             {activeStation === 'Display' && (
                 <div>
                    <h3 className="text-2xl font-cinzel mb-2">Astrolab Optik</h3>
                    <p className="text-sm text-amber-200/70 mb-4">Kalibrasi antarmuka visual Anda.</p>
                    <div className="space-y-4">
                         <div>
                            <label className="block mb-1">Tema UI</label>
                             <select value={currentTheme} onChange={e => setTheme(e.target.value)} className="w-full bg-black/30 border border-amber-800 rounded px-3 py-1">
                                <option value="theme-sanc">Nadi Suaka (Default)</option>
                                <option value="theme-oracle">Orakel Cahaya Bintang</option>
                                <option value="theme-sunstone">Perpustakaan Batu Surya</option>
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1">Ukuran Font (Segera Hadir)</label>
                            <input type="range" className="w-full" disabled/>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </ModalWrapper>
  );
};