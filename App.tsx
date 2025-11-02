// =================================================================
// 
//          FILE: App.tsx (VERSI BARU - POST-REFAKTOR DB)
// 
// =================================================================
import React, { useState, useCallback, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { NexusSanctum } from './components/NexusSanctum';
import { CreateCampaignView } from './views/CreateCampaignView';
import { HallOfEchoesView } from './views/HallOfEchoesView';
import { JoinCampaignView } from './views/JoinCampaignView';
import { MarketplaceView } from './views/MarketplaceView';
import { SettingsView } from './views/SettingsView';
import { ProfileView } from './views/ProfileView';
import { CharacterSelectionView } from './views/CharacterSelectionView';
import { GameScreen } from './components/GameScreen';
import { Location, Campaign, Character } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { geminiService } from './services/geminiService';
import { dataService } from './services/dataService';
import { generateId } from './utils';
import { DEFAULT_CAMPAIGNS } from './data/defaultCampaigns';
import { DEFAULT_CHARACTERS } from './data/defaultCharacters';
import { LoginView } from './views/LoginView';

type View = Location | 'nexus' | 'character-selection';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('nexus');
  const [theme, setTheme] = useLocalStorage<string>('sankaria-hub-theme', 'theme-sanc');
  const [isLoading, setIsLoading] = useState(true);

  // === State Otentikasi ===
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // === State Data Global (SSOT) ===
  // State ini berisi SEMUA data yang dimiliki user, dimuat sekali saat login
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [allMyCharacters, setAllMyCharacters] = useState<Character[]>([]);

  // === State Sesi Permainan Aktif ===
  // State ini diisi HANYA saat user memilih untuk "Main"
  const [playingCampaign, setPlayingCampaign] = useState<Campaign | null>(null);
  const [playingCharacter, setPlayingCharacter] = useState<Character | null>(null);
  const [playersInGame, setPlayersInGame] = useState<Character[]>([]); // Daftar semua karakter di sesi game

  // State untuk alur join/mulai
  const [campaignToJoinOrStart, setCampaignToJoinOrStart] = useState<Campaign | null>(null);

  // Sumber kebenaran tunggal untuk ID pengguna
  const userId = session?.user?.id;

  // --- EFEK INISIALISASI & OTENTIKASI ---

  // Efek Inisialisasi Layanan (Hanya sekali saat App mount)
  useEffect(() => {
    // Ambil kunci Gemini dari environment variable
    const geminiKeysString = import.meta.env.VITE_GEMINI_API_KEYS || '';
    const geminiKeys = geminiKeysString.split(',')
      .map(key => key.trim())
      .filter(key => key);

    if (geminiKeys.length === 0) {
      console.warn("⚠️ VITE_GEMINI_API_KEYS environment variable tidak disetel atau kosong.");
    }
    geminiService.updateKeys(geminiKeys);

    // Ambil kredensial Supabase dari environment variable
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY environment variable belum disetel!");
      alert("Konfigurasi database belum lengkap. Aplikasi mungkin tidak berfungsi dengan benar.");
    }
    dataService.init(supabaseUrl, supabaseKey);
  }, []);
  
  // Efek Otentikasi
  useEffect(() => {
    setIsAuthLoading(true);
    dataService.getSession().then(({ data: { session } }) => {
        setSession(session);
        setIsAuthLoading(false);
    });

    const { data: { subscription } } = dataService.onAuthStateChange((_event, session) => {
        setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Efek Memuat Data Global (saat Sesi berubah)
  useEffect(() => {
    // Hanya muat data saat ada sesi
    if (!session || !userId) {
        setIsLoading(false);
        setAllCampaigns([]);
        setAllMyCharacters([]);
        return;
    }
    
    const loadGlobalData = async () => {
        setIsLoading(true);
        try {
            // 1. Ambil semua karakter MILIK user ini (RLS 'Allow owner SELECT' bekerja)
            let fetchedCharacters = await dataService.getMyCharacters();
            
            // 2. Ambil semua kampanye yang BISA DIAKSES user ini (RLS 'Allow participants SELECT' bekerja)
            let fetchedCampaigns = await dataService.getCampaigns();

            // 3. Seed data jika user baru (DB-nya kosong)
            if (fetchedCampaigns.length === 0 && fetchedCharacters.length === 0) {
                console.log("User baru terdeteksi, melakukan seeding data default...");
                // Seed Kampanye Default (ini akan dimiliki oleh user ini)
                // Kita harus generate join code baru agar unik
                const campaignsToSeed = DEFAULT_CAMPAIGNS.map(c => ({
                  ...c,
                  owner_id: userId, // User ini jadi DM kampanye default
                  join_code: generateJoinCode() // Pastikan unik
                }));
                await dataService.saveCampaigns(campaignsToSeed);
                fetchedCampaigns = await dataService.getCampaigns(); // Ambil lagi

                // Seed Karakter Default (ini akan dimiliki oleh user ini)
                const charactersToSeed = DEFAULT_CHARACTERS.map(char => ({
                    ...char,
                    id: generateId('char'),
                    owner_id: userId,
                }));
                await dataService.saveCharacters(charactersToSeed);
                fetchedCharacters = await dataService.getMyCharacters(); // Ambil lagi
            }
            
            setAllCampaigns(fetchedCampaigns);
            setAllMyCharacters(fetchedCharacters);

        } catch (error) {
            console.error("Gagal memuat data global:", error);
            alert("Gagal memuat data dari Supabase. Periksa koneksi internet Anda atau coba lagi nanti.");
        } finally {
            setIsLoading(false);
        }
    };

    loadGlobalData();
  }, [session, userId]);


  // --- HANDLER SIMPAN DATA (SSOT) ---

  /**
   * (MANDAT "KARAKTER GLOBAL")
   * Menyimpan SATU karakter global ke DB dan me-refresh state lokal.
   * Ini adalah fungsi inti untuk menyimpan progres HP, inventory, dll.
   */
  const handleUpdateCharacter = useCallback(async (updatedCharacter: Character) => {
    if (!userId) return;

    try {
        const savedChar = await dataService.saveCharacter(updatedCharacter);
        
        // Update state lokal 'allMyCharacters'
        setAllMyCharacters(prev => prev.map(c => c.id === savedChar.id ? savedChar : c));
        
        // Update state 'playingCharacter' jika itu yang sedang dimainkan
        if (playingCharacter && playingCharacter.id === savedChar.id) {
            setPlayingCharacter(savedChar);
        }
    } catch(e) {
         console.error("Gagal menyimpan karakter (global):", e);
         alert("Gagal menyimpan progres karakter Anda. Periksa koneksi Anda.");
    }
  }, [userId, playingCharacter]);

  /**
   * (MANDAT "KARAKTER GLOBAL")
   * Menyimpan BANYAK karakter global ke DB (untuk ProfileView/Pembuatan Karakter).
   */
  const handleUpdateCharactersBatch = useCallback(async (updatedCharacters: Character[]) => {
      if (!userId) return;
      try {
          const savedChars = await dataService.saveCharacters(updatedCharacters);
          // Refresh state lokal 'allMyCharacters'
          setAllMyCharacters(savedChars);
      } catch (e) {
           console.error("Gagal menyimpan karakter (batch):", e);
           alert("Gagal menyimpan perubahan karakter. Periksa koneksi Anda.");
      }
  }, [userId]);


  /**
   * Menyimpan SATU state sesi kampanye ke DB dan me-refresh state lokal.
   */
  const handleSaveCampaign = useCallback(async (updatedCampaign: Campaign) => { 
    try {
        // 'updatedCampaign' di sini adalah tipe 'Campaign' bersih,
        // karena state UI (thinkingState, dll) ada di 'CampaignState' (di dalam useCampaign hook)
        // tapi tidak ada di tipe 'Campaign' (dari types.ts)
        const savedCampaign = await dataService.saveCampaign(updatedCampaign);
        
        // Update state lokal 'allCampaigns'
        setAllCampaigns(prev => prev.map(c => c.id === savedCampaign.id ? savedCampaign : c));

        // Update state 'playingCampaign' jika itu yang sedang dimainkan
        if (playingCampaign && playingCampaign.id === savedCampaign.id) {
            setPlayingCampaign(savedCampaign);
        }
    } catch (e) {
        console.error("Gagal menyimpan kampanye (sesi):", e);
        alert("Gagal menyimpan progres kampanye. Periksa koneksi Anda.");
    }
  }, [playingCampaign]);

  // --- HANDLER ALUR NAVIGASI & GAME ---

  const handleReturnToNexus = useCallback(() => {
    setCurrentView('nexus');
    setCampaignToJoinOrStart(null);
  }, []);
  
  /**
   * Membuat kampanye baru, menyimpannya, dan kembali ke Nexus.
   */
  const handleCreateCampaign = async (newCampaign: Campaign) => {
    if (!userId) return;
    
    // Setel owner_id sebelum menyimpan
    const campaignWithOwner = { ...newCampaign, owner_id: userId };

    try {
      const openingScene = await geminiService.generateOpeningScene(campaignWithOwner);
       campaignWithOwner.event_log.push({
         id: generateId('event'),
         type: 'dm_narration',
         text: openingScene,
         timestamp: new Date().toISOString(),
         turnId: 'turn-0'
       });
    } catch (e) {
      console.error("Gagal menghasilkan adegan pembuka:", e);
      campaignWithOwner.event_log.push({
         id: generateId('event'),
         type: 'system',
         text: "Gagal menghasilkan adegan pembuka. Silakan mulai petualangan Anda.",
         timestamp: new Date().toISOString(),
         turnId: 'turn-0'
      });
    }
    
    const savedCampaign = await dataService.saveCampaign(campaignWithOwner);
    setAllCampaigns(prev => [...prev, savedCampaign]);
    handleReturnToNexus();
  };
  
  /**
   * Dipanggil dari HallOfEchoes atau Marketplace.
   * Memeriksa apakah user sudah ada di kampanye; jika ya, mainkan. Jika tidak, buka seleksi karakter.
   */
  const handleSelectCampaign = useCallback(async (campaign: Campaign) => {
    if (!userId) return;

    setIsLoading(true);
    setCampaignToJoinOrStart(campaign); // Simpan kampanye yang dituju

    try {
        // Ambil daftar karakter yang SUDAH ADA di kampanye ini
        const playersInCampaign = await dataService.getCharactersForCampaign(campaign.id);
        
        // Cek apakah salah satu karakter itu milik kita
        const myCharacterInCampaign = playersInCampaign.find(c => c.owner_id === userId);

        if (myCharacterInCampaign) {
            // --- ALUR: LANJUTKAN GAME ---
            // Kita sudah punya karakter di game ini. Langsung main.
            setPlayersInGame(playersInCampaign);
            setPlayingCharacter(myCharacterInCampaign);
            setPlayingCampaign(campaign);
            setCurrentView('nexus'); // Ini akan memicu render GameScreen
        } else {
            // --- ALUR: JOIN GAME BARU ---
            // Kita belum punya karakter di game ini.
            if (playersInCampaign.length >= campaign.max_players) {
                alert("Maaf, kampanye ini sudah penuh.");
                setIsLoading(false);
                return;
            }
            // Buka modal seleksi karakter
            setCurrentView('character-selection');
        }
    } catch (e) {
        console.error("Gagal memproses pemilihan kampanye:", e);
        alert("Gagal memuat data kampanye.");
    } finally {
        setIsLoading(false);
    }
  }, [userId]);
  
  /**
   * Dipanggil dari CharacterSelectionView setelah user memilih karakter untuk join.
   */
  const handleCharacterSelection = useCallback(async (character: Character) => {
    if (!campaignToJoinOrStart || !userId) return;

    const campaign = campaignToJoinOrStart;

    try {
      // 1. Daftarkan karakter ke kampanye (tambahkan ke tabel campaign_players)
      await dataService.joinCampaign(campaign.id, character.id);

      // 2. Ambil ulang daftar pemain (sekarang termasuk kita)
      const playersInCampaign = await dataService.getCharactersForCampaign(campaign.id);
      
      // 3. Set state permainan aktif
      setPlayersInGame(playersInCampaign);
      setPlayingCampaign(campaign);
      setPlayingCharacter(character);
      
      // 4. Reset alur dan kembali ke nexus (untuk render GameScreen)
      setCampaignToJoinOrStart(null);
      setCurrentView('nexus');

    } catch (e) {
      console.error("Gagal join kampanye dengan karakter:", e);
      alert("Gagal bergabung ke kampanye.");
    }
  }, [campaignToJoinOrStart, userId]);

  /**
   * Dipanggil dari JoinCampaignView.
   */
  const handleFoundCampaignToJoin = (campaign: Campaign) => {
      // Cukup panggil alur normal, seolah user mengklik dari Hall of Echoes
      handleSelectCampaign(campaign);
  }

  /**
   * Dipanggil dari GameScreen.
   * Hanya menyimpan state SESI KAMPANYE.
   */
  const handleExitGame = (finalCampaignState: Campaign) => {
    // Note: handleUpdateCharacter dipanggil terpisah dari dalam GameScreen
    // Jadi di sini kita HANYA perlu save state kampanye.
    handleSaveCampaign(finalCampaignState); 
    
    // Reset state permainan aktif
    setPlayingCampaign(null);
    setPlayingCharacter(null);
    setPlayersInGame([]);
    setCurrentView('nexus');
  };
  
  // --- FUNGSI RENDER ---

  const renderView = () => {
    if (!userId) return null; // Seharusnya tidak terjadi jika sudah login

    if (currentView === 'character-selection' && campaignToJoinOrStart) {
      return (
        <CharacterSelectionView
          // Kirim HANYA karakter milik user ini
          characters={allMyCharacters}
          onSelect={(character) => {
              handleCharacterSelection(character);
          }}
          onClose={handleReturnToNexus}
        />
      );
    }

    switch (currentView) {
      case Location.StorytellersSpire:
        return <CreateCampaignView onClose={handleReturnToNexus} onCreateCampaign={handleCreateCampaign} />;
      case Location.HallOfEchoes:
        return (
            <HallOfEchoesView 
                onClose={handleReturnToNexus} 
                campaigns={allCampaigns} // Kirim semua kampanye yang bisa diakses
                onSelectCampaign={handleSelectCampaign} // Alur baru
            />
        );
      case Location.WanderersTavern:
        // JoinCampaignView tidak perlu diubah, karena 'allCampaigns'
        // sudah difilter oleh RLS. Jika dia bisa 'find' kodenya,
        // berarti dia bisa join (atau sudah join).
        return <JoinCampaignView 
                    onClose={handleReturnToNexus} 
                    campaigns={allCampaigns} // Kirim semua kampanye yang bisa diakses
                    onCampaignFound={handleFoundCampaignToJoin} 
                />;
      case Location.MarketOfAThousandTales:
         // MarketplaceView perlu refaktor di masa depan untuk memisahkan
         // 'allCampaigns' (milikku) dari 'publishedCampaigns' (milik orang lain)
         // Untuk saat ini, kita anggap 'allCampaigns' adalah semua yang ada di DB.
         // Perlu query khusus untuk "getPublishedCampaigns()"
        return <MarketplaceView 
                    onClose={handleReturnToNexus} 
                    allCampaigns={allCampaigns} // TODO: Ini harusnya query terpisah
                    setCampaigns={setAllCampaigns} // Ini juga berbahaya
                    userId={userId} 
                />;
      case Location.TinkerersWorkshop:
        return <SettingsView 
                    onClose={handleReturnToNexus} 
                    currentTheme={theme} 
                    setTheme={setTheme}
                    userEmail={session?.user?.email}
                    onSignOut={() => dataService.signOut()}
                />;
      case Location.MirrorOfSouls:
        return <ProfileView 
                    onClose={handleReturnToNexus} 
                    characters={allMyCharacters} // Kirim HANYA karakter global milik user
                    setCharacters={handleUpdateCharactersBatch} // Gunakan handler batch
                    userId={userId} 
                />;
      default:
        return null;
    }
  };
  
  const LoadingScreen = () => (
     <div className={`w-screen h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}>
        <h1 className="font-cinzel text-5xl animate-pulse">SanKarIA Hub</h1>
        <p className="mt-2">Memuat semesta...</p>
    </div>
  );

  // --- RENDER UTAMA ---

  if (isAuthLoading) {
    return <LoadingScreen />;
  }
  
  // Jika tidak ada sesi, tampilkan login
  if (!session) {
    return <div className={theme}><LoginView /></div>;
  }

  // Jika state permainan aktif, TAMPILKAN GAME
  // (Ini dipindah ke atas 'isLoading' agar game tetap jalan meski loading data lain)
  if (playingCampaign && playingCharacter && userId) {
    return (
      <div className={theme}>
        <GameScreen 
          key={playingCampaign.id} // Paksa re-mount jika kampanye berubah
          initialCampaign={playingCampaign} 
          initialCharacter={playingCharacter} 
          allPlayersInCampaign={playersInGame}
          onExitGame={handleExitGame}
          onSaveCampaign={handleSaveCampaign} // Kirim handler sesi
          onSaveCharacter={handleUpdateCharacter} // Kirim handler karakter global
          userId={userId}
        />
      </div>
    );
  }

  // Jika tidak sedang main, tapi masih memuat data global...
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Jika tidak main & tidak loading, tampilkan Nexus/View
  return (
    <div className={`w-screen h-screen bg-black overflow-hidden ${theme}`}>
      {currentView === 'nexus' && <NexusSanctum onLocationClick={handleLocationClick} userEmail={session?.user?.email} />}
      {currentView !== 'nexus' && renderView()}
    </div>
  );
};

export default App;