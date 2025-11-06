// FASE 0: Rombak Total.
// appStore HANYA mengelola Navigasi Global dan state UI global (LevelUp).
// State Runtime (game session) dipindah ke gameStore.ts.
// State Form (campaign creation) dipindah ke state lokal React di CreateCampaignView.tsx.

import { create } from 'zustand';
import { 
    Character, MapMarker, Campaign, CampaignState, Location
} from '../types';
// (Impor yang tidak perlu dihapus)
// import { dataService } from '../services/dataService'; // Tidak diperlukan di sini
// import { useDataStore } from './dataStore'; // Tidak diperlukan di sini

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

// --- Slice 2: Game Runtime (DIHAPUS) ---
// (Dipindah ke store/gameStore.ts)

// --- Slice 3: Character Creation (DIHAPUS) ---

// --- Slice 4: Campaign Creation (DIHAPUS) ---
// (Dipindah ke state lokal di CreateCampaignView.tsx)

// --- Slice 5: Level Up ---
// (Tetap di sini karena ini adalah UI Modal global)
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


// --- Gabungan Store ---
type AppStore = {
    navigation: NavigationState;
    levelUp: LevelUpState; // (Poin 7)
    actions: NavigationActions & LevelUpActions;
}

// =================================================================
// STORE DEFINITION
// =================================================================
export const useAppStore = create<AppStore>((set, get) => ({
    // === STATE ===
    navigation: initialNavigationState,
    levelUp: initialLevelUpState, // (Poin 7)

    // === ACTIONS ===
    actions: {
        // --- Navigation Actions ---
        navigateTo: (view) => {
            // Aksi reset form (seperti resetCampaignCreation) sekarang
            // ditangani oleh komponen (CreateCampaignView) saat unmount
            // atau saat `onClose` dipanggil.
            
            // if (view !== Location.StorytellersSpire) get().actions.resetCampaignCreation(); // DIHAPUS
            // if (view === Location.StorytellersSpire) { // DIHAPUS
            //     set(state => ({ campaignCreation: { ...state.campaignCreation, step: 1 } }));
            // }
            
            set(state => ({ navigation: { ...state.navigation, currentView: view } }));
        },
        returnToNexus: () => {
            set({ navigation: initialNavigationState });
        },
        startJoinFlow: (campaign) => set(state => ({
            navigation: { ...state.navigation, currentView: 'character-selection', campaignToJoinOrStart: campaign }
        })),

        // --- Runtime Actions (DIHAPUS) ---

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

        // --- Campaign Actions (DIHAPUS) ---
    }
}));