// components/game/ExplorationMap.tsx
// BARU: FASE 5
// Komponen ini merender Peta Eksplorasi (grid + fog)
// Diadaptasi dari P2 (pixel-vtt-stylizer ExplorationView)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapMarker, Tile } from '../../types';
import { EXPLORATION_TILESET } from '../../data/tileset';

interface ExplorationMapProps {
  grid: number[][];
  fog: boolean[][];
  playerPos: { x: number; y: number };
  // markers: MapMarker[]; // Kita belum gunakan marker di grid ini
}

// FASE 3: Hapus TILE_SIZE_PX. Ukuran akan di-handle oleh canvas scaling.
// const TILE_SIZE_PX = 8; 
const PLAYER_COLOR = "#FFFF00"; // Kuning
const FOG_COLOR = "#111827"; // (Warna BG Abu-900)

export const ExplorationMap: React.FC<ExplorationMapProps> = ({ grid, fog, playerPos }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef<boolean>(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const queuedPanRef = useRef<{ dx: number; dy: number } | null>(null);
  const wheelDebounceRef = useRef<number | null>(null);
  const wheelDeltaRef = useRef<number>(0);
  const wheelPosRef = useRef<{ mx: number; my: number }>({ mx: 0, my: 0 });

  const queuePan = useCallback((dx: number, dy: number) => {
    queuedPanRef.current = {
      dx: (queuedPanRef.current?.dx || 0) + dx,
      dy: (queuedPanRef.current?.dy || 0) + dy,
    };
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(() => {
        const q = queuedPanRef.current;
        queuedPanRef.current = null;
        rafIdRef.current = null;
        if (q) {
          setOffset(o => ({ x: o.x + q.dx, y: o.y + q.dy }));
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!grid || !fog || !playerPos) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mapHeight = grid.length; // 100
    const mapWidth = grid[0].length; // 100

    // FASE 3: Set ukuran canvas ke dimensi grid (misal 100x100).
    // CSS akan men-scale ini ke atas.
    canvas.width = mapWidth;
    canvas.height = mapHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // FASE 3: Hitung ukuran 1 tile (yaitu 1 piksel di canvas ini)
    const TILE_WIDTH = 1;
    const TILE_HEIGHT = 1;

    // Render Peta (diadaptasi dari P2)
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        
        if (fog[y][x]) {
            // 1. Gambar FOG
            ctx.fillStyle = FOG_COLOR;
            ctx.fillRect(x * TILE_WIDTH, y * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
        } else {
            // 2. Gambar Tile yang Terlihat
            const tileId = grid[y][x];
            const tile = EXPLORATION_TILESET[tileId as keyof typeof EXPLORATION_TILESET];
            ctx.fillStyle = tile ? tile.color : '#FF00FF'; // Magenta jika error
            ctx.fillRect(x * TILE_WIDTH, y * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
        }
      }
    }

    // 3. Gambar Token Pemain (diadaptasi dari P2)
    // Pastikan token hanya terlihat jika tidak di dalam fog
    if (playerPos.y >= 0 && playerPos.y < mapHeight && playerPos.x >= 0 && playerPos.x < mapWidth && !fog[playerPos.y][playerPos.x]) {
        ctx.fillStyle = PLAYER_COLOR;
        ctx.beginPath();
        ctx.arc(
            playerPos.x + TILE_WIDTH / 2, // 0.5
            playerPos.y + TILE_HEIGHT / 2, // 0.5
            TILE_WIDTH * 1.2, // Radius 1.2px
            0, 
            2 * Math.PI
        );
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
  }, [grid, fog, playerPos]);

  // Snap focus ke posisi pemain setiap kali berubah
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    // Ukuran dasar canvas = grid width/height (px)
    const mapWidth = canvas.width;
    const mapHeight = canvas.height;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const targetX = (playerPos.x / mapWidth) * rect.width * scale;
    const targetY = (playerPos.y / mapHeight) * rect.height * scale;
    setOffset({ x: centerX - targetX, y: centerY - targetY });
  }, [playerPos, scale]);

  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    container.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 1) {
      isPanningRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(activePointersRef.current.values());
    if (pts.length === 1 && isPanningRef.current && lastPointerRef.current) {
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      queuePan(dx, dy);
    } else if (pts.length === 2) {
      const [p1, p2] = pts;
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const prevDist = (handlePointerMove as any)._prevDist || dist;
      const delta = dist - prevDist;
      (handlePointerMove as any)._prevDist = dist;
      setScale(s => clamp(s + delta * 0.0015, 1, 4));
      setOffset(o => ({ x: o.x + (o.x - center.x) * (delta * 0.0005), y: o.y + (o.y - center.y) * (delta * 0.0005) }));
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    try { container.releasePointerCapture(e.pointerId); } catch {}
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size === 0) {
      isPanningRef.current = false;
      lastPointerRef.current = null;
      (handlePointerMove as any)._prevDist = undefined;
      const rect = container.getBoundingClientRect();
      setOffset(o => ({ x: clamp(o.x, rect.width * -1, rect.width * 1), y: clamp(o.y, rect.height * -1, rect.height * 1) }));
    }
  }, [handlePointerMove]);

  // Desktop: wheel zoom and keyboard pan/center
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    wheelPosRef.current = { mx, my };
    wheelDeltaRef.current += e.deltaY;
    if (wheelDebounceRef.current) {
      clearTimeout(wheelDebounceRef.current);
    }
    wheelDebounceRef.current = window.setTimeout(() => {
      const delta = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      const { mx: lmx, my: lmy } = wheelPosRef.current;
      const factor = delta > 0 ? 0.95 : 1.05;
      setScale(s => clamp(s * factor, 1, 4));
      setOffset(o => ({
        x: lmx - (lmx - o.x) * factor,
        y: lmy - (lmy - o.y) * factor,
      }));
    }, 60);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') queuePan(-20, 0);
    else if (e.key === 'ArrowRight') queuePan(20, 0);
    else if (e.key === 'ArrowUp') queuePan(0, -20);
    else if (e.key === 'ArrowDown') queuePan(0, 20);
    else if (e.key.toLowerCase() === 'c' || e.key === ' ') {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const mapWidth = canvas.width;
      const mapHeight = canvas.height;
      const targetX = (playerPos.x / mapWidth) * rect.width * scale;
      const targetY = (playerPos.y / mapHeight) * rect.height * scale;
      setOffset({ x: centerX - targetX, y: centerY - targetY });
    }
  }, [queuePan, playerPos, scale]);

  // Wrapper untuk scaling dan sentering
  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square bg-black overflow-hidden rounded-lg border-2 border-gray-700"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="absolute inset-0" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
        <canvas 
          ref={canvasRef}
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
};