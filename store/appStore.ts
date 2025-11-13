// FASE 0: Rombak Total.
// appStore HANYA mengelola Navigasi Global, state UI global (LevelUp), dan AUTHENTICATION.
// State Runtime (game session) dipindah ke gameStore.ts.
// State Form (campaign creation) dipindah ke state lokal React di CreateCampaignView.tsx.

import { create } from 'zustand';
import {
    Character, Campaign, Location,
    RawCharacterData
} from '../types';
import { dataService } from '../services/dataService'; // Penting untuk Auth!

type View = Location | 'nexus' | 'character-selection';

// =================================================================
// Slice 1: Navigation
// =================================================================
interface NavigationState {
    currentView: View;
    campaignToJoinOrStart: Campaign | null;
    templateToPreFill: RawCharacterData | null;
}
const initialNavigationState: NavigationState = {
    currentView: 'nexus',
    campaignToJoinOrStart: null,
    templateToPreFill: null,
};
interface NavigationActions {
    navigateTo: (view: Location) => void;
    returnToNexus: () => void;
    startJoinFlow: (campaign: Campaign) => void;
    startTemplateFlow: (template: RawCharacterData) => void;
    clearTemplateToPreFill: () => void;
}

// =================================================================
// Slice 2: Authentication (RESTORED)
// =================================================================
interface AuthState {
    user: any | null; // User object dari Supabase
    isAuthLoading: boolean;
}
const initialAuthState: AuthState = {
    user: null,
    isAuthLoading: true,
};
interface AuthActions {
    initialize: () => Promise<void>;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

// =================================================================
// Slice 3: Level Up
// =================================================================
interface LevelUpState {
    characterToLevel: Character | null;
}
const initialLevelUpState: LevelUpState = {
    characterToLevel: null,
};
interface LevelUpActions {
    triggerLevelUp: (character: Character) => void;
    closeLevelUp: () => void;
}

// =================================================================
// Slice 4: Notifications
// =================================================================
export interface AppNotification {
    id: string;
    message: string;
    type?: 'info' | 'success' | 'error' | 'warning';
    durationMs?: number;
    count?: number;
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

// =================================================================
// Gabungan Store
// =================================================================
type AppStore = {
    navigation: NavigationState;
    auth: AuthState;     // Tambahkan AuthState
    levelUp: LevelUpState;
    notifications: NotificationState;
    
    // Helper getters untuk kemudahan akses di komponen (shortcut)
    user: any | null; 
    isAuthLoading: boolean;

    actions: NavigationActions & AuthActions & LevelUpActions & NotificationActions;
    
    // Flat actions untuk kemudahan destructuring (shortcut)
    initialize: () => Promise<void>;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
    // === STATE ===
    navigation: initialNavigationState,
    auth: initialAuthState,
    levelUp: initialLevelUpState,
    notifications: initialNotificationState,

    // === GETTERS (Derived State) ===
    get user() { return get().auth.user },
    get isAuthLoading() { return get().auth.isAuthLoading },

    // === FLAT ACTIONS (Proxies) ===
    initialize: async () => get().actions.initialize(),
    login: async () => get().actions.login(),
    logout: async () => get().actions.logout(),

    // === ACTIONS IMPLEMENTATION ===
    actions: {
        // --- Navigation ---
        navigateTo: (view) => {
            set(state => ({ navigation: { ...state.navigation, currentView: view } }));
        },
        returnToNexus: () => {
            set({ navigation: initialNavigationState });
        },
        startJoinFlow: (campaign) => set(state => ({
            navigation: { ...state.navigation, currentView: 'character-selection', campaignToJoinOrStart: campaign }
        })),
        startTemplateFlow: (template) => set(state => ({
            navigation: {
                ...state.navigation,
                currentView: Location.MirrorOfSouls,
                templateToPreFill: template,
            }
        })),
        clearTemplateToPreFill: () => set(state => ({
            navigation: { ...state.navigation, templateToPreFill: null }
        })),

        // --- Authentication (FIXED) ---
        initialize: async () => {
            set(state => ({ auth: { ...state.auth, isAuthLoading: true } }));
            try {
                // Cek sesi yang ada
                const user = await dataService.getCurrentUser();
                if (user) {
                    console.log("[Auth] Session restored:", user.email);
                }
                set(state => ({ auth: { ...state.auth, user, isAuthLoading: false } }));
                
                // Setup listener untuk perubahan auth (login/logout di tab lain atau via provider)
                // Note: Kita asumsikan dataService punya metode untuk subscribe, 
                // jika tidak, ini cukup untuk inisialisasi awal.
                
            } catch (error) {
                console.error("[Auth] Initialization failed:", error);
                set(state => ({ auth: { ...state.auth, user: null, isAuthLoading: false } }));
            }
        },
        login: async () => {
            try {
                await dataService.signInWithGoogle();
                // Redirect akan ditangani oleh browser/provider
            } catch (error) {
                console.error("[Auth] Login failed:", error);
                get().actions.pushNotification({ message: "Login Gagal", type: 'error' });
            }
        },
        logout: async () => {
            try {
                await dataService.signOut();
                set(state => ({ auth: { ...state.auth, user: null } }));
                get().actions.returnToNexus(); // Reset navigasi
            } catch (error) {
                console.error("[Auth] Logout failed:", error);
            }
        },

        // --- Level Up ---
        triggerLevelUp: (character) => {
            if (get().levelUp.characterToLevel) return;
            set(state => ({ levelUp: { characterToLevel: character } }));
        },
        closeLevelUp: () => {
            set({ levelUp: initialLevelUpState });
        },

        // --- Notifications ---
        pushNotification: (n) => {
            const defaultDuration = 3000;
            const duration = n.durationMs ?? defaultDuration;
            let usedId = '';

            set((state) => {
                const list = state.notifications.notifications;
                const dupIndex = list.findIndex((x) => x.message === n.message && x.type === n.type);
                let next = [...list];

                if (dupIndex >= 0) {
                    const existing = next[dupIndex];
                    const updated = { ...existing, count: (existing.count ?? 1) + 1 };
                    next[dupIndex] = updated;
                    usedId = existing.id;
                } else {
                    if (next.length >= 3) {
                        next = next.slice(1);
                    }
                    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    usedId = id;
                    next = [...next, { id, ...n, count: 1 }];
                }

                return { notifications: { notifications: next } };
            });

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
    }
}));