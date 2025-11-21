File: components/nexus/CampaignWizard.tsx
Search:
// components/nexus/CampaignWizard.tsx
import React, { useState } from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { useAppStore } from '../../store/appStore';
import { campaignRepository } from '../../services/repository/campaignRepository';
import { Campaign, CampaignRules } from '../../types';

interface CampaignWizardProps {
  onComplete: (campaignId: string) => void;
  onCancel: () => void;
}

type WizardStep = 'DETAILS' | 'RULES' | 'REVIEW';

const THEMES = ['Fantasy', 'Sci-Fi', 'Horror', 'Cyberpunk', 'Eldritch', 'Steampunk'];
const DM_PERSONALITIES = ["Serius & Kelam", "Heroik & Epik", "Kocak & Kacau", "Misterius & Menegangkan"];

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<WizardStep>('DETAILS');
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAppStore();

  // Form State
  const [details, setDetails] = useState({
    name: '',
    description: '',
    theme: 'Fantasy',
    dmPersonality: DM_PERSONALITIES[0],
  });

  const [rules, setRules] = useState<CampaignRules>({
    startingLevel: 1,
    advancementType: 'milestone',
    rollPrivacy: 'public',
    allowHomebrew: false,
    maxPartySize: 4,
  });

  const handleCreate = async () => {
    if (!user || !details.name) return;
    setIsCreating(true);
    try {
      const campaignData: Omit<Campaign, 'id' | 'ownerId' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId' | 'initiativeOrder'> = {
        title: details.name,
        description: details.description,
        theme: details.theme.toLowerCase(),
        dmPersonality: details.dmPersonality,
        rulesConfig: rules, // Inject Rules
        
        // Defaults
        cover_url: `https://picsum.photos/seed/${details.name}/800/600`,
        joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        isPublished: false,
        maxPlayers: rules.maxPartySize,
        mainGenre: details.theme,
        subGenre: 'RPG',
        duration: 'Ongoing',
        isNSFW: false,
        dmNarrationStyle: 'Standar',
        responseLength: 'Standar',
        gameState: 'exploration',
        currentPlayerId: null,
        longTermMemory: '',
        currentTime: 43200,
        currentWeather: 'Cerah',
        worldEventCounter: 0,
        mapImageUrl: '',
        mapMarkers: [],
        currentPlayerLocation: 'Lokasi Awal',
        quests: [],
        npcs: [],
        explorationGrid: [],
        fogOfWar: [],
        battleState: null,
        playerGridPosition: { x: 50, y: 50 },
      };

      const newCampaign = await campaignRepository.createCampaign(campaignData, user.id);
      if (newCampaign) onComplete(newCampaign.id);
    } catch (error) {
      console.error(error);
      alert("Gagal menciptakan dimensi baru.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
      <PixelCard className="w-full max-w-2xl border-gold bg-surface h-[600px] flex flex-col">
        <div className="border-b-2 border-wood pb-4 mb-4 flex justify-between items-center">
            <h2 className="font-pixel text-gold text-xl">RITUAL PENCIPTAAN DUNIA</h2>
            <div className="flex gap-2">
                {['DETAILS', 'RULES', 'REVIEW'].map((s, i) => (
                    <div key={s} className={`px-2 py-1 text-[10px] border ${step === s ? 'bg-gold text-black border-gold' : 'text-faded border-wood'}`}>
                        {i + 1}. {s}
                    </div>
                ))}
            </div>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2">
           {/* STEP 1: DETAILS */}
           {step === 'DETAILS' && (
               <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="font-pixel text-xs text-gold block mb-2">NAMA DIMENSI (CAMPAIGN TITLE)</label>
                        <input 
                           type="text" 
                           value={details.name}
                           onChange={(e) => setDetails({...details, name: e.target.value})}
                           className="w-full bg-black border-2 border-wood p-3 font-retro text-parchment focus:border-gold outline-none text-lg"
                           placeholder="e.g. The Curse of Strahd"
                           autoFocus
                        />
                    </div>
                    <div>
                        <label className="font-pixel text-xs text-faded block mb-2">SINOPSIS DUNIA</label>
                        <textarea 
                           value={details.description}
                           onChange={(e) => setDetails({...details, description: e.target.value})}
                           className="w-full bg-black border-2 border-wood p-3 font-retro text-parchment focus:border-gold outline-none"
                           rows={4}
                           placeholder="Deskripsikan premis, konflik utama, dan suasana dunia ini..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="font-pixel text-xs text-faded block mb-2">TEMA VISUAL</label>
                            <select 
                                value={details.theme}
                                onChange={(e) => setDetails({...details, theme: e.target.value})}
                                className="w-full bg-black border-2 border-wood p-2 font-retro text-parchment"
                            >
                                {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="font-pixel text-xs text-faded block mb-2">KEPRIBADIAN DM</label>
                            <select 
                                value={details.dmPersonality}
                                onChange={(e) => setDetails({...details, dmPersonality: e.target.value})}
                                className="w-full bg-black border-2 border-wood p-2 font-retro text-parchment"
                            >
                                {DM_PERSONALITIES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
               </div>
           )}

           {/* STEP 2: RULES */}
           {step === 'RULES' && (
               <div className="space-y-6 animate-fade-in">
                   <div className="grid grid-cols-2 gap-6">
                        <div className="bg-black/30 p-4 border border-wood">
                            <label className="font-pixel text-xs text-gold block mb-4">LEVEL AWAL</label>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setRules(r => ({...r, startingLevel: Math.max(1, r.startingLevel - 1)}))} className="w-8 h-8 border border-wood bg-black hover:bg-white/10 text-gold">-</button>
                                <span className="font-pixel text-2xl text-parchment">{rules.startingLevel}</span>
                                <button onClick={() => setRules(r => ({...r, startingLevel: Math.min(20, r.startingLevel + 1)}))} className="w-8 h-8 border border-wood bg-black hover:bg-white/10 text-gold">+</button>
                            </div>
                            <p className="text-[10px] text-faded mt-2">Level karakter saat memulai kampanye.</p>
                        </div>

                        <div className="bg-black/30 p-4 border border-wood">
                            <label className="font-pixel text-xs text-gold block mb-4">UKURAN PARTY</label>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setRules(r => ({...r, maxPartySize: Math.max(1, r.maxPartySize - 1)}))} className="w-8 h-8 border border-wood bg-black hover:bg-white/10 text-gold">-</button>
                                <span className="font-pixel text-2xl text-parchment">{rules.maxPartySize}</span>
                                <button onClick={() => setRules(r => ({...r, maxPartySize: Math.min(8, r.maxPartySize + 1)}))} className="w-8 h-8 border border-wood bg-black hover:bg-white/10 text-gold">+</button>
                            </div>
                            <p className="text-[10px] text-faded mt-2">Jumlah pemain maksimal.</p>
                        </div>
                   </div>

                   <div>
                       <label className="font-pixel text-xs text-gold block mb-2">METODE PROGRESSI</label>
                       <div className="grid grid-cols-2 gap-4">
                           <div 
                               onClick={() => setRules({...rules, advancementType: 'milestone'})}
                               className={`p-3 border-2 cursor-pointer transition-all ${rules.advancementType === 'milestone' ? 'border-gold bg-gold/10' : 'border-wood bg-black/50'}`}
                           >
                               <div className="font-pixel text-sm text-parchment">MILESTONE</div>
                               <div className="text-[10px] text-faded">Naik level berdasarkan pencapaian cerita.</div>
                           </div>
                           <div 
                               onClick={() => setRules({...rules, advancementType: 'xp'})}
                               className={`p-3 border-2 cursor-pointer transition-all ${rules.advancementType === 'xp' ? 'border-gold bg-gold/10' : 'border-wood bg-black/50'}`}
                           >
                               <div className="font-pixel text-sm text-parchment">EXPERIENCE (XP)</div>
                               <div className="text-[10px] text-faded">Naik level dengan membunuh monster.</div>
                           </div>
                       </div>
                   </div>

                   <div>
                       <label className="font-pixel text-xs text-gold block mb-2">TRANSPARANSI DADU DM</label>
                       <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={rules.rollPrivacy === 'public'} onChange={() => setRules({...rules, rollPrivacy: 'public'})} className="accent-gold"/>
                                <span className="text-sm text-parchment">Public (Terbuka)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={rules.rollPrivacy === 'private_to_dm'} onChange={() => setRules({...rules, rollPrivacy: 'private_to_dm'})} className="accent-gold"/>
                                <span className="text-sm text-parchment">Private (Rahasia)</span>
                            </label>
                       </div>
                   </div>
               </div>
           )}

           {/* STEP 3: REVIEW */}
           {step === 'REVIEW' && (
               <div className="space-y-4 animate-fade-in h-full flex flex-col items-center justify-center">
                    <div className="text-center space-y-2 mb-8">
                        <h3 className="font-pixel text-2xl text-gold">{details.name}</h3>
                        <p className="font-retro text-parchment italic max-w-md mx-auto">"{details.description}"</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 w-full max-w-md text-sm border-t border-b border-wood py-4">
                        <div className="text-right text-faded">Tema:</div><div className="text-gold">{details.theme}</div>
                        <div className="text-right text-faded">DM Style:</div><div className="text-gold">{details.dmPersonality}</div>
                        <div className="text-right text-faded">Mulai Level:</div><div className="text-gold">{rules.startingLevel}</div>
                        <div className="text-right text-faded">Party Size:</div><div className="text-gold">{rules.maxPartySize} Pemain</div>
                        <div className="text-right text-faded">Sistem:</div><div className="text-gold uppercase">{rules.advancementType}</div>
                    </div>

                    <p className="text-xs text-faded mt-8">Apakah Anda siap membuka gerbang ke dunia ini?</p>
               </div>
           )}
        </div>

        <div className="pt-4 border-t-2 border-wood flex gap-4 mt-auto">
             {step === 'DETAILS' && (
                 <>
                    <RuneButton label="BATAL" variant="secondary" onClick={onCancel} fullWidth />
                    <RuneButton label="LANJUT KE ATURAN" disabled={!details.name} onClick={() => setStep('RULES')} fullWidth />
                 </>
             )}
             {step === 'RULES' && (
                 <>
                    <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('DETAILS')} fullWidth />
                    <RuneButton label="TINJAU DUNIA" onClick={() => setStep('REVIEW')} fullWidth />
                 </>
             )}
             {step === 'REVIEW' && (
                 <>
                    <RuneButton label="UBAH ATURAN" variant="secondary" onClick={() => setStep('RULES')} fullWidth />
                    <RuneButton 
                        label={isCreating ? "MEMBUKA GERBANG..." : "MANIFESTASIKAN"} 
                        variant="danger" 
                        disabled={isCreating} 
                        onClick={handleCreate} 
                        fullWidth 
                    />
                 </>
             )}
        </div>
      </PixelCard>
    </div>
  );
};

Replace:
// components/nexus/CampaignWizard.tsx
import React, { useState } from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { useAppStore } from '../../store/appStore';
import { campaignRepository } from '../../services/repository/campaignRepository';
import { generationService } from '../../services/ai/generationService';
import { Campaign, CampaignRules } from '../../types';
import { DEFAULT_CAMPAIGNS } from '../../data/defaultCampaigns'; 
import { generateJoinCode } from '../../utils';

interface CampaignWizardProps {
  onComplete: (campaignId: string) => void;
  onCancel: () => void;
}

// Mode Wizard: Library (Template) vs Incantation (Custom)
type WizardMode = 'LIBRARY' | 'INCANTATION';

const THEMES = ['Fantasy', 'Dark Fantasy', 'Sci-Fi', 'Cyberpunk', 'Eldritch Horror', 'Steampunk'];
// "Scale" menggantikan Durasi, memicu Atlas Protocol
const SCALES = [
    { id: 'One-Shot', label: 'Kisah Tunggal', desc: 'Satu peta, linear, tamat dalam 1-2 sesi.' },
    { id: 'Endless Saga', label: 'Hikayat Tanpa Akhir', desc: 'Multi-peta, open world, cerita bercabang.' }
];

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onComplete, onCancel }) => {
  const { user } = useAppStore();
  const [mode, setMode] = useState<WizardMode>('LIBRARY');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Incantation State (Custom)
  const [incantation, setIncantation] = useState({
    title: '',
    theme: 'Fantasy',
    scale: 'One-Shot',
    villain: '', // Ini adalah "Trigger/Konflik"
    description: ''
  });

  // --- LOGIC: ORACLE AI (FASE 1) ---
  const invokeOracle = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        const suggestion = await generationService.suggestIncantation(incantation.theme);
        setIncantation(prev => ({
            ...prev,
            title: suggestion.title,
            description: suggestion.description,
            villain: suggestion.villain
        }));
    } catch (e) {
        console.error("Oracle gagal:", e);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- LOGIC: MANIFESTATION ---
  const manifestWorld = async (isTemplate: boolean, templateData?: Partial<Campaign>) => {
    if (!user) return;
    setIsProcessing(true);
    try {
        // Setup Rules default
        const defaultRules: CampaignRules = {
            startingLevel: 1,
            advancementType: 'milestone',
            rollPrivacy: 'public',
            allowHomebrew: false,
            maxPartySize: 4,
        };

        let finalData: any = {};

        if (isTemplate && templateData) {
            // Mode Library: Clone Template
            finalData = {
                ...templateData,
                joinCode: generateJoinCode(),
                ownerId: user.id,
                isPublished: true,
                // Pastikan scale ter-set jika template punya (atau default one-shot)
                duration: templateData.duration || 'One-Shot'
            };
        } else {
            // Mode Incantation: Create Custom
            const isEndless = incantation.scale === 'Endless Saga';
            
            finalData = {
                title: incantation.title,
                description: incantation.description,
                theme: incantation.theme.toLowerCase(),
                
                // Metadata Baru
                duration: incantation.scale, // Trigger Atlas Protocol di Backend nanti
                mainGenre: incantation.theme,
                subGenre: 'RPG', // Default
                
                // DM Personality (Invisible Arbiter)
                dmPersonality: "Adil & Adaptif", 
                dmNarrationStyle: 'Langsung & Percakapan',
                responseLength: 'Standar',
                
                rulesConfig: defaultRules,
                
                // Boilerplate Data
                cover_url: `https://picsum.photos/seed/${incantation.title.replace(/\s/g, '-')}/800/600`,
                joinCode: generateJoinCode(),
                isPublished: false,
                maxPlayers: 4,
                isNSFW: false,
                
                gameState: 'exploration',
                currentPlayerId: null,
                longTermMemory: `Tema: ${incantation.theme}. Konflik Awal: ${incantation.villain}.`,
                currentTime: 43200,
                currentWeather: 'Cerah',
                worldEventCounter: 0,
                
                // Inisialisasi Atlas Protocol (Empty) - Backend akan populate nanti
                mapImageUrl: '',
                mapMarkers: [],
                quests: [], // Kosong karena akan di-generate procedural
                npcs: [],
                
                // Grid Placeholder
                explorationGrid: Array.from({ length: 100 }, () => Array(100).fill(10001)),
                fogOfWar: Array.from({ length: 100 }, () => Array(100).fill(true)),
                battleState: null,
                playerGridPosition: { x: 50, y: 50 },
            };
        }

        // Simpan ke DB
        const newCampaign = await campaignRepository.createCampaign(finalData, user.id);
        if (newCampaign) onComplete(newCampaign.id);
    } catch (error) {
        console.error("Gagal menciptakan dimensi:", error);
        alert("Ritual gagal. Dewa Dice sedang marah.");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
      <PixelCard className="w-full max-w-5xl border-gold bg-surface h-[85vh] flex flex-col relative overflow-hidden shadow-2xl shadow-amber-900/20">
        
        {/* HEADER */}
        <div className="border-b-2 border-wood pb-4 mb-4 flex justify-between items-center shrink-0 px-2">
            <div>
                <h2 className="font-pixel text-gold text-xl md:text-3xl tracking-wider">
                    {mode === 'LIBRARY' ? "THE LIBRARY OF ECHOES" : "RITUAL OF CREATION"}
                </h2>
                <p className="font-retro text-faded text-xs md:text-sm">
                    {mode === 'LIBRARY' 
                        ? "Pilih takdir yang sudah tertulis, atau tulis takdirmu sendiri." 
                        : "Ucapkan mantramu, dan saksikan dunia terbentuk."}
                </p>
            </div>
            <button onClick={onCancel} className="text-xs text-faded hover:text-red-400 font-pixel border border-wood px-2 py-1 hover:bg-red-900/30 transition-colors">
                [ X ] BATAL
            </button>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar p-2">
           
           {/* --- MODE: LIBRARY (TEMPLATE) --- */}
           {mode === 'LIBRARY' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {/* KARTU: NEW TOME (CUSTOM) */}
                   <div 
                        onClick={() => setMode('INCANTATION')}
                        className="group relative h-80 border-2 border-dashed border-wood/50 hover:border-gold hover:bg-gold/5 flex flex-col items-center justify-center cursor-pointer transition-all rounded-lg"
                   >
                       <div className="text-6xl text-faded group-hover:text-gold mb-4 animate-pulse">+</div>
                       <span className="font-pixel text-lg text-faded group-hover:text-gold">TULIS MANTRA BARU</span>
                       <p className="text-xs text-faded mt-2 px-8 text-center font-retro">
                           Mulai dari kertas kosong. Dibantu oleh Oracle AI.
                       </p>
                   </div>

                   {/* KARTU: TEMPLATES */}
                   {DEFAULT_CAMPAIGNS.map((tpl, idx) => (
                       <div key={idx} className="relative border-2 border-wood bg-black group hover:border-gold transition-all flex flex-col h-80 overflow-hidden rounded-lg shadow-lg">
                           {/* Cover Image */}
                           <div className="h-40 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700" style={{ backgroundImage: `url(${tpl.cover_url || tpl.image})` }}>
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                           </div>
                           
                           {/* Content */}
                           <div className="p-4 flex flex-col flex-grow bg-surface border-t border-wood">
                               <h3 className="font-pixel text-gold text-md truncate">{tpl.title}</h3>
                               <div className="flex gap-2 my-2">
                                    <span className="text-[10px] bg-wood/30 px-2 py-0.5 rounded text-parchment border border-wood/50">{tpl.mainGenre}</span>
                                    <span className="text-[10px] bg-wood/30 px-2 py-0.5 rounded text-parchment border border-wood/50">{tpl.duration}</span>
                               </div>
                               <p className="font-retro text-xs text-faded line-clamp-3">{tpl.description}</p>
                               
                               <button 
                                    onClick={() => manifestWorld(true, tpl)}
                                    disabled={isProcessing}
                                    className="mt-auto w-full font-pixel text-xs bg-wood text-parchment py-2 hover:bg-gold hover:text-black transition-colors border border-wood"
                               >
                                   {isProcessing ? "MEMBUKA BUKU..." : "BUKA BUKU INI"}
                               </button>
                           </div>
                       </div>
                   ))}
               </div>
           )}

           {/* --- MODE: INCANTATION (CUSTOM MAD LIBS) --- */}
           {mode === 'INCANTATION' && (
               <div className="max-w-3xl mx-auto py-8 flex flex-col gap-8 animate-fade-in">
                   
                   {/* THE INCANTATION FORM */}
                   <div className="bg-black/40 border border-wood p-6 rounded-lg relative">
                       <div className="absolute -top-3 left-4 bg-surface px-2 text-gold font-pixel text-xs border border-wood">
                           GULUNGAN MANTRA
                       </div>

                       <div className="font-cinzel text-lg md:text-2xl text-parchment leading-relaxed space-y-6 text-justify">
                           <div>
                               "Saya menyerukan kepada para Dewa Kuno untuk membangkitkan sebuah dunia 
                               <span className="mx-2 inline-block border-b-2 border-gold min-w-[150px]">
                                    <select 
                                        value={incantation.theme}
                                        onChange={(e) => setIncantation({...incantation, theme: e.target.value})}
                                        className="w-full bg-transparent text-gold font-pixel focus:outline-none text-center cursor-pointer appearance-none"
                                    >
                                        {THEMES.map(t => <option key={t} value={t} className="bg-black">{t.toUpperCase()}</option>)}
                                    </select>
                               </span>.
                           </div>

                           <div>
                               Kisah ini akan menjadi sebuah
                               <span className="mx-2 inline-block border-b-2 border-gold min-w-[200px]">
                                    <select 
                                        value={incantation.scale}
                                        onChange={(e) => setIncantation({...incantation, scale: e.target.value})}
                                        className="w-full bg-transparent text-gold font-pixel focus:outline-none text-center cursor-pointer appearance-none"
                                    >
                                        {SCALES.map(s => <option key={s.id} value={s.id} className="bg-black">{s.label.toUpperCase()}</option>)}
                                    </select>
                               </span>,
                               di mana takdir ditentukan oleh konflik melawan
                               <span className="mx-2 inline-block border-b-2 border-gold w-full md:w-auto min-w-[200px]">
                                    <input 
                                        type="text" 
                                        value={incantation.villain}
                                        onChange={(e) => setIncantation({...incantation, villain: e.target.value})}
                                        placeholder="(Musuh / Bencana Utama...)"
                                        className="w-full bg-transparent text-gold font-bold placeholder-white/20 focus:outline-none text-center"
                                    />
                               </span>.
                           </div>

                           <div>
                               Dunia ini bernama 
                               <span className="mx-2 inline-block border-b-2 border-gold min-w-[200px]">
                                    <input 
                                        type="text" 
                                        value={incantation.title}
                                        onChange={(e) => setIncantation({...incantation, title: e.target.value})}
                                        placeholder="(Judul Dunia...)"
                                        className="w-full bg-transparent text-gold font-bold placeholder-white/20 focus:outline-none text-center"
                                    />
                               </span>,
                               sebuah tempat di mana...
                           </div>
                           
                           <div className="relative mt-2">
                                <textarea 
                                    value={incantation.description}
                                    onChange={(e) => setIncantation({...incantation, description: e.target.value})}
                                    placeholder="(Lanjutkan deskripsi dunia di sini, atau minta Oracle untuk melengkapinya...)"
                                    className="w-full bg-black/30 border border-wood/50 p-4 text-base font-retro text-faded focus:text-parchment focus:border-gold focus:outline-none rounded h-32 resize-none"
                                />
                                {/* AUTOCOMPLETE BUTTON */}
                                <button 
                                    onClick={invokeOracle}
                                    disabled={isProcessing}
                                    className="absolute bottom-4 right-4 text-xs bg-cyan-900/50 border border-cyan-700 text-cyan-200 px-3 py-1 hover:bg-cyan-800 hover:text-white flex items-center gap-2 transition-all rounded"
                                >
                                    {isProcessing ? (
                                        <span className="animate-pulse">Menerawang...</span>
                                    ) : (
                                        <><span>✨</span> LENGKAPI MANTRA</>
                                    )}
                                </button>
                           </div>
                       </div>
                   </div>

                   {/* SCALE INFO */}
                   <div className="flex gap-4 items-start p-4 border border-wood/30 bg-black/20 rounded">
                        <div className="text-2xl text-gold">ℹ️</div>
                        <div>
                            <h4 className="font-pixel text-gold text-sm mb-1">
                                SKALA: {SCALES.find(s => s.id === incantation.scale)?.label}
                            </h4>
                            <p className="font-retro text-xs text-faded">
                                {SCALES.find(s => s.id === incantation.scale)?.desc}
                            </p>
                            {incantation.scale === 'Endless Saga' && (
                                <p className="text-[10px] text-red-400 mt-1 font-bold">
                                    *Mengaktifkan Atlas Protocol: Peta Prosedural & Multi-Node.*
                                </p>
                            )}
                        </div>
                   </div>

                   {/* ACTION BUTTONS */}
                   <div className="flex gap-4 pt-4">
                       <RuneButton 
                            label="KEMBALI KE PERPUSTAKAAN" 
                            variant="secondary" 
                            onClick={() => setMode('LIBRARY')} 
                       />
                       <RuneButton 
                            label={isProcessing ? "MEMBUAT DIMENSI..." : "MANIFESTASIKAN DUNIA"} 
                            variant="danger" 
                            disabled={!incantation.title || isProcessing}
                            onClick={() => manifestWorld(false)}
                            fullWidth
                       />
                   </div>

               </div>
           )}
        </div>
      </PixelCard>
    </div>
  );
};