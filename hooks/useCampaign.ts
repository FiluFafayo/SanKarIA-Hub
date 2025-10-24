import { useReducer, useMemo } from 'react';
import { Campaign, GameEvent, Monster, RollRequest, InventoryItem, MonsterAction, Character, ThinkingState, Quest, NPC, QuestStatus, PlayerActionEvent, DmNarrationEvent, SystemMessageEvent, RollResultEvent, DmReactionEvent, WorldTime, WorldWeather } from '../types';
import { generateId } from '../utils';
import { DEFAULT_MONSTERS } from '../data/monsters';

export interface CampaignState extends Campaign {
    thinkingState: ThinkingState;
    activeRollRequest: RollRequest | null;
    players: Character[]; // Add players to the campaign state for easy access
}

// Definisikan tipe untuk payload monster yang lebih fleksibel
interface MonsterSpawnPayload {
    name: string;
    quantity: number;
    stats?: {
        maxHp: number;
        armorClass: number;
        dexterity: number;
        actions: MonsterAction[];
    }
}

interface AddItemsPayload {
    characterId: string;
    items: Omit<InventoryItem, 'description' | 'isEquipped' | 'toHitBonus' | 'damageDice' | 'effect'>[];
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

// FIX: Create a discriminated union of Omitted event types to help TypeScript's type inference.
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
    spawnMonsters: (monstersToSpawn: MonsterSpawnPayload[], prebuiltMonsters?: Monster[]) => void;
    clearChoices: () => void;
    setChoices: (choices: string[]) => void;
    updateCharacterInCampaign: (character: Character) => void;
    addItemsToInventory: (payload: AddItemsPayload) => void;
    updateQuestLog: (payload: UpdateQuestPayload) => void;
    logNpcInteraction: (payload: LogNpcInteractionPayload) => void;
    updateWorldState: (time: WorldTime, weather: WorldWeather) => void;
}

type Action =
  | { type: 'SET_STATE'; payload: Partial<CampaignState> }
  | { type: 'ADD_EVENT'; payload: GameEvent }
  | { type: 'START_TURN'; payload: string }
  | { type: 'END_TURN' }
  | { type: 'UPDATE_MONSTER'; payload: Monster }
  | { type: 'REMOVE_MONSTER'; payload: string } // id
  | { type: 'ADD_MONSTERS'; payload: Monster[] }
  | { type: 'SET_CHOICES'; payload: string[] }
  | { type: 'UPDATE_CHARACTER'; payload: Character }
  | { type: 'SET_THINKING_STATE'; payload: ThinkingState }
  | { type: 'ADD_ITEMS_TO_INVENTORY'; payload: AddItemsPayload }
  | { type: 'UPDATE_QUEST_LOG'; payload: UpdateQuestPayload }
  | { type: 'LOG_NPC_INTERACTION'; payload: LogNpcInteractionPayload }
  | { type: 'UPDATE_WORLD_STATE', payload: { time: WorldTime, weather: WorldWeather } };


const reducer = (state: CampaignState, action: Action): CampaignState => {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'ADD_EVENT':
      // Increment world event counter on player action
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
      return { ...state, monsters: newMonsters, initiativeOrder: newInitiativeOrder };
    }
    case 'ADD_MONSTERS':
      return { ...state, monsters: [...state.monsters, ...action.payload] };
    case 'SET_CHOICES':
        return { ...state, choices: action.payload };
     case 'UPDATE_CHARACTER':
        return {
            ...state,
            players: state.players.map(p => p.id === action.payload.id ? action.payload : p),
        };
    case 'SET_THINKING_STATE':
        return { ...state, thinkingState: action.payload };
    case 'ADD_ITEMS_TO_INVENTORY': {
        const { characterId, items } = action.payload;
        const newPlayers = state.players.map(p => {
            if (p.id === characterId) {
                const newInventory = [...p.inventory];
                items.forEach(itemToAdd => {
                    const existingItemIndex = newInventory.findIndex(i => i.name === itemToAdd.name);
                    if (existingItemIndex > -1) {
                        newInventory[existingItemIndex].quantity += itemToAdd.quantity;
                    } else {
                        newInventory.push({ ...itemToAdd, description: '', isEquipped: false });
                    }
                });
                return { ...p, inventory: newInventory };
            }
            return p;
        });
        return { ...state, players: newPlayers };
    }
    case 'UPDATE_QUEST_LOG': {
        const { id, title, description, status, isMainQuest, reward } = action.payload;
        const quests = [...state.quests];
        const existingQuestIndex = quests.findIndex(q => q.id === id);
        const newQuestData = { id, title, description, status, isMainQuest: isMainQuest || false, reward };
        
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
                return state; // Abort update if it's a duplicate
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
            worldEventCounter: 0 // Reset counter after an event
        };
    }
    default:
      return state;
  }
};

export const useCampaign = (initialCampaign: Campaign, initialPlayers: Character[]) => {
    const [campaign, dispatch] = useReducer(reducer, {
        ...initialCampaign,
        thinkingState: 'idle',
        activeRollRequest: null,
        players: initialPlayers,
        turnId: null,
    });

    const actions: CampaignActions = useMemo(() => {
        const setGameState = (state: 'exploration' | 'combat') => {
            if (state === 'combat' && campaign.gameState === 'exploration') {
                 dispatch({ type: 'SET_STATE', payload: { gameState: state, initiativeOrder: [] } });
            } else if (state === 'exploration') {
                 dispatch({ type: 'SET_STATE', payload: { gameState: state, initiativeOrder: [], monsters: [], currentPlayerId: null } });
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
        const updateCharacterInCampaign = (character: Character) => dispatch({ type: 'UPDATE_CHARACTER', payload: character });
        const setThinkingState = (state: ThinkingState) => dispatch({ type: 'SET_THINKING_STATE', payload: state });
        const addItemsToInventory = (payload: AddItemsPayload) => dispatch({ type: 'ADD_ITEMS_TO_INVENTORY', payload });
        const updateQuestLog = (payload: UpdateQuestPayload) => dispatch({ type: 'UPDATE_QUEST_LOG', payload });
        const logNpcInteraction = (payload: LogNpcInteractionPayload) => dispatch({ type: 'LOG_NPC_INTERACTION', payload });
        const updateWorldState = (time: WorldTime, weather: WorldWeather) => dispatch({ type: 'UPDATE_WORLD_STATE', payload: { time, weather } });


        return {
            logEvent,
            startTurn,
            endTurn,
            clearChoices,
            setChoices,
            updateCharacterInCampaign,
            addItemsToInventory,
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
            spawnMonsters: (monstersToSpawn, prebuiltMonsters) => {
                let newMonsters: Monster[] = prebuiltMonsters ? [...prebuiltMonsters] : [];
                
                monstersToSpawn.forEach(m => {
                    if (prebuiltMonsters && prebuiltMonsters.some(pm => pm.name === m.name)) return;
                    
                    for (let i = 0; i < m.quantity; i++) {
                        const uniqueName = m.quantity > 1 ? `${m.name} ${i + 1}` : m.name;
                        let monsterData: Omit<Monster, 'id' | 'currentHp' | 'initiative' | 'conditions'> | null = null;
                        
                        if (m.stats) {
                            monsterData = { name: m.name, ...m.stats };
                        } 
                        else {
                            const template = DEFAULT_MONSTERS.find(dm => dm.name.toLowerCase() === m.name.toLowerCase());
                            if (template) {
                                monsterData = template;
                            }
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
                    setGameState('combat');
                }
            },
        };
    }, [campaign.gameState]);

    const fullCampaignState = useMemo(() => ({
        ...campaign,
        players: campaign.players,
    }), [campaign]);

    return { campaign: fullCampaignState, campaignActions: actions };
};
