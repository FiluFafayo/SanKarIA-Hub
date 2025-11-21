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

// Wizard Step Definition - Mengadopsi flow CharacterWizard
type WizardStep = 'METHOD' | 'LIBRARY' | 'THEME' | 'SCALE' | 'CONCEPT' | 'REVIEW';

const THEMES = ['Fantasy', 'Dark Fantasy', 'Sci-Fi', 'Cyberpunk', 'Eldritch Horror', 'Steampunk'];
const SCALES = [
    { id: 'One-Shot', label: 'Kisah Tunggal', desc: 'Satu peta, linear, 1-2 sesi. Cocok untuk pemula.' },
    { id: 'Endless Saga', label: 'Hikayat Tanpa Akhir', desc: 'Open World, Procedural Generation, Cerita Bercabang.' }
];

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onComplete, onCancel }) => {
  const { user } = useAppStore();
  const [step, setStep] = useState<WizardStep>('METHOD');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    theme: 'Fantasy',
    scale: 'One-Shot',
    villain: '', 
    description: ''
  });

  // State untuk preview Template yang dipilih
  const [selectedTemplate, setSelectedTemplate] = useState<Partial<Campaign> | null>(null);

  // --- LOGIC: ORACLE AI ---
  const invokeOracle = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        const suggestion = await generationService.suggestIncantation(formData.theme);
        setFormData(prev => ({
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
  const manifestWorld = async (isTemplate: boolean) => {
    if (!user) return;
    setIsProcessing(true);
    try {
        const defaultRules: CampaignRules = {
            startingLevel: 1,
            advancementType: 'milestone',
            rollPrivacy: 'public',
            allowHomebrew: false,
            maxPartySize: 4,
        };

        let finalData: any = {};

        if (isTemplate && selectedTemplate) {
            // Mode Library
            finalData = {
                ...selectedTemplate,
                joinCode: generateJoinCode(),
                ownerId: user.id,
                isPublished: true,
                duration: selectedTemplate.duration || 'One-Shot'
            };
        } else {
            // Mode Incantation
            finalData = {
                title: formData.title,
                description: formData.description,
                theme: formData.theme.toLowerCase(),
                duration: formData.scale,
                mainGenre: formData.theme,
                subGenre: 'RPG',
                dmPersonality: "Adil & Adaptif", 
                dmNarrationStyle: 'Langsung & Percakapan',
                responseLength: 'Standar',
                rulesConfig: defaultRules,
                cover_url: `https://picsum.photos/seed/${formData.title.replace(/\s/g, '-')}/800/600`,
                joinCode: generateJoinCode(),
                isPublished: false,
                maxPlayers: 4,
                isNSFW: false,
                gameState: 'exploration',
                currentPlayerId: null,
                longTermMemory: `Tema: ${formData.theme}. Konflik Awal: ${formData.villain}.`,
                currentTime: 43200,
                currentWeather: 'Cerah',
                worldEventCounter: 0,
                mapImageUrl: '',
                mapMarkers: [],
                quests: [],
                npcs: [],
                explorationGrid: Array.from({ length: 100 }, () => Array(100).fill(10001)),
                fogOfWar: Array.from({ length: 100 }, () => Array(100).fill(true)),
                battleState: null,
                playerGridPosition: { x: 50, y: 50 },
            };
        }

        const newCampaign = await campaignRepository.createCampaign(finalData, user.id);
        if (newCampaign) onComplete(newCampaign.id);
    } catch (error) {
        console.error("Gagal menciptakan dimensi:", error);
        // Dalam arsitektur paranoid, alert adalah dosa, tapi untuk MVP kita biarkan dulu
        alert("Ritual gagal. Dewa Dice sedang marah.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- HELPER: RENDER CONTENT BY STEP ---
  const renderContent = () => {
    switch (step) {
        case 'METHOD':
            return (
                <div className="flex flex-col gap-4 animate-fade-in">
                    <p className="text-parchment font-retro text-center text-sm mb-2">
                        Bagaimana dunia ini akan terbentuk?
                    </p>
                    
                    <div 
                        onClick={() => setStep('LIBRARY')}
                        className="p-4 border-2 border-wood cursor-pointer hover:bg-white/5 transition-all group relative overflow-hidden"
                    >
                        <div className="flex items-center gap-4 z-10 relative">
                            <div className="text-3xl">📖</div>
                            <div>
                                <h3 className="font-pixel text-gold group-hover:text-white">PERPUSTAKAAN (TEMPLATE)</h3>
                                <p className="text-xs text-faded font-retro">Pilih dari kisah legendaris yang sudah tertulis.</p>
                            </div>
                        </div>
                    </div>

                    <div 
                        onClick={() => setStep('THEME')}
                        className="p-4 border-2 border-dashed border-wood cursor-pointer hover:bg-gold/10 hover:border-gold transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="text-3xl group-hover:animate-pulse">✨</div>
                            <div>
                                <h3 className="font-pixel text-faded group-hover:text-gold">RITUAL PENCIPTAAN (CUSTOM)</h3>
                                <p className="text-xs text-faded font-retro">Tulis mantramu sendiri dengan bantuan Oracle.</p>
                            </div>
                        </div>
                    </div>
                </div>
            );

        case 'LIBRARY':
            return (
                <div className="flex flex-col gap-2 animate-fade-in">
                    {!selectedTemplate ? (
                        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
                            {DEFAULT_CAMPAIGNS.map((tpl, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => setSelectedTemplate(tpl)}
                                    className="p-3 border-2 border-wood cursor-pointer flex gap-3 hover:bg-white/5"
                                >
                                    <img src={tpl.cover_url || tpl.image} className="w-16 h-16 object-cover border border-wood/50" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-pixel text-gold text-sm truncate">{tpl.title}</div>
                                        <div className="flex gap-1 mt-1">
                                            <span className="text-[9px] bg-wood/30 px-1 rounded text-faded border border-wood/30">{tpl.mainGenre}</span>
                                            <span className="text-[9px] bg-wood/30 px-1 rounded text-faded border border-wood/30">{tpl.duration}</span>
                                        </div>
                                        <p className="font-retro text-[10px] text-faded mt-1 line-clamp-1">{tpl.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 animate-fade-in">
                            <div className="p-3 bg-black/50 border-2 border-wood">
                                <div className="h-32 w-full bg-cover bg-center border-b border-wood mb-3 relative" style={{ backgroundImage: `url(${selectedTemplate.cover_url || selectedTemplate.image})` }}>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                                    <h3 className="absolute bottom-2 left-2 font-pixel text-lg text-gold drop-shadow-md">{selectedTemplate.title}</h3>
                                </div>
                                <p className="text-xs text-parchment font-retro text-justify mb-4">{selectedTemplate.description}</p>
                                <div className="grid grid-cols-2 gap-2 text-[10px] text-faded">
                                    <div className="bg-wood/10 p-2 border border-wood/30">
                                        <span className="text-gold block">Genre:</span> {selectedTemplate.mainGenre}
                                    </div>
                                    <div className="bg-wood/10 p-2 border border-wood/30">
                                        <span className="text-gold block">Skala:</span> {selectedTemplate.duration}
                                    </div>
                                </div>
                            </div>
                            <RuneButton label="Pilih Buku Lain" variant="secondary" onClick={() => setSelectedTemplate(null)} fullWidth />
                        </div>
                    )}
                    <div className="flex gap-2 mt-4 relative z-20">
                        <RuneButton label="KEMBALI" variant="secondary" onClick={() => selectedTemplate ? setSelectedTemplate(null) : setStep('METHOD')} fullWidth />
                        <RuneButton label="BUKA BUKU INI" fullWidth disabled={!selectedTemplate || isProcessing} onClick={() => manifestWorld(true)} />
                    </div>
                </div>
            );

        case 'THEME':
            return (
                <>
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 animate-fade-in">
                        {THEMES.map((t) => (
                            <div
                                key={t}
                                onClick={() => setFormData({...formData, theme: t})}
                                className={`p-3 border-2 cursor-pointer text-center hover:bg-white/5 transition-colors ${formData.theme === t ? 'border-gold bg-gold/10' : 'border-wood'}`}
                            >
                                <div className="font-pixel text-md text-parchment">{t}</div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-4 relative z-20">
                        <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('METHOD')} fullWidth />
                        <RuneButton label="LANJUT" fullWidth onClick={() => setStep('SCALE')} />
                    </div>
                </>
            );

        case 'SCALE':
            return (
                <>
                     <div className="flex flex-col gap-4 animate-fade-in">
                        {SCALES.map((s) => (
                            <div
                                key={s.id}
                                onClick={() => setFormData({...formData, scale: s.id})}
                                className={`p-4 border-2 cursor-pointer transition-colors ${formData.scale === s.id ? 'border-gold bg-gold/10' : 'border-wood hover:bg-white/5'}`}
                            >
                                <div className="font-pixel text-gold text-sm mb-1">{s.label}</div>
                                <div className="font-retro text-xs text-faded">{s.desc}</div>
                                {s.id === 'Endless Saga' && (
                                    <div className="mt-2 text-[9px] bg-red-900/30 text-red-300 px-2 py-1 border border-red-900/50 inline-block rounded">
                                        ⚠️ EXPERIMENTAL: Procedural Engine
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-4 relative z-20">
                        <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('THEME')} fullWidth />
                        <RuneButton label="LANJUT" fullWidth onClick={() => setStep('CONCEPT')} />
                    </div>
                </>
            );

        case 'CONCEPT':
            return (
                <div className="flex flex-col gap-3 animate-fade-in">
                    <div className="p-3 bg-black/40 border border-wood rounded space-y-3">
                        <div>
                            <label className="text-[10px] text-gold font-pixel block mb-1">NAMA DUNIA</label>
                            <input 
                                type="text" 
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                className="w-full bg-black border border-wood p-2 text-parchment font-pixel text-sm focus:border-gold outline-none"
                                placeholder="Contoh: Eldoria"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gold font-pixel block mb-1">ANCAMAN UTAMA</label>
                            <input 
                                type="text" 
                                value={formData.villain}
                                onChange={(e) => setFormData({...formData, villain: e.target.value})}
                                className="w-full bg-black border border-wood p-2 text-parchment font-retro text-sm focus:border-gold outline-none"
                                placeholder="Contoh: Raja Iblis yang bangkit..."
                            />
                        </div>
                        <div className="relative">
                            <label className="text-[10px] text-gold font-pixel block mb-1">DESKRIPSI SINGKAT</label>
                            <textarea 
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                className="w-full bg-black border border-wood p-2 text-faded font-retro text-xs focus:border-gold outline-none h-24 resize-none"
                                placeholder="Dunia ini hancur karena..."
                            />
                            <button 
                                onClick={invokeOracle}
                                disabled={isProcessing}
                                className="absolute bottom-2 right-2 text-[9px] bg-cyan-900/80 border border-cyan-700 text-cyan-200 px-2 py-1 hover:bg-cyan-700 rounded flex items-center gap-1"
                            >
                                {isProcessing ? <span className="animate-spin">⚙️</span> : <span>✨</span>} ORACLE
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 mt-2 relative z-20">
                        <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('SCALE')} fullWidth />
                        <RuneButton label="LANJUT" fullWidth disabled={!formData.title} onClick={() => setStep('REVIEW')} />
                    </div>
                </div>
            );

        case 'REVIEW':
             return (
                <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="text-center mb-2">
                        <h3 className="font-pixel text-gold text-lg">KONFIRMASI RITUAL</h3>
                        <p className="font-retro text-xs text-faded">Apakah mantramu sudah benar?</p>
                    </div>

                    <div className="bg-surface border-2 border-gold p-4 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-gold text-black text-[9px] font-bold px-2 py-1">
                            {formData.scale.toUpperCase()}
                        </div>
                        
                        <h4 className="font-pixel text-parchment text-md mb-1">{formData.title}</h4>
                        <div className="text-[10px] text-gold mb-3 italic">{formData.theme} RPG</div>
                        
                        <p className="font-retro text-xs text-faded mb-3 line-clamp-4">
                            "{formData.description}"
                        </p>
                        
                        <div className="border-t border-wood/30 pt-2 mt-2">
                            <p className="text-[10px] text-red-400">
                                <span className="font-bold">KONFLIK:</span> {formData.villain || "Belum terdeteksi..."}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-2 relative z-20">
                        <RuneButton label="UBAH MANTRA" variant="secondary" onClick={() => setStep('CONCEPT')} fullWidth />
                        <RuneButton 
                            label={isProcessing ? "MEMBUKA DIMENSI..." : "MANIFESTASIKAN"} 
                            variant="danger" 
                            disabled={isProcessing} 
                            onClick={() => manifestWorld(false)} 
                            fullWidth 
                        />
                    </div>
                </div>
            );
            
        default: return null;
    }
  };

  return (
    <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <PixelCard className="w-full max-w-md border-gold shadow-pixel-glow bg-surface flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="border-b-2 border-wood pb-4 mb-4 shrink-0">
            <div className="flex justify-between items-center">
                <h2 className="font-pixel text-gold text-lg md:text-xl tracking-wider">
                    {step === 'METHOD' && "PILIHAN TAKDIR"}
                    {step === 'LIBRARY' && "PERPUSTAKAAN KUNO"}
                    {step === 'THEME' && "TEMA DUNIA"}
                    {step === 'SCALE' && "SKALA WAKTU"}
                    {step === 'CONCEPT' && "GULUNGAN MANTRA"}
                    {step === 'REVIEW' && "MANIFESTASI"}
                </h2>
                <button onClick={onCancel} className="text-xs text-faded hover:text-red-400 font-pixel border border-wood px-2 py-1 hover:bg-red-900/30 transition-colors">
                    X
                </button>
            </div>
            {/* Progress Indicator (Only for Incantation) */}
            {['THEME', 'SCALE', 'CONCEPT', 'REVIEW'].includes(step) && (
                <div className="flex gap-1 mt-2">
                    {['THEME', 'SCALE', 'CONCEPT', 'REVIEW'].map((s, i) => {
                         const steps = ['THEME', 'SCALE', 'CONCEPT', 'REVIEW'];
                         const currentIdx = steps.indexOf(step);
                         const isActive = i <= currentIdx;
                         return (
                             <div key={s} className={`h-1 flex-1 rounded ${isActive ? 'bg-gold' : 'bg-wood/30'}`} />
                         );
                    })}
                </div>
            )}
        </div>

        {/* CONTENT */}
        <div className="flex-grow overflow-y-auto custom-scrollbar pr-1">
            {renderContent()}
        </div>

      </PixelCard>
    </div>
  );
};