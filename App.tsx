// File: src/App.tsx
// FASE 1: REFAKTOR TOTAL - MENGGUNAKAN APPLAYOUT
import React, { useState, useEffect } from 'react';
import { AppLayout } from './components/AppLayout';
import { GrimoireLogin } from './components/nexus/GrimoireLogin';
import { useAppStore } from './store/appStore';
import { useDataStore } from './store/dataStore';

const App: React.FC = () => {
  // Global App State
  // Ambil authLog juga untuk debugging visual
  const { user, isAuthLoading, auth, initialize } = useAppStore(s => ({
      ...s,
      auth: s.auth // Pastikan kita bisa akses auth.authLog
  }));
  const { actions: dataActions } = useDataStore();

  // UI State
  const [theme, setTheme] = useState('theme-grimoire'); // Default theme

  // 1. Boot Sequence (Auth)
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 2. Data Sequence (SSoT)
  // Pipa Data disambungkan di sini: Saat user login, otomatis fetch data.
  useEffect(() => {
    if (user && !isAuthLoading) {
        console.log("[App] User authenticated, initializing SSoT...");
        dataActions.fetchInitialData(user.id);
    }
  }, [user, isAuthLoading, dataActions]);

  // Render Logic

  // A. Booting / Checking Auth (DEBUG VIEW)
  if (isAuthLoading) {
     return (
        <div className="flex flex-col items-center justify-center h-full bg-black text-gold font-retro p-8 cursor-wait font-mono">
           <div className="mb-4 font-pixel animate-pulse text-xl text-center">GRIMOIRE ENGINE<br/><span className="text-xs text-red-500">DEBUG MODE</span></div>
           <div className="text-[10px] text-faded animate-pulse mb-4">CHECKING SOUL SIGNATURE...</div>

           {/* VISUAL LOGGING */}
           <div className="w-full max-w-md bg-gray-900/50 border border-gray-800 p-2 text-[9px] text-green-400 font-mono overflow-y-auto max-h-[200px] rounded">
               {auth?.authLog?.map((log, i) => (
                   <div key={i} className="border-b border-gray-800/50 pb-1 mb-1 last:border-0">
                       {`> ${log}`}
                   </div>
               ))}
               <div className="animate-pulse text-green-700">_</div>
           </div>
           <div className="mt-4 text-[9px] text-gray-600">Auto-timeout in 5s...</div>
        </div>
     );
  }

  // B. Login Gate (Jika tidak ada user)
  if (!user) {
     return <GrimoireLogin />;
  }

  // C. Main App Layout (Jika user ada)
  // AppLayout menangani: Loading Data, Error Data, Game Screen, dan View Manager (Nexus).
  return (
    <AppLayout 
        userId={user.id}
        userEmail={user.email}
        theme={theme}
        setTheme={setTheme}
    />
  );
};

export default App;