// components/nexus/CampaignWizard.tsx
import React, { useState } from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { useAppStore } from '../../store/appStore';
import { campaignRepository } from '../../services/repository/campaignRepository';
import { generationService } from '../../services/ai/generationService';
import { Campaign, CampaignRules } from '../../types';
import { DEFAULT_CAMPAIGNS } from '../../data/defaultCampaigns'; // Pastikan path ini benar
import { generateJoinCode } from '../../utils';

interface CampaignWizardProps {
  onComplete: (campaignId: string) => void;
  onCancel: () => void;
}

// State Machine Utama
type WizardMode = 'GALLERY' | 'RITUAL';
type RitualStep = 'DETAILS' | 'RULES' | 'REVIEW';

const THEMES = ['Fantasy', 'Dark Fantasy', 'Sci-Fi', 'Cyberpunk', 'Eldritch Horror', 'Steampunk'];
const DM_PERSONALITIES = ["Serius & Kelam", "Heroik & Epik", "Kocak & Kacau", "Misterius & Menegangkan", "Taktis & Brutal"];

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onComplete, onCancel }) => {
  const { user } = useAppStore();
  const [mode, setMode] = useState<WizardMode>('GALLERY');
  const [step, setStep] = useState<RitualStep>('DETAILS');
  const [isProcessing, setIsProcessing] = useState(false);
  
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

  // --- LOGIC: ORACLE AI (FASE 2) ---
  const invokeOracle = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        const suggestion = await generationService.suggestCampaignDetails(details.theme);
        setDetails(prev => ({
            ...prev,
            name: suggestion.title,
            description: suggestion.description,
            dmPersonality: suggestion.dmPersonality || prev.dmPersonality
        }));
    } catch (e) {
        console.error("Oracle gagal:", e);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- LOGIC: CREATE CAMPAIGN (TEMPLATE & CUSTOM) ---
  const finalizeCreation = async (isTemplate: boolean, templateData?: Partial<Campaign>) => {
    if (!user) return;
    setIsProcessing(true);
    try {
        // Base Data
        let finalData: any = {};

        if (isTemplate && templateData) {
            // FASE 1: Clone Template
            finalData = {
                ...templateData,
                joinCode: generateJoinCode(),
                ownerId: user.id, // Penting!
                isPublished: true, // Template selalu siap main
            };
        } else {
            // FASE 0: Custom Ritual
            finalData = {
                title: details.name,
                description: details.description,
                theme: details.theme.toLowerCase(),
                dmPersonality: details.dmPersonality,
                rulesConfig: rules,
                
                // Defaults Standar
                cover_url: `https://picsum.photos/seed/${details.name.replace(/\s/g, '-')}/800/600`,
                joinCode: generateJoinCode(),
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
    <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <PixelCard className="w-full max-w-4xl border-gold bg-surface h-[85vh] flex flex-col relative overflow-hidden">
        
        {/* HEADER: Disederhanakan, Tanpa Tab Ribet */}
        <div className="border-b-2 border-wood pb-4 mb-4 flex justify-between items-center shrink-0">
            <div>
                <h2 className="font-pixel text-gold text-xl md:text-2xl">
                    {mode === 'GALLERY' ? "HALL OF ECHOES" : "RITUAL PENCIPTAAN"}
                </h2>
                <p className="font-retro text-faded text-xs">
                    {mode === 'GALLERY' ? "Pilih takdir yang sudah tertulis, atau tulis takdirmu sendiri." : "Bentuk dunia dari ketiadaan."}
                </p>
            </div>
            {mode === 'RITUAL' && (
                <button onClick={() => setMode('GALLERY')} className="text-xs text-faded hover:text-gold font-pixel">
                    [ X ] BATAL
                </button>
            )}
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
           
           {/* --- MODE: GALLERY (FASE 1) --- */}
           {mode === 'GALLERY' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
                   {/* Create New Card */}
                   <div 
                        onClick={() => setMode('RITUAL')}
                        className="group relative h-64 border-2 border-dashed border-wood/50 hover:border-gold hover:bg-gold/5 flex flex-col items-center justify-center cursor-pointer transition-all rounded-lg"
                   >
                       <div className="text-4xl text-faded group-hover:text-gold mb-2">+</div>
                       <span className="font-pixel text-faded group-hover:text-gold">BUAT DUNIA BARU</span>
                       <p className="text-[10px] text-faded mt-2 px-4 text-center">Mulai dari kertas kosong. Dibantu oleh Oracle AI.</p>
                   </div>

                   {/* Template Cards */}
                   {DEFAULT_CAMPAIGNS.map((tpl, idx) => (
                       <div key={idx} className="relative border-2 border-wood bg-black group hover:border-gold transition-all flex flex-col h-64 overflow-hidden rounded-lg">
                           <div className="h-32 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-500" style={{ backgroundImage: `url(${tpl.image})` }} />
                           <div className="p-3 flex flex-col flex-grow">
                               <h3 className="font-pixel text-gold text-sm truncate">{tpl.title}</h3>
                               <p className="font-retro text-xs text-faded line-clamp-2 mt-1">{tpl.description}</p>
                               <div className="mt-auto pt-2 flex justify-between items-center">
                                   <span className="text-[10px] bg-wood/30 px-2 py-1 rounded text-parchment">{tpl.mainGenre}</span>
                                   <button 
                                        onClick={() => finalizeCreation(true, tpl)}
                                        disabled={isProcessing}
                                        className="font-pixel text-[10px] bg-gold text-black px-3 py-1 hover:bg-white disabled:opacity-50"
                                   >
                                       {isProcessing ? "..." : "MAIN"}
                                   </button>
                               </div>
                           </div>
                       </div>
                   ))}
               </div>
           )}

           {/* --- MODE: RITUAL (FASE 0 & 2) --- */}
           {mode === 'RITUAL' && (
               <div className="max-w-xl mx-auto space-y-6 py-4 animate-fade-in">
                   
                   {/* STEP 1: VISION */}
                   {step === 'DETAILS' && (
                       <div className="space-y-6">
                            <div className="bg-black/20 p-4 border border-wood/50 rounded">
                                <label className="font-pixel text-xs text-faded block mb-2">TEMA UTAMA</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {THEMES.map(t => (
                                        <button 
                                            key={t}
                                            onClick={() => setDetails({...details, theme: t})}
                                            className={`text-[10px] py-2 border ${details.theme === t ? 'border-gold bg-gold text-black' : 'border-wood text-faded hover:border-gold'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative">
                                <label className="font-pixel text-xs text-gold block mb-2 flex justify-between">
                                    <span>IDENTITAS DUNIA</span>
                                    <button 
                                        onClick={invokeOracle}
                                        disabled={isProcessing}
                                        className="text-[10px] text-cyan-400 hover:text-white flex items-center gap-1 animate-pulse"
                                    >
                                        {isProcessing ? "Menerawang..." : "✨ Panggil Oracle AI"}
                                    </button>
                                </label>
                                <input 
                                   type="text" 
                                   value={details.name}
                                   onChange={(e) => setDetails({...details, name: e.target.value})}
                                   className="w-full bg-black border-2 border-wood p-3 font-retro text-parchment focus:border-gold outline-none text-lg mb-2 rounded"
                                   placeholder="Nama Dunia..."
                                />
                                <textarea 
                                   value={details.description}
                                   onChange={(e) => setDetails({...details, description: e.target.value})}
                                   className="w-full bg-black border-2 border-wood p-3 font-retro text-parchment focus:border-gold outline-none rounded"
                                   rows={4}
                                   placeholder="Deskripsi singkat..."
                                />
                            </div>

                            <div>
                                <label className="font-pixel text-xs text-faded block mb-2">GAYA NARATOR (DM)</label>
                                <select 
                                    value={details.dmPersonality}
                                    onChange={(e) => setDetails({...details, dmPersonality: e.target.value})}
                                    className="w-full bg-black border-2 border-wood p-2 font-retro text-parchment rounded"
                                >
                                    {DM_PERSONALITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                       </div>
                   )}

                   {/* STEP 2: LAWS */}
                   {step === 'RULES' && (
                       <div className="space-y-6">
                           <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/30 p-4 border border-wood rounded text-center">
                                    <label className="font-pixel text-xs text-gold block mb-2">LEVEL MULAI</label>
                                    <div className="flex items-center justify-center gap-4">
                                        <button onClick={() => setRules(r => ({...r, startingLevel: Math.max(1, r.startingLevel - 1)}))} className="text-gold text-xl hover:scale-125">-</button>
                                        <span className="font-pixel text-2xl text-parchment">{rules.startingLevel}</span>
                                        <button onClick={() => setRules(r => ({...r, startingLevel: Math.min(20, r.startingLevel + 1)}))} className="text-gold text-xl hover:scale-125">+</button>
                                    </div>
                                </div>
                                <div className="bg-black/30 p-4 border border-wood rounded text-center">
                                    <label className="font-pixel text-xs text-gold block mb-2">PEMAIN MAX</label>
                                    <div className="flex items-center justify-center gap-4">
                                        <button onClick={() => setRules(r => ({...r, maxPartySize: Math.max(1, r.maxPartySize - 1)}))} className="text-gold text-xl hover:scale-125">-</button>
                                        <span className="font-pixel text-2xl text-parchment">{rules.maxPartySize}</span>
                                        <button onClick={() => setRules(r => ({...r, maxPartySize: Math.min(8, r.maxPartySize + 1)}))} className="text-gold text-xl hover:scale-125">+</button>
                                    </div>
                                </div>
                           </div>
                           
                           <div className="p-4 border border-wood bg-black/20 rounded">
                               <label className="font-pixel text-xs text-gold block mb-2">SISTEM PROGRESSI</label>
                               <div className="flex gap-2">
                                   <button 
                                        onClick={() => setRules({...rules, advancementType: 'milestone'})}
                                        className={`flex-1 py-2 text-xs border ${rules.advancementType === 'milestone' ? 'bg-gold text-black border-gold' : 'text-faded border-wood'}`}
                                   >
                                       MILESTONE (Cerita)
                                   </button>
                                   <button 
                                        onClick={() => setRules({...rules, advancementType: 'xp'})}
                                        className={`flex-1 py-2 text-xs border ${rules.advancementType === 'xp' ? 'bg-gold text-black border-gold' : 'text-faded border-wood'}`}
                                   >
                                       XP (Monster)
                                   </button>
                               </div>
                           </div>
                       </div>
                   )}

                   {/* STEP 3: MANIFESTATION */}
                   {step === 'REVIEW' && (
                       <div className="text-center py-8 space-y-4">
                            <h3 className="font-pixel text-3xl text-gold">{details.name || "Dunia Tanpa Nama"}</h3>
                            <p className="font-retro text-parchment italic max-w-md mx-auto">"{details.description || "..."}"</p>
                            <div className="flex justify-center gap-4 text-xs text-faded mt-4">
                                <span>Lvl {rules.startingLevel}</span>
                                <span>•</span>
                                <span>{rules.advancementType.toUpperCase()}</span>
                                <span>•</span>
                                <span>{details.theme}</span>
                            </div>
                       </div>
                   )}

               </div>
           )}
        </div>

        {/* FOOTER: ACTION BUTTONS */}
        <div className="pt-4 border-t-2 border-wood mt-auto flex justify-between gap-4 shrink-0">
             {mode === 'GALLERY' && (
                 <RuneButton label="KEMBALI KE NEXUS" variant="secondary" onClick={onCancel} />
             )}

             {mode === 'RITUAL' && (
                 <>
                    {step === 'DETAILS' ? (
                        <RuneButton label="BATAL" variant="secondary" onClick={() => setMode('GALLERY')} />
                    ) : (
                        <RuneButton label="KEMBALI" variant="secondary" onClick={() => {
                            if (step === 'REVIEW') setStep('RULES');
                            else if (step === 'RULES') setStep('DETAILS');
                        }} />
                    )}

                    {step !== 'REVIEW' ? (
                        <RuneButton 
                            label="LANJUT" 
                            disabled={!details.name && step === 'DETAILS'} 
                            onClick={() => {
                                if (step === 'DETAILS') setStep('RULES');
                                else if (step === 'RULES') setStep('REVIEW');
                            }} 
                        />
                    ) : (
                        <RuneButton 
                            label={isProcessing ? "MEMANTRAI..." : "MANIFESTASIKAN"} 
                            variant="danger" 
                            disabled={isProcessing} 
                            onClick={() => finalizeCreation(false)} 
                        />
                    )}
                 </>
             )}
        </div>
      </PixelCard>
    </div>
  );
};