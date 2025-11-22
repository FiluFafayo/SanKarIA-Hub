// components/game/BattleMapRenderer.tsx
// BARU: FASE 3
// Komponen ini mengadaptasi logika rendering dari P2 (pixel-vtt-stylizer BattleView)
// dan logika kalkulasi dari P2 (ai-native rulesEngine).
// Ini adalah komponen 'dumb' yang hanya me-render state dari useCampaign.

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { BattleState, Unit, TerrainType, GridCell } from '../../types';
import { CampaignActions } from '../../hooks/useCampaign';
import { calculateMovementOptions, findShortestPath } from '../../services/battleRules';
import { BATTLE_TILESET } from '../../data/tileset'; // Impor tileset

interface BattleMapRendererProps {
  battleState: BattleState;
  campaignActions: CampaignActions;
  currentUserId: string; // Untuk menentukan apakah unit adalah 'kita'
  onMoveUnit?: (unitId: string, path: { x: number; y: number }[], cost: number) => void;
  onTargetTap?: (unitId: string) => void; // Tap target untuk aksi aktif (Attack/Spell/Item)
  onQuickAction?: (action: 'Attack' | 'Skill' | 'Spell' | 'Item' | 'Disengage' | 'Dodge', unitId: string) => void; // Long-press quick wheel
  onRollD20?: () => void; // Mini dice quick roll
}

// Ukuran grid (bisa diubah)
const BATTLE_GRID_WIDTH = 30;
const BATTLE_GRID_HEIGHT = 20;
// FASE 3: CELL_SIZE_PX dihapus. Ukuran akan responsif.

export const BattleMapRenderer: React.FC<BattleMapRendererProps> = ({ battleState, campaignActions, currentUserId, onMoveUnit, onTargetTap, onQuickAction, onRollD20 }) => {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(battleState.activeUnitId);
  const [quickWheel, setQuickWheel] = useState<{ leftPercent: number; topPercent: number; unitId: string } | null>(null);
  const [pressTimer, setPressTimer] = useState<any>(null);

  // Gesture state: pinch/pan/zoom & snap focus
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  // Cek apakah unit yang terpilih adalah milik kita
  const isMyUnitSelected = useMemo(() => {
    return selectedUnitId === currentUserId;
  }, [selectedUnitId, currentUserId]);

  const selectedUnit = useMemo(() => {
    return battleState.units.find(u => u.id === selectedUnitId);
  }, [selectedUnitId, battleState.units]);

  // Snap focus ke unit aktif ketika berubah
  useEffect(() => {
    const unitIdToFocus = selectedUnitId || battleState.activeUnitId;
    const u = battleState.units.find(uu => uu.id === unitIdToFocus);
    const container = containerRef.current;
    if (!u || !container) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const xPercent = (u.gridPosition.x / BATTLE_GRID_WIDTH) * 100;
    const yPercent = (u.gridPosition.y / BATTLE_GRID_HEIGHT) * 100;
    const targetX = (xPercent / 100) * rect.width * scale;
    const targetY = (yPercent / 100) * rect.height * scale;
    setOffset({ x: centerX - targetX, y: centerY - targetY });
  }, [selectedUnitId, battleState.activeUnitId, battleState.units, scale]);

  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  const handleContainerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    container.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 1) {
      isPanningRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleContainerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(activePointersRef.current.values());
    if (pts.length === 1 && isPanningRef.current && lastPointerRef.current) {
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      queuePan(dx, dy);
    } else if (pts.length === 2) {
      // Pinch zoom
      const [p1, p2] = pts;
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const prevDist = (handleContainerPointerMove as any)._prevDist || dist;
      const delta = dist - prevDist;
      (handleContainerPointerMove as any)._prevDist = dist;
      setScale(s => clamp(s + delta * 0.0015, 1, 3.5));
      setOffset(o => ({ x: o.x + (o.x - center.x) * (delta * 0.0005), y: o.y + (o.y - center.y) * (delta * 0.0005) }));
    }
  }, []);

  const handleContainerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    try { container.releasePointerCapture(e.pointerId); } catch {}
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size === 0) {
      isPanningRef.current = false;
      lastPointerRef.current = null;
      (handleContainerPointerMove as any)._prevDist = undefined;
      const rect = container.getBoundingClientRect();
      setOffset(o => ({ x: clamp(o.x, rect.width * -1, rect.width * 1), y: clamp(o.y, rect.height * -1, rect.height * 1) }));
    }
  }, [handleContainerPointerMove]);

  // Desktop: wheel zoom and keyboard pan/center/roll
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
      setScale(s => clamp(s * factor, 1, 3.5));
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
    else if (e.key.toLowerCase() === 'r') {
      onRollD20 && onRollD20();
    } else if (e.key === 'Escape') {
      setQuickWheel(null);
    } else if (e.key.toLowerCase() === 'c' || e.key === ' ') {
      // center to active unit
      const container = containerRef.current;
      const unitIdToFocus = selectedUnitId || battleState.activeUnitId;
      const u = battleState.units.find(uu => uu.id === unitIdToFocus);
      if (!container || !u) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const xPercent = (u.gridPosition.x / BATTLE_GRID_WIDTH) * 100;
      const yPercent = (u.gridPosition.y / BATTLE_GRID_HEIGHT) * 100;
      const targetX = (xPercent / 100) * rect.width * scale;
      const targetY = (yPercent / 100) * rect.height * scale;
      setOffset({ x: centerX - targetX, y: centerY - targetY });
    }
  }, [queuePan, onRollD20, selectedUnitId, battleState.activeUnitId, battleState.units, scale]);

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
      // Gunakan path terpendek berbasis medan untuk biaya gerak
      const result = findShortestPath(selectedUnit, battleState, { x, y });
      if (!result) return;
      const { cost, path } = result;

      if (onMoveUnit) {
        onMoveUnit(selectedUnit.id, path, cost);
      } else {
        // Fallback: langsung pesan moveUnit jika handler tidak disediakan
        campaignActions.moveUnit({ unitId: selectedUnit.id, newPosition: { x, y }, cost });
      }
    }
  };

  // Helper untuk warna grid (diadaptasi dari P2)
  const getTerrainColor = (cell: GridCell) => {
    // Kita tidak lagi menggunakan P2 TerrainType, tapi kita bisa memetakannya
    // Untuk Fase 3, kita buat transparan agar Peta HD terlihat
    return 'rgba(255, 255, 255, 0.1)'; // Overlay grid tipis
  };
  
  // FASE 3: Hapus kalkulasi piksel tetap
  // const mapPixelWidth = BATTLE_GRID_WIDTH * CELL_SIZE_PX;
  // const mapPixelHeight = BATTLE_GRID_HEIGHT * CELL_SIZE_PX;
  
  // FASE 3: Hitung rasio aspek dari konstanta grid
  const aspectRatio = `${BATTLE_GRID_WIDTH} / ${BATTLE_GRID_HEIGHT}`;

  return (
    // FASE 3: Wrapper sekarang mengisi area (w-full h-full) dan menggunakan padding/aspect-ratio
    // alih-alih overflow-auto. Ini adalah inti perbaikan Mobile-First.
    <div className="w-full h-full bg-gray-900 flex items-center justify-center p-2 md:p-4">
        {/* Wrapper untuk menjaga rasio aspek & sentering */}
        <div
            ref={containerRef}
            className="relative bg-gray-800 shadow-lg w-full max-w-full max-h-full"
            style={{
                aspectRatio: aspectRatio, // Biarkan CSS menangani ukuran
                backgroundColor: '#333'
            }}
            onPointerDown={handleContainerPointerDown}
            onPointerMove={handleContainerPointerMove}
            onPointerUp={handleContainerPointerUp}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            {/* Transform container for pinch/pan/zoom */}
            <div className="absolute inset-0" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
              {/* Background image follows transform */}
              <div className="absolute inset-0" style={{ backgroundImage: battleState.mapImageUrl ? `url(${battleState.mapImageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.6 }}></div>
              {/* 1. Render Grid & Movement Options (diadaptasi dari P2) */}
              <div
                  className="absolute inset-0 grid"
                  style={{ 
                      gridTemplateColumns: `repeat(${BATTLE_GRID_WIDTH}, 1fr)`,
                      // FASE 3: Hapus width/height tetap. Biarkan 'inset-0' mengisi parent.
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
            {battleState.units.map(unit => {
                // FASE 3: Kalkulasi posisi/ukuran responsif (persentase)
                const cellWidthPercent = 100 / BATTLE_GRID_WIDTH;
                const cellHeightPercent = 100 / BATTLE_GRID_HEIGHT;
                
                // Ukuran unit adalah 80% dari lebar sel (dalam persentase parent)
                const unitWidthPercent = cellWidthPercent * 0.8;
                // Ukuran unit adalah 80% dari tinggi sel (dalam persentase parent)
                const unitHeightPercent = cellHeightPercent * 0.8;
                
                const leftPercent = (unit.gridPosition.x / BATTLE_GRID_WIDTH) * 100 + (cellWidthPercent / 2);
                const topPercent = (unit.gridPosition.y / BATTLE_GRID_HEIGHT) * 100 + (cellHeightPercent / 2);

                const handlePointerDown = (e: React.PointerEvent) => {
                    // Mulai timer untuk long-press
                    if (pressTimer) clearTimeout(pressTimer);
                    const t = setTimeout(() => {
                        setQuickWheel({ leftPercent, topPercent, unitId: unit.id });
                    }, 450);
                    setPressTimer(t);
                };

                const handlePointerUp = () => {
                    if (pressTimer) {
                        clearTimeout(pressTimer);
                        setPressTimer(null);
                    }
                };

                const handleClick = () => {
                    setSelectedUnitId(unit.id);
                    if (onTargetTap) onTargetTap(unit.id);
                };

                return (
                    <div
                        key={unit.id}
                        // FASE 3: Hapus 'w-8 h-8'
                        className={`absolute rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 ${
                            unit.isPlayer ? 'bg-blue-600' : 'bg-red-600'
                        } ${
                            selectedUnitId === unit.id ? 'ring-4 ring-yellow-400 z-10' : 'ring-2 ring-black/70'
                        } ${
                            unit.id === battleState.activeUnitId ? 'animate-pulse' : ''
                        }`}
                        style={{
                            // FASE 3: Ukuran dan Posisi Responsif (Persentase)
                            width: `${unitWidthPercent}%`,
                            height: `${unitHeightPercent}%`,
                            left: `${leftPercent}%`,
                            top: `${topPercent}%`,
                        }}
                        onClick={handleClick}
                        onPointerDown={handlePointerDown}
                        onPointerUp={handlePointerUp}
                    >
                        {unit.name.substring(0, 1)}
                    </div>
                );
            })}

            </div>

            {/* 3. Loading Overlay (jika mapImageUrl belum ada) */}
            {!battleState.mapImageUrl &&
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20">
                    <div className="w-16 h-16 border-4 border-t-amber-500 border-gray-200 rounded-full animate-spin"></div>
                    <p className="mt-4 text-white text-lg font-cinzel">Mempersiapkan Medan Tempur...</p>
                </div>
            }

            {/* Quick Wheel (Long-press) */}
            {quickWheel && (
                <div
                  className="absolute z-30"
                  style={{ left: `${quickWheel.leftPercent}%`, top: `${quickWheel.topPercent}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div className="bg-gray-800/90 backdrop-blur rounded-full p-2 flex gap-2 border border-gray-600">
                    {['Attack','Disengage','Dodge','Spell','Item','Skill'].map(a => (
                      <button
                        key={a}
                        className="text-xs px-2 py-1 rounded-full bg-gray-700 text-white hover:bg-purple-600"
                        onClick={() => { onQuickAction && onQuickAction(a as any, quickWheel.unitId); setQuickWheel(null); }}
                      >{a}</button>
                    ))}
                    <button className="text-xs px-2 py-1 rounded-full bg-gray-700 text-amber-300 hover:bg-amber-600" onClick={() => { onRollD20 && onRollD20(); setQuickWheel(null); }}>d20</button>
                    <button className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600" onClick={() => setQuickWheel(null)}>×</button>
                  </div>
                </div>
            )}

            {/* Mini Dice (bottom-right) */}
            <div className="absolute bottom-2 right-2 z-20">
              <button className="rounded-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm shadow hover:border-purple-400" onClick={() => onRollD20 && onRollD20()}>Roll d20</button>
            </div>
        </div>
    </div>
  );
};