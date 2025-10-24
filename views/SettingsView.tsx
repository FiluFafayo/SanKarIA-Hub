
import React, { Dispatch, SetStateAction, useState, useEffect } from 'react';
import { ViewWrapper } from '../components/ViewWrapper';
import { geminiService } from '../services/geminiService';

interface SettingsViewProps {
    onClose: () => void;
    apiKeys: string[]; // Tetap terima untuk testing & info
    // HAPUS: setApiKeys: Dispatch<SetStateAction<string[]>>;
    currentTheme: string;
    setTheme: Dispatch<SetStateAction<string>>;
    supabaseUrl: string; // Tetap terima untuk info
    // HAPUS: setSupabaseUrl: Dispatch<SetStateAction<string>>;
    supabaseKeyConfigured: boolean; // Ganti supabaseKey dengan boolean status
    // HAPUS: setSupabaseKey: Dispatch<SetStateAction<string>>;
}

type TestStatus = 'idle' | 'loading' | 'success' | 'error';
interface TestResult {
    status: TestStatus;
    message?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    onClose, apiKeys, currentTheme, setTheme,
    supabaseUrl, supabaseKeyConfigured // Terima props baru
}) => {
    const [activeStation, setActiveStation] = useState('Connection');
    const [masterVolume, setMasterVolume] = useState(100);
    const [musicVolume, setMusicVolume] = useState(75);
    const [testResults, setTestResults] = useState<TestResult[]>([]);

    useEffect(() => {
        setTestResults(apiKeys.map(() => ({ status: 'idle' })));
    }, [apiKeys.length]);

    const handleTestKey = async (index: number) => {
        const keyToTest = apiKeys[index];
        setTestResults(prev => {
            const newResults = [...prev];
            newResults[index] = { status: 'loading', message: 'Menguji...' };
            return newResults;
        });

        const result = await geminiService.testApiKey(keyToTest);

        setTestResults(prev => {
            const newResults = [...prev];
            newResults[index] = {
                status: result.success ? 'success' : 'error',
                message: result.message,
            };
            return newResults;
        });
    };

    const getStatusDotClass = (status: TestStatus) => {
        switch (status) {
            case 'loading': return 'bg-yellow-400 animate-pulse';
            case 'success': return 'bg-green-400';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-600';
        }
    };

    const getStatusMessageClass = (status: TestStatus) => {
        switch (status) {
            case 'success': return 'text-green-400';
            case 'error': return 'text-red-400';
            default: return 'text-amber-200/70';
        }
    }


    return (
        <ViewWrapper onClose={onClose} title="Bengkel Juru Cipta">
            <div className="bg-bg-secondary border border-yellow-700/50 rounded-lg shadow-2xl text-amber-100 flex flex-col md:flex-row min-h-[600px]">
                {/* Sidebar */}
                <div className="w-full md:w-1/3 bg-black/30 p-4 md:p-6 border-b md:border-b-0 md:border-r border-yellow-800/30 md:rounded-l-lg">
                    <h2 className="font-cinzel text-2xl md:text-3xl mb-4 md:mb-6 text-center md:text-left">Stasiun Kerja</h2>
                    <nav className="flex flex-row md:flex-col gap-2">
                        <button onClick={() => setActiveStation('Connection')} className={`flex-1 md:flex-none p-3 rounded text-center md:text-left font-cinzel transition-colors ${activeStation === 'Connection' ? 'bg-amber-700 text-white' : 'hover:bg-amber-800/50'}`}>Koneksi</button>
                        <button onClick={() => setActiveStation('Audio')} className={`flex-1 md:flex-none p-3 rounded text-center md:text-left font-cinzel transition-colors ${activeStation === 'Audio' ? 'bg-amber-700 text-white' : 'hover:bg-amber-800/50'}`}>Audio</button>
                        <button onClick={() => setActiveStation('Display')} className={`flex-1 md:flex-none p-3 rounded text-center md:text-left font-cinzel transition-colors ${activeStation === 'Display' ? 'bg-amber-700 text-white' : 'hover:bg-amber-800/50'}`}>Tampilan</button>
                    </nav>
                </div>
                {/* Content */}
                <div className="w-full md:w-2/3 p-6 md:p-8">
                    {activeStation === 'Connection' && (
                        <div>
                            <h3 className="text-2xl font-cinzel mb-2">Meja Koneksi Alkimia</h3>
                            <p className="text-sm text-amber-200/70 mb-6">Koneksi diambil dari environment variables.</p>

                            <h4 className="font-cinzel text-lg text-amber-300 border-b border-amber-500/20 pb-1 mb-3">Koneksi Gemini AI</h4>
                            <div className="space-y-4 mb-6">
                                {apiKeys.length > 0 ? apiKeys.map((key, index) => ( // Cek jika ada keys
                                    <div key={index}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded-full ${getStatusDotClass(testResults[index]?.status || 'idle')} border-2 border-gray-400 flex-shrink-0 transition-colors`}></div>
                                            {/* Ganti Input dengan Teks Status */}
                                            <p className="flex-grow bg-black/20 border border-amber-800/50 rounded px-3 py-2 text-amber-100/70 italic">
                                                Kunci API Gemini #{index + 1} (Terkonfigurasi)
                                            </p>
                                            <button onClick={() => handleTestKey(index)} disabled={testResults[index]?.status === 'loading'} className="...">
                                                {testResults[index]?.status === 'loading' ? '...' : 'Test'}
                                            </button>
                                            {/* Hapus tombol remove (-) */}
                                        </div>
                                        {testResults[index]?.message && (
                                            <p className={`text-xs ml-6 mt-1 ${getStatusMessageClass(testResults[index].status)}`}>
                                                {testResults[index].message}
                                            </p>
                                        )}
                                    </div>
                                )) : (
                                    <p className="text-amber-200/70 italic">Tidak ada kunci API Gemini yang dikonfigurasi di environment.</p>
                                )}
                            </div>
                            {/* Hapus tombol + Tambah slot */}

                            <h4 className="font-cinzel text-lg text-amber-300 border-b border-amber-500/20 pb-1 mb-3">Koneksi Database Supabase</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block mb-1 text-sm">Supabase Project URL</label>
                                    {/* Ganti Input dengan Teks */}
                                    <p className="w-full bg-black/20 border border-amber-800/50 rounded px-3 py-2 text-amber-100/90 break-all">
                                        {supabaseUrl || <span className="italic text-amber-100/50">Belum dikonfigurasi</span>}
                                    </p>
                                </div>
                                <div>
                                    <label className="block mb-1 text-sm">Supabase Anon (Public) Key</label>
                                    {/* Ganti Input dengan Teks Status */}
                                    <p className="w-full bg-black/20 border border-amber-800/50 rounded px-3 py-2 text-amber-100/70 italic">
                                        {supabaseKeyConfigured ? 'Kunci Anon (Terkonfigurasi)' : <span className="text-amber-100/50">Belum dikonfigurasi</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeStation === 'Audio' && (
                        <div>
                            <h3 className="text-2xl font-cinzel mb-2">Gramofon Ajaib</h3>
                            <p className="text-sm text-amber-200/70 mb-6">Sesuaikan suasana pendengaran dari pengalaman Anda.</p>
                            <div className="space-y-6">
                                <div>
                                    <label className="block mb-1">Volume Utama</label>
                                    <input type="range" className="w-full accent-amber-500" value={masterVolume} onChange={e => setMasterVolume(parseInt(e.target.value, 10))} />
                                </div>
                                <div>
                                    <label className="block mb-1">Volume Musik</label>
                                    <input type="range" className="w-full accent-amber-500" value={musicVolume} onChange={e => setMusicVolume(parseInt(e.target.value, 10))} />
                                </div>
                                <div>
                                    <label className="block mb-1">Suara AI DM</label>
                                    <select className="w-full bg-black/30 border border-amber-800 rounded px-3 py-2">
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
                            <p className="text-sm text-amber-200/70 mb-6">Kalibrasi antarmuka visual Anda.</p>
                            <div className="space-y-6">
                                <div>
                                    <label className="block mb-1">Tema UI</label>
                                    <select value={currentTheme} onChange={e => setTheme(e.target.value)} className="w-full bg-black/30 border border-amber-800 rounded px-3 py-2">
                                        <option value="theme-sanc">Nadi Suaka (Default)</option>
                                        <option value="theme-oracle">Orakel Cahaya Bintang</option>
                                        <option value="theme-sunstone">Perpustakaan Batu Surya</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block mb-1 text-gray-500">Ukuran Font (Segera Hadir)</label>
                                    <input type="range" className="w-full" disabled />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ViewWrapper>
    );
};
