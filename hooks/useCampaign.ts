import { useReducer, useMemo } from "react";
// REFAKTOR G-5: Hapus dataService, ganti dengan registry
// import { dataService } from "../services/dataService"; 
import { findItem } from "../data/registry"; // REFAKTOR G-5
import {
	Campaign,
	GameEvent,
	MonsterInstance,
	RollRequest,
	InventoryItem,
	Character,
	ThinkingState,
	Quest,
	NPC,
	QuestStatus,
	PlayerActionEvent,
	DmNarrationEvent,
	SystemMessageEvent,
	RollResultEvent,
	DmReactionEvent,
	WorldTime,
	WorldWeather,
	MonsterDefinition,
	CharacterInventoryItem,
	ItemDefinition,
	SpellDefinition,
} from "../types";
import { generateId } from "../utils";
import { MONSTER_DEFINITIONS } from "../data/monsters"; // <-- FIX: Import name yang benar

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
		// (Ini sekarang usang, tapi kita biarkan untuk kompatibilitas AI lama)
		maxHp: number;
		armorClass: number;
		dexterity: number;
		actions: { name: string; toHitBonus: number; damageDice: string }[];
	};
}

interface AddItemsPayload {
	characterId: string;
	items: {
		name: string; // AI akan mengirim nama, kita akan cari definisinya
		quantity: number;
	}[];
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
	disposition?: "Friendly" | "Neutral" | "Hostile" | "Unknown";
}

type LoggableGameEvent =
	| Omit<PlayerActionEvent, "id" | "timestamp" | "turnId">
	| Omit<DmNarrationEvent, "id" | "timestamp" | "turnId">
	| Omit<DmReactionEvent, "id" | "timestamp" | "turnId">
	| Omit<SystemMessageEvent, "id" | "timestamp" | "turnId">
	| Omit<RollResultEvent, "id" | "timestamp" | "turnId">;

export interface CampaignActions {
	logEvent: (event: LoggableGameEvent, turnId: string) => void;
	startTurn: () => string;
	endTurn: () => void;
	updateMonster: (monster: MonsterInstance) => void;
	removeMonster: (monsterInstanceId: string) => void;
	setInitiativeOrder: (order: string[]) => void;
	setCurrentPlayerId: (id: string | null) => void;
	setGameState: (state: "exploration" | "combat") => void;
	setThinkingState: (state: ThinkingState) => void;
	setActiveRollRequest: (request: RollRequest | null) => void;
	spawnMonsters: (monstersToSpawn: MonsterSpawnPayload[]) => void;
	clearChoices: () => void;
	setChoices: (choices: string[]) => void;
	updateCharacterInCampaign: (character: Character) => void;
	addItemsToInventory: (payload: AddItemsPayload) => void;
	updateQuestLog: (payload: UpdateQuestPayload) => void;
	logNpcInteraction: (payload: LogNpcInteractionPayload) => void;
	updateWorldState: (time: WorldTime, weather: WorldWeather) => void;
}

type Action =
	| { type: "SET_STATE"; payload: Partial<CampaignState> }
	| { type: "ADD_EVENT"; payload: GameEvent }
	| { type: "START_TURN"; payload: string }
	| { type: "END_TURN" }
	| { type: "UPDATE_MONSTER"; payload: MonsterInstance } // REFAKTOR
	| { type: "REMOVE_MONSTER"; payload: string } // instanceId
	| { type: "ADD_MONSTERS"; payload: MonsterInstance[] } // REFAKTOR
	| { type: "SET_CHOICES"; payload: string[] }
	| { type: "UPDATE_CHARACTER"; payload: Character }
	| { type: "SET_THINKING_STATE"; payload: ThinkingState }
	| { type: "ADD_ITEMS_TO_INVENTORY"; payload: AddItemsPayload }
	| { type: "UPDATE_QUEST_LOG"; payload: UpdateQuestPayload }
	| { type: "LOG_NPC_INTERACTION"; payload: LogNpcInteractionPayload }
	| {
			type: "UPDATE_WORLD_STATE";
			payload: { time: WorldTime; weather: WorldWeather };
	  };

const reducer = (state: CampaignState, action: Action): CampaignState => {
	switch (action.type) {
		case "SET_STATE":
			return { ...state, ...action.payload };
		case "ADD_EVENT":
			const worldEventCounter =
				action.payload.type === "player_action"
					? state.worldEventCounter + 1
					: state.worldEventCounter;
			return {
				...state,
				eventLog: [...state.eventLog, action.payload],
				worldEventCounter,
			};
		case "START_TURN":
			// Saat giliran BARU dimulai, reset REAKSI semua orang
			return {
				...state,
				turnId: action.payload,
				players: state.players.map((p) => ({ ...p, usedReaction: false })),
			};
		case "END_TURN":
			// Saat giliran LAMA berakhir, reset BONUS ACTION hanya untuk pemain yang baru saja selesai
			const currentPlayerId = state.currentPlayerId;
			return {
				...state,
				turnId: null,
				thinkingState: "idle",
				players: state.players.map((p) =>
					p.id === currentPlayerId ? { ...p, usedBonusAction: false } : p
				),
			};
		case "UPDATE_MONSTER": // REFAKTOR: Bekerja dengan MonsterInstance
			return {
				...state,
				monsters: state.monsters.map((m) =>
					m.instanceId === action.payload.instanceId ? action.payload : m
				),
			};
		case "REMOVE_MONSTER": {
			// REFAKTOR: Bekerja dengan instanceId
			const newMonsters = state.monsters.filter(
				(m) => m.instanceId !== action.payload
			);
			const newInitiativeOrder = state.initiativeOrder.filter(
				(id) => id !== action.payload
			);
			return {
				...state,
				monsters: newMonsters,
				initiativeOrder: newInitiativeOrder,
			};
		}
		case "ADD_MONSTERS": // REFAKTOR: Menerima MonsterInstance[]
			return { ...state, monsters: [...state.monsters, ...action.payload] };
		case "SET_CHOICES":
			return { ...state, choices: action.payload };
		case "UPDATE_CHARACTER":
			return {
				...state,
				players: state.players.map((p) =>
					p.id === action.payload.id ? action.payload : p
				),
			};
		case "SET_THINKING_STATE":
			return { ...state, thinkingState: action.payload };
		case "ADD_ITEMS_TO_INVENTORY": {
			// BUGFIX G-1/G-5: Logika ini diperbaiki untuk menggunakan SSoT dari registry
			// alih-alih membuat item placeholder palsu.
			// Ini adalah SINKRONISASI RUNTIME untuk UI GameScreen.
			// Penyimpanan SSoT permanen ditangani oleh handleUpdateCharacter di App.tsx.

			const { characterId, items } = action.payload;

			const newPlayers = state.players.map((p) => {
				if (p.id === characterId) {
					const newInventory = [...p.inventory];
					items.forEach((itemToAdd) => {
						const existingItemIndex = newInventory.findIndex(
							(i) => i.item.name.toLowerCase() === itemToAdd.name.toLowerCase()
						);
						
						if (existingItemIndex > -1) {
							// Item sudah ada, tambahkan kuantitas
							newInventory[existingItemIndex] = {
								...newInventory[existingItemIndex],
								quantity: newInventory[existingItemIndex].quantity + itemToAdd.quantity,
							};
						} else {
							// Item baru, cari definisi SSoT dari registry (G-5)
							const definition = findItem(itemToAdd.name); // REFAKTOR G-5
							
							if (!definition) {
								// Fallback pesimis jika cache gagal (seharusnya tidak terjadi)
								console.error(`BUG G-1 FALLBACK: ItemDefinition tidak ditemukan di cache untuk: ${itemToAdd.name}. Item tidak akan ditambahkan ke state runtime.`);
							} else {
								// Definisi SSoT ditemukan, buat item inventaris baru
								newInventory.push({
									instanceId: generateId("inv-runtime"), // ID runtime sementara
									item: definition, // Gunakan SSoT Definition
									quantity: itemToAdd.quantity,
									isEquipped: false,
								});
							}
						}
					});
					return { ...p, inventory: newInventory };
				}
				return p;
			});
			return { ...state, players: newPlayers };
		}
		case "UPDATE_QUEST_LOG": {
			const { id, title, description, status, isMainQuest, reward } =
				action.payload;
			const quests = [...state.quests];
			const existingQuestIndex = quests.findIndex((q) => q.id === id);
			const newQuestData = {
				id,
				title,
				description,
				status,
				isMainQuest: isMainQuest || false,
				reward,
			};

			if (existingQuestIndex > -1) {
				quests[existingQuestIndex] = {
					...quests[existingQuestIndex],
					...newQuestData,
				};
			} else {
				quests.push(newQuestData);
			}
			return { ...state, quests };
		}
		case "LOG_NPC_INTERACTION": {
			const payload = action.payload;
			const npcs = [...state.npcs];
			let existingNpcIndex = -1;

			if (payload.npcId) {
				existingNpcIndex = npcs.findIndex((n) => n.id === payload.npcId);
			}

			if (existingNpcIndex === -1) {
				existingNpcIndex = npcs.findIndex(
					(n) => n.name.toLowerCase() === payload.npcName.toLowerCase()
				);
			}

			if (existingNpcIndex > -1) {
				const existingNpc = { ...npcs[existingNpcIndex] };

				const lastNote =
					existingNpc.interactionHistory[
						existingNpc.interactionHistory.length - 1
					];
				if (lastNote === payload.summary) {
					return state; // Abort update if it's a duplicate
				}

				existingNpc.interactionHistory = [
					...existingNpc.interactionHistory,
					payload.summary,
				];

				if (payload.npcName) existingNpc.name = payload.npcName;
				if (payload.description) existingNpc.description = payload.description;
				if (payload.location) existingNpc.location = payload.location;
				if (payload.disposition) existingNpc.disposition = payload.disposition;

				npcs[existingNpcIndex] = existingNpc;
			} else {
				const newNpc: NPC = {
					id: generateId("npc"),
					name: payload.npcName,
					description: payload.description || "Belum ada deskripsi.",
					location: payload.location || "Tidak diketahui",
					disposition: payload.disposition || "Unknown",
					interactionHistory: [payload.summary],
				};
				npcs.push(newNpc);
			}
			return { ...state, npcs };
		}
		case "UPDATE_WORLD_STATE": {
			return {
				...state,
				currentTime: action.payload.time,
				currentWeather: action.payload.weather,
				worldEventCounter: 0, // Reset counter after an event
			};
		}
		default:
			return state;
	}
};

export const useCampaign = (
	initialCampaign: Campaign,
	initialPlayers: Character[]
) => {
	const [campaign, dispatch] = useReducer(reducer, {
		...initialCampaign,
		thinkingState: "idle",
		activeRollRequest: null,
		players: initialPlayers, // SSoT Karakter di-pass saat inisialisasi
		turnId: null,
	});

	const actions: CampaignActions = useMemo(() => {
		const setGameState = (state: "exploration" | "combat") => {
			if (state === "combat" && campaign.gameState === "exploration") {
				dispatch({
					type: "SET_STATE",
					payload: { gameState: state, initiativeOrder: [] },
				});
			} else if (state === "exploration") {
				dispatch({
					type: "SET_STATE",
					payload: {
						gameState: state,
						initiativeOrder: [],
						monsters: [],
						currentPlayerId: null,
					},
				});
			} else {
				dispatch({ type: "SET_STATE", payload: { gameState: state } });
			}
		};

		const logEvent = (eventData: LoggableGameEvent, turnId: string) => {
			const newEvent: GameEvent = {
				...eventData,
				id: generateId("event"),
				timestamp: new Date().toISOString(),
				turnId: turnId,
			} as GameEvent;
			dispatch({ type: "ADD_EVENT", payload: newEvent });
		};

		const startTurn = (): string => {
			const newTurnId = generateId("turn");
			dispatch({ type: "START_TURN", payload: newTurnId });
			return newTurnId;
		};

		const endTurn = () => dispatch({ type: "END_TURN" });
		const setActiveRollRequest = (request: RollRequest | null) =>
			dispatch({ type: "SET_STATE", payload: { activeRollRequest: request } });
		const clearChoices = () => dispatch({ type: "SET_CHOICES", payload: [] });
		const setChoices = (choices: string[]) =>
			dispatch({ type: "SET_CHOICES", payload: choices });
		const updateCharacterInCampaign = (character: Character) =>
			dispatch({ type: "UPDATE_CHARACTER", payload: character });
		const setThinkingState = (state: ThinkingState) =>
			dispatch({ type: "SET_THINKING_STATE", payload: state });
		const addItemsToInventory = (payload: AddItemsPayload) =>
			dispatch({ type: "ADD_ITEMS_TO_INVENTORY", payload });
		const updateQuestLog = (payload: UpdateQuestPayload) =>
			dispatch({ type: "UPDATE_QUEST_LOG", payload });
		const logNpcInteraction = (payload: LogNpcInteractionPayload) =>
			dispatch({ type: "LOG_NPC_INTERACTION", payload });
		const updateWorldState = (time: WorldTime, weather: WorldWeather) =>
			dispatch({ type: "UPDATE_WORLD_STATE", payload: { time, weather } });

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
			updateMonster: (monster) =>
				dispatch({ type: "UPDATE_MONSTER", payload: monster }),
			removeMonster: (monsterId) =>
				dispatch({ type: "REMOVE_MONSTER", payload: monsterId }),
			setInitiativeOrder: (order) =>
				dispatch({ type: "SET_STATE", payload: { initiativeOrder: order } }),
			setCurrentPlayerId: (id) =>
				dispatch({ type: "SET_STATE", payload: { currentPlayerId: id } }),
			setGameState,
			setThinkingState,
			setActiveRollRequest,
			spawnMonsters: (monstersToSpawn) => {
				// 'prebuiltMonsters' dihapus, tidak lagi relevan
				let newMonsters: MonsterInstance[] = [];

				monstersToSpawn.forEach((m) => {
					// REFAKTOR: Selalu cari di MONSTER_DEFINITIONS
					const template = MONSTER_DEFINITIONS.find(
						(dm) => dm.name.toLowerCase() === m.name.toLowerCase()
					);

					if (template) {
						for (let i = 0; i < m.quantity; i++) {
							const uniqueName = m.quantity > 1 ? `${m.name} ${i + 1}` : m.name;

							newMonsters.push({
								instanceId: generateId("monster"), // ID unik untuk instansi ini
								definition: template, // Data stat block lengkap (SSoT)
								name: uniqueName,
								currentHp: template.maxHp,
								initiative: 0,
								conditions: [],
							});
						}
					} else {
						// (Fallback jika AI mengarang monster)
						console.warn(
							`Monster template "${m.name}" tidak ditemukan di MONSTER_DEFINITIONS. Menggunakan stat fallback.`
						);
						// (Di sini kita bisa membuat monster kustom jika m.stats ada, tapi untuk sekarang, kita log)
					}
				});

				if (newMonsters.length > 0) {
					dispatch({ type: "ADD_MONSTERS", payload: newMonsters });
					setGameState("combat"); // Otomatis masuk mode combat
				}
			},
		};
	}, [campaign.gameState]); // <-- dependensi disederhanakan

	const fullCampaignState = useMemo(
		() => ({
			...campaign,
			players: campaign.players,
		}),
		[campaign]
	);

	return { campaign: fullCampaignState, campaignActions: actions };
};
