// App.tsx
import React, { useState, useEffect } from 'react';
import { GameLayout } from './components/layout/GameLayout';
import { NexusScene } from './components/scenes/NexusScene';

const BootScreen = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-black text-green-500 font-retro">
    <div className="mb-4 font-pixel animate-pulse">SYSTEM BOOT_</div>
    <div className="w-full max-w-[200px] h-1 bg-gray-900">
        <div className="h-full bg-green-700 animate-[grow_2s_ease-out_forwards]" style={{width: '100%'}}></div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    // Fake boot sequence time
    setTimeout(() => setBooted(true), 1500);
  }, []);

  return (
    <GameLayout>
      {!booted ? <BootScreen /> : <NexusScene />}
    </GameLayout>
  );
};

export default App;