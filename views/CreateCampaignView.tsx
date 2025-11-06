import React, { useState, ChangeEvent, useEffect } from 'react'; // Import ChangeEvent, useEffect
import { ViewWrapper } from '../components/ViewWrapper';
import { Campaign, Quest, NPC, MapMarker, TerrainType, GridCell } from '../types'; // BARU
import { generateId, generateJoinCode } from '../utils';
import { generationService } from '../services/ai/generationService';
import { InteractiveMap } from '../components/game/InteractiveMap';
// FASE 0: Hapus appStore (kecuali untuk onClose)
// import { useAppStore } from '../store/appStore'; 


interface CreateCampaignViewProps {
  onClose: () => void;
  onCreateCampaign: (campaignData: Omit<Campaign, 'id' | 'ownerId' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId' | 'initiativeOrder'>) => Promise<any>; // REFAKTOR G-4
}

interface CampaignFramework {
    proposedTitle: string;
    proposedMainQuest: { title: string, description: string };
    proposedMainNPCs: { name: string, description: string }[];
    potentialSideQuests: { title: string, description: string }[];
    description: string; // Add original premise for map generation
}

// FASE 0: Definisikan tipe state form lokal
interface CampaignCreationPillars {
    premise: string;
    keyElements: string;
    endGoal: string;
}
const initialPillars: CampaignCreationPillars = { premise: '', keyElements: '', endGoal: '' };
type MapData = { imageUrl: string; markers: MapMarker[], startLocationId: string } | null;

const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  // FASE 2 FIX: Hapus 'h-full'. Tambahkan 'min-h-[60vh]' agar tombol tetap di bawah pada layar pendek, tapi biarkan konten tumbuh.
  <div className="p-4 sm:p-6 md:p-8 text-gray-800 flex flex-col min-h-[60vh] bg-amber-50 rounded-lg shadow-xl">{children}</div>
);

export const CreateCampaignView: React.FC<CreateCampaignViewProps> = ({ onClose, onCreateCampaign }) => {
  // State Ephemeral (Loading) tetap lokal
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // FASE 0: State Form sekarang dikelola secara LOKAL, bukan oleh Zustand
  const [step, setStep] = useState(1);
  const [pillars, setPillars] = useState<CampaignCreationPillars>(initialPillars);
  const [framework, setFramework] = useState<CampaignFramework | null>(null);
  const [mapData, setMapData] = useState<MapData>(null);

  // FASE 0: Buat fungsi reset lokal
  const resetCampaignCreation = () => {
      setStep(1);
      setPillars(initialPillars);
      setFramework(null);
      setMapData(null);
  };
  
  // FASE 0: Gunakan effect untuk reset state saat komponen ditutup
  // (Ini menggantikan logika reset di appStore.actions.navigateTo)
  useEffect(() => {
      // Saat komponen unmount (ditutup), reset state
      return () => {
          resetCampaignCreation();
      };
  }, []);


  const handleClose = () => {
    // resetCampaignCreation(); // Tidak perlu, effect unmount akan menangani
    onClose();
  };

  const handlePillarChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setPillars({ ...pillars, [name]: value });
  };

  const generateFramework = async () => {
      if (!pillars.premise.trim() || !pillars.keyElements.trim()) {
          alert("Premis Utama dan Elemen Kunci harus diisi.");
          return;
      }
      setIsLoading(true);
      setLoadingMessage("Meminta visi dari para dewa cerita...");
      try {
          const result = await generationService.generateCampaignFramework(pillars);
          setFramework({ ...result, description: pillars.premise });
          setStep(2); // FASE 0: Ganti ke state lokal
      } catch (e) {
          console.error("Gagal membuat kerangka kampanye:", e);
          alert("Gagal berkomunikasi dengan AI untuk membuat kerangka. Coba lagi.");
      } finally {
          setIsLoading(false);
      }
  };
  
  const generateMap = async () => {
      if (!framework) return;
      setIsLoading(true);
      try {
          setLoadingMessage("Menggambar peta dunia...");
          // REFAKTOR G-2
          // (P0 FIX) generateMapImage sekarang mengembalikan URL, bukan B64
          const imageUrl = await generationService.generateMapImage(framework.description);
          // const imageUrl = `data:image/png;base64,${imageB64}`; // Dihapus

          setLoadingMessage("Menandai tempat-tempat penting...");
          const markerData = await generationService.generateMapMarkers(framework);
          
          setMapData({ // FASE 0: Ganti ke state lokal
              imageUrl,
              markers: markerData.markers,
              startLocationId: markerData.startLocationId
          });
          setStep(4); // FASE 0: Ganti ke state lokal

      } catch (e) {
          console.error("Gagal membuat peta:", e);
          alert("Gagal membuat peta kampanye. Anda dapat melanjutkan tanpa peta atau mencoba lagi.");
          setStep(4); // FASE 0: Ganti ke state lokal
      } finally {
          setIsLoading(false);
      }
  }
  
  const handleCreate = async () => {
    if (!framework) return;
    setIsLoading(true);
    setLoadingMessage("Mewujudkan dunia...");

    try {
        // --- BARU: FASE 4 - Generate Peta Eksplorasi ---
        const EXPLORATION_WIDTH = 100;
        const EXPLORATION_HEIGHT = 100;
        // (Logika generator sederhana, bisa diganti Drunkard's Walk P2 nanti)
        const explorationGrid: number[][] = Array.from({ length: EXPLORATION_HEIGHT }, () =>
            Array.from({ length: EXPLORATION_WIDTH }, () => {
                const r = Math.random();
                if (r < 0.6) return 10001; // Plains
                if (r < 0.85) return 10002; // Forest
                if (r < 0.95) return 10004; // Mountains
                return 10000; // Ocean
            })
        );
        // Buat Fog of War awal (semua true/tersembunyi)
        const fogOfWar: boolean[][] = Array.from({ length: EXPLORATION_HEIGHT }, () =>
            Array.from({ length: EXPLORATION_WIDTH }, () => true)
        );

        // FASE 4 FIX: Tentukan posisi awal (default tengah jika peta gagal)
        let playerGridPosition = { x: 50, y: 50 };
        if (mapData && mapData.startLocationId) {
            const startMarker = mapData.markers.find(m => m.id === mapData.startLocationId);
            if (startMarker) {
                // Konversi % (0-100) ke koordinat grid (0-99)
                playerGridPosition.x = Math.max(0, Math.min(EXPLORATION_WIDTH - 1, Math.floor((startMarker.x / 100) * EXPLORATION_WIDTH)));
                playerGridPosition.y = Math.max(0, Math.min(EXPLORATION_HEIGHT - 1, Math.floor((startMarker.y / 100) * EXPLORATION_HEIGHT)));
            }
        }
        // --- AKHIR GENERATOR PETA EKSPLORASI ---

        // REFAKTOR G-2
        const toolCalls = await generationService.mechanizeCampaignFramework(framework);
        
        const initialQuests: Quest[] = [];
        const initialNpcs: NPC[] = [];

        toolCalls.forEach(call => {
            if (call.functionName === 'update_quest_log') {
                initialQuests.push({
                    id: call.args.id,
                    title: call.args.title,
                    description: call.args.description,
                    status: call.args.status,
                    isMainQuest: call.args.isMainQuest || false,
                });
            } else if (call.functionName === 'log_npc_interaction') {
                 initialNpcs.push({
                    id: generateId('npc'),
                    name: call.args.npcName,
                    description: call.args.description || 'Belum ada deskripsi.',
                    location: call.args.location || 'Tidak diketahui',
                    disposition: call.args.disposition || 'Unknown',
                    interactionHistory: [call.args.summary]
                });
            }
        });

        const newCampaign: Omit<Campaign, 'id' | 'ownerId' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId' | 'initiativeOrder'> = {
          title: framework.proposedTitle,
          description: pillars.premise,
          mainGenre: 'Fantasi',
          subGenre: '',
          duration: 'Kampanye Kustom',
          isNSFW: false,
          maxPlayers: 4,
          theme: 'Fantasi',
          // (Poin 10) Hardcode baseline baru
          dmPersonality: "DM yang suportif namun menantang, fokus pada cerita.",
          dmNarrationStyle: 'Langsung & Percakapan',
          responseLength: 'Standar',
          eventLog: [],
          turnId: null,
          longTermMemory: `Premis: ${pillars.premise}. Elemen Kunci: ${pillars.keyElements}. Tujuan Akhir: ${pillars.endGoal}. Misi Utama: ${framework.proposedMainQuest.title}.`,
          image: `https://picsum.photos/seed/${generateId('img')}/400/300`,
          playerIds: [],
          currentPlayerId: null,
          joinCode: generateJoinCode(),
          gameState: 'exploration',
          monsters: [],
          initiativeOrder: [],
          choices: [],
          quests: initialQuests,
            npcs: initialNpcs,
            currentTime: 43200, // (Poin 5) 12:00 PM
            currentWeather: 'Cerah',
          worldEventCounter: 0,
          mapImageUrl: mapData?.imageUrl,
          mapMarkers: mapData?.markers || [],
          currentPlayerLocation: mapData?.startLocationId,
          
          // BARU: Tambahkan data grid
        explorationGrid: explorationGrid,
        fogOfWar: fogOfWar,
        battleState: null,
        playerGridPosition: playerGridPosition, // FASE 4 FIX: Gunakan posisi awal yang dihitung
        };
        
        // REFAKTOR G-4: onCreateCampaign sekarang adalah aksi dari dataStore
        await onCreateCampaign(newCampaign); 
        // resetCampaignCreation(); // FASE 0: Tidak perlu, penutupan akan memicu reset
        
        // BUG FIX: Panggil handleClose() setelah sukses
        handleClose();

    } catch (e) {
        console.error("Gagal memekanisasi atau membuat kampanye:", e);
        alert("Gagal menyelesaikan pembuatan kampanye. Coba lagi.");
    } finally {
        // BUG FIX: Selalu matikan loading spinner, baik sukses atau gagal
        setIsLoading(false);
    }
  };
  
  const renderLoadingOverlay = () => (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-50">
        <div className="w-16 h-16 border-4 border-t-amber-500 border-gray-200 rounded-full animate-spin"></div>
        <p className="mt-4 text-white text-lg font-cinzel">{loadingMessage}</p>
    </div>
  )

  const renderPage = () => {
      switch(step) {
          case 1:
              return (
                <Page>
                    <h2 className="font-cinzel text-3xl text-yellow-900 mb-4 border-b-2 border-yellow-800/20 pb-2">Langkah 1: Visi Awal</h2>
                    <p className="mb-4 text-sm">Berikan AI fondasi cerita Anda. Semakin jelas, semakin baik hasilnya.</p>
                    
                    <label className="font-cinzel text-yellow-800 mt-4">Premis Utama (1-2 kalimat)</label>
                    <textarea name="premise" value={pillars.premise} onChange={handlePillarChange} rows={3} className="bg-transparent border-2 border-yellow-800/30 focus:outline-none focus:border-yellow-800 p-2 mt-1 resize-none" placeholder="Contoh: Sebuah artefak kuno telah dicuri, menyebabkan musim dingin abadi..."></textarea>
                    
                    <label className="font-cinzel text-yellow-800 mt-6">Elemen Kunci (3-5 kata kunci)</label>
                    <input name="keyElements" value={pillars.keyElements} onChange={handlePillarChange} className="bg-transparent border-b-2 border-yellow-800/30 focus:outline-none focus:border-yellow-800 text-base p-1" placeholder="Contoh: Artefak Beku, Kultus Naga Es, Biara Terisolasi" />

                    <label className="font-cinzel text-yellow-800 mt-6">Tujuan Akhir (Opsional)</label>
                    <input name="endGoal" value={pillars.endGoal} onChange={handlePillarChange} className="bg-transparent border-b-2 border-yellow-800/30 focus:outline-none focus:border-yellow-800 text-base p-1" placeholder="Contoh: Mengembalikan artefak dan mengakhiri musim dingin." />

                    <div className="flex-grow"></div>
                    <button onClick={generateFramework} className="self-end font-cinzel bg-yellow-800 text-white px-6 py-2 rounded hover:bg-yellow-700 transition-colors">
                      Elaborasi dengan AI
                    </button>
                </Page>
              );
          case 2:
              return (
                <Page>
                    <h2 className="font-cinzel text-3xl text-yellow-900 mb-4 border-b-2 border-yellow-800/20 pb-2">Langkah 2: Elaborasi AI</h2>
                     <p className="mb-4 text-sm">AI telah membuat proposal berdasarkan visi Anda. Tinjau dan sunting kerangka ini sebelum melanjutkan.</p>
                    {framework && (
                        <div className="space-y-4 overflow-y-auto pr-2">
                             <div>
                                <label className="font-cinzel text-yellow-800">Judul Kampanye</label>
                                <input name="proposedTitle" value={framework.proposedTitle} onChange={(e) => setFramework({...framework, proposedTitle: e.target.value})} className="w-full bg-transparent border-b-2 border-yellow-800/30 focus:outline-none focus:border-yellow-800" />
                            </div>
                        </div>
                    )}
                    <div className="flex-grow"></div>
                    <div className="flex justify-between">
                         {/* FASE 0: Gunakan state lokal */}
                         <button onClick={() => setStep(1)} className="font-cinzel text-yellow-900 hover:text-yellow-700 transition-colors">&larr; Kembali</button>
                         <button onClick={() => setStep(3)} className="font-cinzel text-yellow-900 hover:text-yellow-700 transition-colors">Lanjutkan ke Pembuatan Peta &rarr;</button>
                    </div>
                </Page>
            );
        case 3:
            return (
                <Page>
                    <h2 className="font-cinzel text-3xl text-yellow-900 mb-4 border-b-2 border-yellow-800/20 pb-2">Langkah 3: Peta Dunia</h2>
                    <p className="mb-4 text-sm">Mari kita visualisasikan dunia Anda. AI akan menghasilkan peta berdasarkan deskripsi kampanye Anda.</p>
                    {mapData?.imageUrl && (
                        <div className="my-4">
                            <InteractiveMap imageUrl={mapData.imageUrl} markers={mapData.markers} playerLocationId={mapData.startLocationId} />
                        </div>
                    )}
                    <div className="flex-grow"></div>
                    <div className="flex justify-between">
                         {/* FASE 0: Gunakan state lokal */}
                         <button onClick={() => setStep(2)} className="font-cinzel text-yellow-900 hover:text-yellow-700 transition-colors">&larr; Kembali</button>
                         <button onClick={generateMap} className="font-cinzel bg-yellow-800 text-white px-6 py-2 rounded hover:bg-yellow-700 transition-colors">
                           {mapData ? 'Buat Ulang Peta' : 'Buat Peta'}
                         </button>
                         <button onClick={() => setStep(4)} className="font-cinzel text-yellow-900 hover:text-yellow-700 transition-colors">Lanjutkan ke Sentuhan Akhir &rarr;</button>
                    </div>
                </Page>
            )
        case 4:
             return (
                <Page>
                     <h2 className="font-cinzel text-3xl text-yellow-900 mb-4 border-b-2 border-yellow-800/20 pb-2">Langkah 4: Finalisasi</h2>
                     <p className="mb-4 text-sm">Pengaturan DM (Kepribadian, Gaya Narasi) sekarang telah diatur ke *baseline* standar baru untuk performa terbaik. Anda siap untuk mewujudkan dunia Anda.</p>
                     
                    {/* (Poin 10) Opsi UI dihapus */}

                    <div className="flex-grow"></div>
                    <div className="flex justify-between items-center">
                         {/* FASE 0: Gunakan state lokal */}
                         <button onClick={() => setStep(3)} className="font-cinzel text-yellow-900 hover:text-yellow-700 transition-colors">&larr; Kembali</button>
                         <button onClick={handleCreate} className="font-cinzel bg-yellow-800 text-white px-6 py-2 rounded hover:bg-yellow-700 transition-colors">
                           Buat Kampanye
                         </button>
                    </div>
                </Page>
            );
          default: return null;
      }
  }


  return (
    // REFAKTOR G-3: Gunakan handleClose
    <ViewWrapper onClose={handleClose} title="Puncak Pencerita - Kampanye Kustom"> 
        <div className="relative">
            {isLoading && renderLoadingOverlay()}
            {renderPage()}
        </div>
    </ViewWrapper>
  );
};
