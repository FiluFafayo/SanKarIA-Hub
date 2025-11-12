// Update File: App.tsx
import React from 'react';
import { GameLayout } from './components/layout/GameLayout';
import { PixelCard } from './components/grimoire/PixelCard';
import { RuneButton } from './components/grimoire/RuneButton';
import { AvatarFrame } from './components/grimoire/AvatarFrame';
import { LogDrawer } from './components/grimoire/LogDrawer';

const App: React.FC = () => {
  // Dummy Data untuk test multiplayer look
  const dummyLogs = [
    { sender: "DM", message: "Kalian memasuki ruangan gelap...", type: 'system' as const },
    { sender: "Rizky", message: "Aku nyalain obor!", type: 'chat' as const },
    { sender: "System", message: "Rizky roll 1d20: Critical Fail (1)", type: 'system' as const },
  ];

  return (
    <GameLayout>
      <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto pb-20">
        
        {/* Header Test */}
        <div className="text-center">
            <h1 className="font-pixel text-gold text-xl mb-2">GRIMOIRE UI KIT</h1>
            <p className="font-retro text-faded">Phase 1 Validation</p>
        </div>

        {/* Multiplayer Party Test */}
        <PixelCard>
            <p className="font-pixel text-[10px] text-faded mb-4 text-center">PARTY STATUS</p>
            <div className="flex justify-around">
                <AvatarFrame 
                    name="You" 
                    imageUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
                    status="turn"
                    hpPercentage={80}
                />
                <AvatarFrame 
                    name="Budi" 
                    imageUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Budi" 
                    status="online"
                    hpPercentage={40}
                />
                <AvatarFrame 
                    name="Siti" 
                    imageUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Siti" 
                    status="afk"
                    hpPercentage={100}
                />
            </div>
        </PixelCard>

        {/* Buttons Test */}
        <div className="grid grid-cols-2 gap-4">
            <RuneButton label="ATTACK" variant="danger" />
            <RuneButton label="DEFEND" variant="primary" />
            <div className="col-span-2">
                <RuneButton label="OPEN INVENTORY" variant="secondary" fullWidth />
            </div>
        </div>

        {/* Text Content Test */}
        <PixelCard variant="paper">
            <h3 className="font-pixel text-void mb-2">Quest: The Lost API</h3>
            <p className="font-retro text-xl leading-tight">
                Temukan endpoint yang hilang di dalam reruntuhan kode legacy.
                Hati-hati terhadap bug <code>undefined</code> yang berkeliaran.
            </p>
        </PixelCard>

      </div>

      {/* Log Drawer Overlay */}
      <LogDrawer logs={dummyLogs} />

    </GameLayout>
  );
};

export default App;