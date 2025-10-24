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
import { generateId } from './utils';
import { DEFAULT_CAMPAIGNS } from './data/defaultCampaigns';
import { DEFAULT_CHARACTERS } from './data/defaultCharacters';

type View = Location | 'nexus' | 'character-selection';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('nexus');
  const [apiKeys, setApiKeys] = useLocalStorage<string[]>('sankarla-apikeys', ['']);
  const [supabaseUrl, setSupabaseUrl] = useLocalStorage<string>('sankarla-supabase-url', '');
  const [supabaseKey, setSupabaseKey] = useLocalStorage<string>('sankarla-supabase-key', '');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [userId, setUserId] = useLocalStorage<string>('sankarla-userId', '');
  const [theme, setTheme] = useLocalStorage<string>('sankarla-theme', 'theme-sanc');
  const [isLoading, setIsLoading] = useState(true);

  // State for the game session
  const [playingCampaign, setPlayingCampaign] = useState<Campaign | null>(null);
  const [playingCharacter, setPlayingCharacter] = useState<Character | null>(null);

  useEffect(() => {
    if (!userId) {
      setUserId(generateId('user'));
    }
  }, [userId, setUserId]);

  useEffect(() => {
    dataService.init(supabaseUrl, supabaseKey);

    const loadData = async () => {
        setIsLoading(true);
        try {
            let fetchedCampaigns = await dataService.getCampaigns();
            let fetchedCharacters = await dataService.getCharacters();

            // Seed data if database/storage is empty
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
            alert("Gagal memuat data. Periksa pengaturan koneksi Supabase Anda atau coba lagi nanti.");
        } finally {
            setIsLoading(false);
        }
    };

    loadData();
  }, [supabaseUrl, supabaseKey, userId]);

  const myCharacters = characters.filter(c => c.ownerId === userId);
  const [campaignToJoinOrStart, setCampaignToJoinOrStart] = useState<Campaign | null>(null);
  
  useEffect(() => {
    geminiService.updateKeys(apiKeys);
  }, [apiKeys]);
  
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
        await dataService.saveCampaign(updatedCampaign);
        setCampaigns(prev => {
            const index = prev.findIndex(c => c.id === updatedCampaign.id);
            if (index !== -1) {
                const newCampaigns = [...prev];
                newCampaigns[index] = updatedCampaign;
                return newCampaigns;
            }
            return [...prev, updatedCampaign]; // Fallback in case it's a new one
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
      console.error("Failed to generate opening scene:", e);
      newCampaign.eventLog.push({
         id: generateId('event'),
         type: 'system',
         text: "Gagal menghasilkan adegan pembuka. Silakan mulai petualangan Anda.",
         timestamp: new Date().toISOString(),
         turnId: 'turn-0'
      });
    }
    await dataService.saveCampaign(newCampaign);
    setCampaigns(prev => [...prev, newCampaign]);
    handleReturnToNexus();
  };
  
  const handleSelectCampaign = (campaign: Campaign) => {
    // API Key check for hosts
    if (!apiKeys.some(k => k.trim() !== '')) {
        alert("Anda harus memasukkan Kunci API Gemini di 'Bengkel Juru Cipta' sebelum memulai atau melanjutkan kampanye.");
        setCurrentView(Location.TinkerersWorkshop);
        return;
    }

    const playerCharacter = characters.find(c => c.ownerId === userId && campaign.playerIds.includes(c.id));

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
                    apiKeys={apiKeys} 
                    setApiKeys={setApiKeys} 
                    onClose={handleReturnToNexus} 
                    currentTheme={theme} 
                    setTheme={setTheme}
                    supabaseUrl={supabaseUrl}
                    setSupabaseUrl={setSupabaseUrl}
                    supabaseKey={supabaseKey}
                    setSupabaseKey={setSupabaseKey}
                />;
      case Location.MirrorOfSouls:
        return <ProfileView onClose={handleReturnToNexus} characters={characters} setCharacters={setCharacters} userId={userId} />;
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
          userId={userId}
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
      {currentView === 'nexus' && <NexusSanctum onLocationClick={handleLocationClick} />}
      {currentView !== 'nexus' && renderView()}
    </div>
  );
};

export default App;