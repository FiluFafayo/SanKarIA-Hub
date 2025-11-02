// =================================================================
// 
//      FILE: useCampaign.ts (VERSI BARU - POST-REFAKTOR DB)
// 
// =================================================================

import { useReducer, useMemo } from 'react';
import { 
    Campaign, GameEvent, Monster, RollRequest, MonsterAction, 
    ThinkingState, Quest, NPC, QuestStatus, PlayerActionEvent, 
    DmNarrationEvent, SystemMessageEvent, RollResultEvent, 
    DmReactionEvent, WorldTime, WorldWeather, ToolCall 
} from '../types';
import { generateId } from '../utils';
import { DEFAULT_MONSTERS } from '../data/monsters';

// State yang dikelola hook ini HANYA state sesi kampanye + state UI sementara
export interface CampaignState extends Campaign {
    thinkingState: ThinkingState;
    activeRollRequest: RollRequest | null;
}

// Payload untuk Tool Call
// Kita HARUS mengeksposnya agar App.tsx bisa menangani update karakter global
interface AddItemsPayload {
    characterId: string;
    items: any[]; // Tipe item disederhanakan di sini
}

interface UpdateQuestPayload {
    id: string;
    title: string;
    description: string;
    status: QuestStatus;
    isMainQuest?: boolean;
    reward?: string;
}

interface LogNpcInteractionPayload {
    npcId?: string;
    npcName: string;
    summary: string;
    description?: string;
    location?: string;
    disposition?: 'Friendly' | 'Neutral' | 'Hostile' | 'Unknown';
}

interface SpawnMonstersPayload {
    name: string;
    quantity: number;
    stats?: {
        maxHp: number;
        armorClass: number;
        dexterity: number;
        actions: MonsterAction[];
    }
}

// Tipe event yang bisa di-log
type LoggableGameEvent =
    | Omit<PlayerActionEvent, 'id' | 'timestamp' | 'turnId'>
    | Omit<DmNarrationEvent, 'id' | 'timestamp' | 'turnId'>
    | Omit<DmReactionEvent, 'id' | 'timestamp' | 'turnId'>
    | Omit<SystemMessageEvent, 'id' | 'timestamp' | 'turnId'>
    | Omit<RollResultEvent, 'id' | 'timestamp' | 'turnId'>;


export interface CampaignActions {
    logEvent: (event: LoggableGameEvent, turnId: string) => void;
    startTurn: () => string;
    endTurn: () => void;
    updateMonster: (monster: Monster) => void;
    removeMonster: (monsterId: string) => void;
    setInitiativeOrder: (order: string[]) => void;
    setCurrentPlayerId: (id: string | null) => void;
    setGameState: (state: 'exploration' | 'combat') => void;
    setThinkingState: (state: ThinkingState) => void;
    setActiveRollRequest: (request: RollRequest | null) => void;
    clearChoices: () => void;
    setChoices: (choices: string[]) => void;
    
    // --- AKSI YANG DIUBAH ---
    // Aksi ini sekarang HANYA mengubah state Sesi Kampanye.
    // Mereka TIDAK LAGI mengubah state karakter.
    updateQuestLog: (payload: UpdateQuestPayload) => void;
    logNpcInteraction: (payload: LogNpcInteractionPayload) => void;
    updateWorldState: (time: WorldTime, weather: WorldWeather) => void;
    
    // Ini adalah perubahan arsitektur BESAR.
    // Hook ini tidak lagi memproses tool call, tapi hanya mem-dispatch-nya
    // ke komponen induk (GameScreen/App.tsx) untuk ditangani.
    // Tapi itu akan memecah hook combat/exploration.
    
    // === REVISI RENCANA ARSITEKTUR ===
    // Hook 'useCampaign' HARUS menangani semua update state SESI.
    // Hook 'useCombatSystem' dan 'useExplorationSystem' akan memanggil aksi ini.
    // Pemanggilan 'ToolCall' yang berdampak pada KARAKTER (seperti add_items)
    // HARUS ditangani di level yang lebih tinggi (App.tsx).
    
    // MARI KITA TETAPKAN: Hook ini HANYA mengelola state 'Campaign' (sesi).
    // Kita akan hapus semua yang terkait 'Character' dari hook ini.
    
    spawnMonsters: (monstersToSpawn: SpawnMonstersPayload[]) => void;
}

// Reducer HANYA mengelola CampaignState
type Action =
  | { type: 'SET_STATE'; payload: Partial<CampaignState> }
  | { type: 'ADD_EVENT'; payload: GameEvent }
  | { type: 'START_TURN'; payload: string }
  | { type: 'END_TURN' }
  | { type: 'UPDATE_MONSTER'; payload: Monster }
  | { type: 'REMOVE_MONSTER'; payload: string } // id
  | { type: 'ADD_MONSTERS'; payload: Monster[] }
  | { type: 'SET_CHOICES'; payload: string[] }
  | { type: 'SET_THINKING_STATE'; payload: ThinkingState }
  | { type: 'UPDATE_QUEST_LOG'; payload: UpdateQuestPayload }
  | { type: 'LOG_NPC_INTERACTION'; payload: LogNpcInteractionPayload }
  | { type: 'UPDATE_WORLD_STATE', payload: { time: WorldTime, weather: WorldWeather } };


const reducer = (state: CampaignState, action: Action): CampaignState => {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'ADD_EVENT':
      const worldEventCounter = action.payload.type === 'player_action'
        ? state.worldEventCounter + 1
        : state.worldEventCounter;
      return { ...state, eventLog: [...state.eventLog, action.payload], worldEventCounter };
    case 'START_TURN':
      return { ...state, turnId: action.payload };
    case 'END_TURN':
      return { ...state, turnId: null, thinkingState: 'idle' };
    case 'UPDATE_MONSTER':
      return {
        ...state,
        monsters: state.monsters.map(m => m.id === action.payload.id ? action.payload : m),
      };
    case 'REMOVE_MONSTER': {
      const newMonsters = state.monsters.filter(m => m.id !== action.payload);
      const newInitiativeOrder = state.initiativeOrder.filter(id => id !== action.payload);
      // Jika monster yang mati adalah giliran saat ini, geser ke null (akan di-handle advanceTurn)
      const currentPlayerId = state.currentPlayerId === action.payload ? null : state.currentPlayerId;
      return { ...state, monsters: newMonsters, initiativeOrder: newInitiativeOrder, currentPlayerId };
    }
    case 'ADD_MONSTERS':
      return { ...state, monsters: [...state.monsters, ...action.payload] };
    case 'SET_CHOICES':
        return { ...state, choices: action.payload };
    case 'SET_THINKING_STATE':
        return { ...state, thinkingState: action.payload };
    case 'UPDATE_QUEST_LOG': {
        const { id, title, description, status, isMainQuest, reward } = action.payload;
        const quests = [...state.quests];
        const existingQuestIndex = quests.findIndex(q => q.id === id);
        const newQuestData = { id, title, description, status, isMainQuest: isMainQuest || false, reward: reward || '' };
        
        if (existingQuestIndex > -1) {
            quests[existingQuestIndex] = { ...quests[existingQuestIndex], ...newQuestData };
        } else {
            quests.push(newQuestData);
        }
        return { ...state, quests };
    }
    case 'LOG_NPC_INTERACTION': {
        const payload = action.payload;
        const npcs = [...state.npcs];
        let existingNpcIndex = -1;

        if (payload.npcId) {
            existingNpcIndex = npcs.findIndex(n => n.id === payload.npcId);
        }
        
        if (existingNpcIndex === -1) {
            existingNpcIndex = npcs.findIndex(n => n.name.toLowerCase() === payload.npcName.toLowerCase());
        }

        if (existingNpcIndex > -1) {
            const existingNpc = { ...npcs[existingNpcIndex] };
            
            const lastNote = existingNpc.interactionHistory[existingNpc.interactionHistory.length - 1];
            if (lastNote === payload.summary) {
                return state; // Abort update jika duplikat
            }

            existingNpc.interactionHistory = [...existingNpc.interactionHistory, payload.summary];
            
            if (payload.npcName) existingNpc.name = payload.npcName;
            if (payload.description) existingNpc.description = payload.description;
            if (payload.location) existingNpc.location = payload.location;
            if (payload.disposition) existingNpc.disposition = payload.disposition;
            
            npcs[existingNpcIndex] = existingNpc;
        } else {
            const newNpc: NPC = {
                id: generateId('npc'),
                name: payload.npcName,
                description: payload.description || 'Belum ada deskripsi.',
                location: payload.location || 'Tidak diketahui',
                disposition: payload.disposition || 'Unknown',
                interactionHistory: [payload.summary]
            };
            npcs.push(newNpc);
        }
        return { ...state, npcs };
    }
    case 'UPDATE_WORLD_STATE': {
        return {
            ...state,
            currentTime: action.payload.time,
            currentWeather: action.payload.weather,
            worldEventCounter: 0 // Reset counter
        };
    }
    default:
      return state;
  }
};

/**
 * Hook ini sekarang HANYA mengelola state sesi 'Campaign'
 * State 'Character' (players) dikelola di level atas (App.tsx / GameScreen.tsx)
 * dan harus di-passing ke hook lain (useCombatSystem, useExplorationSystem)
 */
export const useCampaign = (initialCampaign: Campaign) => {
    const [campaign, dispatch] = useReducer(reducer, {
        ...initialCampaign,
        thinkingState: 'idle',
        activeRollRequest: null,
        turnId: null, // Selalu mulai turnId dari null
    });

    const actions: CampaignActions = useMemo(() => {
        const setGameState = (state: 'exploration' | 'combat') => {
            if (state === 'combat' && campaign.gameState === 'exploration') {
                 dispatch({ type: 'SET_STATE', payload: { gameState: state, initiativeOrder: [] } });
            } else if (state === 'exploration') {
                 dispatch({ type: 'SET_STATE', payload: { 
                    gameState: state, 
                    initiativeOrder: [], 
                    monsters: [], 
                    currentPlayerId: null,
                    turnId: null,
                    activeRollRequest: null,
                    choices: []
                } });
            } else {
                 dispatch({ type: 'SET_STATE', payload: { gameState: state } });
            }
        };

        const logEvent = (eventData: LoggableGameEvent, turnId: string) => {
            const newEvent: GameEvent = {
                ...eventData,
                id: generateId('event'),
                timestamp: new Date().toISOString(),
                turnId: turnId,
            } as GameEvent;
            dispatch({ type: 'ADD_EVENT', payload: newEvent });
        };
        
        const startTurn = (): string => {
            const newTurnId = generateId('turn');
            dispatch({ type: 'START_TURN', payload: newTurnId });
            return newTurnId;
        };
        
        const endTurn = () => dispatch({ type: 'END_TURN' });
        const setActiveRollRequest = (request: RollRequest | null) => dispatch({ type: 'SET_STATE', payload: { activeRollRequest: request } });
        const clearChoices = () => dispatch({ type: 'SET_CHOICES', payload: [] });
        const setChoices = (choices: string[]) => dispatch({ type: 'SET_CHOICES', payload: choices });
        const setThinkingState = (state: ThinkingState) => dispatch({ type: 'SET_THINKING_STATE', payload: state });
        const updateQuestLog = (payload: UpdateQuestPayload) => dispatch({ type: 'UPDATE_QUEST_LOG', payload });
        const logNpcInteraction = (payload: LogNpcInteractionPayload) => dispatch({ type: 'LOG_NPC_INTERACTION', payload });
        const updateWorldState = (time: WorldTime, weather: WorldWeather) => dispatch({ type: 'UPDATE_WORLD_STATE', payload: { time, weather } });

        return {
            logEvent,
            startTurn,
            endTurn,
            clearChoices,
            setChoices,
            updateQuestLog,
            logNpcInteraction,
            updateWorldState,
            updateMonster: (monster) => dispatch({ type: 'UPDATE_MONSTER', payload: monster }),
            removeMonster: (monsterId) => dispatch({ type: 'REMOVE_MONSTER', payload: monsterId }),
            setInitiativeOrder: (order) => dispatch({ type: 'SET_STATE', payload: { initiativeOrder: order } }),
            setCurrentPlayerId: (id) => dispatch({ type: 'SET_STATE', payload: { currentPlayerId: id } }),
            setGameState,
            setThinkingState,
            setActiveRollRequest,
            spawnMonsters: (monstersToSpawn) => {
                let newMonsters: Monster[] = [];
                
                monstersToSpawn.forEach(m => {
                    for (let i = 0; i < m.quantity; i++) {
                        const uniqueName = m.quantity > 1 ? `${m.name} ${i + 1}` : m.name;
                        
                        let monsterData: Omit<Monster, 'id' | 'currentHp' | 'initiative' | 'conditions'> | null = null;
                        
                        const template = DEFAULT_MONSTERS.find(dm => dm.name.toLowerCase() === m.name.toLowerCase());
                        
                        if (template) {
                            monsterData = template;
                        } 
                        else if (m.stats) {
                            // Ini adalah monster kustom dari AI
                            // Kita harus 'melengkapi' data yang mungkin kurang
                            const baseStats = DEFAULT_MONSTERS[0]; // Ambil goblin sebagai base
                            monsterData = {
                                ...baseStats,
                                name: m.name,
                                ...m.stats
                            };
                        } 

                        if (monsterData) {
                            newMonsters.push({
                                ...monsterData,
                                id: generateId('monster'),
                                name: uniqueName,
                                currentHp: monsterData.maxHp,
                                initiative: 0,
                                conditions: [],
                            });
                        }
                    }
                });

                if (newMonsters.length > 0) {
                    dispatch({ type: 'ADD_MONSTERS', payload: newMonsters });
                    setGameState('combat'); // Otomatis masuk mode combat
                }
            },
        };
    // Kita hanya perlu 'campaign.gameState' sebagai dependensi
    }, [campaign.gameState]);

    // Kembalikan state sesi kampanye yang sudah di-dispatch
    return { campaign, campaignActions: actions };
};