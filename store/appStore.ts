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

        // --- Authentication (REAL-TIME) ---
        initialize: async () => {
            // 1. Set loading state
            set(state => ({ auth: { ...state.auth, isAuthLoading: true } }));

            try {
                // 2. PASANG LISTENER DULU
                // Ini akan menangani event di MASA DEPAN (login, logout, token refresh)
                dataService.onAuthStateChange(async (event, session) => {
                    // Listener INI yang akan menangani update state SETELAH inisialisasi
                    console.log(`[Auth] Event Triggered: ${event}`, session?.user?.email);
                    const user = session?.user ?? null;

                    // Set user-nya, TAPI JANGAN set loading: false di sini
                    // Biarkan pengecekan manual di bawah yang mengontrol "boot sequence"
                    set(state => ({ auth: { ...state.auth, user } }));

                    if (user) {
                        // [FIX] Jangan await, biarkan jalan di background agar UI tidak macet
                        dataService.getOrCreateProfile().catch(console.error);
                    }

                    // Jika user logout, paksa kembali ke Nexus
                    if (event === 'SIGNED_OUT') {
                        get().actions.returnToNexus();
                    }
                });

                // 3. LAKUKAN PENGECEKAN AKTIF (SEKARANG)
                // Ini adalah "snapshot" saat aplikasi boot.
                // `getCurrentUser()` akan resolve user dari local storage/session.
                const currentUser = await dataService.getCurrentUser();
                if (currentUser) {
                    console.log("[Auth] Initial Check Found (manual):", currentUser.email);
                    set(state => ({ auth: { ...state.auth, user: currentUser } }));
                    // [FIX] Unblock boot sequence
                    dataService.getOrCreateProfile().catch(console.error);
                }

            } catch (error) {
                console.error("[Auth] Error during initialization:", error);
                // Jika error, set user ke null (tapi biarkan finally handle loading)
                set(state => ({ auth: { ...state.auth, user: null } }));
            } finally {
                // 4. JAMINAN
                // Apapun yang terjadi (sukses atau error), 
                // proses boot selesai. Set loading ke false.
                set(state => ({ auth: { ...state.auth, isAuthLoading: false } }));
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