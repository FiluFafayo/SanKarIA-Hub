// data/tileset.ts
// Ini adalah definisi SSoT untuk SETIAP tile yang bisa dirender di peta,
// baik Battle (zoom-in) maupun Exploration (zoom-out).
// Diadaptasi dari P2 (pixel-vtt-stylizer [cite: 425-427]) dan diperluas.

// Tipe Tile diadaptasi dari P2
export interface Tile {
  id: number;
  name: string;
  color: string; // Warna Heksadesimal untuk digambar di canvas
  isImpassable?: boolean; // Untuk pathfinding
  movementCost?: number; // Untuk pathfinding (default 1)
  category: 'Terrain' | 'Wall' | 'Door' | 'Object' | 'Hazard' | 'Structure' | 'Biome' | 'POI';
}

// =======================================================================
// BATTLE MAP TILESET (ID 1-9999)
// Skala: 1 tile = 5ft x 5ft (Zoom-In)
// =======================================================================
export const BATTLE_TILESET: Record<number, Tile> = {
  // 0: Lantai Kosong/Default
  0: { id: 0, name: 'Floor (Stone)', color: '#757575', category: 'Terrain' },
  1: { id: 1, name: 'Grass', color: '#34A853', category: 'Terrain' },
  2: { id: 2, name: 'Dirt', color: '#A1887F', category: 'Terrain' },
  3: { id: 3, name: 'Sand', color: '#FBC02D', category: 'Terrain' },
  4: { id: 4, name: 'Water (Shallow)', color: '#4285F4', movementCost: 2, category: 'Terrain' },
  5: { id: 5, name: 'Water (Deep)', color: '#3060C0', isImpassable: true, category: 'Terrain' },
  6: { id: 6, name: 'Mud', color: '#6D4C41', movementCost: 2, category: 'Terrain' },
  7: { id: 7, name: 'Bush (Difficult)', color: '#00796B', movementCost: 2, category: 'Terrain' },
  8: { id: 8, name: 'Snow', color: '#F0F0F0', movementCost: 2, category: 'Terrain' },
  
  // 10-19: Medan Spesial (Permintaanmu)
  15: { id: 15, name: 'Lava River', color: '#F44336', isImpassable: true, category: 'Hazard' },
  
  // 100-199: Dinding (Impassable)
  100: { id: 100, name: 'Stone Wall', color: '#424242', isImpassable: true, category: 'Wall' },
  101: { id: 101, name: 'Wood Wall', color: '#8D6E63', isImpassable: true, category: 'Wall' },
  102: { id: 102, name: 'Brick Wall', color: '#A1887F', isImpassable: true, category: 'Wall' },
  103: { id: 103, name: 'Cave Wall (Rough)', color: '#605050', isImpassable: true, category: 'Wall' },
  104: { id: 104, name: 'Hedge Wall', color: '#208020', isImpassable: true, category: 'Wall' },
  105: { id: 105, name: 'Crumbling Wall (User Req)', color: '#656050', isImpassable: true, category: 'Wall' },
  110: { id: 110, name: 'Sci-Fi Lab Wall (User Req)', color: '#E0E0F0', isImpassable: true, category: 'Wall' },
  111: { id: 111, name: 'Energy Barrier', color: '#20C0F0', isImpassable: true, category: 'Wall' },

  // 200-299: Pintu (Bisa dilewati, status bisa berubah)
  200: { id: 200, name: 'Wood Door (Closed)', color: '#A1887F', isImpassable: true, category: 'Door' },
  201: { id: 201, name: 'Wood Door (Open)', color: '#C0A090', category: 'Terrain' },
  202: { id: 202, name: 'Stone Door (Closed)', color: '#606060', isImpassable: true, category: 'Door' },
  203: { id: 203, name: 'Sci-Fi Door (Closed)', color: '#A0B0B0', isImpassable: true, category: 'Door' },

  // 300-399: Objek (Rintangan, Cover, Interaktif)
  300: { id: 300, name: 'Tree (Obstacle)', color: '#004D40', isImpassable: true, category: 'Object' },
  301: { id: 301, name: 'Crate (Wood Pile Req)', color: '#BCAAA4', movementCost: 2, category: 'Object' }, // Cover/Sulit dilewati
  302: { id: 302, name: 'Barrel', color: '#907050', movementCost: 2, category: 'Object' },
  303: { id: 303, name: 'Chest', color: '#FFD700', category: 'Object' },
  304: { id: 304, name: 'Tavern Bar', color: '#8B4513', isImpassable: true, category: 'Object' },
  305: { id: 305, name: 'Barbershop Chair (User Req)', color: '#D0B0B0', category: 'Object' },
  306: { id: 306, name: 'Bookshelf', color: '#6D4C41', isImpassable: true, category: 'Object' },
  310: { id: 310, name: 'Lab Equipment (User Req)', color: '#B0F0F0', isImpassable: true, category: 'Object' },
  311: { id: 311, name: 'Tumpukan Kayu (User Req)', color: '#A1887F', isImpassable: true, category: 'Object' },

  // 400-499: Bahaya & Tile Ajaib (Permintaanmu)
  400: { id: 400, name: 'Spike Trap (Hidden)', color: '#757575', category: 'Hazard' }, // Terlihat sama dgn lantai
  401: { id: 401, name: 'Magic Portal (User Req)', color: '#9C27B0', category: 'Hazard' }, // Bisa jadi 'Object'
  402: { id: 402, name: 'SCP Containment Cell (User Req)', color: '#FF0000', isImpassable: true, category: 'Wall' },
  403: { id: 403, name: 'Warp Pad (User Req)', color: '#00BCD4', category: 'Terrain' },
  404: { id: 404, name: 'Runic Circle', color: '#FFEB3B', category: 'Terrain' },
};


// =======================================================================
// EXPLORATION MAP TILESET (ID 10000+)
// Skala: 1 tile = 1km x 1km (Zoom-Out)
// =======================================================================
export const EXPLORATION_TILESET: Record<number, Tile> = {
  // 10000-10999: Bioma Dasar
  10000: { id: 10000, name: 'Ocean', color: '#00008B', isImpassable: true, category: 'Biome' },
  10001: { id: 10001, name: 'Plains (Grassland)', color: '#34A853', category: 'Biome' },
  10002: { id: 10002, name: 'Forest', color: '#006400', movementCost: 2, category: 'Biome' },
  10003: { id: 10003, name: 'Desert (Sand)', color: '#FBC02D', movementCost: 2, category: 'Biome' },
  10004: { id: 10004, name: 'Mountains', color: '#606060', isImpassable: true, category: 'Biome' },
  10005: { id: 10005, name: 'Volcanic Wastes', color: '#B71C1C', movementCost: 3, category: 'Biome' },
  10006: { id: 10006, name: 'Swamp (Mud)', color: '#6D4C41', movementCost: 2, category: 'Biome' },
  10007: { id: 10007, name: 'Snowy Tundra', color: '#F0F0F0', movementCost: 2, category: 'Biome' },
  
  // 20000-20999: Jalan & Sungai
  20000: { id: 20000, name: 'Road', color: '#BCAAA4', movementCost: 0.5, category: 'Terrain' },
  20001: { id: 20001, name: 'River', color: '#4285F4', isImpassable: true, category: 'Terrain' },

  // 30000-30999: Struktur 1x1 (Permintaanmu)
  30000: { id: 30000, name: 'Village (1x1)', color: '#CD853F', category: 'Structure' },
  30001: { id: 30001, name: 'Tavern (1x1)', color: '#8B4513', category: 'Structure' },
  30002: { id: 30002, name: 'Cave Entrance (1x1)', color: '#3E2723', category: 'Structure' },
  30003: { id: 30003, name: 'School (1x1)', color: '#FFF59D', category: 'Structure' },
  30004: { id: 30004, name: 'Pacuan Kuda (1x1)', color: '#795548', category: 'Structure' },
  30005: { id: 30005, name: 'Mall/Bioskop (1x1)', color: '#90A4AE', category: 'Structure' },
  30006: { id: 30006, name: 'Gubuk (1x1)', color: '#A1887F', category: 'Structure' },
  30007: { id: 30007, name: 'Laboratorium (1x1)', color: '#E0E0F0', category: 'Structure' },
  30008: { id: 30008, name: 'Kandang SCP (1x1)', color: '#FF0000', category: 'Structure' },

  // 30100-30199: Struktur Multi-Tile (Permintaanmu)
  30100: { id: 30100, name: 'City (2x2 Top-Left)', color: '#B0BEC5', category: 'Structure' },
  30101: { id: 30101, name: 'City (2x2 Top-Right)', color: '#B0BEC5', category: 'Structure' },
  30102: { id: 30102, name: 'City (2x2 Bottom-Left)', color: '#B0BEC5', category: 'Structure' },
  30103: { id: 30103, name: 'City (2x2 Bottom-Right)', color: '#B0BEC5', category: 'Structure' },

  // 30200-30299: POI Bergerak/Event (Permintaanmu)
  30200: { id: 30200, name: 'Caravan (POI)', color: '#FFB74D', category: 'POI' },
  30201: { id: 30201, name: 'Night Market (POI)', color: '#9C27B0', category: 'POI' },
};