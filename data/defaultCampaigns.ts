// data/defaultCampaigns.ts

import { Campaign } from '../types';
import { generateJoinCode, generateId } from '../utils';

// Ini adalah data DEFINISI untuk seeding.
// Data runtime (eventLog, monsters, players, dll) akan di-generate
// atau di-load secara terpisah.
export const DEFAULT_CAMPAIGNS: Omit<Campaign, 'id' | 'ownerId' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId' | 'initiativeOrder'>[] = [
  {
    title: 'Misteri Kuil Tenggelam',
    description: 'Jauh di bawah ombak, Kuil A\'zoth yang telah lama hilang memanggil. Harta karun kuno dan kengerian yang tak terkatakan menanti mereka yang cukup berani untuk mengungkap rahasianya. Tapi hati-hati, laut tidak mudah melepaskan apa yang telah diambilnya.',
    mainGenre: 'Fantasi',
    subGenre: 'Misteri Magis',
    duration: 'Kampanye Mini (3-5 Sesi)',
    isNSFW: false,
    maxPlayers: 4,
    theme: 'Fantasi',
    dmPersonality: 'Narator Misterius',
    dmNarrationStyle: 'Langsung & Percakapan',
    responseLength: 'Standar',
    longTermMemory: 'Ada sebuah kuil kuno yang tenggelam di lepas pantai, dikenal sebagai Kuil A\'zoth. Legenda mengatakan itu menyimpan artefak kuat yang disebut Mata Kraken.',
    image: 'https://picsum.photos/seed/sunken-temple/400/300',
    joinCode: generateJoinCode(),
    gameState: 'exploration',
    isPublished: true,
    quests: [
      // Quest sekarang didefinisikan di sini
      {
        id: 'main-quest-1',
        title: 'Temukan Mata Kraken',
        description: 'Selidiki Kuil A\'zoth yang tenggelam dan temukan artefak legendaris, Mata Kraken, sebelum jatuh ke tangan yang salah.',
        status: 'active',
        isMainQuest: true
      }
    ],
    npcs: [
      // NPC sekarang didefinisikan di sini
      {
        id: 'npc-shore-captain',
        name: 'Kapten Elias',
        description: 'Seorang kapten kapal tua yang mengantarmu ke lokasi kuil. Tampak gugup dan tidak ingin berlama-lama.',
        location: 'Garis Pantai',
        disposition: 'Neutral',
        interactionHistory: ['Mengantarkan para petualang ke Kuil A\'zoth.'],
        opinion: {}, // (Poin 4)
        secret: 'Dia berhutang budi pada kultus yang menjaga kuil dan diam-diam melapor kepada mereka.' // (Poin 4)
      }
    ],
    currentTime: 43200, // (Poin 5) 12:00 PM
    currentWeather: 'Cerah',
    worldEventCounter: 0,
    mapImageUrl: 'https://picsum.photos/seed/map-sunken/800/600',
    mapMarkers: [
        { id: 'shoreline', name: 'Garis Pantai', x: 10, y: 50 },
        { id: 'temple-azoth', name: 'Kuil A\'zoth', x: 75, y: 60 },
    ],
    currentPlayerLocation: 'shoreline',
    currentPlayerId: null, // Ditetapkan saat player pertama join
    // BARU: Fase 6 - Tambahan Data Peta Grid
    explorationGrid: [], // Akan di-populate saat load jika kosong
    fogOfWar: [], // Akan di-populate saat load jika kosong
    battleState: null,
    playerGridPosition: { x: 10, y: 50 }, // Sesuaikan dengan 'shoreline'
  },
  {
    title: 'Bisikan di Puncak Merah',
    description: 'Desa terpencil di Puncak Merah diganggu oleh penyakit aneh dan mimpi buruk. Para tetua menyalahkan roh gunung yang marah, tetapi beberapa orang berbisik tentang kultus gelap yang melakukan ritual terlarang di reruntuhan terdekat. Apakah Anda akan menjawab panggilan mereka untuk meminta bantuan?',
    mainGenre: 'Horor',
    subGenre: 'Investigasi Supernatural',
    duration: 'Kampanye Mini (3-5 Sesi)',
    isNSFW: false,
    maxPlayers: 5,
    theme: 'Horor',
    dmPersonality: 'Penyair Epik',
    dmNarrationStyle: 'Langsung & Percakapan',
    responseLength: 'Rinci',
    longTermMemory: 'Desa Puncak Merah adalah komunitas pertambangan yang terisolasi. Baru-baru ini, para penduduk desa menderita penyakit misterius yang menyebabkan kegilaan. Ada reruntuhan kuno di gunung di atas desa.',
    image: 'https://picsum.photos/seed/crimson-peaks/400/300',
    joinCode: generateJoinCode(),
    gameState: 'exploration',
    isPublished: true,
    quests: [
      {
        id: 'main-quest-2',
        title: 'Selidiki Kegilaan',
        description: 'Cari tahu sumber kegilaan yang melanda Desa Puncak Merah dan hentikan itu.',
        status: 'active',
        isMainQuest: true
      }
    ],
    npcs: [],
    currentTime: 61200, // (Poin 5) 5:00 PM
    currentWeather: 'Berawan',
    worldEventCounter: 0,
    mapImageUrl: 'https://picsum.photos/seed/map-crimson/800/600',
    mapMarkers: [
        { id: 'red-peak-village', name: 'Desa Puncak Merah', x: 40, y: 70 },
        { id: 'ruins', name: 'Reruntuhan Kuno', x: 50, y: 20 },
    ],
    currentPlayerLocation: 'red-peak-village',
    currentPlayerId: null,
    // BARU: Fase 6 - Tambahan Data Peta Grid
    explorationGrid: [],
    fogOfWar: [],
    battleState: null,
    playerGridPosition: { x: 40, y: 70 }, // Sesuaikan dengan 'red-peak-village'
  },
  // (Campaign 3 akan mengikuti pola yang sama)
];