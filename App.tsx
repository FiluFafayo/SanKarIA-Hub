// File: src/App.tsx
// GRIMOIRE ENGINE v1.0 (Restored & Hardened)
import React, { useState, useEffect } from 'react';
import { GameLayout } from './components/layout/GameLayout';
import { NexusScene } from './components/scenes/NexusScene';
import { BattleScene } from './components/scenes/BattleScene';
import { ExplorationScene } from './components/scenes/ExplorationScene';
import { GrimoireLogin } from './components/nexus/GrimoireLogin';
import { useAppStore } from './store/appStore';
import { useDataStore } from './store/dataStore';

// --- KOMPONEN DEBUG/BOOT (Hardened) ---
const BootScreen: React.FC<{ logs: string[]; isStuck: boolean }> = ({ logs, isStuck }) => (
  <div className="flex flex-col items-center justify-center h-full bg-black text-gold font-retro p-8 cursor-wait font-mono z-50 relative">
    <div className="mb-4 font-pixel animate-pulse text-xl text-center">
      GRIMOIRE ENGINE <span className="text-xs text-red-500 block">PARANOID BOOT</span>
    </div>
    
    {/* Status Indicator */}
    <div className="text-[10px] text-faded animate-pulse mb-4 flex flex-col items-center gap-2">
       <span>MEMVERIFIKASI TANDA TANGAN JIWA...</span>
       {isStuck && <span className="text-red-500 font-bold bg-red-900/20 px-2 py-1 border border-red-800">TIMEOUT DETECTED - RETRYING...</span>}
    </div>

    {/* Visual Logger (CCTV) */}
    <div className="w-full max-w-md bg-gray-900/50 border border-gray-800 p-2 text-[9px] text-green-400 font-mono overflow-y-auto h-[200px] rounded shadow-inner">
       {logs.map((log, i) => (
           <div key={i} className="border-b border-gray-800/50 pb-1 mb-1 last:border-0 break-words">
               <span className="opacity-50 mr-2">[{i}]</span>{log}
           </div>
       ))}
       <div className="animate-pulse text-green-700">_</div>
    </div>
    
    {/* Loading Bar Fake-but-Cool */}
    <div className="w-full max-w-[200px] h-1 bg-gray-800 mt-4 relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-gold h-full w-[50%] animate-loading-bar shadow-[0_0_10px_#d4af37]"></div>
    </div>
  </div>
);

// --- KOMPONEN ERROR DATA ---
const DataErrorScreen: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
    <div className="flex flex-col items-center justify-center h-full bg-void text-red-500 font-retro p-8 z-50">
        <h1 className="text-2xl font-pixel mb-4">KONEKSI SEMESTA TERPUTUS</h1>
        <div className="border border-red-900 bg-red-950/30 p-4 max-w-md text-center text-xs font-mono text-red-300 mb-6">
            {error}
        </div>
        <button 
            onClick={onRetry}
            className="px-6 py-3 border-2 border-red-600 hover:bg-red-900/50 text-red-100 font-pixel transition-all active:scale-95"
        >
            COBA LAGI (RITUAL ULANG)
        </button>
    </div>
);

const App: React.FC = () => {
  // 1. State Global (Direct Access - No Getters!)
  const { auth, initialize } = useAppStore(s => ({ auth: s.auth, initialize: s.initialize }));
  const { state: dataState, actions: dataActions } = useDataStore();
  
  // Unpack untuk kemudahan (Direct Access)
  const user = auth.user;
  const isAuthLoading = auth.isAuthLoading;
  const authLog = auth.authLog || []; // Fallback array kosong

  // 2. State Lokal Mesin (The Grimoire State Machine)
  const [appState, setAppState] = useState<'BOOT' | 'NEXUS' | 'EXPLORATION' | 'BATTLE'>('BOOT');
  const [isBootStuck, setIsBootStuck] = useState(false);

  // EFFECT 1: Boot Sequence (Auth)
  useEffect(() => {
    const bootTimeout = setTimeout(() => setIsBootStuck(true), 8000); // 8 detik panic button
    initialize();
    return () => clearTimeout(bootTimeout);
  }, [initialize]);

  // EFFECT 2: Data Sequence (SSoT)
  // Pipa Data: Saat user login && auth kelar -> Fetch Data.
  useEffect(() => {
    if (user && !isAuthLoading) {
        // Hanya fetch jika belum loaded, tidak sedang loading, dan tidak error
        if (!dataState.hasLoaded && !dataState.isLoading && !dataState.error) {
            console.log("[App] User authenticated, initializing SSoT...");
            dataActions.fetchInitialData(user.id);
        }
    }
  }, [user, isAuthLoading, dataState.hasLoaded, dataState.isLoading, dataState.error, dataActions]);

  // EFFECT 3: State Transition Guard
  useEffect(() => {
    // A. Jika Auth Loading -> Paksa BOOT
    if (isAuthLoading) {
        if (appState !== 'BOOT') setAppState('BOOT');
        return;
    }

    // B. Jika Auth Selesai tapi tidak ada User -> NEXUS (Login Mode)
    if (!user) {
        if (appState !== 'NEXUS') setAppState('NEXUS');
        return;
    }

    // C. Jika User Ada -> NEXUS (Scene Mode) 
    if (user && appState === 'BOOT') {
        setAppState('NEXUS');
    }

    // D. Jika User Logout saat main -> Tendang ke NEXUS
    if (!user && (appState === 'BATTLE' || appState === 'EXPLORATION')) {
        setAppState('NEXUS');
    }

  }, [isAuthLoading, user, appState]);

  // --- RENDER LOGIC (Layout Grimoire) ---

  return (
    <GameLayout>
      
      {/* LAYER 1: BOOT SCREEN (Blocking) */}
      {isAuthLoading && (
        <div className="absolute inset-0 z-[100]">
            <BootScreen logs={authLog} isStuck={isBootStuck} />
        </div>
      )}

      {/* LAYER 2: DATA ERROR (Blocking) */}
      {!isAuthLoading && user && dataState.error && (
         <div className="absolute inset-0 z-[90]">
            <DataErrorScreen 
                error={dataState.error} 
                onRetry={() => user && dataActions.fetchInitialData(user.id)} 
            />
         </div>
      )}

      {/* LAYER 3: DATA LOADING OVERLAY (Non-Blocking / Transparent) 
          Hanya tampil jika user ada, auth kelar, tapi data sedang ditarik
      */}
      {!isAuthLoading && user && dataState.isLoading && !dataState.hasLoaded && (
          <div className="absolute inset-0 z-[80] bg-black/80 flex items-center justify-center">
              <div className="text-gold font-pixel animate-pulse">MEMBUKA GERBANG SEMESTA...</div>
          </div>
      )}

      {/* LAYER 4: SCENE MANAGER */}
      {!isAuthLoading && (
        <>
            {/* A. LOGIN / NEXUS HUB */}
            {appState === 'NEXUS' && (
                !user ? (
                    <GrimoireLogin />
                ) : (
                    // Pastikan data sudah siap sebelum menampilkan NexusScene agar tidak glitch
                    (dataState.hasLoaded || dataState.characters.length >= 0) && (
                        <NexusScene 
                            onStartGame={() => setAppState('EXPLORATION')} 
                        />
                    )
                )
            )}

            {/* B. EXPLORATION SCENE */}
            {appState === 'EXPLORATION' && user && (
                <ExplorationScene 
                    onEncounter={() => setAppState('BATTLE')}
                />
            )}

            {/* C. BATTLE SCENE */}
            {appState === 'BATTLE' && user && (
                <BattleScene 
                    onExit={() => setAppState('EXPLORATION')}
                />
            )}
        </>
      )}

    </GameLayout>
  );
};

export default App;