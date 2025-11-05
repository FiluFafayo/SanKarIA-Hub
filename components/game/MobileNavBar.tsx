import React from 'react';

// BARU: Tipe tab diperluas
export type MobileTab = 'chat' | 'character' | 'info' | 'battle';

interface MobileNavBarProps {
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
  gameState: 'exploration' | 'combat'; // BARU: Untuk render kondisional
}

const NavButton: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex-1 flex flex-col items-center justify-center p-2 transition-colors ${isActive ? 'text-purple-300' : 'text-gray-400 hover:text-white'}`}
    >
        {/* Placeholder for icon */}
        <span className="text-sm font-cinzel">{label}</span>
    </button>
);

export const MobileNavBar: React.FC<MobileNavBarProps> = ({ activeTab, setActiveTab, gameState }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gray-800 border-t-2 border-gray-700 flex justify-around items-stretch z-30">
        <NavButton label="Karakter" isActive={activeTab === 'character'} onClick={() => setActiveTab('character')} />
        
        {/* BARU: Render kondisional berdasarkan gameState */}
        {gameState === 'combat' ? (
            <NavButton label="Tempur" isActive={activeTab === 'battle'} onClick={() => setActiveTab('battle')} />
        ) : (
            <NavButton label="Chat" isActive={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
        )}
        
        <NavButton label="Info" isActive={activeTab === 'info'} onClick={() => setActiveTab('info')} />
        
        {/* BARU: Tampilkan Chat sebagai tab ke-4 jika sedang tempur */}
        {gameState === 'combat' && (
             <NavButton label="Chat" isActive={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
        )}
    </div>
  );
};