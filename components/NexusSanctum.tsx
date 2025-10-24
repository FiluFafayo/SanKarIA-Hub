import React from 'react';
import { Location } from '../types';
import { LocationCard } from './LocationCard';

interface NexusSanctumProps {
  onLocationClick: (location: Location) => void;
}

export const NexusSanctum: React.FC<NexusSanctumProps> = ({ onLocationClick }) => {

  const locations = [
    { id: Location.StorytellersSpire, desc: "Ciptakan dunia dan petualangan baru dari imajinasimu.", img: "https://picsum.photos/seed/spire/400/600" },
    { id: Location.HallOfEchoes, desc: "Lanjutkan petualangan yang tersimpan atau hidupkan kembali kisah lama.", img: "https://picsum.photos/seed/echoes/400/600" },
    { id: Location.WanderersTavern, desc: "Bergabunglah dengan kampanye temanmu menggunakan kode rahasia.", img: "https://picsum.photos/seed/tavern/400/600" },
    { id: Location.MarketOfAThousandTales, desc: "Jelajahi dan salin petualangan yang dibuat oleh pemain lain.", img: "https://picsum.photos/seed/market/400/600" },
    { id: Location.MirrorOfSouls, desc: "Lihat, atur, dan lahirkan pahlawan-pahlawanmu.", img: "https://picsum.photos/seed/mirror/400/600" },
    { id: Location.TinkerersWorkshop, desc: "Sesuaikan pengaturan, koneksi, dan tampilan pengalamanmu.", img: "https://picsum.photos/seed/workshop/400/600" },
  ];

  return (
    <div className="w-full h-full overflow-y-auto select-none bg-bg-primary p-4 md:p-8">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: 'url(https://picsum.photos/seed/nexus-bg/1920/1080)' }}
      />
      
      {/* Content */}
      <div className="relative z-10 text-center mb-8 md:mb-12">
         <h1 className="font-cinzel text-5xl md:text-7xl font-bold text-white text-shadow-lg tracking-widest" style={{textShadow: '0 0 15px rgba(255,223,186,0.8)'}}>
          SanKarlA
        </h1>
        <p className="text-amber-100 text-sm md:text-lg opacity-80 font-light tracking-wider">Nadi Suaka</p>
      </div>

      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 max-w-7xl mx-auto">
        {locations.map(({ id, desc, img }) => (
          <LocationCard
            key={id}
            name={id}
            description={desc}
            imageUrl={img}
            onClick={() => onLocationClick(id)}
          />
        ))}
      </div>
    </div>
  );
};