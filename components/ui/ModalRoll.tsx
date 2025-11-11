import React from 'react';

interface ModalRollProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const ModalRoll: React.FC<ModalRollProps> = ({ isOpen, onClose, title = 'Roll' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border-primary rounded-token-lg shadow-elevation-4 p-space-md w-80 text-text-primary">
        <h3 className="font-cinzel text-xl mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-4">Wireframe modal untuk aksi roll (d20/d6, dsb.).</p>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 bg-amber-700 text-white rounded-token-md" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
};

export default ModalRoll;