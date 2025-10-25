
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [theme, setTheme] = useLocalStorage<string>('sankaria-hub-theme', 'theme-sanc');
  const [isLoading, setIsLoading] = useState(true);

  // State Otentikasi
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Sumber kebenaran tunggal untuk ID pengguna
  const userId = session?.user?.id;

  // State untuk sesi permainan
  const [playingCampaign, setPlayingCampaign] = useState<Campaign | null>(null);
  const [playingCharacter, setPlayingCharacter] = useState<Character | null>(null);
  
  // Efek Inisialisasi Layanan
  useEffect(() => {
    // Ambil kunci Gemini dari environment variable
    const geminiKeysString = import.meta.env.VITE_GEMINI_API_KEYS || '';
    // Pisahkan string kunci menjadi array, hilangkan spasi, dan filter kunci kosong
    const geminiKeys = geminiKeysString.split(',')
      .map(key => key.trim())
      .filter(key => key);

    if (geminiKeys.length === 0) {
      console.warn("⚠️ VITE_GEMINI_API_KEYS environment variable tidak disetel atau kosong.");
    }
    geminiService.updateKeys(geminiKeys);

    // Ambil kredensial Supabase dari environment variable
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ VITE_SUPABASE_URL atau VITE_SUPABASE_KEY environment variable belum disetel!");
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


  useEffect(() => {
    // Hanya muat data saat ada sesi
    if (!session) {
        setIsLoading(false);
        setCampaigns([]);
        setCharacters([]);
        return;
    }
    
    const loadData = async () => {
        setIsLoading(true);
        try {
            let fetchedCampaigns = await dataService.getCampaigns();
            let fetchedCharacters = await dataService.getCharacters();

            // Seed data jika database kosong
            if (fetchedCampaigns.length === 0) {
                await dataService.saveCampaigns(DEFAULT_CAMPAIGNS);
                fetchedCampaigns = DEFAULT_CAMPAIGNS;
            }
            if (fetchedCharacters.length === 0 && userId) {
                const userCharacters = DEFAULT_CHARACTERS.map(char => ({
                    ...char,
                    id: generateId('char'),
                    ownerId: userId,
                }));
                await dataService.saveCharacters(userCharacters);
                fetchedCharacters = userCharacters;
            }
            
            setCampaigns(fetchedCampaigns);
            setCharacters(fetchedCharacters);
        } catch (error) {
            console.error("Gagal memuat data:", error);
            alert("Gagal memuat data dari Supabase. Periksa koneksi internet Anda atau coba lagi nanti.");
        } finally {
            setIsLoading(false);
        }
    };

    loadData();
  }, [session, userId]);

  const myCharacters = characters.filter(c => c.ownerId === userId);
  const [campaignToJoinOrStart, setCampaignToJoinOrStart] = useState<Campaign | null>(null);
  
  const handleLocationClick = useCallback((location: Location) => {
    setCurrentView(location);
  }, []);

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
            return [...prev, updatedCampaign]; // Fallback jika kampanye baru
        });
    } catch (e) {
        console.error("Gagal menyimpan kampanye:", e);
        alert("Gagal menyimpan progres kampanye. Periksa koneksi Anda.");
    }
  };

  const handleUpdateCharacter = async (updatedCharacter: Character) => {
    try {
        await dataService.saveCharacter(updatedCharacter);
        setCharacters(prev => {
            const index = prev.findIndex(c => c.id === updatedCharacter.id);
            if (index !== -1) {
                const newCharacters = [...prev];
                newCharacters[index] = updatedCharacter;
                return newCharacters;
            }
            return prev;
        });
        if (playingCharacter && playingCharacter.id === updatedCharacter.id) {
            setPlayingCharacter(updatedCharacter);
        }
    } catch(e) {
         console.error("Gagal menyimpan karakter:", e);
         alert("Gagal menyimpan progres karakter. Periksa koneksi Anda.");
    }
  };

  const handleCreateCampaign = async (newCampaign: Campaign) => {
    try {
      const openingScene = await geminiService.generateOpeningScene(newCampaign);
       newCampaign.eventLog.push({
         id: generateId('event'),
         type: 'dm_narration',
         text: openingScene,
         timestamp: new Date().toISOString(),
         turnId: 'turn-0'
       });
    } catch (e) {
      console.error("Gagal menghasilkan adegan pembuka:", e);
      newCampaign.eventLog.push({
         id: generateId('event'),
         type: 'system',
         text: "Gagal menghasilkan adegan pembuka. Silakan mulai petualangan Anda.",
         timestamp: new Date().toISOString(),
         turnId: 'turn-0'
      });
    }
    const savedCampaign = await dataService.saveCampaign(newCampaign);
    setCampaigns(prev => [...prev, savedCampaign]);
    handleReturnToNexus();
  };
  
  const handleSelectCampaign = (campaign: Campaign) => {
    if (!userId) return;

    const playerCharacterInCampaign = characters.find(c => campaign.playerIds.includes(c.id));
    
    if (playerCharacterInCampaign && playerCharacterInCampaign.ownerId === userId) {
        setPlayingCampaign(campaign);
        setPlayingCharacter(playerCharacterInCampaign);
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
    if (!campaignToJoinOrStart || !userId) return;

    const campaign = campaignToJoinOrStart;
    const isPlayerAlreadyInCampaign = campaign.playerIds.includes(character.id);

    let updatedCampaign = { ...campaign };
    if (!isPlayerAlreadyInCampaign) {
      updatedCampaign.playerIds = [...campaign.playerIds, character.id];
      if (updatedCampaign.playerIds.length === 1 && !updatedCampaign.currentPlayerId) {
        updatedCampaign.currentPlayerId = character.id;
      }
      handleSaveCampaign(updatedCampaign);
    }

    setPlayingCampaign(updatedCampaign);
    setPlayingCharacter(character);
    setCampaignToJoinOrStart(null);
    setCurrentView('nexus');
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

  const renderView = () => {
    if (!userId) return null;

    if (currentView === 'character-selection' && campaignToJoinOrStart) {
      return (
        <CharacterSelectionView
          characters={myCharacters}
          onSelect={(characterId) => {
            const character = characters.find(c => c.id === characterId);
            if(character) {
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
        return <MarketplaceView onClose={handleReturnToNexus} allCampaigns={campaigns} setCampaigns={setCampaigns} userId={userId} />;
      case Location.TinkerersWorkshop:
        return <SettingsView 
                    onClose={handleReturnToNexus} 
                    currentTheme={theme} 
                    setTheme={setTheme}
                    userEmail={session?.user?.email}
                    onSignOut={() => dataService.signOut()}
                />;
      case Location.MirrorOfSouls:
        return <ProfileView onClose={handleReturnToNexus} characters={characters} setCharacters={setCharacters} userId={userId} />;
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
  
  // Jika tidak ada sesi, tampilkan login
  if (!session) {
    return <div className={theme}><LoginView /></div>;
  }

  if (playingCampaign && playingCharacter && userId) {
    const campaignPlayers = characters.filter(c => playingCampaign.playerIds.includes(c.id));
    return (
      <div className={theme}>
        <GameScreen 
          initialCampaign={playingCampaign} 
          character={playingCharacter} 
          players={campaignPlayers}
          onExit={handleExitGame}
          updateCharacter={handleUpdateCharacter}
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
