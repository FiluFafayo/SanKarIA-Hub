
import React, { useState } from 'react';
import { ModalWrapper } from '../ModalWrapper';
import { Campaign } from '../../types';
import { generateId, generateJoinCode } from '../../utils';

interface MarketplaceModalProps {
  onClose: () => void;
  allCampaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  userId: string;
}

const AdventurePoster: React.FC<{ campaign: Campaign; onCopy: () => void }> = ({ campaign, onCopy }) => (
    <div className="group w-52 bg-gray-800 rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300">
        <img src={campaign.image} alt={campaign.title} className="w-full h-72 object-cover" />
        <div className="p-3 text-white">
            <h3 className="font-cinzel truncate">{campaign.title}</h3>
            <p className="text-xs text-gray-400">Tema: {campaign.theme}</p>
            <div className="flex justify-between items-center mt-2 text-xs">
                <span className="text-gray-300">{campaign.playerIds.length} pemain</span>
                <button onClick={onCopy} className="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded font-cinzel transition-colors">Salin</button>
            </div>
        </div>
    </div>
);

export const MarketplaceModal: React.FC<MarketplaceModalProps> = ({ onClose, allCampaigns, setCampaigns, userId }) => {
  const [filter, setFilter] = useState('Semua');

  const handleCopyCampaign = (originalCampaign: Campaign) => {
    const newCampaign: Campaign = {
        ...originalCampaign,
        id: generateId('campaign'),
        joinCode: generateJoinCode(),
        playerIds: [], // Reset players for the new copy
        currentPlayerId: null,
        // FIX: Changed 'history' to 'eventLog' to match the Campaign type.
        eventLog: [], // Reset event log
        isPublished: false, // Not published by default
        monsters: [], // Reset monsters
        initiativeOrder: [],
        gameState: 'exploration'
    };
    setCampaigns(prev => [...prev, newCampaign]);
    alert(`Kampanye "${originalCampaign.title}" telah disalin ke Aula Gema Anda!`);
  }

  const publishedCampaigns = allCampaigns.filter(c => c.isPublished);
  const filteredCampaigns = publishedCampaigns.filter(c => filter === 'Semua' || c.theme === filter);

  return (
    <ModalWrapper onClose={onClose} title="Pasar Seribu Kisah">
      <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-600/50 rounded-xl p-8 shadow-2xl w-[90vw] max-w-5xl max-h-[90vh]">
        <h2 className="font-cinzel text-4xl text-white mb-2 text-center" style={{textShadow: '0 0 10px #f59e0b'}}>Pasar Seribu Kisah</h2>
        <p className="text-amber-200 text-center mb-8">Temukan petualangan yang dibuat oleh pemain sepertimu.</p>
        <div className="flex justify-center mb-6 gap-4">
            <button onClick={() => setFilter('Semua')} className={`px-4 py-2 font-cinzel rounded transition-colors ${filter === 'Semua' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Semua</button>
            <button onClick={() => setFilter('Fantasi')} className={`px-4 py-2 font-cinzel rounded transition-colors ${filter === 'Fantasi' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Fantasi</button>
            <button onClick={() => setFilter('Sci-Fi')} className={`px-4 py-2 font-cinzel rounded transition-colors ${filter === 'Sci-Fi' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Sci-Fi</button>
            <button onClick={() => setFilter('Horor')} className={`px-4 py-2 font-cinzel rounded transition-colors ${filter === 'Horor' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Horor</button>
        </div>
        <div className="overflow-y-auto h-[60vh] p-4">
            {filteredCampaigns.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-6">
                    {filteredCampaigns.map(campaign => <AdventurePoster key={campaign.id} campaign={campaign} onCopy={() => handleCopyCampaign(campaign)} />)}
                </div>
            ) : (
                <p className="text-center text-amber-200/80">Tidak ada kampanye yang diterbitkan cocok dengan filter ini.</p>
            )}
        </div>
      </div>
    </ModalWrapper>
  );
};
