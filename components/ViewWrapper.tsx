import React from 'react';

interface ViewWrapperProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}

export const ViewWrapper: React.FC<ViewWrapperProps> = ({ children, onClose, title }) => {
  return (
    <div className="fixed inset-0 bg-bg-primary text-text-primary z-50 flex flex-col animate-fade-in">
      <header className="flex-shrink-0 bg-bg-secondary/80 backdrop-blur-sm p-4 flex items-center justify-between border-b border-border-primary">
        <h1 className="font-cinzel text-2xl text-accent-primary">{title}</h1>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-bg-tertiary text-text-primary rounded-full z-10 hover:bg-red-600 transition-colors flex items-center justify-center text-2xl"
          aria-label="Kembali ke Nexus"
        >
          &times;
        </button>
      </header>
      <main className="flex-grow overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
            {children}
        </div>
      </main>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
