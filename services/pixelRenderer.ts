// services/pixelRenderer.ts
// BARU: FASE 1
// Service ini bertanggung jawab untuk merender layout pixel art di
// canvas off-screen, berdasarkan data P1 dan logika P2.
// Service ini TIDAK BOLEH mengimpor React.

import { Character, Tile } from "../types";
import { SPRITE_PARTS } from "../data/spriteParts";
import { BATTLE_TILESET, EXPLORATION_TILESET } from "../data/tileset";

const CHAR_CANVAS_WIDTH = 96;
const CHAR_CANVAS_HEIGHT = 96;
const MAP_TILE_SIZE = 10; // 10x10px per tile di layout

// Shim sederhana untuk OffscreenCanvas jika tersedia, fallback ke DOM Canvas
const createCanvas = (width: number, height: number): HTMLCanvasElement => {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height) as any;
    }
    // Fallback ke elemen DOM (diperlukan untuk lingkungan non-worker)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
};

/**
 * Merender layout pixel art untuk karakter berdasarkan data mereka.
 * Diadaptasi dari P2 (pixel-vtt-stylizer AssemblerView)
 * @param character Objek Karakter (P1)
 * @returns string data URL base64 (image/png)
 */
export const renderCharacterLayout = (character: Character): string => {
    const canvas = createCanvas(CHAR_CANVAS_WIDTH, CHAR_CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Gagal mendapatkan 2D context untuk pixelRenderer");

    ctx.clearRect(0, 0, CHAR_CANVAS_WIDTH, CHAR_CANVAS_HEIGHT);

    // Variabel posisi (disederhanakan dari P2)
    const centerX = CHAR_CANVAS_WIDTH / 2;
    const centerY = CHAR_CANVAS_HEIGHT / 2;
    const bodyHeight = CHAR_CANVAS_HEIGHT * 0.4;
    const bodyWidth = bodyHeight * 0.6;
    const headRadius = bodyWidth * 0.5;

    // TODO: Logika pemetaan data (P1) ke sprite part (P2)
    // Ini adalah versi sederhana untuk Fase 1
    const parts = {
        base: SPRITE_PARTS.race_base.find(p => p.name.includes(character.race)) || SPRITE_PARTS.race_base[0],
        torso: SPRITE_PARTS.armor_torso.find(p => p.name.toLowerCase().includes(character.class.toLowerCase())) || SPRITE_PARTS.armor_torso[0],
        head: SPRITE_PARTS.head_accessory.find(p => p.id === character.scars[0]) || SPRITE_PARTS.head_accessory[0],
        weapon: SPRITE_PARTS.weapon_right_hand.find(p => p.name.includes('Sword')) || SPRITE_PARTS.weapon_right_hand[0],
    };

    // Render Layer (logika P2)
    // Ini harus diperluas di Fase 2 untuk merender semua 10 layer
    
    // 1. Gambar Base (Kulit Ras)
    ctx.fillStyle = parts.base.color;
    ctx.fillRect(centerX - bodyWidth / 2, centerY - bodyHeight / 2, bodyWidth, bodyHeight); // Tubuh
    ctx.beginPath();
    ctx.arc(centerX, centerY - bodyHeight / 2, headRadius, 0, 2 * Math.PI); // Kepala
    ctx.fill();

    // 2. Gambar Armor (Torso)
    ctx.fillStyle = parts.torso.color;
    ctx.fillRect(centerX - bodyWidth / 2, centerY - bodyHeight / 2, bodyWidth, bodyHeight);

    // 3. Gambar Senjata
    ctx.fillStyle = parts.weapon.color;
    ctx.fillRect(centerX + bodyWidth / 2, centerY - bodyHeight * 0.1, bodyWidth * 0.2, bodyHeight * 0.8);
    
    // 4. Gambar Fitur Wajah (Luka, dll)
    if (parts.head.id !== 'ha_none') {
        ctx.fillStyle = parts.head.color;
        // (Contoh: gambar goresan)
        ctx.fillRect(centerX - headRadius / 2, centerY - bodyHeight / 2 - headRadius / 2, headRadius, 4);
    }
    
    return canvas.toDataURL('image/png');
};

/**
 * Merender layout pixel art untuk peta (tempur atau eksplorasi).
 * Diadaptasi dari P2 (pixel-vtt-stylizer BattleView) [cite: 489-490]
 * @param grid Grid data (number[][])
 * @param isBattleMap Menentukan tileset mana yang digunakan
 * @returns string data URL base64 (image/png)
 */
export const renderMapLayout = (
    grid: number[][], 
    isBattleMap: boolean = true
): string => {
    
    if (!grid || grid.length === 0) throw new Error("Grid tidak boleh kosong");
    
    const mapHeight = grid.length;
    const mapWidth = grid[0].length;
    const tileset = isBattleMap ? BATTLE_TILESET : EXPLORATION_TILESET;

    const canvas = createCanvas(mapWidth * MAP_TILE_SIZE, mapHeight * MAP_TILE_SIZE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Gagal mendapatkan 2D context untuk pixelRenderer");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const tileId = grid[y][x];
            const tile = tileset[tileId as keyof typeof tileset];
            
            // Logika P2 [cite: 489-490]
            ctx.fillStyle = tile ? tile.color : '#FF00FF'; // Magenta untuk error
            ctx.fillRect(x * MAP_TILE_SIZE, y * MAP_TILE_SIZE, MAP_TILE_SIZE, MAP_TILE_SIZE);
            
            // Blueprint Hitam/Putih/Abu dari P2 (ai-native...)
            if (tile?.isImpassable) {
                ctx.fillStyle = 'black';
            } else if (tile?.movementCost && tile.movementCost > 1) {
                ctx.fillStyle = 'gray';
            } else {
                ctx.fillStyle = 'white';
            }
            ctx.fillRect(x * MAP_TILE_SIZE, y * MAP_TILE_SIZE, MAP_TILE_SIZE, MAP_TILE_SIZE);
        }
    }
    
    return canvas.toDataURL('image/png');
};