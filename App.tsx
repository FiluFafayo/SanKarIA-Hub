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
import { Location, Campaign, Character, GameEvent, CampaignState } from './types'; // Tipe baru
import { useLocalStorage } from './hooks/useLocalStorage';
// REFAKTOR G-2: Impor generationService, bukan geminiService
import { generationService } from './services/ai/generationService';
import { geminiService } from './services/geminiService'; // (Masih dibutuhkan untuk updateKeys)
import { dataService } from './services/dataService';
import { generateId } from './utils';
// DEFAULT_CAMPAIGNS dan DEFAULT_CHARACTERS tidak lagi di-seed dari sini
import { LoginView } from './views/LoginView';

// (Fase 1.E Hotfix) Muat data definisi ke global scope agar ProfileModal bisa akses
import { RACES } from './data/races';
import { CLASS_DEFINITIONS } from './data/classes';
import { BACKGROUNDS } from './data/backgrounds';
(window as any).RACES_DATA = RACES;
(window as any).CLASS_DEFINITIONS_DATA = CLASS_DEFINITIONS;
(window as any).BACKGROUNDS_DATA = BACKGROUNDS;

type View = Location | 'nexus' | 'character-selection';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('nexus');
  
  // =================================================================
  // REFAKTORISASI STATE (MANDAT 3.4)
  // =================================================================
  // 'campaigns' HANYA menyimpan daftar campaign yang diikuti user
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // 'characters' adalah SSoT untuk SEMUA karakter milik user
  const [characters, setCharacters] = useState<Character[]>([]);
  
  const [theme, setTheme] = useLocalStorage<string>('sankaria-hub-theme', 'theme-sanc');
  const [isLoading, setIsLoading] = useState(true);

  // State Otentikasi
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Sumber kebenaran tunggal untuk ID pengguna
  const userId = session?.user?.id;

  // State untuk sesi permainan
  const [playingCampaign, setPlayingCampaign] = useState<CampaignState | null>(null);
  const [playingCharacter, setPlayingCharacter] = useState<Character | null>(null);
  
  // State untuk alur "Join"
  const [campaignToJoinOrStart, setCampaignToJoinOrStart] = useState<Campaign | null>(null);

  // =================================================================
  // REFAKTORISASI FUNGSI NAVIGASI (YANG HILANG)
  // =================================================================
  const handleLocationClick = useCallback((location: Location) => {
    setCurrentView(location);
  }, []);

  const handleReturnToNexus = useCallback(() => {
    setCurrentView('nexus');
    setCampaignToJoinOrStart(null);
  }, []);
  
  // Efek Inisialisasi Layanan (Tidak berubah)
  useEffect(() => {
    const geminiKeysString = import.meta.env.VITE_GEMINI_API_KEYS || '';
    const geminiKeys = geminiKeysString.split(',')
      .map(key => key.trim())
      .filter(key => key);

    if (geminiKeys.length === 0) {
      console.warn("⚠️ VITE_GEMINI_API_KEYS environment variable tidak disetel atau kosong.");
    }
    geminiService.updateKeys(geminiKeys);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY environment variable belum disetel!");
      alert("Konfigurasi database belum lengkap. Aplikasi mungkin tidak berfungsi dengan benar.");
    }
    dataService.init(supabaseUrl, supabaseKey);
  }, []);
  
  // Efek Otentikasi (Tidak berubah)
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

  // =================================================================
  // REFAKTORISASI DATA LOADING
  // =================================================================
  useEffect(() => {
    // Hanya muat data saat ada sesi
    if (!session || !userId) {
        setIsLoading(false);
        setCampaigns([]);
        setCharacters([]);
        return;
    }
    
    const loadDataAndSeed = async () => {
        setIsLoading(true);
        try {
            // 1. Muat dan cache data definisi global (items, spells, dll)
            // Ini aman dipanggil setiap saat, RLS SELECT mengizinkannya.
            await dataService.cacheGlobalData();

            // 2. Muat SSoT Karakter (Mandat 3.4)
            const fetchedCharacters = await dataService.getMyCharacters(userId);
            setCharacters(fetchedCharacters);

            // 3. Muat Daftar Campaign berdasarkan karakter yang dimiliki
            const myCharacterIds = fetchedCharacters.map(c => c.id);
            const fetchedCampaigns = await dataService.getMyCampaigns(myCharacterIds);
            setCampaigns(fetchedCampaigns);
            
            // (Logika seeding karakter default dipindah ke ProfileModal/ProfileView)

        } catch (error) {
            console.error("Gagal memuat data:", error);
            alert("Gagal memuat data dari Supabase. Periksa koneksi internet Anda atau coba lagi nanti.");
        } finally {
            setIsLoading(false);
        }
    };

    loadDataAndSeed();
  }, [session, userId]); // Hanya bergantung pada sesi

  // =================================================================
  // REFAKTORISASI FUNGSI DATA (SESUAI SSoT)
  // =================================================================

  /**
   * Menyimpan HANYA state campaign (bukan player) ke DB.
   * (Quests, NPCs, initiativeOrder, currentPlayerId, dll)
   */
  const handleSaveCampaign = async (updatedCampaign: Campaign | CampaignState) => { 
    try {
        // Destructure buat misahin data runtime dari data DB
        const {
            activeRollRequest,
            thinkingState,
            players, // 'players' adalah SSoT, jangan simpan di sini
            ...campaignToSave // 'campaignToSave' sekarang jadi objek 'Campaign' bersih
        } = updatedCampaign as CampaignState;

        const savedCampaign = await dataService.saveCampaign(campaignToSave); // Kirim objek bersih
        
        // Update state 'campaigns' lokal
        setCampaigns(prev => {
            const index = prev.findIndex(c => c.id === savedCampaign.id);
            if (index !== -1) {
                const newCampaigns = [...prev];
                // Pastikan kita menyimpan state runtime yang bersih
                newCampaigns[index] = { ...savedCampaign, eventLog: [], monsters: [], players: [], playerIds: campaignToSave.playerIds, choices: [], turnId: null };
                return newCampaigns;
            }
            return [...prev, { ...savedCampaign, eventLog: [], monsters: [], players: [], playerIds: campaignToSave.playerIds, choices: [], turnId: null }]; 
        });
    } catch (e) {
        console.error("Gagal menyimpan kampanye:", e);
        alert("Gagal menyimpan progres kampanye. Periksa koneksi Anda.");
    }
  };

  /**
   * Menyimpan SSoT Karakter (Mandat 3.4)
   * Ini adalah fungsi inti untuk menyimpan progres HP, inventory, spell slot, dll.
   */
  /**
   * (Fase 1.E) Fungsi baru untuk menyimpan karakter yang BARU DIBUAT
   */
  const handleSaveNewCharacter = async (
      charData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'>,
      inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[],
      spellData: SpellDefinition[]
  ): Promise<void> => {
      if (!userId) throw new Error("Tidak ada user ID saat menyimpan karakter baru.");
      
      try {
          const newCharacter = await dataService.saveNewCharacter(charData, inventoryData, spellData, userId);
          setCharacters(prev => [...prev, newCharacter]);
          setPlayingCharacter(newCharacter); // Langsung mainkan karakter baru? (atau set selected)
      } catch (e) {
          console.error("Gagal menyimpan karakter baru:", e);
          alert("Gagal menyimpan karakter baru. Coba lagi.");
          throw e; // Lemparkan error agar modal tahu
      }
  };

  /**
   * Menyimpan SSoT Karakter (Mandat 3.4)
   * Ini adalah fungsi inti untuk menyimpan progres HP, inventory, spell slot, dll.
   */
  const handleUpdateCharacter = async (updatedCharacter: Character) => {
    try {
        const savedCharacter = await dataService.saveCharacter(updatedCharacter);
        
        // Update SSoT 'characters' lokal
        setCharacters(prev => {
            const index = prev.findIndex(c => c.id === savedCharacter.id);
            if (index !== -1) {
                const newCharacters = [...prev];
                newCharacters[index] = savedCharacter;
                return newCharacters;
            }
            return [...prev, savedCharacter]; // (Untuk karakter baru)
        });
        
        // Jika karakter yang di-update adalah yang sedang dimainkan, update state-nya
        if (playingCharacter && playingCharacter.id === savedCharacter.id) {
            setPlayingCharacter(savedCharacter);
        }
        
        // Update juga state 'players' di dalam 'playingCampaign' (Mandat 2.2)
        if (playingCampaign) {
            setPlayingCampaign(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    players: prev.players.map(p => p.id === savedCharacter.id ? savedCharacter : p)
                };
            });
        }
    } catch(e) {
         console.error("Gagal menyimpan karakter (SSoT):", e);
         alert("Gagal menyimpan progres karakter. Periksa koneksi Anda.");
    }
  };
  
  /**
   * Membuat Campaign baru
   */
  const handleCreateCampaign = async (campaignData: Omit<Campaign, 'id' | 'ownerId' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId' | 'initiativeOrder'>) => {
    if (!userId) return;

    try {
      const newCampaign = await dataService.createCampaign(campaignData, userId);
      
      // REFAKTOR G-2: Gunakan generationService
      const openingScene = await generationService.generateOpeningScene(newCampaign);
      
      // Simpan event pembuka ke DB
      const openingEvent: Omit<GameEvent, 'id' | 'timestamp'> & { campaignId: string } = {
         campaignId: newCampaign.id,
         type: 'dm_narration',
         text: openingScene,
         turnId: 'turn-0',
         characterId: null
      };
      await dataService.logGameEvent(openingEvent);

      setCampaigns(prev => [...prev, newCampaign]);
      handleReturnToNexus();

    } catch (e) {
      console.error("Gagal membuat kampanye atau adegan pembuka:", e);
      alert("Gagal membuat kampanye. Coba lagi.");
    }
  };
  
  /**
   * Memilih campaign dari Hall of Echoes atau setelah Join/Create
   * Ini adalah fungsi UTAMA untuk memuat sesi game.
   */
  const handleSelectCampaign = async (campaign: Campaign) => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
        // 1. Tentukan karakter mana yang kita mainkan di campaign ini
        const myCharacterInCampaign = characters.find(c => campaign.playerIds.includes(c.id));
        
        if (!myCharacterInCampaign) {
             // Jika kita belum punya karakter di campaign ini (alur 'Join')
            setCampaignToJoinOrStart(campaign);
            setCurrentView('character-selection');
            setIsLoading(false);
            return;
        }
        
        // 2. Muat data runtime (Events, Monsters, dan SSoT SEMUA player)
        const { eventLog, monsters, players } = await dataService.loadCampaignRuntimeData(campaign.id, campaign.playerIds);
        
        // 3. Siapkan CampaignState untuk GameScreen
        const campaignState: CampaignState = {
            ...campaign,
            eventLog,
            monsters,
            players, // Ini adalah SSoT semua player (Mandat 2.2)
            thinkingState: 'idle',
            activeRollRequest: null,
            choices: [],
            turnId: null, // Selalu mulai dengan turnId null
        };
        
        // 4. Set state permainan
        setPlayingCampaign(campaignState);
        setPlayingCharacter(myCharacterInCampaign); // Ini SSoT karakter *kita*
        setCurrentView('nexus'); // (Kita tidak pindah view, GameScreen akan otomatis render)

    } catch (e) {
        console.error("Gagal memuat data runtime campaign:", e);
        alert("Gagal memuat sesi permainan. Coba lagi.");
    } finally {
        setIsLoading(false);
    }
  };
  
  /**
   * Dipanggil dari CharacterSelectionView setelah memilih karakter untuk 'Join'
   */
  const handleCharacterSelection = async (character: Character) => {
    if (!campaignToJoinOrStart || !userId) return;

    const campaign = campaignToJoinOrStart;

    try {
      // 1. Tambahkan player ke tabel relasional 'campaign_players'
      await dataService.addPlayerToCampaign(campaign.id, character.id);

      // 2. Update state campaign lokal
      const updatedCampaign = { ...campaign };
      updatedCampaign.playerIds = [...campaign.playerIds, character.id];
      if (updatedCampaign.playerIds.length === 1 && !updatedCampaign.currentPlayerId) {
        updatedCampaign.currentPlayerId = character.id; // Player pertama jadi giliran pertama
        
        // Simpan perubahan currentPlayerId ke DB
        await handleSaveCampaign(updatedCampaign); 
      }
      
      // Update state campaigns utama
      setCampaigns(prev => prev.map(c => c.id === updatedCampaign.id ? updatedCampaign : c));
      
      setCampaignToJoinOrStart(null);
      setCurrentView('nexus');
      
      // 3. Langsung muat game
      await handleSelectCampaign(updatedCampaign);

    } catch (e) {
         console.error("Gagal join campaign:", e);
         alert("Gagal bergabung ke campaign. Mungkin Anda sudah bergabung?");
         handleReturnToNexus();
    }
  };

  const handleExitGame = (finalCampaignState: CampaignState) => {
    // 1. Simpan state campaign (NPC, Quests, initiativeOrder, currentPlayerId, dll)
    handleSaveCampaign(finalCampaignState);
    
    // 2. Simpan SSoT karakter kita (Mandat 3.4)
    // 'playingCharacter' state sudah di-update oleh GameScreen via 'handleUpdateCharacter'
    // Jadi, kita hanya perlu memastikan 'playingCharacter' terakhir disimpan.
    if (playingCharacter) {
        handleUpdateCharacter(playingCharacter);
    }
    
    // 3. Reset state runtime
    setPlayingCampaign(null);
    setPlayingCharacter(null);
    setCurrentView('nexus');
  };
  
  // (Fungsi ini sekarang hanya untuk alur JoinCampaignView)
  const handleFoundCampaignToJoin = (campaign: Campaign) => {
      // Tidak langsung 'handleSelectCampaign', tapi mulai alur join
      setCampaignToJoinOrStart(campaign);
      setCurrentView('character-selection');
  }

  // =================================================================
  // RENDER LOGIC
  // =================================================================

  const renderView = () => {
    if (!userId) return null; // Harusnya tidak pernah terjadi jika ada session

    // Alur khusus: Memilih karakter untuk join campaign
    if (currentView === 'character-selection' && campaignToJoinOrStart) {
      return (
        <CharacterSelectionView
          characters={characters} // Kirim SSoT karakter
          onSelect={(character) => { // (Lihat refaktor 1.C.4)
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
        return <HallOfEchoesView 
                  onClose={handleReturnToNexus} 
                  campaigns={campaigns} // Kirim daftar campaign
                  onSelectCampaign={handleSelectCampaign} // Kirim pemuat game
                  myCharacters={characters} // Kirim SSoT karakter
                  onUpdateCampaign={handleSaveCampaign} // Kirim penyimpan campaign
                />;
      case Location.WanderersTavern:
        return <JoinCampaignView 
                  onClose={handleReturnToNexus} 
                  onCampaignFound={handleFoundCampaignToJoin} // (Lihat refaktor 1.C.2)
                />;
      case Location.MarketOfAThousandTales:
        return <MarketplaceView 
                  onClose={handleReturnToNexus} 
                  setCampaigns={setCampaigns} // (Lihat refaktor 1.C.3)
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
                  characters={characters} // SSoT Characters
                  onSaveNewCharacter={handleSaveNewCharacter} // Prop baru
                  setCharacters={setCharacters} // Prop lama (untuk update/delete)
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

  if (isAuthLoading) {
    return <LoadingScreen />;
  }
  
  if (!session) {
    return <div className={theme}><LoginView /></div>;
  }

  // =================================================================
  // RENDER GAME SCREEN (SSoT)
  // =================================================================
  if (playingCampaign && playingCharacter && userId) {
    // 'playingCampaign' sudah berisi 'players' (SSoT semua player)
    // 'playingCharacter' adalah SSoT *kita*
    return (
      <div className={theme}>
        <GameScreen 
          key={playingCampaign.id} // Kunci untuk reset state saat ganti campaign
          initialCampaign={playingCampaign} 
          character={playingCharacter} 
          players={playingCampaign.players} // Kirim SSoT semua player
          onExit={handleExitGame}
          updateCharacter={handleUpdateCharacter} // Kirim SSoT updater
          userId={userId}
        />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className={`w-screen h-screen bg-black overflow-hidden ${theme}`}>
      {currentView === 'nexus' && <NexusSanctum onLocationClick={handleLocationClick} userEmail={session?.user?.email} />}
      {currentView !== 'nexus' && renderView()}
    </div>
  );
};

export default App;