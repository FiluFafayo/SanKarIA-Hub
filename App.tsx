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
      {/* Ganti animasi grow (palsu) dengan indeterminate (jujur) */}
      <div className="absolute inset-y-0 left-0 bg-gold w-full opacity-50"></div>
      <div className="absolute inset-y-0 left-0 bg-gold h-full w-[50%] animate-pulse shadow-[0_0_10px_#d4af37]"></div>
    </div>

    <div className="mt-2 text-[10px] text-faded animate-pulse">CHECKING AUTH...</div>
  </div>
);

const App: React.FC = () => {
  const user = useAppStore((s) => s.auth.user);
  const isAuthLoading = useAppStore((s) => s.auth.isAuthLoading);
  const initialize = useAppStore((s) => s.initialize);
  // State Mesin: Menentukan layar mana yang aktif
  const [appState, setAppState] = useState<'BOOT' | 'NEXUS' | 'BATTLE'>('BOOT');

  // Effect 1: Hanya panggil initialize saat mount
  useEffect(() => {
    initialize(); // Cek sesi login saat aplikasi dimuat
  }, [initialize]); // Tambahkan dependency

  // Effect 2: Pindahkan state dari BOOT ke NEXUS HANYA SAAT auth selesai loading
  useEffect(() => {
    // Jika kita di state BOOT dan loading selesai (sudah false)
    if (appState === 'BOOT' && !isAuthLoading) {
      // Pindahkan ke NEXUS. Timer 2 detik dihapus.
      setAppState('NEXUS');
    }

    // Jika user logout (user jadi null) saat di dalam battle/game,
    // paksa kembali ke NEXUS (layar login)
    if (appState === 'BATTLE' && !user && !isAuthLoading) {
        setAppState('NEXUS');
    }

  }, [isAuthLoading, appState, user]); // Dijalankan tiap isAuthLoading, appState, atau user berubah

  return (
    <GameLayout>

      {/* STATE 1: BOOT SCREEN.
        Tampilkan ini jika appState masih 'BOOT' ATAU jika auth masih loading.
        Ini adalah kunci anti-race-condition.
      */}
      {(appState === 'BOOT' || isAuthLoading) && <BootScreen />}

      {/* STATE 2: MAIN MENU (NEXUS) or LOGIN GATE
        Hanya tampilkan jika appState 'NEXUS' DAN auth SUDAH TIDAK loading
      */}
      {appState === 'NEXUS' && !isAuthLoading && (
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

      {/* STATE 3: GAMEPLAY (BATTLE)
        Hanya tampilkan jika appState 'BATTLE' DAN auth SUDAH TIDAK loading
      */}
      {appState === 'BATTLE' && !isAuthLoading && (
        <BattleScene
          // Kalau user kabur/exit, kembalikan ke NEXUS
          onExit={() => setAppState('NEXUS')}
        />
      )}

    </GameLayout>
  );
};

export default App;