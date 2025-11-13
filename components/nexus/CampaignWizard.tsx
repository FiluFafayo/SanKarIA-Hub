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