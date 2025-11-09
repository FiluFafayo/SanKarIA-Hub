import { useReducer, useMemo } from "react";
// REFAKTOR G-5: Hapus dataService, ganti dengan registry
// import { dataService } from "../services/dataService";
import { findItem, findMonster } from "../data/registry"; // REFAKTOR G-5 / FASE 3
import {
    Campaign,
    GameEvent,
    MonsterInstance,
    RollRequest,
    CharacterInventoryItem, // FASE 1 FIX: Ganti nama tipe
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
    CampaignState,
    CampaignActions,
    // BARU: Impor tipe dari Fase 1
    BattleState,
    BattleStatus,
    GridCell,
    TerrainType,
    Unit,
} from "../types";
import { generateId, xpToNextLevel } from "../utils"; // FASE 1 (Tugas 5)
// import { useAppStore } from "../store/appStore"; // FASE 3: Dihapus (Side-effect dipindah)
// import { MONSTER_DEFINITIONS } from "../data/monsters"; // <-- FASE 3: Dihapus, gunakan registry

// Tipe CampaignState kini diimpor dari types.ts sebagai SSoT

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
    image?: string; // URL potret NPC (opsional)
    imagePending?: boolean; // Status pembuatan potret (opsional)
}

type LoggableGameEvent =
	| Omit<PlayerActionEvent, "id" | "timestamp" | "turnId">
	| Omit<DmNarrationEvent, "id" | "timestamp" | "turnId">
	| Omit<DmReactionEvent, "id" | "timestamp" | "turnId">
	| Omit<DmDialogueEvent, "id" | "timestamp" | "turnId"> // (Poin 3) Tambahkan DmDialogueEvent
	| Omit<SystemMessageEvent, "id" | "timestamp" | "turnId">
	| Omit<RollResultEvent, "id" | "timestamp" | "turnId">;

// Tipe CampaignActions kini diimpor dari types.ts sebagai SSoT

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
	// BARU: Aksi untuk mengelola Battle State
	| { type: "SET_BATTLE_STATE"; payload: BattleState | null }
	| { type: "SET_BATTLE_GRID"; payload: GridCell[][] }
	| { type: "SET_BATTLE_MAP_IMAGE"; payload: string }
	| { type: "SET_BATTLE_UNITS"; payload: Unit[] }
	| { type: "SET_ACTIVE_BATTLE_UNIT"; payload: string | null }
	| {
		type: "MOVE_UNIT";
		payload: {
			unitId: string;
			newPosition: { x: number; y: number };
			cost: number;
		};
	}
	| { type: "SET_FOG_OF_WAR"; payload: boolean[][] } // BARU: Fase 5
	| { type: "CLEAR_BATTLE_STATE" } // BARU
	| {
		type: "ADVANCE_TIME";
		payload: number; // Detik yang ditambahkan
	}
	| {
		// (Poin 7) Aksi baru untuk XP
		type: "AWARD_XP";
		payload: { characterId: string; amount: number };
	}
	| {
		// (Poin 4) Aksi baru untuk Opini NPC
		type: "UPDATE_NPC_OPINION";
		payload: { npcId: string; characterId: string; change: number };
	}
	| {
		// (Poin 5) Aksi terpisah untuk cuaca
		type: "SET_WEATHER";
		payload: WorldWeather;
	};

const reducer = (state: CampaignState, action: Action): CampaignState => {
	switch (action.type) {
		case "SET_STATE":
			// Pastikan battleState tidak terhapus secara tidak sengaja oleh SET_STATE parsial
			return {
				...state,
				...action.payload,
				battleState:
					action.payload.battleState !== undefined
						? action.payload.battleState
						: state.battleState,
			};
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
								quantity:
									newInventory[existingItemIndex].quantity + itemToAdd.quantity,
							};
						} else {
							// Item baru, cari definisi SSoT dari registry (G-5)
							const definition = findItem(itemToAdd.name); // REFAKTOR G-5

							if (!definition) {
								// Fallback pesimis jika cache gagal (seharusnya tidak terjadi)
								console.error(
									`BUG G-1 FALLBACK: ItemDefinition tidak ditemukan di cache untuk: ${itemToAdd.name}. Item tidak akan ditambahkan ke state runtime.`
								);
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

                const lastNote = existingNpc.interactionHistory[existingNpc.interactionHistory.length - 1];
                const isDuplicateNote = lastNote === payload.summary;
                // Jika ringkasan duplikat, jangan tambahkan lagi, tapi tetap update field lain
                if (!isDuplicateNote) {
                    existingNpc.interactionHistory = [
                        ...existingNpc.interactionHistory,
                        payload.summary,
                    ];
                }

				if (payload.npcName) existingNpc.name = payload.npcName;
				if (payload.description) existingNpc.description = payload.description;
				if (payload.location) existingNpc.location = payload.location;
                if (payload.disposition) existingNpc.disposition = payload.disposition;
                if (payload.image) existingNpc.image = payload.image;
                if (payload.imagePending !== undefined) existingNpc.imagePending = payload.imagePending;

                npcs[existingNpcIndex] = existingNpc;
            } else {
                const newNpc: NPC = {
                    id: generateId("npc"),
                    name: payload.npcName,
                    description: payload.description || "Belum ada deskripsi.",
                    location: payload.location || "Tidak diketahui",
                    disposition: payload.disposition || "Unknown",
                    interactionHistory: [payload.summary],
                    image: payload.image,
                    imagePending: payload.imagePending || false,
                };
                npcs.push(newNpc);
            }
            return { ...state, npcs };
        }
		// (Poin 5) Ganti reducer UPDATE_WORLD_STATE
		case "ADVANCE_TIME": {
			return {
				...state,
				currentTime: state.currentTime + action.payload,
				worldEventCounter: 0, // Reset counter
			};
		}
		case "SET_WEATHER": {
			return {
				...state,
				currentWeather: action.payload,
			};
		}
		// (Poin 7) Reducer untuk XP
		case "AWARD_XP": {
			const { characterId, amount } = action.payload;
			// FASE 3: Logika triggerLevelUp (side-effect) dipindahkan ke hook (Exploration/Combat system)

			const newPlayers = state.players.map((p) => {
				if (p.id === characterId) {
					const newXp = (p.xp || 0) + amount;
					// Cek level up tidak lagi diperlukan DI SINI.
					return { ...p, xp: newXp };
				}
				return p;
			});

			return {
				...state,
				players: newPlayers,
			};
		}
		// (Poin 4) Reducer untuk Opini NPC
		case "UPDATE_NPC_OPINION": {
			const { npcId, characterId, change } = action.payload;
			return {
				...state,
				npcs: state.npcs.map((npc) => {
					if (npc.id === npcId) {
						const currentOpinion = npc.opinion?.[characterId] || 0;
						const newOpinion = currentOpinion + change;
						return {
							...npc,
							opinion: {
								...npc.opinion,
								[characterId]: newOpinion,
							},
						};
					}
					return npc;
				}),
			};
		}

		// --- Reducer Battle State BARU ---
		case "SET_BATTLE_STATE":
			return { ...state, battleState: action.payload };

		case "SET_BATTLE_GRID":
			if (!state.battleState) return state;
			return {
				...state,
				battleState: { ...state.battleState, gridMap: action.payload },
			};

		case "SET_BATTLE_MAP_IMAGE":
			if (!state.battleState) return state;
			return {
				...state,
				battleState: { ...state.battleState, mapImageUrl: action.payload },
			};

		case "SET_BATTLE_UNITS":
			if (!state.battleState) return state;
			return {
				...state,
				battleState: { ...state.battleState, units: action.payload },
			};

		case "SET_ACTIVE_BATTLE_UNIT":
			if (!state.battleState) return state;
			return {
				...state,
				battleState: { ...state.battleState, activeUnitId: action.payload },
			};

		case "CLEAR_BATTLE_STATE": // BARU
			return {
				...state,
				battleState: null,
				gameState: "exploration", // Pastikan state kembali ke eksplorasi
				initiativeOrder: [],
				currentPlayerId: state.players.length > 0 ? state.players[0].id : null, // Kembalikan ke pemain pertama
			};

		case "SET_FOG_OF_WAR": // BARU: Fase 5
			return { ...state, fogOfWar: action.payload };

		case "MOVE_UNIT": {
			// Diadaptasi dari P2 (ai-native...)
			if (!state.battleState) return state;
			const { unitId, newPosition, cost } = action.payload;
			return {
				...state,
				battleState: {
					...state.battleState,
					units: state.battleState.units.map((u) =>
						u.id === unitId
							? {
								...u,
								gridPosition: newPosition,
								remainingMovement: u.remainingMovement - cost,
							}
							: u
					),
				},
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
		battleState: null, // BARU: Inisialisasi battleState
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

		// --- Implementasi Aksi Battle State BARU ---
		const setBattleState = (state: BattleState | null) =>
			dispatch({ type: "SET_BATTLE_STATE", payload: state });
		const setBattleGrid = (grid: GridCell[][]) =>
			dispatch({ type: "SET_BATTLE_GRID", payload: grid });
		const setBattleMapImage = (url: string) =>
			dispatch({ type: "SET_BATTLE_MAP_IMAGE", payload: url });
		const setBattleUnits = (units: Unit[]) =>
			dispatch({ type: "SET_BATTLE_UNITS", payload: units });
		const setActiveBattleUnit = (id: string | null) =>
			dispatch({ type: "SET_ACTIVE_BATTLE_UNIT", payload: id });
		const moveUnit = (payload: {
			unitId: string;
			newPosition: { x: number; y: number };
			cost: number;
		}) => dispatch({ type: "MOVE_UNIT", payload: payload });
		const clearBattleState = () => dispatch({ type: "CLEAR_BATTLE_STATE" }); // BARU
		const setFogOfWar = (fog: boolean[][]) =>
			dispatch({ type: "SET_FOG_OF_WAR", payload: fog }); // BARU: Fase 5

		// (Poin 5) Ganti implementasi action
		const advanceTime = (seconds: number) =>
			dispatch({ type: "ADVANCE_TIME", payload: seconds });
		const setWeather = (weather: WorldWeather) =>
			dispatch({ type: "SET_WEATHER", payload: weather });
		// (Poin 7)
		const awardXp = (characterId: string, amount: number) =>
			dispatch({ type: "AWARD_XP", payload: { characterId, amount } });
		// (Poin 4)
		const updateNpcOpinion = (
			npcId: string,
			characterId: string,
			change: number
		) =>
			dispatch({
				type: "UPDATE_NPC_OPINION",
				payload: { npcId, characterId, change },
			});

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

			// BARU
			setBattleState,
			setBattleGrid,
			setBattleMapImage,
			setBattleUnits,
			setActiveBattleUnit,
			moveUnit,
			clearBattleState, // BARU
			setFogOfWar, // BARU

			// (Poin 5) Ganti
			advanceTime,
			setWeather,
			awardXp, // (Poin 7)
			updateNpcOpinion, // (Poin 4)
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
					// FASE 3: Gunakan findMonster dari registry
					const template = findMonster(m.name);

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
						// FASE 2 FALLBACK: AI mengarang nama monster.
						console.warn(
							`Monster template "${m.name}" tidak ditemukan. Menggunakan fallback 'Goblin'.`
						);
						// Coba fallback ke 'Goblin'
						const fallbackTemplate = findMonster("Goblin");
						if (fallbackTemplate) {
							for (let i = 0; i < m.quantity; i++) {
								const uniqueName =
									m.quantity > 1 ? `Goblin (???) ${i + 1}` : `Goblin (???)`;
								newMonsters.push({
									instanceId: generateId("monster-fallback"),
									definition: fallbackTemplate,
									name: uniqueName,
									currentHp: fallbackTemplate.maxHp,
									initiative: 0,
									conditions: [],
								});
							}
							// Log ke event game agar DM (pemain) tahu AI salah
							logEvent(
								{
									type: "system",
									text: `--- SYSTEM: AI mencoba memunculkan monster '${m.name}' yang tidak ada. Menggantinya dengan 'Goblin'. ---`,
								},
								campaign.turnId || "turn-fallback"
							);
						} else {
							console.error(
								"FALLBACK GAGAL: Template 'Goblin' tidak ditemukan."
							);
						}
					}
				});

				if (newMonsters.length > 0) {
					dispatch({ type: "ADD_MONSTERS", payload: newMonsters });
					setGameState("combat"); // Otomatis masuk mode combat
				}
			},
		};
	}, []); // (dispatch dijamin stabil, gameState tidak diperlukan)

	const fullCampaignState = useMemo(
		() => ({
			...campaign,
			players: campaign.players,
		}),
		[campaign]
	);

	return { campaign: fullCampaignState, campaignActions: actions };
};
