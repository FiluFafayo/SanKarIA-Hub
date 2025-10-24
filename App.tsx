// App.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from './firebase';
import { LoginButton } from './components/LoginButton';
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
import { generateId, generateJoinCode } from './utils';
import { DEFAULT_CAMPAIGNS } from './data/defaultCampaigns';

type View = Location | 'nexus' | 'character-selection';

const App: React.FC = () => {
  // --- State Auth ---
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [supabaseAuthReady, setSupabaseAuthReady] = useState(false);
  const [supabaseClientInitialized, setSupabaseClientInitialized] = useState(false);
  // -----------------

  const [currentView, setCurrentView] = useState<View>('nexus');
  const [userId, setUserId] = useState<string>(''); // Diisi dari Firebase user.uid
  const [theme, setTheme] = useLocalStorage<string>('sankaria-theme', 'theme-sanc');
  const [isLoading, setIsLoading] = useState(true); // Loading data campaign/character

  // --- Default & Local Storage Values ---
  const defaultApiKeys = [
      'AIzaSyD3uJ5i0E6xw3wPtfjz02k8ES-rMU6nDt8', // Ganti dengan defaultmu jika beda
      'AIzaSyAQOBMFPQ5VrqQH2-TwGvQD9ZMcFz0i7Pc'  // Ganti dengan defaultmu jika beda
  ];
  const defaultSupabaseUrl = 'https://apofprrwfcjwtovvqhds.supabase.co'; // <<< GANTI DENGAN URL BARU DARI SUPABASE
  const defaultSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwb2ZwcnJ3ZmNqd3RvdnZxaGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzg5ODksImV4cCI6MjA3Njg1NDk4OX0.SrurgXy8wLzYC0xTTYD8F4RggY8kYHARB9Tw9wJNvUs'; // <<< GANTI DENGAN ANON KEY BARU DARI SUPABASE

  const [apiKeys, setApiKeys] = useLocalStorage<string[]>('sankaria-apikeys', defaultApiKeys);
  const [supabaseUrl, setSupabaseUrl] = useLocalStorage<string>('sankaria-supabase-url', defaultSupabaseUrl);
  const [supabaseKey, setSupabaseKey] = useLocalStorage<string>('sankaria-supabase-key', defaultSupabaseKey);
  // ------------------------------------

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);

  // State for the game session
  const [playingCampaign, setPlayingCampaign] = useState<Campaign | null>(null);
  const [playingCharacter, setPlayingCharacter] = useState<Character | null>(null);

  // --- Auth & Data Loading Effects ---

  // Effect 1: Firebase Auth Listener
  useEffect(() => {
    console.log("Setting up Firebase Auth listener...");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Firebase Auth state changed. User:", user ? user.uid : 'null');
      setFirebaseUser(user);
      if (!user) {
        console.log("User logged out from Firebase. Signing out Supabase...");
        await dataService.signOut();
        setSupabaseAuthReady(false);
        setUserId('');
      }
      // Set authLoading false HANYA setelah cek awal selesai
      if (authLoading) setAuthLoading(false);
    });
    return () => {
      console.log("Cleaning up Firebase Auth listener.");
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Harus kosong agar jalan sekali

  // Effect 2: Supabase Client Initialization
  useEffect(() => {
    if (supabaseUrl && supabaseKey) {
      console.log("Supabase URL/Key detected, initializing client...");
      try {
        dataService.init(supabaseUrl, supabaseKey);
        setSupabaseClientInitialized(true);
        console.log("Supabase client initialized flag set to true.");
      } catch (error) {
        console.error("Gagal init Supabase client:", error);
        setSupabaseClientInitialized(false);
      }
    } else {
      console.log("Supabase URL/Key empty, client not initialized.");
      setSupabaseClientInitialized(false);
    }
  }, [supabaseUrl, supabaseKey]);

  // Effect 3: Supabase Sign In with Firebase Token
  useEffect(() => {
    const handleSupabaseSignIn = async (user: User) => {
      console.log("Firebase user detected & Supabase client ready. Attempting Supabase sign in...");
      try {
        const token = await user.getIdToken(true); // Paksa refresh token
        await dataService.signInWithFirebaseToken(token);
        setSupabaseAuthReady(true);
        setUserId(user.uid);
        console.log("Supabase sign in successful, auth ready.");
      } catch (error) {
        console.error("Gagal sign in ke Supabase dengan token:", error);
        setSupabaseAuthReady(false);
        setUserId('');
        // Optional: Logout paksa dari Firebase jika Supabase gagal?
        // await handleLogout();
      }
    };

    if (firebaseUser && supabaseClientInitialized && !supabaseAuthReady) {
        // Hanya jalankan jika: User ada, client init, DAN Supabase belum ready
        handleSupabaseSignIn(firebaseUser);
    } else if (!firebaseUser) {
        // Jika user logout, pastikan Supabase tidak ready
        setSupabaseAuthReady(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, supabaseClientInitialized]); // Re-run jika user berubah atau client init

  // Effect 4: Load Data
  useEffect(() => {
    if (supabaseAuthReady && userId) {
      console.log("Supabase auth ready & userId set. Loading data...");
      setIsLoading(true); // Set loading true saat mulai load
      const loadData = async () => {
        try {
          let fetchedCampaigns = await dataService.getCampaigns();
          let fetchedCharacters = await dataService.getCharacters(); // Ambil semua chars dulu

          if (fetchedCampaigns.length === 0) {
            console.log("Seeding default campaigns...");
            await dataService.saveCampaigns(DEFAULT_CAMPAIGNS);
            fetchedCampaigns = DEFAULT_CAMPAIGNS;
          }

          setCampaigns(fetchedCampaigns);
          // Filter characters milik user SAAT INI
          setCharacters(fetchedCharacters.filter(c => c.ownerId === userId));
          console.log("Data loaded. Campaigns:", fetchedCampaigns.length, "User Characters:", fetchedCharacters.filter(c => c.ownerId === userId).length);

        } catch (error) {
          console.error("Gagal memuat data:", error);
          setCampaigns([]); // Reset state jika error
          setCharacters([]);
        } finally {
          setIsLoading(false);
        }
      };
      loadData();
    } else {
      // Jika Supabase belum siap, atau user logout
      console.log("Supabase not ready or no user, clearing data.");
      setCampaigns([]);
      setCharacters([]);
      setIsLoading(false); // Pastikan loading selesai
    }
  }, [supabaseAuthReady, userId]); // Hanya bergantung pada status auth Supabase & userId

  // --- End Auth & Data Loading Effects ---

  // --- Helper Functions ---
  const handleLogout = async () => {
    console.log("Logout initiated...");
    setAuthLoading(true);
    try {
      await firebaseSignOut(auth);
      // State akan dihandle oleh onAuthStateChanged
    } catch (error) {
      console.error("Firebase logout error:", error);
      setAuthLoading(false);
    }
  };

  const myCharacters = characters; // Langsung pakai state, sudah difilter

  const [campaignToJoinOrStart, setCampaignToJoinOrStart] = useState<Campaign | null>(null);

  useEffect(() => {
    geminiService.updateKeys(apiKeys);
  }, [apiKeys]);

  const handleLocationClick = useCallback((location: Location) => {
    if (!firebaseUser) {
        alert("Anda harus login untuk mengakses fitur ini.");
        return;
    }
    if (location === Location.StorytellersSpire && !apiKeys.some(k => k.trim() !== '')) {
        alert("Anda harus memasukkan Kunci API Gemini di 'Bengkel Juru Cipta' sebelum dapat membuat kampanye baru.");
        setCurrentView(Location.TinkerersWorkshop);
        return;
    }
    setCurrentView(location);
  }, [apiKeys, firebaseUser]); // Tambah firebaseUser

  const handleReturnToNexus = useCallback(() => {
    setCurrentView('nexus');
    setCampaignToJoinOrStart(null);
  }, []);

  const handleSaveCampaign = async (updatedCampaign: Campaign) => {
    try {
        await dataService.saveCampaign(updatedCampaign);
        setCampaigns(prev => {
            const index = prev.findIndex(c => c.id === updatedCampaign.id);
            if (index !== -1) {
                const newCampaigns = [...prev];
                newCampaigns[index] = updatedCampaign;
                return newCampaigns;
            }
            return [...prev, updatedCampaign]; // Fallback
        });
    } catch (e) {
        console.error("Gagal menyimpan kampanye:", e);
        alert("Gagal menyimpan progres kampanye. Periksa koneksi Anda.");
    }
  };

  const handleUpdateCharacter = async (updatedCharacter: Character) => {
    try {
        // Pastikan ownerId tidak ikut terkirim jika tidak perlu/berubah
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { ownerId, ...charDataToSave } = updatedCharacter;
        // Jika saveCharacter dimodif untuk TIDAK terima ownerId, pakai charDataToSave
        // Jika saveCharacter masih terima ownerId, kirim updatedCharacter
        const savedChar = await dataService.saveCharacter(updatedCharacter); // Asumsi saveCharacter bisa handle ini

        setCharacters(prev => {
            const index = prev.findIndex(c => c.id === savedChar.id);
            if (index !== -1) {
                const newCharacters = [...prev];
                newCharacters[index] = savedChar;
                return newCharacters;
            }
            // Seharusnya tidak terjadi jika update
            return prev;
        });
        if (playingCharacter && playingCharacter.id === savedChar.id) {
            setPlayingCharacter(savedChar);
        }
    } catch(e) {
       console.error("Gagal menyimpan karakter:", e);
       alert("Gagal menyimpan progres karakter. Periksa koneksi Anda.");
    }
  };

  const handleCreateCampaign = async (newCampaignData: Omit<Campaign, 'id' | 'joinCode' | 'playerIds' | 'currentPlayerId' | 'eventLog' | 'turnId' | 'monsters' | 'initiativeOrder' | 'choices' | 'quests' | 'npcs' | 'currentTime' | 'currentWeather' | 'worldEventCounter' | 'mapImageUrl' | 'mapMarkers' | 'currentPlayerLocation' | 'image' | 'gameState'>) => {
    const newCampaign: Campaign = {
        ...newCampaignData,
        id: generateId('campaign'),
        joinCode: generateJoinCode(),
        playerIds: [],
        currentPlayerId: null,
        eventLog: [],
        turnId: null,
        image: `https://picsum.photos/seed/${generateId('img')}/400/300`,
        gameState: 'exploration',
        monsters: [],
        initiativeOrder: [],
        choices: [],
        quests: [],
        npcs: [],
        currentTime: 'Siang',
        currentWeather: 'Cerah',
        worldEventCounter: 0,
        mapImageUrl: undefined,
        mapMarkers: [],
        currentPlayerLocation: undefined,
        longTermMemory: `Premise: ${newCampaignData.description}`,
        isPublished: false, // Default tidak publish
    };

    setIsLoading(true); // Tampilkan loading global
    try {
        const openingScene = await geminiService.generateOpeningScene(newCampaign);
        newCampaign.eventLog.push({
            id: generateId('event'), type: 'dm_narration', text: openingScene,
            timestamp: new Date().toISOString(), turnId: 'turn-0'
        });
    } catch (e) {
      console.error("Failed to generate opening scene:", e);
      newCampaign.eventLog.push({
          id: generateId('event'), type: 'system', text: "Gagal menghasilkan adegan pembuka.",
          timestamp: new Date().toISOString(), turnId: 'turn-0'
      });
    }

    try {
        await dataService.saveCampaign(newCampaign); // Simpan ke Supabase
        setCampaigns(prev => [...prev, newCampaign]);
        handleReturnToNexus();
    } catch (error) {
        console.error("Gagal menyimpan kampanye baru:", error);
        alert(`Gagal menyimpan kampanye baru ke database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsLoading(false); // Sembunyikan loading global
    }
  };

  const handleSelectCampaign = (campaign: Campaign) => {
    if (!firebaseUser) return; // Seharusnya tidak terjadi jika UI benar
    if (!apiKeys.some(k => k.trim() !== '')) {
        alert("Anda harus memasukkan Kunci API Gemini di 'Bengkel Juru Cipta' sebelum memulai atau melanjutkan kampanye.");
        setCurrentView(Location.TinkerersWorkshop);
        return;
    }

    const playerCharacter = myCharacters.find(c => campaign.playerIds.includes(c.id));

    if (playerCharacter) {
        setPlayingCampaign(campaign);
        setPlayingCharacter(playerCharacter);
    } else {
      if (campaign.playerIds.length >= campaign.maxPlayers) {
        alert("Maaf, kampanye ini sudah penuh.");
        return;
      }
      setCampaignToJoinOrStart(campaign);
      setCurrentView('character-selection');
    }
  };

  const handleCharacterSelection = (character: Character) => {
    if (!campaignToJoinOrStart) return;

    const campaign = campaignToJoinOrStart;
    const isPlayerInCampaign = campaign.playerIds.includes(character.id);

    let updatedCampaign = { ...campaign };
    if (!isPlayerInCampaign) {
      updatedCampaign.playerIds = [...campaign.playerIds, character.id];
      if (updatedCampaign.playerIds.length === 1 && !updatedCampaign.currentPlayerId) {
        updatedCampaign.currentPlayerId = character.id; // Pemain pertama jadi giliran pertama
      }
      handleSaveCampaign(updatedCampaign); // Simpan perubahan playerIds
    }

    setPlayingCampaign(updatedCampaign);
    setPlayingCharacter(character);
    setCampaignToJoinOrStart(null);
    setCurrentView('nexus'); // Kembali ke nexus, nanti langsung redirect ke game screen
  };

  const handleExitGame = (finalCampaignState: Campaign) => {
    handleSaveCampaign(finalCampaignState);
    setPlayingCampaign(null);
    setPlayingCharacter(null);
    setCurrentView('nexus');
  };

  const handleFoundCampaignToJoin = (campaign: Campaign) => {
      handleSelectCampaign(campaign);
  }

  // --- Render Views ---
  const renderView = () => {
    if (currentView === 'character-selection' && campaignToJoinOrStart) {
      return (
        <CharacterSelectionView
          characters={myCharacters} // Sudah difilter
          onSelect={(characterId) => {
            const character = myCharacters.find(c => c.id === characterId);
            if(character) handleCharacterSelection(character);
          }}
          onClose={handleReturnToNexus}
        />
      );
    }

    switch (currentView) {
      case Location.StorytellersSpire:
        // Perlu ubah CreateCampaignView agar tidak terima onCreateCampaign dg param Campaign utuh
        // Mungkin lebih baik onCreateCampaign hanya terima data form?
        // @ts-ignore Mengabaikan type mismatch sementara
        return <CreateCampaignView onClose={handleReturnToNexus} onCreateCampaign={handleCreateCampaign} />;
      case Location.HallOfEchoes:
        return <HallOfEchoesView onClose={handleReturnToNexus} campaigns={campaigns} onSelectCampaign={handleSelectCampaign} myCharacters={myCharacters} onUpdateCampaign={handleSaveCampaign} />;
      case Location.WanderersTavern:
        return <JoinCampaignView onClose={handleReturnToNexus} campaigns={campaigns} onCampaignFound={handleFoundCampaignToJoin} />;
      case Location.MarketOfAThousandTales:
        return <MarketplaceView onClose={handleReturnToNexus} allCampaigns={campaigns} setCampaigns={setCampaigns} userId={userId} />;
      case Location.TinkerersWorkshop:
        return <SettingsView
                  apiKeys={apiKeys} setApiKeys={setApiKeys}
                  onClose={handleReturnToNexus}
                  currentTheme={theme} setTheme={setTheme}
                  supabaseUrl={supabaseUrl} setSupabaseUrl={setSupabaseUrl}
                  supabaseKey={supabaseKey} setSupabaseKey={setSupabaseKey}
               />;
      case Location.MirrorOfSouls:
        // ProfileView butuh userId untuk saveCharacter baru
        return <ProfileView onClose={handleReturnToNexus} characters={myCharacters} setCharacters={setCharacters} userId={userId} />;
      default:
        return null;
    }
  };

  // --- Main Render Logic ---
  if (authLoading) {
    return (
      <div className={`w-screen h-screen bg-bg-primary flex items-center justify-center text-text-primary ${theme}`}>
        Memverifikasi sesi...
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className={`w-screen h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}>
        <h1 className="font-cinzel text-5xl mb-4">SanKarIA</h1>
        <p className="mb-8">Silakan login untuk memulai petualangan.</p>
        {/* onLogin tidak perlu callback karena trigger popup */}
        <LoginButton user={null} onLogout={handleLogout} />
      </div>
    );
  }

  // Jika user login tapi Supabase client belum init atau auth belum ready
  if (!supabaseClientInitialized || !supabaseAuthReady) {
      return (
          <div className={`w-screen h-screen bg-bg-primary flex items-center justify-center text-text-primary ${theme}`}>
              { !supabaseClientInitialized ? 'Menginisialisasi koneksi...' : 'Menyiapkan sesi Supabase...' }
          </div>
      );
  }

  // Jika user login, Supabase siap, TAPI data masih loading
  if (isLoading) {
    return (
        <div className={`w-screen h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}>
            <h1 className="font-cinzel text-5xl animate-pulse">SanKarIA</h1>
            <p className="mt-2">Memuat semesta...</p>
        </div>
    );
  }

  // Jika sedang dalam game
  if (playingCampaign && playingCharacter) {
    const campaignPlayers = characters.filter(c => playingCampaign.playerIds.includes(c.id));
    return (
      <div className={theme}>
        {/* Tombol logout tetap ada di game screen */}
        <LoginButton user={firebaseUser} onLogout={handleLogout} />
        <GameScreen
          initialCampaign={playingCampaign}
          character={playingCharacter}
          players={campaignPlayers} // Mungkin perlu ambil data player lain dari Supabase?
          onExit={handleExitGame}
          updateCharacter={handleUpdateCharacter}
          userId={userId}
        />
      </div>
    );
  }

  // Render aplikasi utama (Nexus atau View lain)
  return (
    <div className={`w-screen h-screen bg-black overflow-hidden ${theme}`}>
      {/* Tombol logout di Nexus/Views */}
      <LoginButton user={firebaseUser} onLogout={handleLogout} />
      {currentView === 'nexus' && <NexusSanctum onLocationClick={handleLocationClick} />}
      {currentView !== 'nexus' && renderView()}
    </div>
  );
};

export default App;