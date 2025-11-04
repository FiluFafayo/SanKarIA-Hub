// REFAKTOR G-4: App.tsx (God Object) dibongkar.
// Tanggung jawabnya sekarang HANYA:
// 1. Inisialisasi service (Gemini, Supabase)
// 2. Manajemen Autentikasi (Session)
// 3. Memicu loading SSoT (via dataStore)
// 4. Me-render AppLayout (yang akan menangani semua logika view)

import React, { useCallback, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { useLocalStorage } from './hooks/useLocalStorage';
import { geminiService } from './services/geminiService';
import { dataService } from './services/dataService';
import { LoginView } from './views/LoginView';
import { useDataStore } from './store/dataStore'; // G-4
import { AppLayout } from './components/AppLayout'; // G-4

// (Fase 1.E Hotfix) Muat data definisi ke global scope
import { RACES } from './data/races';
import { CLASS_DEFINITIONS } from './data/classes';
import { BACKGROUNDS } from './data/backgrounds';
(window as any).RACES_DATA = RACES;
(window as any).CLASS_DEFINITIONS_DATA = CLASS_DEFINITIONS;
(window as any).BACKGROUNDS_DATA = BACKGROUNDS;

const App: React.FC = () => {
  const [theme, setTheme] = useLocalStorage<string>('sankaria-hub-theme', 'theme-sanc');
  
  // State Otentikasi
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const userId = session?.user?.id;

  // Ambil state SSoT dari store G-4
  const fetchInitialData = useDataStore(s => s.actions.fetchInitialData);
  const SSoT_hasLoaded = useDataStore(s => s.state.hasLoaded);

  // Efek Inisialisasi Layanan (Tidak berubah)
  useEffect(() => {
    const geminiKeysString = import.meta.env.VITE_GEMINI_API_KEYS || '';
    const geminiKeys = geminiKeysString.split(',')
      .map(key => key.trim())
      .filter(key => key);

    if (geminiKeys.length === 0) {
      console.warn("⚠️ VITE_GEMINI_API_KEYS environment variable tidak disetel atau kosong.");
    }
    geminiService.updateKeys(geminiKeys);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY environment variable belum disetel!");
      alert("Konfigurasi database belum lengkap. Aplikasi mungkin tidak berfungsi dengan benar.");
    }
    dataService.init(supabaseUrl, supabaseKey);
  }, []);
  
  // Efek Otentikasi (Tidak berubah)
  useEffect(() => {
    setIsAuthLoading(true);
    dataService.getSession().then(({ data: { session } }) => {
        setSession(session);
        setIsAuthLoading(false);
    });

    const { data: { subscription } } = dataService.onAuthStateChange((_event, session) => {
        setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // REFAKTOR G-4: Data Loading
  // Efek ini sekarang HANYA memicu fetch, tidak menyimpan state secara lokal.
  useEffect(() => {
    if (session && userId && !SSoT_hasLoaded) {
        fetchInitialData(userId);
    }
  }, [session, userId, fetchInitialData, SSoT_hasLoaded]);

  // =================================================================
  // FUNGSI HANDLER (DIHAPUS SEMUA)
  // (Semua logika dipindah ke dataStore.ts atau appStore.ts)
  // =================================================================
  
  // =================================================================
  // RENDER LOGIC (DISEDERHANAKAN)
  // =================================================================
  
  const LoadingScreen = () => (
     <div className={`w-screen h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}>
        <h1 className="font-cinzel text-5xl animate-pulse">SanKarIA Hub</h1>
        <p className="mt-2">Memuat semesta...</p>
    </div>
  );

  // 1. Tampilkan loading jika Auth belum selesai
  if (isAuthLoading) {
    return <LoadingScreen />;
  }
  
  // 2. Tampilkan login jika tidak ada sesi
  if (!session) {
    return <div className={theme}><LoginView /></div>;
  }
  
  // 3. Tampilkan AppLayout.
  // AppLayout akan menangani apakah harus render LoadingScreen (data),
  // GameScreen (runtime), atau ViewManager (modal/view).
  return (
    <div className={`w-screen h-screen bg-black overflow-hidden ${theme}`}>
      <AppLayout 
        userId={userId} 
        userEmail={session.user.email} 
        theme={theme} 
        setTheme={setTheme}
      />
    </div>
  );
};

export default App;