// REFAKTOR G-4/G-3: Store ini sekarang mengelola SEMUA state UI global, 
// Navigasi, Form, DAN Sesi Game Runtime.

import { create } from 'zustand';
import { 
    Character, MapMarker, Campaign, CampaignState, Location
} from '../types';
// (Impor yang tidak perlu dihapus)
import { dataService } from '../services/dataService';
import { useDataStore } from './dataStore';

type View = Location | 'nexus' | 'character-selection';

// =================================================================
// Tipe State & Aksi
// =================================================================

// --- Slice 1: Navigation ---
interface NavigationState {
    currentView: View;
    campaignToJoinOrStart: Campaign | null; // Untuk alur join
}
const initialNavigationState: NavigationState = {
    currentView: 'nexus',
    campaignToJoinOrStart: null,
};
interface NavigationActions {
    navigateTo: (view: Location) => void;
    returnToNexus: () => void;
    startJoinFlow: (campaign: Campaign) => void;
}

// --- Slice 2: Game Runtime (G-4-R1) ---
interface RuntimeState {
    playingCampaign: CampaignState | null;
    playingCharacter: Character | null;
    isGameLoading: boolean;
}
const initialRuntimeState: RuntimeState = {
    playingCampaign: null,
    playingCharacter: null,
    isGameLoading: false,
};
interface RuntimeActions {
    loadGameSession: (campaign: Campaign, character: Character) => Promise<void>;
    exitGameSession: () => void;
    // Aksi internal yang dipanggil oleh GameScreen/Hooks
    _setRuntimeCampaignState: (campaignState: CampaignState) => void;
    _setRuntimeCharacterState: (character: Character) => void;
}


// --- Slice 3: Character Creation (DIHAPUS) ---
// State ini sekarang dikelola secara lokal oleh ProfileModal.tsx
// untuk menghindari konflik arsitektur.

// --- Slice 4: Campaign Creation ---
// (Tidak berubah dari G-3)
interface CampaignCreationPillars {
    premise: string;
    keyElements: string;
    endGoal: string;
}
interface CampaignFramework {
    proposedTitle: string;
    proposedMainQuest: { title: string, description: string };
    proposedMainNPCs: { name: string, description: string }[];
    potentialSideQuests: { title: string, description: string }[];
    description: string;
}
// (Poin 7) Slice state baru untuk UI Level Up
interface LevelUpState {
    characterToLevel: Character | null; // Karakter yang sedang naik level
}
const initialLevelUpState: LevelUpState = {
    characterToLevel: null,
};
interface LevelUpActions {
    triggerLevelUp: (character: Character) => void;
    closeLevelUp: () => void;
}


interface CampaignCreationState {
    step: number; // 0 = tidak aktif
    pillars: CampaignCreationPillars;
    framework: CampaignFramework | null;
    mapData: { imageUrl: string; markers: MapMarker[], startLocationId: string } | null;
    // campaignData dihapus (Poin 10)
}
const initialCampaignState: CampaignCreationState = {
    step: 0,
    pillars: { premise: '', keyElements: '', endGoal: '' },
    framework: null,
    mapData: null,
    // campaignData dihapus dan akan di-hardcode (Poin 10)
};
interface CampaignCreationActions {
    setCampaignStep: (step: number) => void;
    setPillars: (pillars: CampaignCreationPillars) => void;
    setFramework: (framework: CampaignFramework | null) => void;
    setMapData: (mapData: CampaignCreationState['mapData']) => void;
    // setCampaignData dihapus (Poin 10)
    resetCampaignCreation: () => void;
}

// --- Gabungan Store ---
type AppStore = {
    navigation: NavigationState;
    runtime: RuntimeState; // G-4-R1
    levelUp: LevelUpState; // (Poin 7)
    // characterCreation DIHAPUS
    campaignCreation: CampaignCreationState;
    actions: NavigationActions & RuntimeActions & LevelUpActions & /* CharacterCreationActions DIHAPUS */ CampaignCreationActions;
}

// =================================================================
// STORE DEFINITION
// =================================================================
export const useAppStore = create<AppStore>((set, get) => ({
    // === STATE ===
    navigation: initialNavigationState,
    runtime: initialRuntimeState,
    levelUp: initialLevelUpState, // (Poin 7)
    // characterCreation DIHAPUS
    campaignCreation: initialCampaignState,

    // === ACTIONS ===
    actions: {
        // --- Navigation Actions ---
        navigateTo: (view) => {
            // if (view !== Location.MirrorOfSouls) get().actions.resetCharacterCreation(); // DIHAPUS
            if (view !== Location.StorytellersSpire) get().actions.resetCampaignCreation();
            // if (view === Location.MirrorOfSouls) { // DIHAPUS
            //     set(state => ({ characterCreation: { ...state.characterCreation, step: 1 } }));
            // }
            if (view === Location.StorytellersSpire) {
                set(state => ({ campaignCreation: { ...state.campaignCreation, step: 1 } }));
            }
            set(state => ({ navigation: { ...state.navigation, currentView: view } }));
        },
        returnToNexus: () => {
            // get().actions.resetCharacterCreation(); // DIHAPUS
            get().actions.resetCampaignCreation();
            set({ navigation: initialNavigationState });
        },
        startJoinFlow: (campaign) => set(state => ({
            navigation: { ...state.navigation, currentView: 'character-selection', campaignToJoinOrStart: campaign }
        })),

        // --- Runtime Actions (G-4-R1) ---
        loadGameSession: async (campaign, character) => {
            set(state => ({ runtime: { ...state.runtime, isGameLoading: true } }));
            try {
                const { eventLog, monsters, players } = await dataService.loadCampaignRuntimeData(campaign.id, campaign.playerIds);
                
                const campaignState: CampaignState = {
                    ...campaign, eventLog, monsters, players,
                    thinkingState: 'idle', activeRollRequest: null,
                    choices: [], turnId: null,
                };
                
                set({ 
                    runtime: { 
                        playingCampaign: campaignState, 
                        playingCharacter: character, 
                        isGameLoading: false 
                    }
                });
            } catch (e) {
                console.error("Gagal memuat data runtime campaign:", e);
                alert("Gagal memuat sesi permainan. Coba lagi.");
                set(state => ({ runtime: { ...state.runtime, isGameLoading: false } }));
            }
        },
        exitGameSession: () => {
            const { playingCampaign, playingCharacter } = get().runtime;
            
            if (playingCampaign) {
                // Simpan SSoT Campaign
                useDataStore.getState().actions.saveCampaign(playingCampaign);
            }
            if (playingCharacter) {
                // Simpan SSoT Karakter (ambil state terbaru dari dalam campaign)
                const finalCharacterState = playingCampaign?.players.find(p => p.id === playingCharacter.id);
                if (finalCharacterState) {
                    useDataStore.getState().actions.updateCharacter(finalCharacterState);
                }
            }
            
            // Reset state runtime
            set({ runtime: initialRuntimeState, navigation: initialNavigationState });
        },
        _setRuntimeCampaignState: (campaignState) => {
            set(state => ({ runtime: { ...state.runtime, playingCampaign: campaignState } }));
        },
        _setRuntimeCharacterState: (character) => {
            set(state => ({ runtime: { ...state.runtime, playingCharacter: character } }));
        },

        // --- Level Up Actions (Poin 7) ---
        triggerLevelUp: (character) => {
            // Cek untuk mencegah modal muncul berulang kali jika state belum di-save
            if (get().levelUp.characterToLevel) return;
            console.log(`[LevelUp] Memicu modal Level Up untuk ${character.name}`);
            set(state => ({ levelUp: { characterToLevel: character } }));
        },
        closeLevelUp: () => {
            set({ levelUp: initialLevelUpState });
        },

        // --- Character Actions (DIHAPUS) ---
        // (Seluruh blok logika dari setCharacterStep hingga finalizeCharacter dihapus)

        // --- Campaign Actions ---
        setCampaignStep: (step) => set(state => ({ campaignCreation: { ...state.campaignCreation, step } })),
        setPillars: (pillars) => set(state => ({ campaignCreation: { ...state.campaignCreation, pillars } })),
        setFramework: (framework) => set(state => ({ campaignCreation: { ...state.campaignCreation, framework } })),
        setMapData: (mapData) => set(state => ({ campaignCreation: { ...state.campaignCreation, mapData } })),
        // setCampaignData dihapus (Poin 10)
        resetCampaignCreation: () => set({ campaignCreation: { ...initialCampaignState, step: 0 } }),
    }
}));