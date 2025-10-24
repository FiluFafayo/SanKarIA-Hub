import { createClient, User, Session } from '@supabase/supabase-js'; // Tambahin User & Session
import React, { useState, useCallback, useEffect } from 'react';
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
import { DEFAULT_CHARACTERS } from './data/defaultCharacters';

type View = Location | 'nexus' | 'character-selection';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('nexus');
  // const [apiKeys, setApiKeys] = useLocalStorage<string[]>('sankarla-apikeys', ['']);
  // const [supabaseUrl, setSupabaseUrl] = useLocalStorage<string>('sankarla-supabase-url', '');
  // const [supabaseKey, setSupabaseKey] = useLocalStorage<string>('sankarla-supabase-key', '');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [theme, setTheme] = useLocalStorage<string>('sankarla-theme', 'theme-sanc');
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null); // State baru buat session

  const geminiApiKeysEnv = process.env.GEMINI_API_KEYS || '';
  const supabaseUrlEnv = process.env.SUPABASE_URL || '';
  const supabaseAnonKeyEnv = process.env.SUPABASE_ANON_KEY || '';

  // Parse multi Gemini keys
  const apiKeys = geminiApiKeysEnv.split(',').map(key => key.trim()).filter(key => key.length > 0);
  const supabaseUrl = supabaseUrlEnv;
  const supabaseKey = supabaseAnonKeyEnv;

  // State for the game session
  const [playingCampaign, setPlayingCampaign] = useState<Campaign | null>(null);
  const [playingCharacter, setPlayingCharacter] = useState<Character | null>(null);

  useEffect(() => {
    let supabaseClient: ReturnType<typeof createClient> | null = null;
    if (supabaseUrl && supabaseKey) { // Gunakan variabel yg dibaca dari env
      supabaseClient = createClient(supabaseUrl, supabaseKey);
      dataService.init(supabaseUrl, supabaseKey); // Gunakan variabel yg dibaca dari env
      console.log("Supabase Client Initialized from Env Vars");
    } else {
      console.warn("Supabase URL or Key Env Vars are missing. Supabase functionality disabled.");
      setIsLoading(false); // Langsung set false kalau Supabase ga ke-setup
      setCampaigns(DEFAULT_CAMPAIGNS); // Mungkin load default data aja?
      setCharacters(DEFAULT_CHARACTERS.map(char => ({ ...char, id: generateId('char'), ownerId: 'local-user' }))); // Atau data lokal
      return;
    }

    // Cek session awal
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      console.log("Initial session:", session);
      loadInitialData(session?.user?.id); // Muat data setelah session dicek
    });

    // Listener buat perubahan auth state
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      console.log("Auth state changed:", session);
      // Muat ulang data atau sesuaikan state aplikasi saat login/logout
      loadInitialData(session?.user?.id);
    });

    // Cleanup listener saat komponen unmount
    return () => {
      subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUrl, supabaseKey]); // Hanya re-run kalo URL/Key berubah

  // Pindahkan logika loadData ke fungsi terpisah biar bisa dipanggil ulang
  const loadInitialData = async (currentUserId: string | undefined) => {
    setIsLoading(true);
    try {
      let fetchedCampaigns = await dataService.getCampaigns();
      let fetchedCharacters = currentUserId ? await dataService.getCharacters(currentUserId) : []; // Ambil char HANYA kalo user login

      // Seed data JIKA user login TAPI BELUM punya karakter
      if (currentUserId && fetchedCharacters.length === 0) {
        console.log("No characters found for user, seeding default characters...");
        const userCharacters = DEFAULT_CHARACTERS.map(char => ({
          ...char,
          id: generateId('char'), // ID lokal sementara, Supabase akan generate UUID
          ownerId: currentUserId,
        }));
        // Hapus ID lokal sebelum insert, biarkan Supabase generate UUID
        const charactersToInsert = userCharacters.map(({ id, ...rest }) => rest);
        await dataService.saveCharacters(charactersToInsert); // Save ke Supabase
        fetchedCharacters = await dataService.getCharacters(currentUserId); // Fetch lagi yg udah ada ID UUID
        console.log("Seeded characters:", fetchedCharacters);
      }
      // Seed campaigns jika kosong (opsional, tergantung maumu)
      if (fetchedCampaigns.length === 0) {
        console.log("No campaigns found, seeding default campaigns...");
        await dataService.saveCampaigns(DEFAULT_CAMPAIGNS);
        fetchedCampaigns = await dataService.getCampaigns();
        console.log("Seeded campaigns:", fetchedCampaigns);
      }

      setCampaigns(fetchedCampaigns);
      setCharacters(fetchedCharacters);
    } catch (error) {
      console.error("Gagal memuat data:", error);
      alert("Gagal memuat data. Periksa pengaturan Supabase atau coba lagi nanti.");
      // Set state kosong atau default jika gagal
      setCampaigns([]);
      setCharacters([]);
    } finally {
      setIsLoading(false);
    }
  };

  const myCharacters = characters.filter(c => c.ownerId === session?.user?.id);
  const [campaignToJoinOrStart, setCampaignToJoinOrStart] = useState<Campaign | null>(null);

  // Pastikan useEffect untuk updateKeys geminiService pakai apiKeys dari env
  useEffect(() => {
    if (apiKeys.length > 0) {
      geminiService.updateKeys(apiKeys); // Gunakan variabel yg dibaca dari env
      console.log(`Gemini Service updated with ${apiKeys.length} keys from Env Vars.`);
    } else {
      console.warn("No Gemini API Keys found in Env Vars.");
    }
  }, [apiKeys]); // Dependency-nya apiKeys yg dari env

  const handleLocationClick = useCallback((location: Location) => {
    if (location === Location.StorytellersSpire && !apiKeys.some(k => k.trim() !== '')) {
      alert("Anda harus memasukkan Kunci API Gemini di 'Bengkel Juru Cipta' sebelum dapat membuat kampanye baru.");
      setCurrentView(Location.TinkerersWorkshop);
      return;
    }
    setCurrentView(location);
  }, [apiKeys]);

  const handleReturnToNexus = useCallback(() => {
    setCurrentView('nexus');
    setCampaignToJoinOrStart(null);
  }, []);

  const handleSaveCampaign = async (updatedCampaign: Campaign) => {
    try {
      // Panggil dataService (udah async)
      const savedCampaign = await dataService.saveCampaign(updatedCampaign);
      // Update state LOKAL setelah berhasil save ke DB
      setCampaigns(prev => {
        const index = prev.findIndex(c => c.id === savedCampaign.id);
        if (index !== -1) {
          const newCampaigns = [...prev];
          newCampaigns[index] = savedCampaign; // Pakai data yg udah disave
          return newCampaigns;
        }
        // Jika campaign baru (seharusnya tidak terjadi di sini, tapi sbg fallback)
        return [...prev, savedCampaign];
      });
    } catch (e) {
      console.error("Gagal menyimpan kampanye:", e);
      alert("Gagal menyimpan progres kampanye. Periksa koneksi Anda.");
      // Pertimbangkan: Mungkin perlu revert state lokal jika gagal? (Tergantung kebutuhan)
    }
  };

  const handleUpdateCharacter = async (updatedCharacter: Character) => {
    try {
      // Panggil dataService (udah async)
      const savedCharacter = await dataService.saveCharacter(updatedCharacter);
      // Update state LOKAL setelah berhasil save ke DB
      setCharacters(prev => {
        const index = prev.findIndex(c => c.id === savedCharacter.id);
        if (index !== -1) {
          const newCharacters = [...prev];
          newCharacters[index] = savedCharacter; // Pakai data yg udah disave
          return newCharacters;
        }
        // Seharusnya karakter selalu ada, tapi fallback jika tidak
        console.warn("Character not found in local state after saving:", savedCharacter.id);
        return [...prev, savedCharacter];
      });
      // Update state playingCharacter jika yg diupdate sedang dimainkan
      if (playingCharacter && playingCharacter.id === savedCharacter.id) {
        setPlayingCharacter(savedCharacter);
      }
    } catch (e) {
      console.error("Gagal menyimpan karakter:", e);
      alert("Gagal menyimpan progres karakter. Periksa koneksi Anda.");
      // Pertimbangkan revert state lokal jika perlu
    }
  };

  const handleCreateCampaign = async (newCampaignInput: Omit<Campaign, 'id' | 'joinCode' | 'eventLog' | 'turnId' | 'playerIds' | 'currentPlayerId' | 'gameState' | 'monsters' | 'initiativeOrder' | 'choices' | 'quests' | 'npcs' | 'currentTime' | 'currentWeather' | 'worldEventCounter' | 'mapImageUrl' | 'mapMarkers' | 'currentPlayerLocation'>) => {
    setIsLoading(true); // Tampilkan loading
    let openingScene = "Petualangan dimulai...";
    const campaignId = generateId('campaign'); // Generate ID lokal sementara jika perlu
    const joinCode = generateJoinCode();

    // Siapkan data campaign dasar
    let newCampaign: Campaign = {
      ...newCampaignInput,
      id: campaignId, // ID bisa diganti Supabase nanti
      joinCode: joinCode,
      eventLog: [],
      turnId: null,
      playerIds: [],
      currentPlayerId: null,
      gameState: 'exploration',
      monsters: [],
      initiativeOrder: [],
      choices: [],
      quests: [], // Akan diisi jika ada dari framework
      npcs: [], // Akan diisi jika ada dari framework
      currentTime: 'Siang',
      currentWeather: 'Cerah',
      worldEventCounter: 0,
      mapImageUrl: undefined, // Akan diisi jika map dibuat
      mapMarkers: [], // Akan diisi jika map dibuat
      currentPlayerLocation: undefined, // Akan diisi jika map dibuat
    };

    try {
      // 1. Generate Opening Scene (Optional, bisa gagal)
      try {
        openingScene = await geminiService.generateOpeningScene(newCampaign);
      } catch (e) {
        console.error("Gagal menghasilkan adegan pembuka:", e);
        openingScene = "Gagal menghasilkan adegan pembuka. Silakan mulai petualangan Anda.";
      }

      // Tambahkan event pembuka
      newCampaign.eventLog.push({
        id: generateId('event'),
        type: 'dm_narration',
        text: openingScene,
        timestamp: new Date().toISOString(),
        turnId: 'turn-0'
      });

      // 2. Simpan campaign ke database
      // Kirim data tanpa ID lokal jika memungkinkan, biarkan DB generate UUID
      const campaignToSave = { ...newCampaign, id: undefined };
      const savedCampaign = await dataService.saveCampaign(campaignToSave);

      // 3. Update state lokal dengan data dari database (termasuk ID UUID)
      setCampaigns(prev => [...prev, savedCampaign]);
      handleReturnToNexus(); // Kembali ke Nexus setelah berhasil

    } catch (e) {
      console.error("Gagal membuat atau menyimpan kampanye:", e);
      alert("Gagal membuat kampanye baru. Periksa koneksi atau coba lagi.");
    } finally {
      setIsLoading(false); // Sembunyikan loading
    }
  };

  const handleSelectCampaign = (campaign: Campaign) => {
    // API Key check for hosts
    if (!apiKeys.some(k => k.trim() !== '')) {
      alert("Anda harus memasukkan Kunci API Gemini di 'Bengkel Juru Cipta' sebelum memulai atau melanjutkan kampanye.");
      setCurrentView(Location.TinkerersWorkshop);
      return;
    }

    const playerCharacter = characters.find(c => c.ownerId === session?.user?.id && campaign.playerIds.includes(c.id));

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

  const handleCharacterSelection = async (character: Character) => { // Tambah async
    if (!campaignToJoinOrStart) return;

    const campaign = campaignToJoinOrStart;
    const isPlayerInCampaign = campaign.playerIds.includes(character.id);

    let updatedCampaignData = { ...campaign };
    if (!isPlayerInCampaign) {
      updatedCampaignData.playerIds = [...campaign.playerIds, character.id];
      if (updatedCampaignData.playerIds.length === 1 && !updatedCampaignData.currentPlayerId) {
        // Set pemain pertama yg join sebagai giliran pertama (opsional)
        updatedCampaignData.currentPlayerId = character.id;
      }
      try {
        // Simpan perubahan playerIds ke database SEBELUM masuk game
        await handleSaveCampaign(updatedCampaignData);
        console.log("Campaign updated with new player:", character.id);
      } catch (error) {
        console.error("Gagal menyimpan update campaign saat join:", error);
        alert("Gagal bergabung ke campaign. Coba lagi.");
        return; // Jangan lanjut jika gagal save
      }
    }

    // Set state lokal SETELAH save berhasil (atau jika player sudah ada)
    setPlayingCampaign(updatedCampaignData);
    setPlayingCharacter(character);
    setCampaignToJoinOrStart(null); // Reset state sementara
    setCurrentView('nexus'); // Balik ke nexus, nanti otomatis masuk GameScreen
  };

  // Cukup pastikan handleSaveCampaign yg dipanggil di sini sudah async
  const handleExitGame = (finalCampaignState: Campaign) => {
    handleSaveCampaign(finalCampaignState); // Panggil fungsi yg sudah async
    setPlayingCampaign(null);
    setPlayingCharacter(null);
    setCurrentView('nexus');
  };

  const handleFoundCampaignToJoin = (campaign: Campaign) => {
    handleSelectCampaign(campaign);
  }

  const renderView = () => {
    if (currentView === 'character-selection' && campaignToJoinOrStart) {
      return (
        <CharacterSelectionView
          characters={myCharacters}
          onSelect={(characterId) => {
            const character = characters.find(c => c.id === characterId);
            if (character) {
              handleCharacterSelection(character);
            }
          }}
          onClose={handleReturnToNexus}
        />
      );
    }

    switch (currentView) {
      case Location.StorytellersSpire:
        return <CreateCampaignView onClose={handleReturnToNexus} onCreateCampaign={handleCreateCampaign} />;
      case Location.HallOfEchoes:
        return <HallOfEchoesView onClose={handleReturnToNexus} campaigns={campaigns} onSelectCampaign={handleSelectCampaign} myCharacters={myCharacters} onUpdateCampaign={handleSaveCampaign} />;
      case Location.WanderersTavern:
        return <JoinCampaignView onClose={handleReturnToNexus} campaigns={campaigns} onCampaignFound={handleFoundCampaignToJoin} />;
      case Location.MarketOfAThousandTales:
        return <MarketplaceView onClose={handleReturnToNexus} allCampaigns={campaigns} setCampaigns={setCampaigns} userId={session?.user?.id} />; // Pastikan userId bisa undefined
      case Location.TinkerersWorkshop:
        return <SettingsView
          // Hapus props setter: setApiKeys, setSupabaseUrl, setSupabaseKey
          apiKeys={apiKeys} // Kirim apiKeys yg dibaca dari env
          onClose={handleReturnToNexus}
          currentTheme={theme}
          setTheme={setTheme}
          supabaseUrl={supabaseUrl} // Kirim supabaseUrl yg dibaca dari env
          supabaseKeyConfigured={!!supabaseKey} // Kirim boolean status saja
        />;
      case Location.MirrorOfSouls:
        return <ProfileView onClose={handleReturnToNexus} characters={characters} setCharacters={setCharacters} userId={session?.user?.id} />; // Pastikan userId bisa undefined
      default:
        return null;
    }
  };

  if (playingCampaign && playingCharacter) {
    const campaignPlayers = characters.filter(c => playingCampaign.playerIds.includes(c.id));
    return (
      <div className={theme}>
        <GameScreen
          initialCampaign={playingCampaign}
          character={playingCharacter}
          players={campaignPlayers}
          onExit={handleExitGame}
          updateCharacter={handleUpdateCharacter}
          userId={session?.user?.id ?? 'guest'} // Kasih fallback 'guest' atau handle jika user tidak login
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`w-screen h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}>
        <h1 className="font-cinzel text-5xl animate-pulse">SanKarlA</h1>
        <p className="mt-2">Memuat semesta...</p>
      </div>
    );
  }

  return (
    <div className={`w-screen h-screen bg-black overflow-hidden ${theme}`}>
      {currentView === 'nexus' && <NexusSanctum onLocationClick={handleLocationClick} session={session} />} {/* <-- TAMBAHKAN session={session} DI SINI */}
      {currentView !== 'nexus' && renderView()}
    </div>
  );
};

export default App;