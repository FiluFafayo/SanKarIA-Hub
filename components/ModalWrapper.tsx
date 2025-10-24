import React from 'react';

interface ModalWrapperProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({ onClose, title, children }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-fast"
      onClick={onClose}
    >
      <div 
        className="relative"
        onClick={(e) => e.stopPropagation()} // Prevent click from closing modal
      >
        <h2 className="sr-only">{title}</h2>
        {children}
         <style>{`
            @keyframes fade-in-fast {
            from { opacity: 0; }
            to { opacity: 1; }
            }
            .animate-fade-in-fast {
            animation: fade-in-fast 0.2s ease-out forwards;
            }
        `}</style>
      </div>
    </div>
  );
};
