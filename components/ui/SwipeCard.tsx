import React, { useRef, useState } from 'react';

interface SwipeCardProps {
  title?: string;
  subtitle?: string;
  onConfirm?: () => void; // swipe right
  onDetail?: () => void;  // swipe left
  children?: React.ReactNode;
}

// Simple horizontal swipe card for prototype interactions
export const SwipeCard: React.FC<SwipeCardProps> = ({ title, subtitle, onConfirm, onDetail, children }) => {
  const startX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const threshold = 80; // px

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || startX.current === null) return;
    const dx = e.clientX - startX.current;
    setDragX(dx);
  };
  const endDrag = () => {
    if (!dragging) return;
    const dx = dragX;
    setDragging(false);
    startX.current = null;
    // decide
    if (dx > threshold) {
      onConfirm?.();
    } else if (dx < -threshold) {
      onDetail?.();
    }
    // reset position
    setDragX(0);
  };

  return (
    <div className="relative"
      style={{ touchAction: 'pan-y' }}
    >
      {/* overlays */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-space-md">
        <span className={`text-emerald-300 font-semibold transition-opacity ${dragX > threshold / 2 ? 'opacity-100' : 'opacity-0'}`}>Confirm →</span>
        <span className={`text-sky-300 font-semibold transition-opacity ${dragX < -threshold / 2 ? 'opacity-100' : 'opacity-0'}`}>← Detail</span>
      </div>
      <div
        className="bg-surface-secondary border border-gray-700 rounded-token-md shadow-token-sm p-space-md select-none"
        style={{ transform: `translateX(${dragX}px)`, transition: dragging ? 'none' : 'transform 200ms ease' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {title && (
          <div className="mb-space-xs">
            <div className="font-semibold text-text-primary">{title}</div>
            {subtitle && <div className="text-xs text-text-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="text-sm text-text-primary">
          {children}
        </div>
      </div>
    </div>
  );
};

export default SwipeCard;