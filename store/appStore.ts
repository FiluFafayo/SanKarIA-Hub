// FASE 0: Rombak Total.
// appStore HANYA mengelola Navigasi Global dan state UI global (LevelUp).
// State Runtime (game session) dipindah ke gameStore.ts.
// State Form (campaign creation) dipindah ke state lokal React di CreateCampaignView.tsx.

import { create } from 'zustand';
// (Impor RawCharacterData)
import {
    Character, MapMarker, Campaign, CampaignState, Location,
    RawCharacterData
} from '../types';
// (Impor yang tidak perlu dihapus)
// import { dataService } from '../services/dataService'; // Tidak diperlukan di sini
// import { useDataStore } from './dataStore'; // Tidak diperlukan di sini

type View = Location | 'nexus' | 'character-selection' | 'wireframe-preview';

// =================================================================
// Tipe State & Aksi
// =================================================================

// --- Slice 1: Navigation ---
interface NavigationState {
    currentView: View;
    campaignToJoinOrStart: Campaign | null; // Untuk alur join
    templateToPreFill: RawCharacterData | null; // FASE 2: Untuk alur template
}
const initialNavigationState: NavigationState = {
    currentView: 'nexus',
    campaignToJoinOrStart: null,
    templateToPreFill: null, // FASE 2
};
interface NavigationActions {
    navigateTo: (view: View) => void;
    returnToNexus: () => void;
    startJoinFlow: (campaign: Campaign) => void;
    startTemplateFlow: (template: RawCharacterData) => void; // FASE 2
    clearTemplateToPreFill: () => void; // FASE 2
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

// --- Slice 6: Notifications (Toaster) ---
export interface AppNotification {
    id: string;
    message: string;
    type?: 'info' | 'success' | 'error' | 'warning';
    durationMs?: number; // Durasi khusus untuk auto-dismiss
    count?: number; // Penggabungan duplikat
}
interface NotificationState {
    notifications: AppNotification[];
}
const initialNotificationState: NotificationState = {
    notifications: [],
};
interface NotificationActions {
    pushNotification: (n: Omit<AppNotification, 'id'>) => void;
    clearNotification: (id: string) => void;
}


// --- Gabungan Store ---
type AppStore = {
    navigation: NavigationState;
    levelUp: LevelUpState; // (Poin 7)
    notifications: NotificationState;
    actions: NavigationActions & LevelUpActions & NotificationActions;
}

// =================================================================
// STORE DEFINITION
// =================================================================
export const useAppStore = create<AppStore>((set, get) => ({
    // === STATE ===
    navigation: initialNavigationState,
    levelUp: initialLevelUpState, // (Poin 7)
    notifications: initialNotificationState,

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

        // FASE 2: Aksi alur template
        startTemplateFlow: (template) => set(state => ({
            navigation: {
                ...state.navigation,
                currentView: Location.MirrorOfSouls, // Arahkan ke Cermin Jiwa
                templateToPreFill: template,
                // campaignToJoinOrStart tetap ada jika alur ini dimulai dari CharacterSelectionView
            }
        })),
        clearTemplateToPreFill: () => set(state => ({
            navigation: {
                ...state.navigation,
                templateToPreFill: null
            }
        })),

        // --- Runtime Actions (DIHAPUS) ---

        // --- Level Up Actions (Poin 7) ---
        triggerLevelUp: (character) => {
            // Cek untuk mencegah modal muncul berulang kali jika state belum di-save
            if (get().levelUp.characterToLevel) return;
            // FASE 5: Hapus console.log
            set(state => ({ levelUp: { characterToLevel: character } }));
        },
        closeLevelUp: () => {
            set({ levelUp: initialLevelUpState });
        },

        // --- Notification Actions ---
        pushNotification: (n) => {
            const defaultDuration = 3000;
            const duration = n.durationMs ?? defaultDuration;
            let usedId = '';

            set((state) => {
                const list = state.notifications.notifications;
                const dupIndex = list.findIndex((x) => x.message === n.message && x.type === n.type);
                let next = [...list];

                if (dupIndex >= 0) {
                    // Gabungkan duplikat: tingkatkan count dan reset timer
                    const existing = next[dupIndex];
                    const updated = { ...existing, count: (existing.count ?? 1) + 1 };
                    next[dupIndex] = updated;
                    usedId = existing.id;
                } else {
                    // Batasi maksimum 3 notifikasi, buang yang tertua
                    if (next.length >= 3) {
                        next = next.slice(1);
                    }
                    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    usedId = id;
                    next = [...next, { id, ...n, count: 1 }];
                }

                return { notifications: { notifications: next } };
            });

            // Auto clear berdasarkan durasi
            setTimeout(() => {
                const { actions } = get();
                actions.clearNotification(usedId);
            }, duration);
        },
        clearNotification: (id) => {
            set((state) => ({
                notifications: {
                    notifications: state.notifications.notifications.filter((x) => x.id !== id),
                },
            }));
        },

        // --- Campaign Actions (DIHAPUS) ---
    }
}));