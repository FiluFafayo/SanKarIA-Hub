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

// DESKRIPSI TEMA (Fase 2)
const THEME_DATA: Record<string, string> = {
    'Fantasy': 'Pedang, sihir, naga, dan kepahlawanan klasik. Dunia penuh keajaiban.',
    'Dark Fantasy': 'Dunia yang sekarat, moralitas abu-abu, dan bahaya yang nyata.',
    'Sci-Fi': 'Bintang-bintang, teknologi canggih, dan misteri alam semesta.',
    'Cyberpunk': 'High tech, low life. Korporasi jahat dan neon di tengah hujan.',
    'Eldritch Horror': 'Teror kosmik yang tak terbayangkan. Kewarasan adalah harga.',
    'Steampunk': 'Uap, roda gigi, dan revolusi industri dengan sentuhan sihir.',
};

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
    description: '',
    storyInput: '' // BARU: Freeform input untuk user cerita
  });

  // State untuk preview Template yang dipilih
  const [selectedTemplate, setSelectedTemplate] = useState<Partial<Campaign> | null>(null);
  
  // State untuk Oracle Options (Fase 2)
  const [oracleOptions, setOracleOptions] = useState<Array<{title: string, description: string, villain: string}> | null>(null);

  // --- LOGIC: ORACLE AI ---
  const invokeOracle = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setOracleOptions(null); // Reset opsi sebelumnya
    
    try {
        // Panggil AI dengan input cerita user (jika ada)
        const suggestions = await generationService.suggestIncantation(formData.theme, formData.storyInput);
        setOracleOptions(suggestions);
    } catch (e) {
        console.error("Oracle gagal:", e);
    } finally {
        setIsProcessing(false);
    }
  };

  const applyOracleOption = (opt: {title: string, description: string, villain: string}) => {
      setFormData(prev => ({
          ...prev,
          title: opt.title,
          description: opt.description,
          villain: opt.villain
      }));
      setOracleOptions(null); // Tutup modal
  };

  // --- LOGIC: MANIFESTATION ---
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // [FASE 1] Error State

  const manifestWorld = async (isTemplate: boolean) => {
    if (!user) return;
    setIsProcessing(true);
    setErrorMsg(null); // Reset error
    
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
                // [ATLAS PROTOCOL] Grid dikirim via DTO khusus untuk ditangkap Repository
                // Repository akan memisahkannya ke tabel 'world_maps' via RPC
                explorationGrid: Array.from({ length: 100 }, () => Array(100).fill(10001)),
                fogOfWar: Array.from({ length: 100 }, () => Array(100).fill(true)),
                
                battleState: null,
                playerGridPosition: { x: 50, y: 50 },
            };
        }

        const newCampaign = await campaignRepository.createCampaign(finalData, user.id);
        if (newCampaign) {
             onComplete(newCampaign.id);
        } else {
             throw new Error("Campaign ID kosong dari Void.");
        }
    } catch (error: any) {
        console.error("Gagal menciptakan dimensi:", error);
        setErrorMsg(error.message || "Ritual gagal. Dewa Dice sedang marah.");
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
                <div className="flex flex-col gap-2 animate-fade-in h-full">
                    {!selectedTemplate ? (
                        <div className="flex flex-col gap-2 overflow-y-auto pr-2 h-full">
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
                <div className="flex flex-col h-full">
                     <div className="flex flex-col gap-2 overflow-y-auto pr-2 animate-fade-in flex-1">
                        {/* Tombol Surprise Me */}
                        <div 
                            onClick={() => {
                                const randomTheme = Object.keys(THEME_DATA)[Math.floor(Math.random() * Object.keys(THEME_DATA).length)];
                                setFormData({...formData, theme: randomTheme});
                            }}
                            className="p-3 border-2 border-dashed border-cyan-900/50 bg-cyan-900/10 cursor-pointer text-center hover:bg-cyan-900/30 hover:border-cyan-500 transition-all mb-2 group"
                        >
                            <div className="font-pixel text-sm text-cyan-400 group-hover:text-cyan-200 flex items-center justify-center gap-2">
                                <span>🎲</span> SURPRISE ME
                            </div>
                        </div>

                        {Object.entries(THEME_DATA).map(([t, desc]) => (
                            <div
                                key={t}
                                onClick={() => setFormData({...formData, theme: t})}
                                className={`p-3 border-2 cursor-pointer transition-all ${formData.theme === t ? 'border-gold bg-gold/10' : 'border-wood hover:bg-white/5'}`}
                            >
                                <div className="font-pixel text-md text-parchment text-center">{t}</div>
                                {formData.theme === t && (
                                    <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-retro text-faded text-center italic animate-fade-in">
                                        "{desc}"
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="shrink-0 flex gap-2 mt-4 pt-4 border-t border-wood/30 relative z-20">
                        <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('METHOD')} fullWidth />
                        <RuneButton label="LANJUT" fullWidth onClick={() => setStep('SCALE')} />
                    </div>
                </div>
            );

        case 'SCALE':
            return (
                <div className="flex flex-col h-full">
                     <div className="flex flex-col gap-4 animate-fade-in flex-1 overflow-y-auto pr-2">
                        {SCALES.map((s) => (
                            <div
                                key={s.id}
                                onClick={() => setFormData({...formData, scale: s.id})}
                                className={`p-4 border-2 cursor-pointer transition-colors shrink-0 ${formData.scale === s.id ? 'border-gold bg-gold/10' : 'border-wood hover:bg-white/5'}`}
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
                    <div className="shrink-0 flex gap-2 mt-4 pt-4 border-t border-wood/30 relative z-20">
                        <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('THEME')} fullWidth />
                        <RuneButton label="LANJUT" fullWidth onClick={() => setStep('CONCEPT')} />
                    </div>
                </div>
            );

        case 'CONCEPT':
            return (
                <div className="flex flex-col gap-3 animate-fade-in h-full relative">
                    {/* ORACLE MODAL OVERLAY */}
                    {oracleOptions && (
                        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-2 animate-fade-in">
                            <div className="text-center mb-2 border-b border-wood pb-2">
                                <h3 className="font-pixel text-gold text-sm">PENGLIHATAN ORACLE</h3>
                                <p className="text-[10px] text-faded font-retro">Pilih satu takdir yang paling memanggilmu...</p>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                {oracleOptions.map((opt, idx) => (
                                    <div 
                                        key={idx}
                                        onClick={() => applyOracleOption(opt)}
                                        className="p-3 border border-wood bg-void/50 cursor-pointer hover:border-gold hover:bg-gold/10 transition-all group"
                                    >
                                        <div className="font-pixel text-xs text-gold mb-1 group-hover:text-white">{opt.title}</div>
                                        <div className="text-[10px] text-faded font-retro italic mb-1">Vs. {opt.villain}</div>
                                        <p className="text-[10px] text-parchment line-clamp-2">{opt.description}</p>
                                    </div>
                                ))}
                            </div>
                            <RuneButton label="BATAL" variant="secondary" onClick={() => setOracleOptions(null)} fullWidth className="mt-2" />
                        </div>
                    )}

                    <div className="p-3 bg-black/40 border border-wood rounded space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                         {/* STORY INPUT MODE (NEW) */}
                        <div className="bg-void/30 p-2 border border-dashed border-wood/50 rounded mb-2">
                             <label className="text-[10px] text-blue-300 font-pixel block mb-1">
                                 ✨ INSPIRASI AWAL (OPSIONAL)
                             </label>
                             <textarea 
                                value={formData.storyInput}
                                onChange={(e) => setFormData({...formData, storyInput: e.target.value})}
                                className="w-full bg-black/50 border border-wood/50 p-2 text-blue-100 font-retro text-xs focus:border-blue-400 outline-none h-16 resize-none placeholder-faded/50"
                                placeholder="Ceritakan idemu... misal: 'Dunia penuh pulau melayang dimana air sangat mahal dan bajak langit berkuasa...'"
                            />
                             <div className="flex justify-end mt-1">
                                <button
                                    onClick={invokeOracle}
                                    disabled={isProcessing}
                                    className="text-[9px] font-pixel bg-void border border-gold text-gold px-3 py-1 hover:bg-gold hover:text-void transition-colors flex items-center gap-1 shadow-pixel-sm"
                                >
                                    {isProcessing ? <span className="animate-spin">⚙️</span> : <span>🔮</span>} TANYA ORACLE
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-wood/30 pt-2 space-y-2">
                            <div>
                                <label className="text-[10px] text-gold font-pixel block mb-1 flex justify-between">
                                    <span>NAMA DUNIA</span>
                                    <span className={formData.title.length > 40 ? "text-red-500" : "text-faded"}>{formData.title.length}/50</span>
                                </label>
                                <input 
                                    type="text" 
                                    value={formData.title}
                                    maxLength={50}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    className="w-full bg-black border border-wood p-2 text-parchment font-pixel text-sm focus:border-gold outline-none"
                                    placeholder="Contoh: Eldoria"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gold font-pixel block mb-1 flex justify-between">
                                    <span>ANCAMAN UTAMA</span>
                                    <span className={formData.villain.length > 40 ? "text-red-500" : "text-faded"}>{formData.villain.length}/50</span>
                                </label>
                                <input 
                                    type="text" 
                                    value={formData.villain}
                                    maxLength={50}
                                    onChange={(e) => setFormData({...formData, villain: e.target.value})}
                                    className="w-full bg-black border border-wood p-2 text-parchment font-retro text-sm focus:border-gold outline-none"
                                    placeholder="Contoh: Raja Iblis yang bangkit..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gold font-pixel block mb-1">DESKRIPSI SINGKAT</label>
                                <textarea 
                                    value={formData.description}
                                    maxLength={500}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    className="w-full bg-black border border-wood p-2 text-faded font-retro text-xs focus:border-gold outline-none h-20 resize-none custom-scrollbar"
                                    placeholder="Dunia ini hancur karena..."
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="shrink-0 flex gap-2 mt-2 relative z-20">
                        <RuneButton label="KEMBALI" variant="secondary" onClick={() => setStep('SCALE')} fullWidth />
                        <RuneButton label="LANJUT" fullWidth disabled={!formData.title} onClick={() => setStep('REVIEW')} />
                    </div>
                </div>
            );

        case 'REVIEW':
             return (
                <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="text-center mb-2">
                        <h3 className="font-pixel text-gold text-lg">GEMA MANTRA</h3>
                        <p className="font-retro text-xs text-faded">Bacalah kembali takdir yang kau tulis...</p>
                    </div>

                    <div className="bg-black/60 border-2 border-wood p-4 shadow-lg relative overflow-hidden rounded-sm">
                        {/* Decorative Corner */}
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gold/50" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gold/50" />

                        <p className="font-retro text-parchment text-sm leading-relaxed text-justify">
                            "Saya memanggil dunia <span className="text-gold border-b border-gold/50">{formData.theme.toUpperCase()}</span>, 
                            sebuah <span className="text-gold border-b border-gold/50">{SCALES.find(s => s.id === formData.scale)?.label}</span> yang bernama 
                            <span className="text-gold border-b border-gold/50 font-bold mx-1">{formData.title.toUpperCase()}</span>.
                            <br/><br/>
                            Di sini, takdir diuji oleh <span className="text-red-400 border-b border-red-900/50">{formData.villain || "KEGELAPAN ABSTRAK"}</span>.
                            <br/>
                            <span className="italic text-faded text-xs mt-2 block">"{formData.description || 'Kisah ini belum terungkap...'}"</span>"
                        </p>
                    </div>

                    {formData.scale === 'Endless Saga' && (
                        <div className="flex items-start gap-2 p-2 bg-red-900/10 border border-red-900/30 rounded">
                            <span className="text-lg">⚠️</span>
                            <p className="text-[10px] text-red-300/80 font-retro leading-tight">
                                <strong>Peringatan Atlas:</strong> Mode ini akan mengaktifkan <em>Procedural Generation</em>. Peta dan Quest akan dibuat secara otomatis oleh AI seiring perjalanan.
                            </p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-2 bg-red-900/50 border border-red-500 text-red-200 text-xs font-pixel text-center mb-2 animate-pulse">
                            ⚠️ {errorMsg.toUpperCase()}
                        </div>
                    )}
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