// File: src/App.tsx
// FASE 1: REFAKTOR TOTAL - MENGGUNAKAN APPLAYOUT
import React, { useState, useEffect } from 'react';
import { AppLayout } from './components/AppLayout';
import { GrimoireLogin } from './components/nexus/GrimoireLogin';
import { useAppStore } from './store/appStore';
import { useDataStore } from './store/dataStore';

const App: React.FC = () => {
  // Global App State
  const { user, isAuthLoading, initialize } = useAppStore();
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

  // A. Booting / Checking Auth
  if (isAuthLoading) {
     return (
        <div className="flex flex-col items-center justify-center h-full bg-black text-gold font-retro p-8 cursor-wait">
           <div className="mb-4 font-pixel animate-pulse text-xl">GRIMOIRE ENGINE</div>
           <div className="text-[10px] text-faded animate-pulse">CHECKING SOUL SIGNATURE...</div>
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