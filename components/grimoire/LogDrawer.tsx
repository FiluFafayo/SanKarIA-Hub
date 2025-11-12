// components/grimoire/LogDrawer.tsx
import React, { useState } from 'react';

interface LogDrawerProps {
  logs: { sender: string; message: string; type: 'chat' | 'system' }[];
}

export const LogDrawer: React.FC<LogDrawerProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Handle Tarikan (Selalu terlihat di bawah) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute bottom-0 left-0 right-0 h-8 bg-wood border-t-2 border-parchment 
        flex items-center justify-center cursor-pointer z-50 transition-all duration-300
        ${isOpen ? 'translate-y-[-300px]' : 'translate-y-0'}
        `}
      >
        <span className="font-pixel text-[10px] text-parchment animate-pulse">
          {isOpen ? "▼ TUTUP JURNAL ▼" : "▲ BUKA JURNAL ▲"}
        </span>
      </div>

      {/* Isi Drawer */}
      <div className={`absolute bottom-0 left-0 right-0 h-[300px] bg-surface border-t-4 border-wood z-40
        transform transition-transform duration-300 p-4 overflow-y-auto font-retro text-lg
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
      `}>
        {logs.map((log, i) => (
          <div key={i} className="mb-2 border-b border-white/10 pb-1 last:border-0">
            <span className={`font-bold ${log.type === 'system' ? 'text-gold' : 'text-blue-300'}`}>
              {log.sender}:
            </span> 
            <span className="text-parchment ml-2">{log.message}</span>
          </div>
        ))}
        <div className="text-center text-faded text-sm mt-4">--- End of Records ---</div>
      </div>
    </>
  );
};