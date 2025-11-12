// components/nexus/CampaignWizard.tsx
import React, { useState } from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { useAppStore } from '../../store/appStore';
import { campaignRepository } from '../../services/repository/campaignRepository';
import { DEFAULT_CAMPAIGNS } from '../../data/defaultCampaigns';

interface CampaignWizardProps {
  onComplete: (campaignId: string) => void;
  onCancel: () => void;
}

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onComplete, onCancel }) => {
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('fantasy');
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAppStore();

  const handleCreate = async () => {
    if (!user || !name) return;
    setIsCreating(true);
    try {
      // Logic backend create campaign
      const campaign = await campaignRepository.createCampaign({
        gm_id: user.id,
        name: name,
        theme: theme,
        status: 'active',
        current_location: 'Nexus Sanctum', // Lokasi awal
        players: [user.id]
      });
      
      if (campaign) {
        onComplete(campaign.id);
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
      <PixelCard className="w-full max-w-md border-gold bg-surface">
        <h2 className="font-pixel text-gold text-center mb-6">CIPTAKAN DIMENSI</h2>
        
        <div className="space-y-4">
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

           <div className="flex gap-2 mt-6">
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