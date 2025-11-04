import React, { useState } from 'react';
import { ViewWrapper } from '../components/ViewWrapper';
import { Campaign, Quest, NPC, MapMarker } from '../types';
import { generateId, generateJoinCode } from '../utils';
// REFAKTOR G-2: Impor generationService
import { generationService } from '../services/ai/generationService';
import { InteractiveMap } from '../components/game/InteractiveMap';


interface CreateCampaignViewProps {
  onClose: () => void;
  onCreateCampaign: (campaign: Campaign) => Promise<void>;
}

interface CampaignFramework {
    proposedTitle: string;
    proposedMainQuest: { title: string, description: string };
    proposedMainNPCs: { name: string, description: string }[];
    potentialSideQuests: { title: string, description: string }[];
    description: string; // Add original premise for map generation
}

const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-4 sm:p-6 md:p-8 text-gray-800 flex flex-col h-full bg-amber-50 rounded-lg shadow-xl">{children}</div>
);

export const CreateCampaignView: React.FC<CreateCampaignViewProps> = ({ onClose, onCreateCampaign }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Step 1 State
  const [pillars, setPillars] = useState({
      premise: '',
      keyElements: '',
      endGoal: ''
  });
  
  // Step 2 State
  const [framework, setFramework] = useState<CampaignFramework | null>(null);

  // Step 3 State
  const [mapData, setMapData] = useState<{ imageUrl: string; markers: MapMarker[], startLocationId: string } | null>(null);

  // Step 4 (Final) State
   const [campaignData, setCampaignData] = useState({
    dmPersonality: 'Penyair Epik',
    responseLength: 'Standar' as Campaign['responseLength'],
    dmNarrationStyle: 'Deskriptif' as Campaign['dmNarrationStyle'],
  });


  const handlePillarChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setPillars(prev => ({ ...prev, [name]: value }));
  };

  const generateFramework = async () => {
      if (!pillars.premise.trim() || !pillars.keyElements.trim()) {
          alert("Premis Utama dan Elemen Kunci harus diisi.");
          return;
      }
      setIsLoading(true);
      setLoadingMessage("Meminta visi dari para dewa cerita...");
      try {
          // REFAKTOR G-2
          const result = await generationService.generateCampaignFramework(pillars);
          setFramework({ ...result, description: pillars.premise });
          setStep(2);
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
          const imageB64 = await generationService.generateMapImage(framework.description);
          const imageUrl = `data:image/png;base64,${imageB64}`;

          setLoadingMessage("Menandai tempat-tempat penting...");
          // REFAKTOR G-2
          const markerData = await generationService.generateMapMarkers(framework);
          
          setMapData({
              imageUrl,
              markers: markerData.markers,
              startLocationId: markerData.startLocationId
          });
          setStep(4);

      } catch (e) {
          console.error("Gagal membuat peta:", e);
          alert("Gagal membuat peta kampanye. Anda dapat melanjutkan tanpa peta atau mencoba lagi.");
          setStep(4); // Lanjutkan ke langkah berikutnya bahkan jika gagal
      } finally {
          setIsLoading(false);
      }
  }
  
  const handleCreate = async () => {
    if (!framework) return;
    setIsLoading(true);
    setLoadingMessage("Mewujudkan dunia...");

    try {
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

        const newCampaign: Campaign = {
          id: generateId('campaign'),
          title: framework.proposedTitle,
          description: pillars.premise,
          mainGenre: 'Fantasi',
          subGenre: '',
          duration: 'Kampanye Kustom',
          isNSFW: false,
          maxPlayers: 4,
          theme: 'Fantasi',
          dmPersonality: campaignData.dmPersonality,
          dmNarrationStyle: campaignData.dmNarrationStyle,
          responseLength: campaignData.responseLength,
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
          currentTime: 'Siang',
          currentWeather: 'Cerah',
          worldEventCounter: 0,
          mapImageUrl: mapData?.imageUrl,
          mapMarkers: mapData?.markers || [],
          currentPlayerLocation: mapData?.startLocationId,
        };
        
        await onCreateCampaign(newCampaign);

    } catch (e) {
        console.error("Gagal memekanisasi atau membuat kampanye:", e);
        alert("Gagal menyelesaikan pembuatan kampanye. Coba lagi.");
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
                     <h2 className="font-cinzel text-3xl text-yellow-900 mb-4 border-b-2 border-yellow-800/20 pb-2">Langkah 4: Sentuhan Akhir</h2>
                     <p className="mb-4 text-sm">Pilih beberapa pengaturan terakhir sebelum memulai petualangan Anda.</p>
                     
                    <label className="font-cinzel text-yellow-800 mt-6">Kepribadian DM</label>
                    <select name="dmPersonality" value={campaignData.dmPersonality} onChange={(e) => setCampaignData(p => ({...p, dmPersonality: e.target.value}))} className="w-full bg-transparent border-b-2 border-yellow-800/30 focus:outline-none focus:border-yellow-800 mt-1 p-1">
                        <option>Penyair Epik</option>
                        <option>Sejarawan Bijak</option>
                        <option>Pelawak Sarkastik</option>
                        <option>Narator Misterius</option>
                        <option>Kecerdasan Buatan yang Logis</option>
                    </select>

                    <label className="font-cinzel text-yellow-800 mt-6">Panjang Respons DM</label>
                    <select name="responseLength" value={campaignData.responseLength} onChange={(e) => setCampaignData(p => ({...p, responseLength: e.target.value as Campaign['responseLength']}))} className="w-full bg-transparent border-b-2 border-yellow-800/30 focus:outline-none focus:border-yellow-800 mt-1 p-1">
                        <option>Singkat</option>
                        <option>Standar</option>
                        <option>Rinci</option>
                    </select>

                    <label className="font-cinzel text-yellow-800 mt-6">Gaya Narasi DM</label>
                    <select name="dmNarrationStyle" value={campaignData.dmNarrationStyle} onChange={(e) => setCampaignData(p => ({...p, dmNarrationStyle: e.target.value as Campaign['dmNarrationStyle']}))} className="w-full bg-transparent border-b-2 border-yellow-800/30 focus:outline-none focus:border-yellow-800 mt-1 p-1">
                        <option value="Deskriptif">Deskriptif (Puitis & Rinci)</option>
                        <option value="Langsung & Percakapan">Langsung & Percakapan (Sederhana)</option>
                    </select>

                    <div className="flex-grow"></div>
                    <div className="flex justify-between items-center">
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
    <ViewWrapper onClose={onClose} title="Puncak Pencerita - Kampanye Kustom">
        <div className="relative">
            {isLoading && renderLoadingOverlay()}
            {renderPage()}
        </div>
    </ViewWrapper>
  );
};
