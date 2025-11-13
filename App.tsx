// File: src/App.tsx
import React, { useState, useEffect } from 'react';
import { GameLayout } from './components/layout/GameLayout';
import { NexusScene } from './components/scenes/NexusScene';
import { BattleScene } from './components/scenes/BattleScene';
import { GrimoireLogin } from './components/nexus/GrimoireLogin';
import { useAppStore } from './store/appStore';

// Komponen Loading Awal (Boot Sequence)
const BootScreen = () => (
  <div className="flex flex-col items-center justify-center h-full bg-void text-stamina font-retro p-8 cursor-wait">
    <div className="mb-4 font-pixel animate-pulse text-xl text-gold">GRIMOIRE ENGINE</div>
    <div className="text-xs text-faded mb-8 font-mono">v0.9.0 - NUCLEAR UPDATE</div>

    {/* Loading Bar Retro */}
    <div className="w-full max-w-[200px] h-2 bg-gray-900 border border-wood relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-gold animate-[grow_2s_ease-out_forwards] w-full shadow-[0_0_10px_#d4af37]"></div>
    </div>

    <div className="mt-2 text-[10px] text-faded animate-pulse">INITIALIZING ASSETS...</div>
  </div>
);

const App: React.FC = () => {
  const { user, initialize } = useAppStore(); // Ambil User & Init Function
  // State Mesin: Menentukan layar mana yang aktif
  const [appState, setAppState] = useState<'BOOT' | 'NEXUS' | 'BATTLE'>('BOOT');

  useEffect(() => {
    initialize(); // Cek sesi login saat aplikasi dimuat
    // Simulasi booting sistem (2 detik)
    const timer = setTimeout(() => setAppState('NEXUS'), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GameLayout>

      {/* STATE 1: BOOT SCREEN */}
      {appState === 'BOOT' && <BootScreen />}

      {/* STATE 2: MAIN MENU (NEXUS) or LOGIN GATE */}
      {appState === 'NEXUS' && (
        !user ? (
          <GrimoireLogin />
        ) : (
          <NexusScene
            // Ini kabel yang kita sambung tadi. 
            // Kalau user masuk gerbang, ubah state ke BATTLE.
            onStartGame={() => setAppState('BATTLE')}
          />
        )
      )}

      {/* STATE 3: GAMEPLAY (BATTLE) */}
      {appState === 'BATTLE' && (
        <BattleScene
          // Kalau user kabur/exit, kembalikan ke NEXUS
          onExit={() => setAppState('NEXUS')}
        />
      )}

    </GameLayout>
  );
};

export default App;