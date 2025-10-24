
import React from 'react';
import { ModalWrapper } from '../ModalWrapper';
import { Campaign, Character } from '../../types';

interface HallOfEchoesModalProps {
  onClose: () => void;
  campaigns: Campaign[];
  onSelectCampaign: (campaign: Campaign) => void;
  myCharacters: Character[];
  onUpdateCampaign: (campaign: Campaign) => void;
}

const CampaignPortal: React.FC<{ campaign: Campaign, onSelect: () => void, onUpdate: (campaign: Campaign) => void, isMyTurn: boolean }> = ({ campaign, onSelect, onUpdate, isMyTurn }) => {
    
    const handlePublishToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdate({ ...campaign, isPublished: !campaign.isPublished });
    }
    
    return (
    <div 
      className={`relative group w-64 h-48 rounded-lg overflow-hidden shadow-lg transition-all duration-300 transform-gpu hover:scale-105 hover:shadow-2xl cursor-pointer`}
      onClick={onSelect}
    >
        <img src={campaign.image} alt={campaign.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 to-transparent transition-all duration-300 border-2 ${isMyTurn ? 'border-amber-400 animate-pulse' : 'border-transparent group-hover:border-amber-400'}`}></div>
        <div className="absolute bottom-0 left-0 p-3 text-white w-full">
            <h3 className="font-cinzel text-lg leading-tight">{campaign.title}</h3>
            {isMyTurn && <p className="text-xs font-bold text-amber-300">Giliran Anda!</p>}
            {/* FIX: Changed 'history' to 'eventLog' to match the Campaign type. */}
            <p className="text-xs opacity-80">{campaign.eventLog.length > 0 ? `Terakhir dimainkan: ${new Date(campaign.eventLog[campaign.eventLog.length - 1].timestamp).toLocaleDateString()}` : 'Belum dimulai'}</p>
        </div>
         <div className="absolute top-2 right-2 bg-black/50 rounded-full px-2 py-1 text-xs text-white">
            {campaign.playerIds.length} Pemain
        </div>
        <button 
            onClick={handlePublishToggle}
            className={`absolute bottom-2 right-2 text-xs px-2 py-1 rounded-full transition-colors ${campaign.isPublished ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white' } opacity-0 group-hover:opacity-100`}
        >
            {campaign.isPublished ? 'Batal Terbit' : 'Terbitkan'}
        </button>
    </div>
)};

export const HallOfEchoesModal: React.FC<HallOfEchoesModalProps> = ({ onClose, campaigns, onSelectCampaign, myCharacters, onUpdateCampaign }) => {
  const myCharacterIds = myCharacters.map(c => c.id);
  
  return (
    <ModalWrapper onClose={onClose} title="Aula Gema">
      <div className="bg-gray-900/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-8 shadow-2xl max-w-4xl max-h-[80vh] overflow-y-auto">
        <h2 className="font-cinzel text-4xl text-white mb-2 text-center" style={{textShadow: '0 0 10px #a855f7'}}>Aula Gema</h2>
        <p className="text-purple-200 text-center mb-8">Petualangan masa lalu dan kini menanti.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.length > 0 ? (
              campaigns.map(campaign => {
                const isMyTurn = myCharacterIds.includes(campaign.currentPlayerId || '');
                return <CampaignPortal key={campaign.id} campaign={campaign} onSelect={() => onSelectCampaign(campaign)} onUpdate={onUpdateCampaign} isMyTurn={isMyTurn} />
              })
            ) : (
              <p className="text-purple-200 text-center col-span-full">Belum ada kampanye. Kunjungi Puncak Pencerita untuk membuatnya!</p>
            )}
        </div>
      </div>
    </ModalWrapper>
  );
};
