import React, { useState } from 'react';
import { ViewWrapper } from '../components/ViewWrapper';
import { Campaign } from '../types';

interface JoinCampaignViewProps {
  onClose: () => void;
  campaigns: Campaign[];
  onCampaignFound: (campaign: Campaign) => void;
}

export const JoinCampaignView: React.FC<JoinCampaignViewProps> = ({ onClose, campaigns, onCampaignFound }) => {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');
    if (code.length < 6) {
        setFeedback("Kode harus 6 karakter.");
        return;
    }
    const campaign = campaigns.find(c => c.joinCode.toLowerCase() === code.toLowerCase());
    if (campaign) {
        setFeedback("Selamat datang, petualang! Pintu pun terbuka...");
        setTimeout(() => {
          onCampaignFound(campaign);
        }, 1000);
    } else {
        setFeedback("Maaf kawan, kata sandinya salah. Si penjaga kedai menggelengkan kepala.");
    }
  };

  return (
    <ViewWrapper onClose={onClose} title="Kedai Pengembara">
      <div className="flex flex-col items-center justify-center text-amber-50 h-full">
        <div className="bg-yellow-900/80 backdrop-blur-sm border border-amber-600 rounded-lg p-8 shadow-2xl w-full max-w-lg">
            <div className="flex items-center mb-6">
                <img src="https://picsum.photos/seed/dwarf/80" alt="Penjaga Kedai" className="w-20 h-20 rounded-full border-4 border-amber-600 mr-4"/>
                <div>
                    <h2 className="font-cinzel text-3xl">Kedai Pengembara</h2>
                    <p className="text-amber-200">Birnya kental dan apinya hangat.</p>
                </div>
            </div>
            <p className="mb-4 italic">"Punya undangan ke pesta pribadi? Cukup berikan kata rahasianya, dan akan kutunjukkan jalannya."</p>
            <form onSubmit={handleSubmit}>
                <input 
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="MASUKKAN KODE GABUNG"
                    className="w-full bg-amber-950/50 border-2 border-amber-700 rounded px-4 py-3 text-white placeholder-amber-200/50 focus:outline-none focus:border-amber-500 transition-colors text-center tracking-widest font-mono text-2xl"
                    maxLength={6}
                />
                <button type="submit" className="w-full mt-4 bg-amber-600 hover:bg-amber-500 font-cinzel text-xl py-3 rounded transition-colors">Gabung Kampanye</button>
            </form>
            {feedback && <p className="mt-4 text-center text-amber-200 transition-opacity duration-300 h-6">{feedback}</p>}
        </div>
      </div>
    </ViewWrapper>
  );
};
