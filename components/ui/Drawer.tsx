import React from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  side?: 'left' | 'right' | 'bottom';
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, side = 'bottom' }) => {
  const sideCls = side === 'bottom' ? 'bottom-0 left-0 right-0 rounded-t-2xl' : side === 'left' ? 'left-0 top-0 bottom-0 rounded-r-2xl w-80' : 'right-0 top-0 bottom-0 rounded-l-2xl w-80';
  return (
    <div className={`fixed inset-0 z-40 ${isOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isOpen}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute ${sideCls} bg-bg-secondary border border-border-primary shadow-elevation-4 transition-transform ${isOpen ? 'translate-y-0' : side === 'bottom' ? 'translate-y-full' : 'translate-x-full'}`}>
        <div className="p-space-md border-b border-border-primary flex items-center justify-between">
          <span className="font-cinzel text-lg text-text-primary">{title}</span>
          <button className="text-text-secondary text-sm underline" onClick={onClose}>Tutup</button>
        </div>
        <div className="p-space-md text-text-primary">{children}</div>
      </div>
    </div>
  );
};

export default Drawer;