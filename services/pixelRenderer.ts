// services/pixelRenderer.ts
// BARU: FASE 1
// Service ini bertanggung jawab untuk merender layout pixel art di
// canvas off-screen, berdasarkan data P1 dan logika P2.
// Service ini TIDAK BOLEH mengimpor React.

import { Character, Tile, GridCell } from "../types";
import { SPRITE_PARTS } from "../data/spriteParts";
import { BATTLE_TILESET, EXPLORATION_TILESET } from "../data/tileset";

const CHAR_CANVAS_WIDTH = 96;
const CHAR_CANVAS_HEIGHT = 96;
const MAP_TILE_SIZE = 10; // 10x10px per tile di layout
const NPC_CANVAS_SIZE = 64; // Ukuran mini-sprite NPC

// Shim sederhana untuk OffscreenCanvas jika tersedia, fallback ke DOM Canvas
const createCanvas = (width: number, height: number): HTMLCanvasElement => {
   // FASE 6 FIX: Hapus logika OffscreenCanvas.
   // Alur ini dipanggil secara sinkron oleh handleSave dan membutuhkan .toDataURL(),
   // yang TIDAK ADA di OffscreenCanvas (yang menggunakan .convertToBlob() async).
   // Kita HARUS menggunakan elemen DOM canvas standar.
   // if (typeof OffscreenCanvas !== 'undefined') {
   //     return new OffscreenCanvas(width, height) as any;
   // }
   
   // Selalu gunakan elemen DOM (diperlukan untuk .toDataURL() sinkron)
   const canvas = document.createElement('canvas');
   canvas.width = width;
   canvas.height = height;
   return canvas;
};

/**
 * Merender layout pixel art untuk karakter berdasarkan data mereka.
 * Implementasi penuh Fase 2.
 * UPGRADE FASE 0 (Roadmap 2025-11-18):
 * - Membaca inventory karakter untuk equipment.
 * - Menggambar blueprint senjata & perisai.
 * @param character Objek Karakter (P1)
 * @returns string data URL base64 (image/png)
 */
export const renderCharacterLayout = (character: Character): string => {
    const canvas = createCanvas(CHAR_CANVAS_WIDTH, CHAR_CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Gagal mendapatkan 2D context untuk pixelRenderer");

    ctx.clearRect(0, 0, CHAR_CANVAS_WIDTH, CHAR_CANVAS_HEIGHT);

    // Posisi gambar dasar
    const centerX = CHAR_CANVAS_WIDTH / 2; // 48
    const headY = 24;
    const bodyY = 48;
    const headRadius = 12;
    const bodyWidth = 20;
    const bodyHeight = 32;

    // --- Helper cari part atau fallback ---
    const getPart = (layer: keyof typeof SPRITE_PARTS, partName: string, defaultId: string) => {
        const part = SPRITE_PARTS[layer].find(p => p.name === partName);
        if (part) return part;
        return SPRITE_PARTS[layer].find(p => p.id === defaultId) || SPRITE_PARTS[layer][0];
    };

    // --- [BARU] Helper internal untuk memetakan Item -> SpritePart ---
    const getSpritePartFromItem = (
        item: CharacterInventoryItem | undefined,
        layer: 'weapon_right_hand' | 'weapon_left_hand' | 'armor_torso' | 'armor_legs'
    ): SpritePart => {
        let defaultId = '';
        switch (layer) {
            case 'weapon_right_hand': defaultId = 'wrh_none'; break;
            case 'weapon_left_hand': defaultId = 'wlh_none'; break;
            case 'armor_torso': defaultId = 'at_common_clothes'; break;
            case 'armor_legs': defaultId = 'al_common_pants'; break;
        }
        
        // Ambil fallback part DARI TIPE DATA YANG BENAR
        const fallbackPart = SPRITE_PARTS[layer].find(p => p.id === defaultId) || SPRITE_PARTS[layer][0];

        if (!item) {
            return fallbackPart;
        }

        const itemName = item.item.name.toLowerCase();
        
        // 1. Coba cari match di 'name' sprite (e.g., "Longsword" cocok dengan "Pedang Panjang")
        // Kita cari kata kunci dari 'sprite name' di 'item name'
        const allParts = SPRITE_PARTS[layer];
        for (const part of allParts) {
            if (part.id === defaultId) continue; // Jangan match "Kosong"
            
            // Ambil kata kunci dari nama sprite, e.g., "Pedang Panjang" -> "pedang"
            const spriteNameKeywords = part.name.toLowerCase().split(' ')[0]; 
            if (itemName.includes(spriteNameKeywords)) {
                return part;
            }
            // Cek juga ID, e.g., "wrh_longsword" -> "longsword"
            const spriteIdKeyword = part.id.split('_').pop();
            if (spriteIdKeyword && itemName.includes(spriteIdKeyword)) {
                return part;
            }
        }
        
        // 2. Fallback untuk Perisai (karena tipenya 'armor')
        if (layer === 'weapon_left_hand' && item.item.armorType === 'shield') {
            return SPRITE_PARTS.weapon_left_hand.find(p => p.id === 'wlh_shield') || fallbackPart;
        }

        // 3. Fallback untuk Armor (jika nama tidak cocok, pakai class)
        if (layer === 'armor_torso') {
             const classMatch = SPRITE_PARTS.armor_torso.find(p => p.name.toLowerCase().includes(character.class.toLowerCase()));
             if (classMatch) return classMatch;
        }
        if (layer === 'armor_legs') {
             // Coba map dari class, e.g., 'Mage' -> 'al_mage_robe_skirt'
             const classMatch = SPRITE_PARTS.armor_legs.find(p => p.name.toLowerCase().includes(character.class.toLowerCase()));
             if (classMatch) return classMatch;
             
             // Coba map dari nama armor torso, e.g., "Jubah Penyihir" -> "Rok Jubah"
             const torsoPart = getSpritePartFromItem(item, 'armor_torso');
             if (torsoPart.id === 'at_mage_robe') return SPRITE_PARTS.armor_legs.find(p => p.id === 'al_mage_robe_skirt') || fallbackPart;
             if (torsoPart.id === 'at_plate_armor') return SPRITE_PARTS.armor_legs.find(p => p.id === 'al_plate_greaves') || fallbackPart;
             if (torsoPart.id === 'at_leather_armor') return SPRITE_PARTS.armor_legs.find(p => p.id === 'al_leather_boots') || fallbackPart;
        }

        return fallbackPart;
    };

    // --- [BARU] Logika Pemetaan Berbasis INVENTORY ---
    const equippedTorso = character.inventory.find(i => i.isEquipped && i.item.type === 'armor' && i.item.armorType !== 'shield');
    const equippedWeapon = character.inventory.find(i => i.isEquipped && i.item.type === 'weapon');
    const equippedShield = character.inventory.find(i => i.isEquipped && i.item.armorType === 'shield');

    const parts = {
        gender_base: getPart('gender_base', character.gender === 'Pria' ? 'Bentuk Pria' : 'Bentuk Wanita', 'gb_male'),
        race_base: getPart('race_base', character.race, 'rb_human'),
        body_type: getPart('body_type', character.bodyType, 'bt_normal'),
        hair: getPart('hair', character.hair, 'h_bald'),
        facial_hair: getPart('facial_feature', character.facialHair, 'ff_none'),
        head_accessory: getPart('head_accessory', character.headAccessory, 'ha_none'),
        scar: SPRITE_PARTS.facial_feature.find(p => (character.scars || []).includes(p.id)),
        
        // [REFAKTOR] Gunakan helper baru
        armor_torso: getSpritePartFromItem(equippedTorso, 'armor_torso'),
        armor_legs: getSpritePartFromItem(equippedTorso, 'armor_legs'), // Helper akan coba map dari torso/class
        weapon_right: getSpritePartFromItem(equippedWeapon, 'weapon_right_hand'),
        weapon_left: getSpritePartFromItem(equippedShield, 'weapon_left_hand'),
    };

    // --- Logika Render Berbasis Layer ---
    // (PENTING: Urutan render = dari belakang ke depan)

    // 1. Base (Bentuk & Warna Kulit)
    ctx.fillStyle = parts.race_base.color;
    ctx.beginPath();
    ctx.arc(centerX, headY, headRadius, 0, 2 * Math.PI); // Kepala
    ctx.fill();
    ctx.fillRect(centerX - bodyWidth / 2, bodyY - bodyHeight / 2, bodyWidth, bodyHeight); // Tubuh

    // 2. Armor Kaki
    ctx.fillStyle = parts.armor_legs.color;
    ctx.fillRect(centerX - bodyWidth / 2, bodyY + (bodyHeight / 4), bodyWidth, bodyHeight / 2);

    // 3. Armor Torso
    ctx.fillStyle = parts.armor_torso.color;
    ctx.fillRect(centerX - bodyWidth / 2, bodyY - bodyHeight / 2, bodyWidth, bodyHeight / 2);

    // 4. Rambut (di belakang kepala aksesori)
    if (parts.hair.id !== 'h_bald') {
        ctx.fillStyle = parts.hair.color;
        ctx.beginPath();
        ctx.arc(centerX, headY - 2, headRadius + 2, 0.8 * Math.PI, 0.2 * Math.PI, true); // Sedikit di atas kepala
        ctx.fill();
    }

    // 5. Jenggot / Fitur Wajah
    if (parts.facial_hair.id !== 'ff_none') {
        ctx.fillStyle = parts.facial_hair.color;
        ctx.fillRect(centerX - headRadius / 2, headY + headRadius / 2, headRadius, headRadius / 2); // Area jenggot
    }

    // 6. Aksesori Kepala (Tanduk, dll)
    if (parts.head_accessory.id !== 'ha_none') {
        ctx.fillStyle = parts.head_accessory.color;
        ctx.fillRect(centerX - headRadius, headY - headRadius, 8, 8); // Tanduk kiri
        ctx.fillRect(centerX + headRadius - 8, headY - headRadius, 8, 8); // Tanduk kanan
    }

    // 7. Luka (di atas segalanya)
    if (parts.scar) {
        ctx.fillStyle = parts.scar.color;
        ctx.fillRect(centerX + 2, headY - 4, 4, 8); // Goresan vertikal di mata kanan
    }

    // 8. Modifikasi Tubuh (Tangan Buntung, dll)
    if (parts.body_type.id === 'bt_missing_arm_r') {
        ctx.globalCompositeOperation = 'destination-out'; // Mode 'hapus'
        ctx.fillRect(centerX + bodyWidth / 2, bodyY - bodyHeight / 2, (CHAR_CANVAS_WIDTH - centerX - bodyWidth / 2), bodyHeight); // Hapus area tangan kanan
        ctx.globalCompositeOperation = 'source-over'; // Kembali normal
    }
    // (Bisa ditambahkan bt_missing_arm_l di sini jika perlu)

    // 9. [BARU] SENJATA KIRI (Perisai, dll)
    // Dirender sebelum tangan kanan agar 'di belakang' jika 2H
    if (parts.weapon_left.id !== 'wlh_none') {
        ctx.fillStyle = parts.weapon_left.color;
        // Gambar blueprint perisai (kotak besar di kiri)
        ctx.fillRect(centerX - (bodyWidth / 2) - 14, bodyY - (bodyHeight / 4), 12, bodyHeight / 1.5);
    }

    // 10. [BARU] SENJATA KANAN (Pedang, dll)
    if (parts.weapon_right.id !== 'wrh_none') {
        ctx.fillStyle = parts.weapon_right.color;
        // Gambar blueprint pedang (kotak panjang di kanan)
        ctx.fillRect(centerX + (bodyWidth / 2) + 2, bodyY - (bodyHeight / 2.5), 6, bodyHeight * 0.9);
    }

    return canvas.toDataURL('image/png');
};

/**
 * Merender layout pixel art untuk peta (tempur atau eksplorasi).
 * Diadaptasi dari P2 (pixel-vtt-stylizer BattleView)
 * @param grid Grid data (number[][])
 * @param isBattleMap Menentukan tileset mana yang digunakan
 * @returns string data URL base64 (image/png)
 */
export const renderMapLayout = (
    grid: number[][] | GridCell[][],
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
            const cell = grid[y][x] as any;
            const tileId = typeof cell === 'number' ? (cell as number) : (cell.terrain as number);
            const tile = tileset[tileId as keyof typeof tileset];

            // Logika P2
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

/**
 * Mini Sprite Builder untuk NPC berdasarkan ringkasan/deskripsi.
 * Tidak membutuhkan input pengguna; digunakan oleh AI DM saat runtime.
 * Menghasilkan layout pixel sederhana (headshot) sebagai dasar img2img.
 * @param summary Teks ringkasan/karakter NPC
 * @returns string data URL base64 (image/png)
 */
export const renderNpcMiniSprite = (summary: string): string => {
    const canvas = createCanvas(NPC_CANVAS_SIZE, NPC_CANVAS_SIZE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Gagal mendapatkan 2D context untuk pixelRenderer");

    ctx.clearRect(0, 0, NPC_CANVAS_SIZE, NPC_CANVAS_SIZE);

    // Hash sederhana dari summary untuk variasi warna
    const hash = Array.from(summary || 'npc').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const pick = (arr: string[]) => arr[hash % arr.length];

    const skinTones = ['#f2d0a4', '#d8a47f', '#b5835a', '#8d5a38', '#6b3f26'];
    const hairColors = ['#2f1b0c', '#4b2e14', '#704214', '#a0522d', '#c68642', '#1c1c1c', '#3f3f3f'];
    const outfitColors = ['#445b3c', '#2c3e50', '#7f8c8d', '#8e6c3a', '#6d4c41', '#3a3a6a'];

    // Deteksi sederhana dari keyword untuk variasi bentuk
    const hasHelmet = /helm|knight|guard|soldier|militia/i.test(summary);
    const hasBeard = /beard|jenggot|dwarf|orang tua|sage/i.test(summary);
    const isMage = /mage|wizard|penyihir|sorcerer|warlock/i.test(summary);

    const skin = pick(skinTones);
    const hair = pick(hairColors);
    const outfit = isMage ? '#4b0082' : pick(outfitColors);

    const cx = NPC_CANVAS_SIZE / 2;
    const cy = NPC_CANVAS_SIZE / 2;

    // Latar belakang warna lembut sesuai outift
    ctx.fillStyle = outfit + '22'; // transparan
    ctx.fillRect(0, 0, NPC_CANVAS_SIZE, NPC_CANVAS_SIZE);

    // Kepala
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 18, 0, Math.PI * 2);
    ctx.fill();

    // Rambut
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 20, Math.PI, 0);
    ctx.fill();

    // Helm (opsional)
    if (hasHelmet) {
        ctx.fillStyle = '#888888';
        ctx.fillRect(cx - 20, cy - 22, 40, 12);
    }

    // Jenggot (opsional)
    if (hasBeard) {
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.arc(cx, cy + 6, 12, 0, Math.PI);
        ctx.fill();
    }

    // Bahu / Torso
    ctx.fillStyle = outfit;
    ctx.fillRect(cx - 24, cy + 10, 48, 20);

    // Highlight sederhana untuk memberi kontras (ai-friendly blueprint)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, NPC_CANVAS_SIZE - 2, NPC_CANVAS_SIZE - 2);

    // Mata sederhana
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(cx - 6, cy - 4, 4, 4);
    ctx.fillRect(cx + 2, cy - 4, 4, 4);

    return canvas.toDataURL('image/png');
};