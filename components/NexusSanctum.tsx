import React from 'react';
import { Location } from '../types';
import { LocationCard } from './LocationCard';
import { SupabaseClient, User } from '@supabase/supabase-js'; // Import SupabaseClient dan User
import { dataService } from '../services/dataService'; // Import dataService

interface NexusSanctumProps {
  onLocationClick: (location: Location) => void;
  session: { user: User } | null; // Tambah prop session
}

export const NexusSanctum: React.FC<NexusSanctumProps> = ({ onLocationClick, session }) => { // Tambahkan session di parameter props

  const supabase = dataService.getClient(); // Ambil client Supabase dari dataService

  const handleGoogleLogin = async () => {
    if (!supabase) {
      alert("Supabase belum terkonfigurasi. Cek pengaturan di Bengkel Juru Cipta.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // Balik ke halaman ini setelah login
      }
    });
    if (error) {
      console.error('Error logging in with Google:', error);
      alert('Gagal login dengan Google: ' + error.message);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
      alert('Gagal logout: ' + error.message);
    }
  };

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
        <h1 className="font-cinzel text-5xl md:text-7xl font-bold text-white text-shadow-lg tracking-widest" style={{ textShadow: '0 0 15px rgba(255,223,186,0.8)' }}>
          SanKarlA
        </h1>
        <p className="text-amber-100 text-sm md:text-lg opacity-80 font-light tracking-wider">Nadi Suaka</p>
        <div className="mt-4">
          {session ? (
            <div className='flex items-center justify-center gap-4'>
              <p className="text-white">Selamat datang, {session.user.email}!</p>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded text-sm"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded inline-flex items-center"
            >
              {/* Simple Google Icon Placeholder */}
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 48 48"><path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path></svg>
              Login dengan Google
            </button>
          )}
        </div>
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