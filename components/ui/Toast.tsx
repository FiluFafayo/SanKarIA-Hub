import React, { useEffect } from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastProps {
  message: string;
  type?: ToastType;
  durationMs?: number;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', durationMs = 2500, onClose }) => {
  useEffect(() => {
    const t = setTimeout(() => onClose && onClose(), durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onClose]);

  const colorByType = {
    info: 'bg-blue-900 text-blue-100 border-blue-700',
    success: 'bg-green-900 text-green-100 border-green-700',
    warning: 'bg-amber-900 text-amber-100 border-amber-700',
    error: 'bg-red-900 text-red-100 border-red-700',
  }[type];

  return (
    <div className={`pointer-events-auto bg-bg-secondary border border-border-primary shadow-elevation-3 rounded-token-md p-space-sm ${colorByType}`}>
      <span className="text-sm">{message}</span>
    </div>
  );
};

export default Toast;