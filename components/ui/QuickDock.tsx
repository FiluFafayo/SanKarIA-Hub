import React from 'react';

type DockItem = 'explore' | 'combat' | 'chat';

interface QuickDockProps {
  active: DockItem;
  onChange: (item: DockItem) => void;
  hidden?: boolean; // hide sementara saat keyboard aktif di Chat
  fixed?: boolean; // jika false, render inline bukan fixed
}

export const QuickDock: React.FC<QuickDockProps> = ({ active, onChange, hidden, fixed = true }) => {
  if (hidden) return null;
  const base = 'flex-1 py-2 text-center font-cinzel text-sm';
  const inactive = 'text-gray-300';
  const activeCls = 'text-amber-300';
  const wrapperCls = fixed
    ? 'fixed bottom-0 left-0 right-0 z-30 bg-gray-900 border-t border-gray-800 flex pb-safe'
    : 'relative bg-gray-900/80 border-t border-gray-800 flex rounded-md';
  return (
    <nav className={wrapperCls}>
      <button className={`${base} ${active === 'explore' ? activeCls : inactive}`} onClick={() => onChange('explore')}>Explore</button>
      <button className={`${base} ${active === 'combat' ? activeCls : inactive}`} onClick={() => onChange('combat')}>Combat</button>
      <button className={`${base} ${active === 'chat' ? activeCls : inactive}`} onClick={() => onChange('chat')}>Chat</button>
    </nav>
  );
};

export default QuickDock;