// File: App.tsx
import React, { useState, useEffect } from 'react';
import { GameLayout } from './components/layout/GameLayout';

// Placeholder Screens (Nanti kita pisah file)
const BootScreen = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-pulse">
    <h1 className="text-2xl text-gold font-pixel mb-4">GRIMOIRE_OS</h1>
    <p className="text-parchment text-xl">Initializing Mana Streams...</p>
    <div className="mt-8 w-full h-4 border-2 border-wood p-1">
        <div className="h-full bg-blood w-[60%] animate-[ping_1s_ease-in-out_infinite]"></div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulasi loading assets/koneksi awal
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GameLayout>
      {isLoading ? (
        <BootScreen />
      ) : (
        // Nanti di sini adalah 'SceneManager' kita
        <div className="flex flex-col items-center justify-center h-full p-4">
             <h2 className="text-4xl font-pixel text-gold mb-4 text-shadow-sm">NEXUS</h2>
             <p className="text-center mb-8 text-xl">
               "Selamat datang kembali, Traveler."
             </p>
             
             {/* Tombol Sementara gaya Grimoire */}
             <button className="bg-wood text-parchment font-pixel py-4 px-6 
                                border-b-4 border-black active:border-b-0 active:translate-y-1 
                                shadow-pixel-md hover:bg-opacity-90 transition-all w-full max-w-xs">
              MASUK GERBANG
             </button>
        </div>
      )}
    </GameLayout>
  );
};

export default App;