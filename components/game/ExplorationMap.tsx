// components/game/ExplorationMap.tsx
// BARU: FASE 5
// Komponen ini merender Peta Eksplorasi (grid + fog)
// Diadaptasi dari P2 (pixel-vtt-stylizer ExplorationView)

import React, { useEffect, useRef } from 'react';
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

  // Wrapper untuk scaling dan sentering
  return (
    <div className="relative w-full aspect-square bg-black overflow-hidden rounded-lg border-2 border-gray-700">
        <canvas 
            ref={canvasRef} 
            className="w-full h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
        />
    </div>
  );
};