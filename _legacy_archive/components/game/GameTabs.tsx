// FASE 0: Komponen BARU
// Navigasi ergonomis mobile-first.
import React from 'react';

export type GameTab = 'chat' | 'character' | 'info';

interface GameTabsProps {
  activeTab: GameTab;
  onTabChange: (tab: GameTab) => void;
}

// Icon SVG
const ChatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.722.06c-.247.477-.505.94-.79 1.372l-1.938 2.325c-.42.504-1.12.504-1.54 0l-1.938-2.325a12.003 12.003 0 0 1-.79-1.372H7.98c-1.136 0-1.98-.967-1.98-2.193V10.608c0-.97.616-1.813 1.5-2.097m14.25-4.816a48.568 48.568 0 0 0-10.406 0l-3 1.125a3 3 0 0 0-2.02 2.875v.5a3 3 0 0 0 2.02 2.875l3 1.125a48.568 48.568 0 0 0 10.406 0l3-1.125a3 3 0 0 0 2.02-2.875v-.5a3 3 0 0 0-2.02-2.875l-3-1.125Z" />
    </svg>
);
const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
);
const CharacterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A1.5 1.5 0 0 1 18 21.75H6A1.5 1.5 0 0 1 4.501 20.118Z" />
    </svg>
);

const TabButton: React.FC<{icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex-1 flex flex-col items-center justify-center p-2 transition-colors ${
            isActive ? 'text-purple-300' : 'text-gray-400 hover:text-white'
        }`}
    >
        {icon}
        <span className="text-xs font-medium">{label}</span>
    </button>
);

export const GameTabs: React.FC<GameTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="flex-shrink-0 flex justify-around bg-gray-800 border-t-2 border-gray-700 lg:hidden">
        <TabButton
            icon={<ChatIcon />}
            label="Chat"
            isActive={activeTab === 'chat'}
            onClick={() => onTabChange('chat')}
        />
        <TabButton
            icon={<CharacterIcon />}
            label="Karakter"
            isActive={activeTab === 'character'}
            onClick={() => onTabChange('character')}
        />
        <TabButton
            icon={<InfoIcon />}
            label="Info"
            isActive={activeTab === 'info'}
            onClick={() => onTabChange('info')}
        />
    </nav>
  );
};