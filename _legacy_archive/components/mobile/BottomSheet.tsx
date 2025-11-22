import React, { useEffect, useRef } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={`fixed inset-0 z-40 ${isOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isOpen}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={ref}
        className={`absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 rounded-t-2xl shadow-2xl transition-transform ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="p-3 flex items-center justify-between">
          <div className="h-1.5 w-12 bg-gray-600 rounded-full mx-auto" />
        </div>
        {title && <div className="px-4 pb-2 text-gray-300 font-cinzel">{title}</div>}
        <div className="px-4 pb-4 max-h-[50vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};