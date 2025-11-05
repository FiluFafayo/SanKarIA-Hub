// components/game/BattleMapRenderer.tsx
// BARU: FASE 3
// Komponen ini mengadaptasi logika rendering dari P2 (pixel-vtt-stylizer BattleView)
// dan logika kalkulasi dari P2 (ai-native rulesEngine).
// Ini adalah komponen 'dumb' yang hanya me-render state dari useCampaign.

import React, { useState, useMemo, useCallback } from 'react';
import { BattleState, Unit, TerrainType, GridCell } from '../../types';
import { CampaignActions } from '../../hooks/useCampaign';
import { calculateMovementOptions } from '../../services/battleRules';
import { BATTLE_TILESET } from '../../data/tileset'; // Impor tileset

interface BattleMapRendererProps {
  battleState: BattleState;
  campaignActions: CampaignActions;
  currentUserId: string; // Untuk menentukan apakah unit adalah 'kita'
}

// Ukuran grid (bisa diubah)
const BATTLE_GRID_WIDTH = 30;
const BATTLE_GRID_HEIGHT = 20;
const CELL_SIZE_PX = 40; // Ukuran sel dalam piksel

export const BattleMapRenderer: React.FC<BattleMapRendererProps> = ({ battleState, campaignActions, currentUserId }) => {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(battleState.activeUnitId);

  // Cek apakah unit yang terpilih adalah milik kita
  const isMyUnitSelected = useMemo(() => {
    return selectedUnitId === currentUserId;
  }, [selectedUnitId, currentUserId]);

  const selectedUnit = useMemo(() => {
    return battleState.units.find(u => u.id === selectedUnitId);
  }, [selectedUnitId, battleState.units]);

  // Kalkulasi jangkauan gerak (diadaptasi dari P2)
  const movementOptions = useMemo(() => {
    // Hanya kalkulasi jangkauan jika unit kita yang terpilih DAN itu giliran kita
    if (selectedUnit && isMyUnitSelected && battleState.activeUnitId === currentUserId) {
      return calculateMovementOptions(selectedUnit, battleState);
    }
    return new Set<string>(); // Kosongkan jika bukan giliran kita
  }, [selectedUnit, isMyUnitSelected, battleState, currentUserId]);

  // Handle klik sel (diadaptasi dari P2)
  const handleCellClick = (x: number, y: number) => {
    const unitAtCell = battleState.units.find(u => u.gridPosition.x === x && u.gridPosition.y === y);
    
    if (unitAtCell) {
      setSelectedUnitId(unitAtCell.id); // Pilih unit
    } else if (selectedUnit && isMyUnitSelected && movementOptions.has(`${x},${y}`)) {
      // Hitung biaya (Manhattan distance sederhana untuk prototipe P2)
      const start = selectedUnit.gridPosition;
      const cost = Math.abs(start.x - x) + Math.abs(start.y - y); 
      
      // Panggil aksi dari useCampaign (P1)
      campaignActions.moveUnit({ unitId: selectedUnit.id, newPosition: { x, y }, cost });
    }
  };

  // Helper untuk warna grid (diadaptasi dari P2)
  const getTerrainColor = (cell: GridCell) => {
    // Kita tidak lagi menggunakan P2 TerrainType, tapi kita bisa memetakannya
    // Untuk Fase 3, kita buat transparan agar Peta HD terlihat
    return 'rgba(255, 255, 255, 0.1)'; // Overlay grid tipis
  };
  
  const mapPixelWidth = BATTLE_GRID_WIDTH * CELL_SIZE_PX;
  const mapPixelHeight = BATTLE_GRID_HEIGHT * CELL_SIZE_PX;

  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center overflow-auto p-4">
        {/* Wrapper untuk menjaga rasio aspek & sentering */}
        <div
            className="relative bg-gray-800 bg-cover bg-center shadow-lg"
            style={{
                width: mapPixelWidth,
                height: mapPixelHeight,
                minWidth: mapPixelWidth,
                minHeight: mapPixelHeight,
                backgroundImage: battleState.mapImageUrl ? `url(${battleState.mapImageUrl})` : 'none',
                backgroundColor: battleState.mapImageUrl ? 'transparent' : '#333'
            }}
        >
            {/* 1. Render Grid & Movement Options (diadaptasi dari P2) */}
            <div
                className="absolute inset-0 grid"
                style={{ 
                    gridTemplateColumns: `repeat(${BATTLE_GRID_WIDTH}, 1fr)`,
                    width: mapPixelWidth,
                    height: mapPixelHeight,
                }}
            >
                {battleState.gridMap.flat().map((cell, index) => {
                    const x = index % BATTLE_GRID_WIDTH;
                    const y = Math.floor(index / BATTLE_GRID_WIDTH);
                    const isReachable = movementOptions.has(`${x},${y}`);
                    const isSelectedUnit = selectedUnit?.gridPosition.x === x && selectedUnit?.gridPosition.y === y;
                    
                    return (
                        <div
                            key={`${x}-${y}`}
                            onClick={() => handleCellClick(x, y)}
                            className="border border-gray-600/30"
                            style={{
                                backgroundColor: isReachable 
                                    ? 'rgba(59, 130, 246, 0.4)' // Biru (P2)
                                    : isSelectedUnit
                                    ? 'rgba(250, 204, 21, 0.3)' // Kuning
                                    : 'rgba(255, 255, 255, 0.05)', // Grid tipis
                                cursor: isReachable || battleState.units.some(u=>u.gridPosition.x === x && u.gridPosition.y === y) 
                                    ? 'pointer' 
                                    : 'default',
                            }}
                        ></div>
                    );
                })}
            </div>
            
            {/* 2. Render Units (Tokens) (diadaptasi dari P2) */}
            {battleState.units.map(unit => (
                <div
                    key={unit.id}
                    className={`absolute w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 ${
                        unit.isPlayer ? 'bg-blue-600' : 'bg-red-600'
                    } ${
                        selectedUnitId === unit.id ? 'ring-4 ring-yellow-400 z-10' : 'ring-2 ring-black/70'
                    } ${
                        unit.id === battleState.activeUnitId ? 'animate-pulse' : ''
                    }`}
                    style={{
                        width: CELL_SIZE_PX * 0.8,
                        height: CELL_SIZE_PX * 0.8,
                        left: unit.gridPosition.x * CELL_SIZE_PX + CELL_SIZE_PX / 2,
                        top: unit.gridPosition.y * CELL_SIZE_PX + CELL_SIZE_PX / 2,
                    }}
                    onClick={() => setSelectedUnitId(unit.id)}
                >
                    {unit.name.substring(0, 1)}
                </div>
            ))}

            {/* 3. Loading Overlay (jika mapImageUrl belum ada) */}
            {!battleState.mapImageUrl &&
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20">
                    <div className="w-16 h-16 border-4 border-t-amber-500 border-gray-200 rounded-full animate-spin"></div>
                    <p className="mt-4 text-white text-lg font-cinzel">Mempersiapkan Medan Tempur...</p>
                </div>
            }
        </div>
    </div>
  );
};