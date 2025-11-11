import React, { useEffect } from 'react';

export type BannerType = 'info' | 'success' | 'warning' | 'error';

interface BannerProps {
  message: string;
  type?: BannerType;
  persist?: boolean; // true untuk penting (tidak auto-hide)
  durationMs?: number; // auto-hide setelah durasi
  onClose?: () => void;
}

export const Banner: React.FC<BannerProps> = ({ message, type = 'info', persist, durationMs = 3000, onClose }) => {
  useEffect(() => {
    if (!persist) {
      const t = setTimeout(() => onClose && onClose(), durationMs);
      return () => clearTimeout(t);
    }
  }, [persist, durationMs, onClose]);

  const colorByType = {
    info: 'bg-blue-900 text-blue-100 border-blue-700',
    success: 'bg-green-900 text-green-100 border-green-700',
    warning: 'bg-amber-900 text-amber-100 border-amber-700',
    error: 'bg-red-900 text-red-100 border-red-700',
  }[type];

  return (
    <div className={`w-full border ${colorByType} p-space-sm flex items-center justify-between`}> 
      <span className="text-sm">{message}</span>
      {persist && (
        <button aria-label="Tutup banner" onClick={onClose} className="text-xs underline">Tutup</button>
      )}
    </div>
  );
};

export default Banner;