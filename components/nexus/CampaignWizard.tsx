// components/nexus/CampaignWizard.tsx
import React, { useState } from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { useAppStore } from '../../store/appStore';
import { campaignRepository } from '../../services/repository/campaignRepository';
import { Campaign } from '../../types';

interface CampaignWizardProps {
  onComplete: (campaignId: string) => void;
  onCancel: () => void;
}

const DM_PERSONALITIES = [
    "Serius & Kelam",
    "Heroik & Epik",
    "Kocak & Kacau",
    "Misterius & Menegangkan"
];

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onComplete, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('fantasy');
  const [dmPersonality, setDmPersonality] = useState(DM_PERSONALITIES[0]);
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAppStore();

  const handleCreate = async () => {
    if (!user || !name) return;
    setIsCreating(true);
    try {
      const campaignData: Omit<Campaign, 'id' | 'ownerId' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId' | 'initiativeOrder'> = {
        title: name,
        description: description,
        theme: theme,
        dmPersonality: dmPersonality,
        // Provide sensible defaults for other required fields
        cover_url: '',
        joinCode: '',
        isPublished: false,
        maxPlayers: 4,
        mainGenre: '',
        subGenre: '',
        duration: '',
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
      
      if (newCampaign) {
        onComplete(newCampaign.id);
      }
    } catch (error) {
      console.error(error);
      alert("Gagal menciptakan dimensi baru.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
      <PixelCard className="w-full max-w-lg border-gold bg-surface">
        <h2 className="font-pixel text-gold text-center mb-6">CIPTAKAN DIMENSI</h2>
        
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
           <div>
             <label className="font-pixel text-[10px] text-faded block mb-2">NAMA DUNIA (CAMPAIGN)</label>
             <input 
               type="text" 
               value={name}
               onChange={(e) => setName(e.target.value)}
               className="w-full bg-black border-2 border-wood p-2 font-retro text-parchment focus:border-gold outline-none"
               placeholder="e.g. The Shadow Over Innsmouth"
             />
           </div>

           <div>
             <label className="font-pixel text-[10px] text-faded block mb-2">PREMIS DUNIA (DESKRIPSI SINGKAT)</label>
             <textarea 
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               className="w-full bg-black border-2 border-wood p-2 font-retro text-parchment focus:border-gold outline-none"
               rows={3}
               placeholder="Sebuah desa nelayan yang terisolasi menyembunyikan rahasia mengerikan di bawah ombak..."
             />
           </div>

           <div>
             <label className="font-pixel text-[10px] text-faded block mb-2">TEMA CERITA</label>
             <div className="grid grid-cols-2 gap-2">
                {['fantasy', 'scifi', 'horror', 'cyberpunk'].map(t => (
                   <div 
                     key={t}
                     onClick={() => setTheme(t)}
                     className={`p-2 border-2 cursor-pointer text-center capitalize font-pixel text-[10px]
                       ${theme === t ? 'bg-gold text-black border-gold' : 'bg-black text-faded border-wood'}
                     `}
                   >
                     {t}
                   </div>
                ))}
             </div>
           </div>

            <div>
             <label className="font-pixel text-[10px] text-faded block mb-2">KEPRIBADIAN AI DUNGEON MASTER</label>
             <div className="grid grid-cols-2 gap-2">
                {DM_PERSONALITIES.map(p => (
                   <div 
                     key={p}
                     onClick={() => setDmPersonality(p)}
                     className={`p-2 border-2 cursor-pointer text-center font-pixel text-[10px]
                       ${dmPersonality === p ? 'bg-gold text-black border-gold' : 'bg-black text-faded border-wood'}
                     `}
                   >
                     {p}
                   </div>
                ))}
             </div>
           </div>

           <div className="flex gap-2 pt-4">
              <RuneButton label="BATAL" variant="secondary" onClick={onCancel} fullWidth />
              <RuneButton 
                label={isCreating ? "MENCIPTAKAN..." : "WUJUDKAN"} 
                fullWidth 
                disabled={!name || isCreating}
                onClick={handleCreate}
              />
           </div>
        </div>
      </PixelCard>
    </div>
  );
};