// components/nexus/CampaignWizard.tsx
import React, { useState } from 'react';
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

// Arsitektur State Machine untuk Wizard
type WizardStep = 'MODE_SELECT' | 'THEME_SELECT' | 'SCALE_SELECT' | 'DETAILS_INPUT' | 'REVIEW';

const THEMES = ['Fantasy', 'Dark Fantasy', 'Sci-Fi', 'Cyberpunk', 'Eldritch Horror', 'Steampunk'];

const SCALES = [
    { id: 'One-Shot', label: 'Kisah Tunggal', desc: 'Linear. Tamat 1-2 sesi. Cocok untuk pemula.' },
    { id: 'Endless Saga', label: 'Hikayat Tanpa Akhir', desc: 'Open World. Multi-peta. Membutuhkan komitmen jangka panjang.' }
];

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onComplete, onCancel }) => {
  const { user } = useAppStore();
  const [step, setStep] = useState<WizardStep>('MODE_SELECT');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data State
  const [formData, setFormData] = useState({
    title: '',
    theme: 'Fantasy',
    scale: 'One-Shot',
    villain: '',
    description: '',
    selectedTemplate: null as Campaign | null
  });

  // --- LOGIC: ORACLE AI ---
  const invokeOracle = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        // Safety check: Default theme jika kosong
        const themeToUse = formData.theme || 'Fantasy';
        const suggestion = await generationService.suggestIncantation(themeToUse);
        
        setFormData(prev => ({
            ...prev,
            title: suggestion.title,
            description: suggestion.description,
            villain: suggestion.villain
        }));
    } catch (e) {
        console.error("[FATAL] Oracle malfunction:", e);
        // Fallback manual jika AI mati
        setFormData(prev => ({
             ...prev,
             description: prev.description || "Dunia ini tertutup kabut misteri..."
        }));
    } finally {
        setIsProcessing(false);
    }
  };

  // --- LOGIC: MANIFESTATION ---
  const commitToDatabase = async () => {
    if (!user) {
        alert("ERROR: User identity lost. Relogin required.");
        return;
    }
    setIsProcessing(true);
    try {
        const defaultRules: CampaignRules = {
            startingLevel: 1,
            advancementType: 'milestone',
            rollPrivacy: 'public',
            allowHomebrew: false,
            maxPartySize: 4,
        };

        let finalPayload: any = {};

        if (formData.selectedTemplate) {
            // Clone Template
            finalPayload = {
                ...formData.selectedTemplate,
                joinCode: generateJoinCode(),
                ownerId: user.id,
                isPublished: true,
                duration: formData.selectedTemplate.duration || 'One-Shot'
            };
        } else {
            // Custom World
            finalPayload = {
                title: formData.title || `World of ${formData.theme}`,
                description: formData.description,
                theme: formData.theme.toLowerCase(),
                duration: formData.scale,
                mainGenre: formData.theme,
                subGenre: 'RPG',
                
                // DM Config
                dmPersonality: "Adil & Adaptif", 
                dmNarrationStyle: 'Langsung & Percakapan',
                responseLength: 'Standar',
                rulesConfig: defaultRules,
                
                // Visuals & Meta
                cover_url: `https://picsum.photos/seed/${(formData.title || 'void').replace(/\s/g, '-')}/800/600`,
                joinCode: generateJoinCode(),
                isPublished: false,
                maxPlayers: 4,
                isNSFW: false,
                
                // State Initialization
                gameState: 'exploration',
                currentPlayerId: null,
                longTermMemory: `Tema: ${formData.theme}. Konflik Awal: ${formData.villain}.`,
                currentTime: 43200,
                currentWeather: 'Cerah',
                worldEventCounter: 0,
                
                // Atlas Protocol Placeholders
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

        const result = await campaignRepository.createCampaign(finalPayload, user.id);
        if (result) onComplete(result.id);
    } catch (error) {
        console.error("[FATAL] Database Rejection:", error);
        alert("Gagal menciptakan dunia. Cek konsol.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- RENDERERS PER STEP ---

  const renderHeader = (title: string, subtitle: string) => (
      <div className="shrink-0 px-6 py-4 border-b border-wood bg-black/80 backdrop-blur">
          <div className="flex justify-between items-start">
            <div>
                <h2 className="font-pixel text-gold text-xl tracking-wider">{title}</h2>
                <p className="font-retro text-faded text-xs">{subtitle}</p>
            </div>
            <button 
                onClick={onCancel} 
                className="p-2 -mr-2 text-faded hover:text-red-400 active:scale-95 transition-transform"
            >
                ✕
            </button>
          </div>
      </div>
  );

  const renderModeSelect = () => (
      <div className="flex flex-col gap-4 p-6 h-full justify-center">
          {/* Option 1: Template */}
          <button 
              onClick={() => {
                  // Skip setup steps for templates, go to a template picker (simplified here to 'just pick one')
                  // Untuk efisiensi, kita anggap user memilih template langsung memicu review/list
                  // Di implementasi ini, saya buat simple list selection di step ini
              }}
              className="hidden" // Hidden logic placeholder
          />
          
          <div className="grid gap-4">
            <h3 className="text-center font-pixel text-parchment mb-2">PILIH METODE PENCIPTAAN</h3>
            
            <button 
                onClick={() => setStep('THEME_SELECT')}
                className="group relative overflow-hidden border-2 border-wood bg-black/50 p-6 text-left hover:border-gold hover:bg-gold/10 transition-all rounded-lg active:scale-[0.98]"
            >
                <div className="font-pixel text-lg text-gold mb-1">✍️ TULIS MANTRA BARU</div>
                <p className="font-retro text-xs text-faded">Ciptakan dunia unik dari nol dengan bantuan Oracle AI.</p>
            </button>

            <div className="relative py-2 flex items-center">
                <div className="flex-grow border-t border-wood/30"></div>
                <span className="shrink-0 px-2 text-[10px] text-faded font-pixel">ATAU GUNAKAN BUKU LAMA</span>
                <div className="flex-grow border-t border-wood/30"></div>
            </div>

            {/* Template List Direct Access */}
            <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
                {DEFAULT_CAMPAIGNS.map((tpl, idx) => (
                    <button 
                        key={idx}
                        onClick={() => {
                            setFormData(prev => ({ ...prev, selectedTemplate: tpl }));
                            commitToDatabase(); // Direct execution for templates
                        }}
                        className="flex items-center gap-4 border border-wood/50 p-3 rounded hover:bg-wood/20 transition-colors text-left"
                    >
                        <div 
                            className="w-12 h-12 bg-cover rounded border border-wood shrink-0" 
                            style={{ backgroundImage: `url(${tpl.cover_url || tpl.image})` }} 
                        />
                        <div>
                            <div className="font-pixel text-sm text-parchment">{tpl.title}</div>
                            <div className="text-[10px] text-faded">{tpl.mainGenre} • {tpl.duration}</div>
                        </div>
                    </button>
                ))}
            </div>
          </div>
      </div>
  );

  const renderThemeSelect = () => (
      <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto pb-24">
          {THEMES.map(t => (
              <button
                key={t}
                onClick={() => {
                    setFormData(prev => ({ ...prev, theme: t }));
                    setStep('SCALE_SELECT');
                }}
                className={`
                    h-24 flex flex-col items-center justify-center border-2 rounded-lg transition-all
                    ${formData.theme === t 
                        ? 'border-gold bg-gold/20 text-gold' 
                        : 'border-wood/50 bg-black/30 text-faded hover:border-wood hover:text-parchment'}
                `}
              >
                  <span className="font-pixel text-sm text-center">{t}</span>
              </button>
          ))}
      </div>
  );

  const renderScaleSelect = () => (
      <div className="p-6 flex flex-col gap-4">
          {SCALES.map(s => (
              <button
                key={s.id}
                onClick={() => {
                    setFormData(prev => ({ ...prev, scale: s.id }));
                    setStep('DETAILS_INPUT');
                }}
                className={`
                    p-6 border-2 rounded-lg text-left transition-all
                    ${formData.scale === s.id
                        ? 'border-gold bg-gold/10' 
                        : 'border-wood/50 bg-black/30 hover:bg-wood/10'}
                `}
              >
                  <div className="flex justify-between items-center mb-2">
                      <span className={`font-pixel text-lg ${formData.scale === s.id ? 'text-gold' : 'text-parchment'}`}>
                          {s.label}
                      </span>
                      {formData.scale === s.id && <span className="text-gold">✓</span>}
                  </div>
                  <p className="font-retro text-sm text-faded leading-relaxed">
                      {s.desc}
                  </p>
              </button>
          ))}
      </div>
  );

  const renderDetailsInput = () => (
      <div className="p-6 flex flex-col gap-6 overflow-y-auto pb-24">
          
          {/* Judul */}
          <div className="flex flex-col gap-2">
              <label className="font-pixel text-xs text-gold uppercase">Judul Dunia</label>
              <input 
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Contoh: Negeri di Atas Awan"
                  className="bg-black/50 border border-wood p-4 text-parchment font-retro rounded focus:border-gold outline-none"
              />
          </div>

          {/* Villain */}
          <div className="flex flex-col gap-2">
              <label className="font-pixel text-xs text-gold uppercase">Sumber Konflik / Musuh</label>
              <input 
                  type="text"
                  value={formData.villain}
                  onChange={(e) => setFormData({...formData, villain: e.target.value})}
                  placeholder="Contoh: Raja Iblis yang Bangkit"
                  className="bg-black/50 border border-wood p-4 text-parchment font-retro rounded focus:border-gold outline-none"
              />
          </div>

          {/* AI Assistant */}
          <div className="p-4 bg-cyan-900/10 border border-cyan-900/50 rounded-lg flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <span className="font-pixel text-xs text-cyan-400">ORACLE ASSISTANCE</span>
                    <button 
                        onClick={invokeOracle}
                        disabled={isProcessing}
                        className="text-[10px] bg-cyan-900 text-cyan-100 px-3 py-1 rounded border border-cyan-500 hover:bg-cyan-700"
                    >
                        {isProcessing ? "Menerawang..." : "✨ Generate Ide"}
                    </button>
                </div>
                <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Deskripsi dunia akan muncul di sini..."
                    className="w-full h-24 bg-transparent border-none text-sm text-cyan-100/80 font-retro resize-none focus:outline-none"
                />
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-surface flex flex-col text-parchment animate-fade-in">
        
        {/* 1. DYNAMIC HEADER */}
        {step === 'MODE_SELECT' && renderHeader("THE LIBRARY", "Pilih takdirmu.")}
        {step === 'THEME_SELECT' && renderHeader("TEMA DUNIA", "Nuansa apa yang kau cari?")}
        {step === 'SCALE_SELECT' && renderHeader("SKALA WAKTU", "Seberapa panjang kisah ini?")}
        {step === 'DETAILS_INPUT' && renderHeader("DETAIL MANTRA", "Ucapkan nama duniamu.")}

        {/* 2. SCROLLABLE CONTENT AREA */}
        <div className="flex-grow overflow-y-auto bg-gradient-to-b from-black/20 to-black/80">
            {step === 'MODE_SELECT' && renderModeSelect()}
            {step === 'THEME_SELECT' && renderThemeSelect()}
            {step === 'SCALE_SELECT' && renderScaleSelect()}
            {step === 'DETAILS_INPUT' && renderDetailsInput()}
        </div>

        {/* 3. SAFE ZONE NAVIGATION (BOTTOM BAR) */}
        {step !== 'MODE_SELECT' && (
            <div className="shrink-0 p-4 bg-black border-t border-wood pb-safe flex gap-4">
                <button 
                    onClick={() => {
                        if (step === 'THEME_SELECT') setStep('MODE_SELECT');
                        if (step === 'SCALE_SELECT') setStep('THEME_SELECT');
                        if (step === 'DETAILS_INPUT') setStep('SCALE_SELECT');
                    }}
                    disabled={isProcessing}
                    className="px-6 py-3 border border-wood text-faded font-pixel text-xs rounded hover:bg-wood/20"
                >
                    KEMBALI
                </button>
                
                <button 
                    onClick={() => {
                        if (step === 'DETAILS_INPUT') {
                            commitToDatabase();
                        } else {
                            // Logic next step handled in render methods mostly, but failsafe here
                        }
                    }}
                    disabled={isProcessing || (step === 'DETAILS_INPUT' && !formData.title)}
                    className={`
                        flex-grow py-3 font-pixel text-sm rounded shadow-lg transition-all
                        ${isProcessing 
                            ? 'bg-wood cursor-wait text-faded' 
                            : 'bg-gold text-black hover:bg-yellow-500 shadow-gold/20'}
                    `}
                >
                    {isProcessing 
                        ? "MEMPROSES..." 
                        : step === 'DETAILS_INPUT' ? "MANIFESTASIKAN!" : "LANJUT"
                    }
                </button>
            </div>
        )}
    </div>
  );
};