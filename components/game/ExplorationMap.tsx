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

const TILE_SIZE_PX = 8; // Buat tile kecil untuk peta dunia 100x100
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

    // Set ukuran canvas agar sesuai (100 * 8px = 800px)
    canvas.width = mapWidth * TILE_SIZE_PX;
    canvas.height = mapHeight * TILE_SIZE_PX;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Peta (diadaptasi dari P2)
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        
        if (fog[y][x]) {
            // 1. Gambar FOG
            ctx.fillStyle = FOG_COLOR;
            ctx.fillRect(x * TILE_SIZE_PX, y * TILE_SIZE_PX, TILE_SIZE_PX, TILE_SIZE_PX);
        } else {
            // 2. Gambar Tile yang Terlihat
            const tileId = grid[y][x];
            const tile = EXPLORATION_TILESET[tileId as keyof typeof EXPLORATION_TILESET];
            ctx.fillStyle = tile ? tile.color : '#FF00FF'; // Magenta jika error
            ctx.fillRect(x * TILE_SIZE_PX, y * TILE_SIZE_PX, TILE_SIZE_PX, TILE_SIZE_PX);
        }
      }
    }

    // 3. Gambar Token Pemain (diadaptasi dari P2)
    // Pastikan token hanya terlihat jika tidak di dalam fog
    if (!fog[playerPos.y][playerPos.x]) {
        ctx.fillStyle = PLAYER_COLOR;
        ctx.beginPath();
        ctx.arc(
            playerPos.x * TILE_SIZE_PX + TILE_SIZE_PX / 2, 
            playerPos.y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 
            TILE_SIZE_PX / 1.5, // Buat token sedikit lebih besar
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