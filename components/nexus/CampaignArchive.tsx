// components/nexus/CampaignArchive.tsx
import React from 'react';
import { PixelCard } from '../grimoire/PixelCard';
import { RuneButton } from '../grimoire/RuneButton';
import { useDataStore } from '../../store/dataStore';
import { useAppStore } from '../../store/appStore';
import { formatDndTime } from '../../utils';

interface CampaignArchiveProps {
  onSelectCampaign: (campaignId: string) => void;
  onCreateNew: () => void; // Ke DungeonGate (Input Code / Create)
  onBack: () => void;
}

export const CampaignArchive: React.FC<CampaignArchiveProps> = ({ onSelectCampaign, onCreateNew, onBack }) => {
  const campaigns = useDataStore((s) => s.state.campaigns);
  const user = useAppStore((s) => s.auth.user);

  // Urutkan berdasarkan terakhir dimainkan (jika ada timestamp update) atau created_at
  // Untuk sekarang kita render apa adanya, idealnya diurutkan.
  const myCampaigns = campaigns; // DataStore sudah memfilter 'getMyCampaigns'

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <PixelCard className="w-full max-w-2xl h-[80vh] flex flex-col bg-[#0b0a0d] border-wood shadow-2xl">
        
        {/* HEADER */}
        <div className="p-4 border-b-2 border-wood bg-[#1a1921] flex justify-between items-center shrink-0 relative overflow-hidden">
  {/* Decorative Gradient Overlay */}
  <div className="absolute inset-0 bg-gradient-to-r from-wood/20 to-transparent pointer-events-none" />
          <div>
            <h2 className="font-pixel text-xl text-gold drop-shadow-md">ARSIP KRONIK</h2>
            <p className="font-retro text-xs text-faded">Pilih dunia yang ingin Anda kunjungi kembali.</p>
          </div>
          <button onClick={onBack} className="text-red-400 font-pixel hover:text-red-200 text-xl px-3">X</button>
        </div>

        {/* LIST AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {myCampaigns.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 gap-4">
              <div className="text-4xl grayscale">🕸️</div>
              <p className="font-pixel text-faded text-sm">BELUM ADA JEJAK SEJARAH...</p>
              <p className="font-retro text-xs text-faded max-w-xs">
                Anda belum terikat dengan dunia mana pun. Mulailah ritual penciptaan atau masukkan rune dimensi lain.
              </p>
            </div>
          ) : (
            myCampaigns.map((camp) => {
              const isDM = camp.ownerId === user?.id;
              return (
                <div 
                  key={camp.id}
                  onClick={() => onSelectCampaign(camp.id)}
                  className="group relative h-32 w-full border-2 border-wood bg-black cursor-pointer overflow-hidden hover:border-gold transition-all flex shadow-lg"
                >
                  {/* COVER IMAGE */}
                  <div 
                    className="w-1/3 h-full bg-cover bg-center border-r border-wood group-hover:sepia-0 transition-all filter sepia-[0.5]"
                    style={{ backgroundImage: `url(${camp.cover_url || 'https://via.placeholder.com/150'})` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black" />
                  </div>

                  {/* INFO */}
                  <div className="flex-1 p-3 flex flex-col justify-between relative z-10">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-pixel text-gold text-md group-hover:text-white truncate pr-2">{camp.title}</h3>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${isDM ? 'bg-purple-900/50 text-purple-300 border-purple-500' : 'bg-blue-900/50 text-blue-300 border-blue-500'}`}>
                          {isDM ? 'DM' : 'PLAYER'}
                        </span>
                      </div>
                      <p className="font-retro text-[10px] text-faded line-clamp-2 mt-1 italic">
                        "{camp.description}"
                      </p>
                    </div>

                    {/* META TAGS */}
                    <div className="flex gap-2 text-[9px] font-mono text-slate-500 mt-2">
                      <span className="bg-white/5 px-1 rounded border border-white/10">{camp.mainGenre}</span>
                      <span className="bg-white/5 px-1 rounded border border-white/10">{camp.duration}</span>
                      <span className="bg-white/5 px-1 rounded border border-white/10">{formatDndTime(camp.currentTime)}</span>
                    </div>
                  </div>

                  {/* HOVER GLOW */}
                  <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t-2 border-wood bg-[#15141a] flex gap-3 shrink-0">
            <RuneButton 
                label="KEMBALI" 
                variant="secondary" 
                onClick={onBack} 
                className="flex-1"
            />
            <RuneButton 
                label="BUKA GERBANG BARU" 
                variant="primary" 
                onClick={onCreateNew} 
                className="flex-[2]"
            />
        </div>

      </PixelCard>
    </div>
  );
};