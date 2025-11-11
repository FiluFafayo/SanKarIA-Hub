import React, { useMemo } from 'react';
import { Location, Campaign } from '../types';
import { LocationCard } from './LocationCard';
import { useAppStore } from '../store/appStore'; // REFAKTOR G-4
import { useDataStore } from '../store/dataStore';

interface NexusSanctumProps {
  userEmail?: string | null;
  userId?: string;
}

export const NexusSanctum: React.FC<NexusSanctumProps> = ({ userEmail, userId }) => {
  // REFAKTOR G-4: Ambil aksi navigasi dari store
  const navigateTo = useAppStore(s => s.actions.navigateTo);
  const startJoinFlow = useAppStore(s => s.actions.startJoinFlow);
  const { campaigns, characters } = useDataStore(s => s.state);

  const myCharacters = useMemo(() => {
    if (!userId) return [];
    return characters.filter(c => c.ownerId === userId);
  }, [characters, userId]);

  const myCharacterIds = useMemo(() => myCharacters.map(c => c.id), [myCharacters]);

  const myTurnCampaigns = useMemo(() => {
    return campaigns.filter(c => c.currentPlayerId && myCharacterIds.includes(c.currentPlayerId));
  }, [campaigns, myCharacterIds]);

  const quickContinue: Campaign | null = useMemo(() => {
    return myTurnCampaigns[0] || campaigns[0] || null;
  }, [myTurnCampaigns, campaigns]);

  const locations = [
    { id: Location.StorytellersSpire, desc: "Ciptakan dunia dan petualangan baru dari imajinasimu.", img: "https://picsum.photos/seed/spire/400/600" },
    { id: Location.HallOfEchoes, desc: "Lanjutkan petualangan yang tersimpan atau hidupkan kembali kisah lama.", img: "https://picsum.photos/seed/echoes/400/600" },
    { id: Location.WanderersTavern, desc: "Bergabunglah dengan kampanye temanmu menggunakan kode rahasia.", img: "https://picsum.photos/seed/tavern/400/600" },
    { id: Location.MarketOfAThousandTales, desc: "Jelajahi dan salin petualangan yang dibuat oleh pemain lain.", img: "https://picsum.photos/seed/market/400/600" },
    { id: Location.MirrorOfSouls, desc: "Lihat, atur, dan lahirkan pahlawan-pahlawanmu.", img: "https://picsum.photos/seed/mirror/400/600" },
    { id: Location.TinkerersWorkshop, desc: "Sesuaikan pengaturan, koneksi, dan tampilan pengalamanmu.", img: "https://picsum.photos/seed/workshop/400/600" },
    // Dev: Wireframe Kit
    { id: 'wireframe-preview' as any, desc: "Wireframe & Design System (Dev)", img: "https://picsum.photos/seed/wireframe/400/600" },
  ];

  return (
    <div className="w-full h-full overflow-y-auto select-none bg-bg-primary p-4 md:p-8">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: 'url(https://picsum.photos/seed/nexus-bg/1920/1080)' }}
      />
      
      {/* User Info */}
      {userEmail && (
        <p className="absolute top-4 right-4 z-20 text-text-secondary text-xs md:text-sm bg-bg-secondary/70 backdrop-blur-sm p-2 rounded-lg shadow">
            {userEmail}
        </p>
      )}

      {/* Content */}
      <div className="relative z-10 text-center mb-8 md:mb-12">
         <h1 className="font-cinzel text-5xl md:text-7xl font-bold text-white text-shadow-lg tracking-widest" style={{textShadow: '0 0 15px rgba(255,223,186,0.8)'}}>
          SanKarIA Hub
        </h1>
        <p className="text-amber-100 text-sm md:text-lg opacity-80 font-light tracking-wider">Nadi Suaka</p>
      </div>

      {/* Continue Campaign Card */}
      {quickContinue && (
        <div className="relative z-10 max-w-5xl mx-auto mb-6">
          <div className="bg-bg-secondary/80 backdrop-blur-sm border border-amber-600/40 rounded-xl p-4 md:p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <img src={quickContinue.image} alt={quickContinue.title} className="w-16 h-16 rounded object-cover" />
              <div className="flex-1">
                <div className="font-cinzel text-xl md:text-2xl text-amber-300">Lanjutkan Kampanye</div>
                <div className="text-text-secondary text-sm">{quickContinue.title}</div>
                <div className="text-xs text-amber-200/80 mt-1">
                  {myTurnCampaigns.find(c => c.id === quickContinue.id) ? 'Giliran Anda' : 'Siap dimainkan'} • {quickContinue.playerIds.length} pemain
                </div>
              </div>
              <button
                className="font-cinzel bg-amber-600 hover:bg-amber-500 text-bg-primary px-4 py-2 rounded"
                onClick={() => startJoinFlow(quickContinue)}
              >Lanjutkan</button>
            </div>
          </div>
        </div>
      )}

      {/* Active Campaigns List */}
      {campaigns.length > 0 && (
        <div className="relative z-10 max-w-7xl mx-auto mb-8">
          <h2 className="font-cinzel text-2xl text-amber-200 mb-3">Kampanye Aktif Anda</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {campaigns.slice(0, 6).map(c => (
              <div key={c.id} className="bg-bg-secondary/70 border border-border-primary rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <img src={c.image} alt={c.title} className="w-12 h-12 rounded object-cover" />
                  <div className="flex-1">
                    <div className="font-cinzel text-lg text-amber-300 leading-tight">{c.title}</div>
                    <div className="text-xs text-text-secondary">{c.playerIds.length} pemain • {c.isPublished ? 'Terbit' : 'Pribadi'}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-xs ${c.currentPlayerId && myCharacterIds.includes(c.currentPlayerId) ? 'text-emerald-300' : 'text-amber-200/70'}`}>
                    {c.currentPlayerId && myCharacterIds.includes(c.currentPlayerId) ? 'Giliran Anda' : 'Menunggu giliran' }
                  </span>
                  <button
                    className="font-cinzel bg-amber-600 hover:bg-amber-500 text-bg-primary px-3 py-1 rounded"
                    onClick={() => startJoinFlow(c)}
                  >Main</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 max-w-7xl mx-auto">
        {locations.map(({ id, desc, img }) => (
          <LocationCard
            key={String(id)}
            name={String(id)}
            description={desc}
            imageUrl={img}
            onClick={() => navigateTo(id)} // REFAKTOR G-4
          />
        ))}
      </div>
    </div>
  );
};
