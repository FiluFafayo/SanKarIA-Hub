// App.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from './firebase'; // Pastikan path ini benar
import { LoginButton } from './components/LoginButton'; // Pastikan path ini benar
import { NexusSanctum } from './components/NexusSanctum';
import { CreateCampaignView } from './views/CreateCampaignView';
import { HallOfEchoesView } from './views/HallOfEchoesView';
import { JoinCampaignView } from './views/JoinCampaignView';
import { MarketplaceView } from './views/MarketplaceView';
import { SettingsView } from './views/SettingsView';
import { ProfileView } from './views/ProfileView';
import { CharacterSelectionView } from './views/CharacterSelectionView';
import { GameScreen } from './components/GameScreen';
import { Location, Campaign, Character, Ability, Skill, AbilityScores, InventoryItem, SpellSlot, Spell } from './types'; // Import tipe tambahan
import { useLocalStorage } from './hooks/useLocalStorage';
import { geminiService } from './services/geminiService';
import { dataService } from './services/dataService';
import { generateId, generateJoinCode, getAbilityModifier } from './utils'; // Import util tambahan
import { DEFAULT_CAMPAIGNS } from './data/defaultCampaigns';
// import { DEFAULT_CHARACTERS } from './data/defaultCharacters'; // Pastikan ini dikomentari atau dihapus

type View = Location | 'nexus' | 'character-selection';

// Enum untuk status loading yang lebih detail
enum LoadingStatus {
  Idle, // Belum login / Selesai logout
  AuthChecking, // Cek status Firebase awal
  SupabaseInitializing, // Proses dataService.initialize()
  SupabaseSigningIn, // Proses dataService.signInWithFirebaseToken()
  DataLoading, // Proses load campaigns/characters
  AppReady, // Semua siap, tampilkan app
  AuthFailed, // Gagal init/sign in Supabase atau load data
}

const App: React.FC = () => {
  // --- State Auth & Loading ---
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>(LoadingStatus.AuthChecking);
  const [userId, setUserId] = useState<string>('');
  const [lastError, setLastError] = useState<string | null>(null);
  // ---------------------------

  const [currentView, setCurrentView] = useState<View>('nexus');
  const [theme, setTheme] = useLocalStorage<string>('sankaria-theme', 'theme-sanc');

  // --- Default & Local Storage Values ---
  const defaultApiKeys = [
      'AIzaSyD3uJ5i0E6xw3wPtfjz02k8ES-rMU6nDt8', // Ganti jika defaultmu beda
      'AIzaSyAQOBMFPQ5VrqQH2-TwGvQD9ZMcFz0i7Pc'  // Ganti jika defaultmu beda
  ];
  // !!! WAJIB GANTI DENGAN URL & KEY SUPABASE PROYEK BARU KAMU !!!
  const defaultSupabaseUrl = 'https://apofprrwfcjwtovvqhds.supabase.co';
  const defaultSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwb2ZwcnJ3ZmNqd3RvdnZxaGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzg5ODksImV4cCI6MjA3Njg1NDk4OX0.SrurgXy8wLzYC0xTTYD8F4RggY8kYHARB9Tw9wJNvUs';
  // !!! -------------------------------------------------------- !!!

  const [apiKeys, setApiKeys] = useLocalStorage<string[]>('sankaria-apikeys', defaultApiKeys);
  const [supabaseUrl, setSupabaseUrl] = useLocalStorage<string>('sankaria-supabase-url', defaultSupabaseUrl);
  const [supabaseKey, setSupabaseKey] = useLocalStorage<string>('sankaria-supabase-key', defaultSupabaseKey);
  // ------------------------------------

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);

  // State for the game session
  const [playingCampaign, setPlayingCampaign] = useState<Campaign | null>(null);
  const [playingCharacter, setPlayingCharacter] = useState<Character | null>(null);
  const [campaignToJoinOrStart, setCampaignToJoinOrStart] = useState<Campaign | null>(null);

  // --- Auth & Data Loading Flow ---

  // 1. Listen to Firebase Auth State
  useEffect(() => {
    setLoadingStatus(LoadingStatus.AuthChecking);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Firebase Auth state changed. User:", user ? user.uid : 'null');
      const previousUser = firebaseUser; // Simpan user sebelumnya
      setFirebaseUser(user);
      setUserId(user ? user.uid : '');

      if (!user && previousUser) { // Hanya trigger logout jika sebelumnya ada user
          console.log("User logged out from Firebase. Resetting state...");
          setLoadingStatus(LoadingStatus.Idle);
          setCampaigns([]);
          setCharacters([]);
          setPlayingCampaign(null); // Reset game state
          setPlayingCharacter(null);
          setCurrentView('nexus'); // Kembali ke nexus
          dataService.signOut().catch(err => console.error("Supabase sign out error:", err));
      } else if (user && !previousUser) {
          // User baru login, biarkan effect berikutnya handle init/sign in Supabase
          console.log("New user logged in via Firebase.");
      } else if (!user && !previousUser && loadingStatus === LoadingStatus.AuthChecking) {
          // Kondisi awal saat buka app dan belum login
          console.log("Initial auth check: No user logged in.");
          setLoadingStatus(LoadingStatus.Idle);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Hanya jalan sekali saat mount

  // 2. Initialize Supabase & Sign In with Token when User/Credentials change
  useEffect(() => {
    if (firebaseUser) { // Hanya jalankan jika user ada
        if (supabaseUrl && supabaseKey) {
            setLoadingStatus(LoadingStatus.SupabaseInitializing);
            console.log("Initializing Supabase client & signing in...");
            dataService.initialize(supabaseUrl, supabaseKey)
                .then(async (client) => {
                    if (client && firebaseUser) { // Periksa firebaseUser lagi (bisa jadi logout saat init)
                        console.log("Supabase client initialized. Signing in with token...");
                        setLoadingStatus(LoadingStatus.SupabaseSigningIn);
                        try {
                            const token = await firebaseUser.getIdToken(true);
                            await dataService.signInWithFirebaseToken(token);
                            console.log("Supabase sign in successful.");
                            setLoadingStatus(LoadingStatus.DataLoading); // Lanjut ke load data
                            setLastError(null); // Clear error jika sukses
                        } catch (signInError) {
                            console.error("Supabase sign-in failed:", signInError);
                            setLastError(`Gagal verifikasi sesi Supabase: ${signInError instanceof Error ? signInError.message : signInError}`);
                            setLoadingStatus(LoadingStatus.AuthFailed);
                            await handleLogout(); // Logout paksa jika Supabase gagal
                        }
                    } else if (!client) {
                         setLastError("URL atau Kunci Supabase tidak valid.");
                         setLoadingStatus(LoadingStatus.AuthFailed);
                    }
                })
                .catch((initError) => {
                    console.error("Supabase initialization failed:", initError);
                    setLastError(`Gagal inisialisasi Supabase: ${initError instanceof Error ? initError.message : initError}`);
                    setLoadingStatus(LoadingStatus.AuthFailed);
                     // await handleLogout();
                });
        } else {
             setLastError("Konfigurasi Supabase (URL/Key) belum diatur.");
             setLoadingStatus(LoadingStatus.AuthFailed);
        }
    } else if (!firebaseUser && loadingStatus !== LoadingStatus.AuthChecking && loadingStatus !== LoadingStatus.Idle) {
        // Jika user logout saat proses init/signin Supabase
        console.log("User logged out during Supabase setup. Resetting.");
        setLoadingStatus(LoadingStatus.Idle);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, supabaseUrl, supabaseKey]); // Re-run jika user/url/key berubah

  // 3. Load Data when Supabase is ready (DataLoading state)
  useEffect(() => {
    if (loadingStatus === LoadingStatus.DataLoading && userId) {
      console.log("Loading data for user:", userId);
      const loadData = async () => {
        try {
          // --- Logika Seeding & Fetching ---
          console.log("Fetching campaigns...");
          let fetchedCampaigns = await dataService.getCampaigns();
          console.log("Fetching characters...");
          let fetchedCharacters = await dataService.getCharacters(); // Ambil semua chars dulu
          console.log("Fetched campaigns:", fetchedCampaigns.length, "Fetched characters:", fetchedCharacters.length);

          // Seed campaigns JIKA tabel kosong
          if (fetchedCampaigns.length === 0) {
            console.log("Seeding default campaigns...");
            await dataService.saveCampaigns(DEFAULT_CAMPAIGNS);
            // Ambil lagi setelah seeding
            fetchedCampaigns = await dataService.getCampaigns();
            console.log("Campaigns after seeding:", fetchedCampaigns.length);
          }
          // ---------------------------------

          setCampaigns(fetchedCampaigns);
          // Filter karakter HANYA milik user ini
          const userChars = fetchedCharacters.filter(c => c.ownerId === userId);
          setCharacters(userChars);
          console.log("Data loaded successfully. User Characters:", userChars.length);
          setLoadingStatus(LoadingStatus.AppReady);
          setLastError(null);

        } catch (error) {
          console.error("Gagal memuat data:", error);
          const errorMsg = `Gagal memuat data: ${error instanceof Error ? error.message : String(error)}`;
          // Cek jika errornya karena RLS (meski seharusnya tidak jika SELECT diizinkan)
          if (error instanceof Error && error.message.includes('security policy')) {
              setLastError("Gagal memuat data karena aturan keamanan (RLS). Pastikan policy SELECT sudah benar.");
          } else {
              setLastError(errorMsg);
          }
          setCampaigns([]);
          setCharacters([]);
          setLoadingStatus(LoadingStatus.AuthFailed); // Anggap gagal total jika data load error
        }
      };
      loadData();
    }
  }, [loadingStatus, userId]);

  // --- End Auth & Data Loading Flow ---

  // --- Helper Functions ---
  const handleLogout = async () => {
    console.log("Logout initiated...");
    // Reset state aplikasi segera
    setPlayingCampaign(null);
    setPlayingCharacter(null);
    setCurrentView('nexus');
    setCampaigns([]);
    setCharacters([]);
    setLastError(null);
    setLoadingStatus(LoadingStatus.AuthChecking); // Kembali ke state cek auth

    try {
      await firebaseSignOut(auth);
      // State firebaseUser akan dihandle onAuthStateChanged
      console.log("Firebase sign out successful.");
    } catch (error) {
      console.error("Firebase logout error:", error);
      setLoadingStatus(LoadingStatus.Idle); // Jika logout Firebase gagal, fallback ke Idle
    }
  };

  const myCharacters = characters; // Langsung pakai state, sudah difilter

  useEffect(() => {
    geminiService.updateKeys(apiKeys);
  }, [apiKeys]);

  const handleLocationClick = useCallback((location: Location) => {
    if (loadingStatus !== LoadingStatus.AppReady || !firebaseUser) {
        alert("Harap tunggu hingga aplikasi siap atau login terlebih dahulu.");
        return;
    }
    if (location === Location.StorytellersSpire && !apiKeys.some(k => k.trim() !== '')) {
        alert("Anda harus memasukkan Kunci API Gemini di 'Bengkel Juru Cipta' sebelum dapat membuat kampanye baru.");
        setCurrentView(Location.TinkerersWorkshop);
        return;
    }
    setCurrentView(location);
  }, [loadingStatus, firebaseUser, apiKeys]);

  const handleReturnToNexus = useCallback(() => {
    setCurrentView('nexus');
    setCampaignToJoinOrStart(null);
  }, []);

  const handleSaveCampaign = async (updatedCampaign: Campaign) => {
    if (loadingStatus !== LoadingStatus.AppReady) return; // Jangan save jika app belum siap
    try {
        const savedData = await dataService.saveCampaign(updatedCampaign);
        setCampaigns(prev => {
            const index = prev.findIndex(c => c.id === savedData.id);
            if (index !== -1) {
                const newCampaigns = [...prev];
                newCampaigns[index] = savedData;
                return newCampaigns;
            }
            // Jika ini campaign baru yg belum ada di state (misal hasil copy)
            return [...prev, savedData];
        });
    } catch (e) {
        console.error("Gagal menyimpan kampanye:", e);
        alert(`Gagal menyimpan progres kampanye: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleUpdateCharacter = async (updatedCharacter: Character) => {
     if (loadingStatus !== LoadingStatus.AppReady) return;
    try {
        // saveCharacter akan otomatis handle ownerId via RLS/default
        const savedChar = await dataService.saveCharacter(updatedCharacter);

        setCharacters(prev => {
            const index = prev.findIndex(c => c.id === savedChar.id);
            if (index !== -1) {
                const newCharacters = [...prev];
                newCharacters[index] = savedChar;
                return newCharacters;
            }
            return prev; // Seharusnya tidak terjadi jika update
        });
        if (playingCharacter && playingCharacter.id === savedChar.id) {
            setPlayingCharacter(savedChar);
        }
    } catch(e) {
       console.error("Gagal menyimpan karakter:", e);
       alert(`Gagal menyimpan progres karakter: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleCreateCampaign = async (campaignCoreData: Omit<Campaign, 'id' | 'joinCode' | 'playerIds' | 'currentPlayerId' | 'eventLog' | 'turnId' | 'monsters' | 'initiativeOrder' | 'choices' | 'quests' | 'npcs' | 'currentTime' | 'currentWeather' | 'worldEventCounter' | 'mapImageUrl' | 'mapMarkers' | 'currentPlayerLocation' | 'image' | 'gameState' | 'isPublished' | 'longTermMemory'> & { description: string } ) => {
    if (loadingStatus !== LoadingStatus.AppReady) return;

    // Buat objek campaign lengkap di sini
    const newCampaign: Campaign = {
        ...campaignCoreData, // title, mainGenre, subGenre, duration, isNSFW, maxPlayers, theme, dmPersonality, dmNarrationStyle, responseLength
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
        longTermMemory: `Premise: ${campaignCoreData.description}`,
        isPublished: false,
    };

    setLoadingStatus(LoadingStatus.DataLoading); // Tampilkan loading global
    setLastError(null);

    try {
        console.log("Generating opening scene...");
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
      // Tetap lanjutkan save campaign meskipun scene gagal
    }

    try {
        console.log("Saving new campaign to Supabase...");
        const savedCampaign = await dataService.saveCampaign(newCampaign);
        console.log("Campaign saved:", savedCampaign.id);
        setCampaigns(prev => [...prev, savedCampaign]);
        handleReturnToNexus(); // Kembali ke Nexus setelah berhasil
        setLoadingStatus(LoadingStatus.AppReady); // Kembali ke ready
    } catch (error) {
        console.error("Gagal menyimpan kampanye baru:", error);
        setLastError(`Gagal menyimpan kampanye baru: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLoadingStatus(LoadingStatus.AuthFailed); // Gagal -> state error
    }
  };

  const handleSelectCampaign = (campaign: Campaign) => {
    if (loadingStatus !== LoadingStatus.AppReady || !firebaseUser) return;
    if (!apiKeys.some(k => k.trim() !== '')) {
        alert("Anda harus memasukkan Kunci API Gemini di 'Bengkel Juru Cipta' sebelum memulai atau melanjutkan kampanye.");
        setCurrentView(Location.TinkerersWorkshop);
        return;
    }

    // Cari karakter milik user ini yang ada di campaign
    const playerCharacter = myCharacters.find(c => campaign.playerIds.includes(c.id));

    if (playerCharacter) {
        // User sudah join, langsung masuk
        setPlayingCampaign(campaign);
        setPlayingCharacter(playerCharacter);
        setCurrentView('nexus'); // Pindah ke nexus dulu, nanti dirender game screen
    } else {
      // User belum join, cek slot
      if (campaign.playerIds.length >= campaign.maxPlayers) {
        alert("Maaf, kampanye ini sudah penuh.");
        return;
      }
      // Arahkan ke pemilihan karakter
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
      // Tambahkan pemain ke campaign
      updatedCampaign.playerIds = [...campaign.playerIds, character.id];
      // Jika ini pemain pertama, jadikan dia giliran pertama
      if (updatedCampaign.playerIds.length === 1 && !updatedCampaign.currentPlayerId) {
        updatedCampaign.currentPlayerId = character.id;
      }
      // Simpan perubahan ke DB
      handleSaveCampaign(updatedCampaign).then(() => {
          // Setelah save berhasil, set state untuk masuk game
          setPlayingCampaign(updatedCampaign);
          setPlayingCharacter(character);
          setCampaignToJoinOrStart(null);
          setCurrentView('nexus');
      }).catch(err => {
          alert(`Gagal bergabung ke campaign: ${err.message}`);
      });
    } else {
      // Seharusnya tidak terjadi jika logic handleSelectCampaign benar
      // Tapi jika terjadi, anggap saja user mau masuk pakai char itu
      setPlayingCampaign(updatedCampaign);
      setPlayingCharacter(character);
      setCampaignToJoinOrStart(null);
      setCurrentView('nexus');
    }
  };

  const handleExitGame = (finalCampaignState: Campaign) => {
    // Simpan state terakhir sebelum keluar
    handleSaveCampaign(finalCampaignState).then(() => {
        setPlayingCampaign(null);
        setPlayingCharacter(null);
        setCurrentView('nexus');
    }); // Tidak perlu await jika tidak harus menunggu save selesai
  };

  const handleFoundCampaignToJoin = (campaign: Campaign) => {
      // Diterima dari JoinCampaignView, langsung arahkan ke select
      handleSelectCampaign(campaign);
  }

  // --- Fungsi createClassLoadout ---
  // (PENTING: Implementasi lengkapnya ada di sini)
  const createClassLoadout = (charClass: string, finalScores: AbilityScores): {
      maxHp: number; hitDice: string; proficientSavingThrows: Ability[];
      proficientSkills: Skill[]; armorClass: number; inventory: InventoryItem[];
      spellSlots: SpellSlot[]; knownSpells: Spell[];
  } => {
      const conModifier = getAbilityModifier(finalScores.constitution);
      const dexModifier = getAbilityModifier(finalScores.dexterity);
      const wisModifier = getAbilityModifier(finalScores.wisdom);
      const intModifier = getAbilityModifier(finalScores.intelligence);
      const strModifier = getAbilityModifier(finalScores.strength); // Tambah jika perlu

      // Ambil 2-4 skill proficiency berdasarkan kelas
      // Ini contoh sederhana, bisa dibuat lebih kompleks (misal, dari background)
      const getClassSkills = (cls: string): Skill[] => {
          switch(cls) {
              case 'Fighter': return [Skill.Athletics, Skill.Perception];
              case 'Ranger': return [Skill.Survival, Skill.Stealth, Skill.Investigation];
              case 'Barbarian': return [Skill.Athletics, Skill.Intimidation];
              case 'Cleric': return [Skill.Insight, Skill.Religion];
              case 'Wizard': return [Skill.Arcana, Skill.History];
              case 'Rogue': return [Skill.Acrobatics, Skill.Deception, Skill.SleightOfHand, Skill.Stealth];
              default: return [Skill.Athletics, Skill.Survival];
          }
      }

      let loadout = {
          maxHp: 0, hitDice: '1d8', proficientSavingThrows: [] as Ability[],
          proficientSkills: getClassSkills(charClass), armorClass: 10 + dexModifier, // Default AC
          inventory: [] as InventoryItem[], spellSlots: [] as SpellSlot[], knownSpells: [] as Spell[]
      };

      switch(charClass) {
          case 'Fighter':
              loadout.maxHp = 10 + conModifier; loadout.hitDice = '1d10';
              loadout.proficientSavingThrows = [Ability.Strength, Ability.Constitution];
              loadout.armorClass = 18; // Chain mail + Shield
              loadout.inventory = [
                  { name: 'Chain Mail', quantity: 1, type: 'armor', isEquipped: true },
                  { name: 'Longsword', quantity: 1, type: 'weapon', toHitBonus: strModifier + 2, damageDice: `1d8+${strModifier}`, isEquipped: true }, // Proficiency bonus level 1 = +2
                  { name: 'Shield', quantity: 1, type: 'armor', isEquipped: true },
                  { name: 'Light Crossbow', quantity: 1, type: 'weapon', toHitBonus: dexModifier + 2, damageDice: `1d8+${dexModifier}` },
                  { name: 'Bolts', quantity: 20, type: 'other' },
                  { name: "Explorer's Pack", quantity: 1, type: 'other'}
              ];
              break;
          case 'Ranger':
              loadout.maxHp = 10 + conModifier; loadout.hitDice = '1d10';
              loadout.proficientSavingThrows = [Ability.Strength, Ability.Dexterity];
              loadout.armorClass = 14; // Leather armor + Dex (max +2 if medium?) -> Simplified: Leather 11 + Dex
              loadout.inventory = [
                  { name: 'Leather Armor', quantity: 1, type: 'armor', isEquipped: true },
                  { name: 'Longbow', quantity: 1, type: 'weapon', toHitBonus: dexModifier + 2, damageDice: `1d8+${dexModifier}`, isEquipped: true },
                  { name: 'Arrows', quantity: 20, type: 'other' },
                  { name: 'Shortsword', quantity: 2, type: 'weapon', toHitBonus: dexModifier + 2, damageDice: `1d6+${dexModifier}` }, // Finesse weapon
                  { name: "Explorer's Pack", quantity: 1, type: 'other'}
              ];
              break;
          case 'Barbarian':
              loadout.maxHp = 12 + conModifier; loadout.hitDice = '1d12';
              loadout.proficientSavingThrows = [Ability.Strength, Ability.Constitution];
              loadout.armorClass = 10 + dexModifier + conModifier; // Unarmored Defense
              loadout.inventory = [
                  { name: 'Greataxe', quantity: 1, type: 'weapon', toHitBonus: strModifier + 2, damageDice: `1d12+${strModifier}`, isEquipped: true },
                  { name: 'Javelin', quantity: 4, type: 'weapon', toHitBonus: strModifier + 2, damageDice: `1d6+${strModifier}` },
                  { name: "Explorer's Pack", quantity: 1, type: 'other'}
              ];
              break;
          case 'Cleric':
              loadout.maxHp = 8 + conModifier; loadout.hitDice = '1d8';
              loadout.proficientSavingThrows = [Ability.Wisdom, Ability.Charisma];
              loadout.armorClass = 18; // Scale mail + Shield
              loadout.inventory = [
                  { name: 'Scale Mail', quantity: 1, type: 'armor', isEquipped: true },
                  { name: 'Warhammer', quantity: 1, type: 'weapon', toHitBonus: strModifier + 2, damageDice: `1d8+${strModifier}`, isEquipped: true }, // Assuming Str based
                  { name: 'Shield', quantity: 1, type: 'armor', isEquipped: true },
                  { name: 'Holy Symbol', quantity: 1, type: 'other' },
                  { name: "Priest's Pack", quantity: 1, type: 'other'}
              ];
              loadout.spellSlots = [{ level: 1, max: 2, used: 0 }]; // Simplified, could depend on subclass
              loadout.knownSpells = [ // Example spells
                  { name: 'Sacred Flame', level: 0, description: 'Cantrip: Radiant damage.', target: 'creature', effect: { type: 'damage', dice: '1d8'}},
                  { name: 'Guidance', level: 0, description: 'Cantrip: +1d4 to ability check.', target: 'creature', effect: { type: 'heal', dice: '0'}},
                  { name: 'Cure Wounds', level: 1, description: 'Heal target.', target: 'creature', effect: { type: 'heal', dice: `1d8+${wisModifier}`}},
                  { name: 'Bless', level: 1, description: '+1d4 attack/saves.', target: 'creature', effect: { type: 'heal', dice: '0'}}
              ];
              break;
           case 'Wizard':
              loadout.maxHp = 6 + conModifier; loadout.hitDice = '1d6';
              loadout.proficientSavingThrows = [Ability.Intelligence, Ability.Wisdom];
              loadout.armorClass = 10 + dexModifier; // No armor proficiency
              loadout.inventory = [
                  { name: 'Quarterstaff', quantity: 1, type: 'weapon', toHitBonus: strModifier + 2, damageDice: `1d6+${strModifier}`, isEquipped: true },
                  { name: 'Spellbook', quantity: 1, type: 'other' },
                  { name: "Scholar's Pack", quantity: 1, type: 'other'}
              ];
              loadout.spellSlots = [{ level: 1, max: 2, used: 0 }];
              loadout.knownSpells = [ // Example spells
                  { name: 'Fire Bolt', level: 0, description: 'Cantrip: Fire damage.', target: 'creature', effect: { type: 'damage', dice: '1d10'}},
                  { name: 'Mage Hand', level: 0, description: 'Cantrip: Minor telekinesis.', target: 'point', effect: { type: 'heal', dice: '0'}},
                  { name: 'Magic Missile', level: 1, description: 'Auto-hit force damage.', target: 'creature', effect: { type: 'damage', dice: '3d4+3'}}, // 3 darts * (1d4+1)
                  { name: 'Shield', level: 1, description: 'Reaction: +5 AC.', target: 'self', effect: { type: 'heal', dice: '0'}}
              ];
              break;
          case 'Rogue':
              loadout.maxHp = 8 + conModifier; loadout.hitDice = '1d8';
              loadout.proficientSavingThrows = [Ability.Dexterity, Ability.Intelligence];
              loadout.armorClass = 11 + dexModifier; // Leather armor
              loadout.inventory = [
                  { name: 'Leather Armor', quantity: 1, type: 'armor', isEquipped: true },
                  { name: 'Rapier', quantity: 1, type: 'weapon', toHitBonus: dexModifier + 2, damageDice: `1d8+${dexModifier}`, isEquipped: true }, // Finesse
                  { name: 'Shortbow', quantity: 1, type: 'weapon', toHitBonus: dexModifier + 2, damageDice: `1d6+${dexModifier}` },
                  { name: 'Arrows', quantity: 20, type: 'other' },
                  { name: 'Dagger', quantity: 2, type: 'weapon', toHitBonus: dexModifier + 2, damageDice: `1d4+${dexModifier}` },
                  { name: "Thieves' Tools", quantity: 1, type: 'tool'},
                  { name: "Burglar's Pack", quantity: 1, type: 'other'}
              ];
              break;
          default: // Fallback, maybe treat as Fighter
              loadout.maxHp = 10 + conModifier; loadout.hitDice = '1d10';
              loadout.proficientSavingThrows = [Ability.Strength, Ability.Constitution];
              loadout.armorClass = 18;
              loadout.inventory = [ { name: 'Longsword', quantity: 1, type: 'weapon', toHitBonus: strModifier + 2, damageDice: `1d8+${strModifier}`} ];
              break;
      }
      return loadout;
  }
  // -----------------------------------------------------

  // --- Render Views ---
  const renderView = () => {
    if (loadingStatus !== LoadingStatus.AppReady) return null; // Safety check

    if (currentView === 'character-selection' && campaignToJoinOrStart) {
      return (
        <CharacterSelectionView
          characters={myCharacters}
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
        // Pass the CREATION function, not the full save handler
        // CreateCampaignView might need adjustment on how it calls this
        // Assuming CreateCampaignView calls onCreateCampaign with the core data needed
        // @ts-ignore - Adjust CreateCampaignView prop type if needed
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
        // Pass createClassLoadout function to ProfileView/ProfileModal
        return <ProfileView onClose={handleReturnToNexus} characters={myCharacters} setCharacters={setCharacters} userId={userId} createClassLoadout={createClassLoadout} />;
      default:
        return null;
    }
  };

  // --- Main Render Logic ---

  // Tampilkan loading berdasarkan status
  if (loadingStatus !== LoadingStatus.Idle && loadingStatus !== LoadingStatus.AppReady && loadingStatus !== LoadingStatus.AuthFailed) {
      let loadingMessage = "Memuat...";
      if (loadingStatus === LoadingStatus.AuthChecking) loadingMessage = "Memverifikasi sesi...";
      if (loadingStatus === LoadingStatus.SupabaseInitializing) loadingMessage = "Menginisialisasi koneksi...";
      if (loadingStatus === LoadingStatus.SupabaseSigningIn) loadingMessage = "Menyiapkan sesi Supabase...";
      if (loadingStatus === LoadingStatus.DataLoading) loadingMessage = "Memuat semesta...";
      return (
        <div className={`w-screen h-screen bg-bg-primary flex items-center justify-center text-text-primary ${theme}`}>
          {loadingMessage}
        </div>
      );
  }

  // Tampilkan layar Login jika Idle (belum login)
  if (loadingStatus === LoadingStatus.Idle && !firebaseUser) {
    return (
      <div className={`w-screen h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}>
        <h1 className="font-cinzel text-5xl mb-4">SanKarIA</h1>
        <p className="mb-8">Silakan login untuk memulai petualangan.</p>
        <LoginButton user={null} onLogout={handleLogout} />
        {lastError && <p className="mt-4 text-red-400">{lastError}</p>}
      </div>
    );
  }

  // Tampilkan pesan error jika AuthFailed
  if (loadingStatus === LoadingStatus.AuthFailed) {
       return (
          <div className={`w-screen h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary ${theme}`}>
            <h1 className="font-cinzel text-5xl mb-4 text-red-500">Error</h1>
            <p className="mb-8 text-center max-w-md">{lastError || "Terjadi kesalahan saat autentikasi atau memuat data."}</p>
            <button
                onClick={handleLogout} // Tombol logout untuk coba lagi
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
             >
                Logout & Coba Lagi
             </button>
          </div>
       );
  }

  // Jika status AppReady, tampilkan game atau nexus
  if (loadingStatus === LoadingStatus.AppReady && firebaseUser) {
      // Jika sedang dalam game
      if (playingCampaign && playingCharacter) {
        // Cari data SEMUA pemain dalam campaign ini (bisa dari state campaigns jika lengkap, atau fetch lagi)
        // Untuk sekarang, kita filter dari state characters global (asumsi semua char user ada di situ)
        const campaignPlayers = characters.filter(c => playingCampaign.playerIds.includes(c.id));
        return (
          <div className={theme}>
            <LoginButton user={firebaseUser} onLogout={handleLogout} />
            <GameScreen
              initialCampaign={playingCampaign}
              character={playingCharacter}
              players={campaignPlayers} // Kirim data pemain yg relevan
              onExit={handleExitGame}
              updateCharacter={handleUpdateCharacter}
              userId={userId} // userId tetap dari user yg login
            />
          </div>
        );
      }

      // Render aplikasi utama (Nexus atau View lain)
      return (
        <div className={`w-screen h-screen bg-black overflow-hidden ${theme}`}>
          <LoginButton user={firebaseUser} onLogout={handleLogout} />
          {currentView === 'nexus' && <NexusSanctum onLocationClick={handleLocationClick} />}
          {currentView !== 'nexus' && renderView()}
        </div>
      );
  }

  // Fallback jika state tidak terduga (seharusnya tidak terjadi)
  console.warn("Reached unexpected render state:", loadingStatus, firebaseUser);
  return (
      <div className={`w-screen h-screen bg-bg-primary flex items-center justify-center text-text-primary ${theme}`}>
          Status aplikasi tidak diketahui... Coba refresh.
      </div>
  );
};

export default App;