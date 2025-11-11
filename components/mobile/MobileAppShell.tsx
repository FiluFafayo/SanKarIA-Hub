import React, { useState } from 'react';
import { BottomNav, BottomNavItem } from './BottomNav';
import { BottomSheet } from './BottomSheet';

interface MobileAppShellProps {
  children: React.ReactNode;
  chatSheet?: React.ReactNode;
  showBottomNav?: boolean;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({ children, chatSheet, showBottomNav = true }) => {
  const [active, setActive] = useState<BottomNavItem>('chat');
  const [chatOpen, setChatOpen] = useState<boolean>(false);

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0 pb-12 overflow-hidden">
        {children}
      </div>
      {showBottomNav && (
        <BottomNav active={active} onChange={setActive} onOpenChatSheet={() => setChatOpen(true)} />
      )}
      <BottomSheet isOpen={chatOpen} onClose={() => setChatOpen(false)} title="Ruang Chat">
        {chatSheet}
      </BottomSheet>
    </div>
  );
};