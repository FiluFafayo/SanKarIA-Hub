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
    selectedCharacterId: string | null; // [FASE 0] State Foundation Fixed
}
const initialNavigationState: NavigationState = {
    currentView: 'nexus',
    campaignToJoinOrStart: null,
    templateToPreFill: null,
    selectedCharacterId: null, // [FASE 0] Default value
};
interface NavigationActions {
    navigateTo: (view: Location) => void;
    returnToNexus: () => void;
    startJoinFlow: (campaign: Campaign) => void;
    startTemplateFlow: (template: RawCharacterData) => void;
    clearTemplateToPreFill: () => void;
    setSelectedCharacterId: (id: string | null) => void; // [FASE 0] Action Definition
}

// =================================================================
// Slice 2: Authentication (DEBUG MODE)
// =================================================================
interface AuthState {
    user: any | null;
    isAuthLoading: boolean;
    authLog: string[]; // Log internal untuk debugging UI
}
const initialAuthState: AuthState = {
    user: null,
    isAuthLoading: true,
    authLog: [],
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
    auth: AuthState;
    levelUp: LevelUpState;
    notifications: NotificationState;

    // [REMOVED] Getters dihapus karena isu spread operator

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

    // === GETTERS REMOVED (Bad Practice) ===
    // Akses langsung state.auth.user atau state.auth.isAuthLoading di komponen.

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
        // [FASE 0] Implementasi Action
        setSelectedCharacterId: (id) => set(state => ({
            navigation: { ...state.navigation, selectedCharacterId: id }
        })),

        // --- Authentication (LOGGING & SAFETY VALVE) ---
        initialize: async () => {
            const log = (msg: string) => {
                // [FASE 0] Reduce Log Noise: Only log to console, keep state clean
                console.log(`[AppStore] ${msg}`);
                // set(s => ({ auth: { ...s.auth, authLog: [...s.auth.authLog, msg] } })); // Disable verbose state log
            };

            if (!get().auth.isAuthLoading) {
                log("Initialize skipped (already loaded/loading).");
                return;
            }

            log("1. Initialize started.");
            set(state => ({ auth: { ...state.auth, isAuthLoading: true } }));

            // [FASE 0] SAFETY VALVE: Resolve instead of Reject
            const timeoutPromise = new Promise((resolve) =>
                setTimeout(() => {
                    log("Auth Init Timeout (4s). Forcing Open.");
                    resolve("TIMEOUT");
                }, 4000)
            );

            const authProcess = async () => {
                try {
                    log("2. Registering Listener...");
                    dataService.onAuthStateChange(async (event, session) => {
                        // [FASE 0] Deduplication Logic
                        const currentUser = get().auth.user;
                        const incomingUser = session?.user ?? null;
                        
                        // Ignore if state is identical
                        if (currentUser?.id === incomingUser?.id && event !== 'SIGNED_OUT') return;

                        console.log(`[AuthListener] ${event} | User: ${incomingUser?.email ?? 'None'}`);
                        
                        if (event === 'SIGNED_OUT' || !incomingUser) {
                            if (currentUser) {
                                set(state => ({ auth: { ...state.auth, user: null } }));
                                get().actions.returnToNexus();
                            }
                        } else {
                            set(state => ({ auth: { ...state.auth, user: incomingUser } }));
                            // Sync profile idempotent
                            dataService.getOrCreateProfile().catch(() => {});
                        }
                    });

                    const currentUser = await dataService.getCurrentUser(); // Safe call now
                    
                    if (currentUser) {
                        log(`3. Found User: ${currentUser.email}`);
                        set(state => ({ auth: { ...state.auth, user: currentUser } }));
                        dataService.getOrCreateProfile().catch(() => {});
                    } else {
                        log("3. Guest Mode Active.");
                        set(state => ({ auth: { ...state.auth, user: null } }));
                    }

                } catch (error: any) {
                    log(`Auth Process Handled Error: ${error.message}`);
                    set(state => ({ auth: { ...state.auth, user: null } }));
                }
            };

            await Promise.race([authProcess(), timeoutPromise]);
            
            log("4. Initialization Done. Opening Gates.");
            set(state => ({ auth: { ...state.auth, isAuthLoading: false } }));
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