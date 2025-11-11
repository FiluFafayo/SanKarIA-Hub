import React from 'react';

export type BottomNavItem = 'chat' | 'character' | 'info' | 'more';

interface BottomNavProps {
  active: BottomNavItem;
  onChange: (item: BottomNavItem) => void;
  onOpenChatSheet?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ active, onChange, onOpenChatSheet }) => {
  const base = 'flex-1 py-2 text-center font-cinzel text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900';
  const inactive = 'text-gray-300';
  const activeCls = 'text-purple-300';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-gray-900 border-t border-gray-800 flex pb-safe">
      <button aria-label="Buka chat" className={`${base} ${active === 'chat' ? activeCls : inactive}`} onClick={() => { onChange('chat'); onOpenChatSheet && onOpenChatSheet(); }}>Chat</button>
      <button aria-label="Buka panel karakter" className={`${base} ${active === 'character' ? activeCls : inactive}`} onClick={() => onChange('character')}>Karakter</button>
      <button aria-label="Buka panel info" className={`${base} ${active === 'info' ? activeCls : inactive}`} onClick={() => onChange('info')}>Info</button>
      <button aria-label="Buka lainnya" className={`${base} ${active === 'more' ? activeCls : inactive}`} onClick={() => onChange('more')}>Lainnya</button>
    </nav>
  );
};