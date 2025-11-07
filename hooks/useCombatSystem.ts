import { useCallback, useEffect } from "react";
import { CampaignState, CampaignActions } from "./useCampaign";
// FASE 0: Hapus dependensi UI store dari hook logika
// import { useAppStore } from "../store/appStore"; 
import {
	Character,
	DiceRoll,
	RollRequest,
	CharacterInventoryItem,
	SpellDefinition,
	MonsterInstance,
	StructuredApiResponse,
	ToolCall,
	Ability,
    // BARU: Impor tipe dari Fase 1 & 3
    BattleState,
    BattleStatus,
    GridCell,
    TerrainType,
    Unit,
} from "../types";
import {
	rollInitiative,
	rollDice,
	getAbilityModifier,
	getProficiencyBonus,
	// FASE 0: Hapus logic Level Up
	// xpToNextLevel, 
} from "../utils";
// REFAKTOR G-2: Ganti impor geminiService
import { gameService } from "../services/ai/gameService";
import { generationService } from "../services/ai/generationService";
// BARU: Impor renderer
import { renderMapLayout } from "../services/pixelRenderer"; 
import { BATTLE_TILESET } from "../data/tileset";
// (Cleanup DRY) Impor dari utils
import { parseAndLogNarration } from "../utils";


interface CombatSystemProps {
	campaign: CampaignState;
	character: Character; // Karakter *kita*
	players: Character[]; // SEMUA karakter di sesi ini
	campaignActions: CampaignActions;
	onCharacterUpdate: (character: Character) => void; // FASE 1 (Tugas 3)
}

export const useCombatSystem = ({
	campaign,
	character,
	players,
	campaignActions,
	onCharacterUpdate, // FASE 1 (Tugas 3)
}: CombatSystemProps) => {
	const processToolCalls = useCallback(
		(turnId: string, toolCalls: ToolCall[]) => {
			toolCalls.forEach((call) => {
				let message = "";
				switch (call.functionName) {
					case "add_items_to_inventory":
						campaignActions.addItemsToInventory(call.args);
						message = `Inventaris diperbarui: ${call.args.items
							.map((i: any) => `${i.name} (x${i.quantity})`)
							.join(", ")}`;
						break;
					case "update_quest_log":
						campaignActions.updateQuestLog(call.args);
						message = `Jurnal diperbarui: ${call.args.title}`;
						break;
					case "log_npc_interaction":
						campaignActions.logNpcInteraction(call.args);
						message = `Catatan NPC diperbarui: ${call.args.npcName}`;
						break;
					case "spawn_monsters":
					campaignActions.spawnMonsters(call.args.monsters);
					message = `Bahaya! Musuh baru muncul!`;
					break;
                // (Poin 7) Tangani tool XP
                case 'award_xp': { // FASE 3: Tambah block scope
                    const player = players.find(p => p.id === call.args.characterId);
                    if (player) {
                        campaignActions.awardXp(call.args.characterId, call.args.amount);
                        message = `${player.name} menerima ${call.args.amount} XP untuk: ${call.args.reason}`;
                        
                        // FASE 3: Cek Level Up (pasca-reducer)
                        // Mirip dengan explorationSystem, kita ambil state terbaru dari 'campaign.players'
                        // (yang merupakan prop hook yang diperbarui oleh reducer)
                        const updatedPlayerState = campaign.players.find(p => p.id === call.args.characterId);
                        if (updatedPlayerState) {
                            // Panggil onCharacterUpdate untuk SSoT (jika belum ditangani oleh logic HP)
							onCharacterUpdate(updatedPlayerState); 

							// FASE 0: Logika Level Up (UI) dipindahkan ke GameScreen.tsx
							// const xpForNextLevel = xpToNextLevel(updatedPlayerState.level);
							// if (xpForNextLevel > 0 && updatedPlayerState.xp >= xpForNextLevel) {
							//     useAppStore.getState().actions.triggerLevelUp(updatedPlayerState);
							// }
						}
					}
					break;
				}
                // (Poin 4) Tangani tool Opini
                case 'update_npc_opinion':
                    const npc = campaign.npcs.find(n => n.id === call.args.npcId);
                    const char = players.find(p => p.id === call.args.characterId);
                    if (npc && char) {
                        campaignActions.updateNpcOpinion(call.args.npcId, call.args.characterId, call.args.change);
                        message = `Opini ${npc.name} terhadap ${char.name} berubah (${call.args.change > 0 ? '+' : ''}${call.args.change} karena: ${call.args.reason})`;
                    }
                    break;
			}
				if (message) {
					campaignActions.logEvent(
						{ type: "system", text: `--- ${message} ---` },
						turnId
					);
				}
			});
		},
		[campaignActions, players, campaign.players, onCharacterUpdate] // FASE 3: Tambah dependensi
	);

	// =================================================================
	// FUNGSI INTI 1: handleRollComplete (HANYA menangani hasil roll)
	// =================================================================
	const handleRollComplete = useCallback(
		async (roll: DiceRoll, request: RollRequest, turnId: string) => {
			if (!turnId) {
				console.error(
					"Mencoba mencatat peristiwa kombat tanpa turnId eksplisit."
				);
				return;
			}

			campaignActions.setActiveRollRequest(null);

			// --- HANDLE DEATH SAVE ---
			if (request.type === "deathSave") {
				const playerToSave = players.find((p) => p.id === request.characterId);
				if (!playerToSave) return;

				const newSaves = { ...playerToSave.deathSaves };
				let message = `${playerToSave.name} membuat lemparan penyelamatan kematian... `;

				if (roll.total >= 10) {
					// Sukses
					newSaves.successes++;
					if (roll.total === 20) {
						message += ` LEMPARAN KRITIS! Dia sadar dengan 1 HP!`;
						const updatedChar = {
							...playerToSave,
							currentHp: 1,
							deathSaves: { successes: 0, failures: 0 },
						};
						onCharacterUpdate(updatedChar); // FASE 1 (Tugas 3)
						campaignActions.logEvent({ type: "system", text: message }, turnId);
						campaignActions.endTurn();
						return;
					}
					message += `dan berhasil! (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
				} else {
					// Gagal
					newSaves.failures++;
					if (roll.total === 1) {
						newSaves.failures++;
						message += " LEMPARAN KRITIS! Dihitung sebagai 2 kegagalan.";
					}
					message += `dan gagal. (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
				}

				campaignActions.logEvent({ type: "system", text: message }, turnId);
				const updatedChar = { ...playerToSave, deathSaves: newSaves };
				onCharacterUpdate(updatedChar); // FASE 1 (Tugas 3)

				if (newSaves.successes >= 3) {
					campaignActions.logEvent(
						{ type: "system", text: `${playerToSave.name} telah stabil!` },
						turnId
					);
				} else if (newSaves.failures >= 3) {
					campaignActions.logEvent(
						{ type: "system", text: `${playerToSave.name} telah tewas.` },
						turnId
					);
				}

				campaignActions.endTurn();
				return;
			}

			// --- HANDLE ATTACK & DAMAGE ---
			let target: MonsterInstance | Character | undefined = [
				...campaign.monsters,
				...players,
			].find(
				(c) => ("ownerId" in c ? c.id : c.instanceId) === request.target?.id
			);

			if (!target) {
				console.error(
					"Target tidak ditemukan untuk penyelesaian lemparan kombat"
				);
				campaignActions.endTurn();
				return;
			}

			// --- STAGE: ATTACK ---
			if (request.stage === "attack") {
				const targetAC =
					"ownerId" in target
						? target.armorClass
						: target.definition.armorClass;
				const successText = roll.success
					? `mengenai (Total ${roll.total} vs AC ${targetAC})`
					: `gagal mengenai (Total ${roll.total} vs AC ${targetAC})`;

				const attacker = [...players, ...campaign.monsters].find(
					(c) => ("ownerId" in c ? c.id : c.instanceId) === request.characterId
				);
				const attackerName = attacker?.name || "Seseorang";

				const rollMessage = `${attackerName} menyerang ${target.name} dan ${successText}.`;
				campaignActions.logEvent({ type: "system", text: rollMessage }, turnId);

				if (roll.success) {
					let finalDamageDice = request.damageDice;

					// FITUR KELAS: Rogue - Sneak Attack (Kesenjangan #4)
					if (attacker && "ownerId" in attacker && attacker.class === "Rogue") {
						const isAdvantage = request.isAdvantage || false;
						const hasAllyNearby = players.some(
							(p) =>
								p.id !== attacker.id &&
								p.currentHp > 0 &&
								campaign.initiativeOrder.includes(p.id)
						);

						if (isAdvantage || hasAllyNearby) {
							const sneakAttackDice = `${Math.floor(
								(attacker.level + 1) / 2
							)}d6`;
							finalDamageDice = finalDamageDice
								? `${finalDamageDice}+${sneakAttackDice}`
								: sneakAttackDice;
							const reason = isAdvantage ? "(via Advantage)" : "(via Sekutu)";
							campaignActions.logEvent(
								{
									type: "system",
									text: `${attacker.name} menambahkan ${sneakAttackDice} Sneak Attack! ${reason}`,
								},
								turnId
							);
						}
					}

					const damageRollRequest: RollRequest = {
						type: "damage",
						characterId: request.characterId,
						reason: `Menentukan kerusakan terhadap ${target.name}`,
						target: {
							id: "ownerId" in target ? target.id : target.instanceId,
							name: target.name,
							ac: targetAC,
						},
						stage: "damage",
						damageDice: finalDamageDice,
					};

					if (attacker && "definition" in attacker) {
						// Ini MonsterInstance
						const damageResult = rollDice(
							damageRollRequest.damageDice || "1d4"
						);
						const simulatedDamageRoll: DiceRoll = {
							notation: damageRollRequest.damageDice || "1d4",
							rolls: damageResult.rolls,
							modifier: damageResult.modifier,
							total: damageResult.total,
							type: "damage",
						};
						setTimeout(() => {
							if (campaign.turnId === turnId) {
								handleRollComplete(
									simulatedDamageRoll,
									damageRollRequest,
									turnId
								);
							} else {
								console.warn(
									`Timeout damage roll untuk turn ${turnId} dibatalkan karena giliran sudah berakhir.`
								);
							}
						}, 500);
					} else {
						campaignActions.setActiveRollRequest(damageRollRequest);
					}
				} else {
					campaignActions.endTurn();
				}

				// --- STAGE: DAMAGE ---
			} else if (request.stage === "damage") {
				const newHp = Math.max(0, target.currentHp - roll.total);
				const rollMessage = `${target.name} menerima ${roll.total} kerusakan! Sisa HP: ${newHp}.`;
				campaignActions.logEvent({ type: "system", text: rollMessage }, turnId);

				// F2.4: Hapus kondisi 'Hidden' dari penyerang
				const attacker = players.find((p) => p.id === request.characterId);
				let attackerToSave = attacker; // Variabel sementara

				if (attacker && attacker.conditions.includes("Hidden")) {
					attackerToSave = {
						...attacker,
						conditions: attacker.conditions.filter((c) => c !== "Hidden"),
					};
					// Update SSoT penyerang
					onCharacterUpdate(attackerToSave); // FASE 1 (Tugas 3)
					campaignActions.logEvent(
						{
							type: "system",
							text: `${attacker.name} tidak lagi tersembunyi!`,
						},
						turnId
					);
				}

				if ("ownerId" in target) {
					// it's a Character (Player)
					// Cek jika target adalah penyerang (misal, menyerang diri sendiri?)
					// Ini skenario langka, tapi kita harus tangani agar tidak menimpa state
					if (attackerToSave && target.id === attackerToSave.id) {
						// State 'attackerToSave' sudah punya update 'Hidden', tambahkan update 'currentHp'
						const updatedTarget = { ...attackerToSave, currentHp: newHp };
						onCharacterUpdate(updatedTarget); // FASE 1 (Tugas 3)
					} else {
						// Target adalah orang lain, simpan HP target
						const updatedTarget = { ...target, currentHp: newHp };
						onCharacterUpdate(updatedTarget); // FASE 1 (Tugas 3)
					}
				} else {
					// it's a Monster
					const updatedTarget = { ...target, currentHp: newHp };
					campaignActions.updateMonster(updatedTarget);
				}

				if (newHp === 0) {
					campaignActions.logEvent(
						{ type: "system", text: `${target.name} telah dikalahkan!` },
						turnId
					);
					if (!("ownerId" in target)) {
						campaignActions.removeMonster(target.instanceId);
					}
					// (Logika akhir kombat DIHAPUS dari sini)
				}
				campaignActions.endTurn();
			} else {
				campaignActions.endTurn();
			}
		},
		[
			players,
			campaign.monsters,
			campaign.turnId,
			campaign.initiativeOrder,
			campaignActions,
			onCharacterUpdate,
		] // FASE 1 (Tugas 3)
	); // <-- processToolCalls dihapus dari dependensi

	// =================================================================
	// FUNGSI INTI 2: processMechanics (Menentukan aksi)
	// =================================================================
	const processMechanics = useCallback(
		(
			turnId: string,
			mechanics: Omit<StructuredApiResponse, "reaction" | "narration">,
			originalActionText: string
		) => {
			if (!turnId) {
				console.error("processMechanics dipanggil tanpa turnId aktif!");
				return;
			}

			let turnShouldEnd = true;

			if (mechanics.tool_calls && mechanics.tool_calls.length > 0) {
				processToolCalls(turnId, mechanics.tool_calls);
				if (
					mechanics.tool_calls.some((c) => c.functionName === "spawn_monsters")
				) {
					turnShouldEnd = false; // Biarkan combat loop baru mengambil alih
				}
			}

			const hasChoices = mechanics.choices && mechanics.choices.length > 0;
			const hasRollRequest = !!mechanics.rollRequest;
			const isMonsterTurn = campaign.monsters.some(
				(m) => m.instanceId === campaign.currentPlayerId
			);

			if (hasChoices) {
				campaignActions.setChoices(mechanics.choices!);
				turnShouldEnd = false;
			}

			if (hasRollRequest) {
				const request = mechanics.rollRequest!;
				const fullRollRequest: RollRequest = {
					...request,
					characterId: campaign.currentPlayerId!,
					originalActionText: originalActionText,
					isAdvantage: request.isAdvantage,
					isDisadvantage: request.isDisadvantage,
				};

				if (isMonsterTurn) {
					// --- Logika Auto-Roll Monster ---
					const monster = campaign.monsters.find(
						(m) => m.instanceId === campaign.currentPlayerId
					)!;
					let rollNotation = "1d20";
					let modifier = 0;
					let dc = 10;
					let damageDice = "1d4";

					if (request.type === "attack") {
						const targetPlayer =
							players.find((p) => p.id === request.target?.id) ||
							players.find((p) => p.currentHp > 0) ||
							players[0];
						if (!targetPlayer) {
							campaignActions.logEvent(
								{
									type: "system",
									text: `${monster.name} tidak menemukan target.`,
								},
								turnId
							);
						} else {
							const monsterAction =
								monster.definition.actions.find((a) =>
									request.reason.toLowerCase().includes(a.name.toLowerCase())
								) || monster.definition.actions[0];

							modifier = monsterAction.toHitBonus || 0;
							dc = targetPlayer.armorClass;
							damageDice = monsterAction.damageDice || "1d4";

							fullRollRequest.stage = "attack";
							fullRollRequest.damageDice = damageDice;
							fullRollRequest.target = {
								id: targetPlayer.id,
								name: targetPlayer.name,
								ac: dc,
							};

							const result = rollDice(rollNotation);
							const total = result.total + modifier;
							const success = total >= dc;
							const simulatedRoll: DiceRoll = {
								notation: rollNotation,
								rolls: result.rolls,
								modifier: modifier,
								total: total,
								success: success,
								type: request.type,
							};

							setTimeout(() => {
								if (campaign.turnId === turnId) {
									// PANGGILAN AMAN: processMechanics -> handleRollComplete (tidak ada circular)
									handleRollComplete(simulatedRoll, fullRollRequest, turnId);
								}
							}, 500);
							turnShouldEnd = false;
						}
					} else {
						campaignActions.logEvent(
							{
								type: "system",
								text: `${monster.name} mencoba ${request.reason} (auto-roll).`,
							},
							turnId
						);
						// (Logika roll non-attack monster)
					}
				} else {
					// --- Ini Roll Request untuk Pemain ---
					campaignActions.setActiveRollRequest(fullRollRequest);
					turnShouldEnd = false;
				}
			}

			if (turnShouldEnd) {
				if (!campaign.activeRollRequest || isMonsterTurn) {
					const delay = isMonsterTurn ? 500 : 0;
					setTimeout(() => {
						if (campaign.turnId === turnId) {
							campaignActions.endTurn();
						}
					}, delay);
				}
			}
		},
		[
			campaign.currentPlayerId,
			campaign.monsters,
			players,
			campaignActions,
			processToolCalls,
			handleRollComplete,
			campaign.activeRollRequest,
			campaign.turnId,
		]
	); // <-- handleRollComplete adalah dependensi yang valid

	// =================================================================
	// FUNGSI INTI 3: advanceTurn (Menangani alur giliran)
	// =================================================================
	const advanceTurn = useCallback(async () => {
		// --- 1A. CEK TPK (Total Party Kill) (F1.2) ---
		const playersInCombat = players.filter((p) =>
			campaign.initiativeOrder.includes(p.id)
		);
		const allPlayersDown =
			playersInCombat.length > 0 &&
			playersInCombat.every((p) => p.currentHp <= 0);

		if (campaign.gameState === "combat" && allPlayersDown) {
			// Jika semua pemain di 0 HP (dying atau dead), TPK terjadi.
			const turnId = campaignActions.startTurn();
			campaignActions.logEvent(
				{
					type: "system",
					text: "Semua petualang telah gugur. Kegelapan menyelimuti...",
				},
				turnId
			);
			campaignActions.setGameState("exploration"); // Akhiri loop kombat
			campaignActions.logEvent(
				{
					type: "dm_narration",
					text: "Dunia menjadi hening saat kesadaran terakhir memudar. Petualangan ini telah berakhir tragis.",
				},
				turnId
			);
			campaignActions.setChoices(["Petualangan Telah Berakhir."]);
			// Kita tidak endTurn() agar UI terkunci di pesan "Game Over"
			return; // Stop
		}

		// --- 1B. CEK AKHIR KOMBAT (Kemenangan) ---
			// Cek jika kombat *seharusnya* berakhir (Monster mati)
			if (
				campaign.gameState === "combat" &&
				campaign.monsters.length > 0 &&
				campaign.monsters.every((m) => m.currentHp === 0)
			) {
                // BARU: Panggil aksi pembersihan
                campaignActions.clearBattleState(); 

				const turnId = campaignActions.startTurn(); // Mulai "turn" cleanup
				campaignActions.logEvent(
				{
					type: "system",
					text: "Semua musuh telah dikalahkan! Pertarungan berakhir.",
				},
				turnId
			);
			campaignActions.setGameState("exploration");
			try {
				const actionText =
					"Pertarungan telah berakhir. Apa yang terjadi selanjutnya?";

				// REFAKTOR G-2: Ganti Panggilan "Two-Step" menjadi "One-Step"
				// PANGGILAN ATOMIK: Dapatkan Narasi Akhir Kombat + Mekanik (loot, quest, dll)
				const response = await gameService.generateTurnResponse(
					campaign,
					players,
					actionText,
					null, // (Poin 6) Tidak ada pelaku aksi spesifik di akhir kombat
					campaignActions.setThinkingState
				);

				// 1. Log Narasi
				if (response.reaction)
					campaignActions.logEvent(
						{ type: "dm_reaction", text: response.reaction },
						turnId
					);
                // (Poin 3) Gunakan parser baru untuk dialog
                parseAndLogNarration(response.narration, turnId, campaignActions);

				// 2. Proses Mekanik
				// PANGGILAN AMAN: advanceTurn -> processMechanics (tidak ada circular)
				processMechanics(turnId, response, actionText);

				// Jika tidak ada roll/choice, mechanics akan panggil endTurn()
				// Jika ada choice, turnId akan tetap aktif
			} catch (e) {
				console.error("Gagal memproses akhir kombat:", e);
				campaignActions.endTurn(); // Pastikan turn berakhir jika AI error
			}
			return; // Stop, jangan lanjut ke giliran kombat berikutnya
		}

		// --- 2. JIKA KOMBAT LANJUT: Logika Giliran Normal ---
		const { initiativeOrder, currentPlayerId, monsters } = campaign;
		if (initiativeOrder.length === 0 || campaign.turnId) return; // Jangan advance jika giliran sedang berjalan

		const currentIndex = initiativeOrder.findIndex(
			(id) => id === currentPlayerId
		);
		const nextIndex = (currentIndex + 1) % initiativeOrder.length;
		const nextPlayerId = initiativeOrder[nextIndex];

		const turnId = campaignActions.startTurn();
		campaignActions.setCurrentPlayerId(nextPlayerId);

		const nextCombatant = [...players, ...monsters].find(
			(c) => ("ownerId" in c ? c.id : c.instanceId) === nextPlayerId
		);

		if (nextCombatant) {
			campaignActions.logEvent(
				{ type: "system", text: `Sekarang giliran ${nextCombatant.name}.` },
				turnId
			);

			if ("definition" in nextCombatant) {
				// It's a MonsterInstance
				if (nextCombatant.currentHp <= 0) {
					campaignActions.logEvent(
						{ type: "system", text: `${nextCombatant.name} sudah mati.` },
						turnId
					);
					campaignActions.endTurn(); // Langsung lewati giliran
					return;
				}
				try {
					const playerTargets = players.filter((p) => p.currentHp > 0);
					const target =
						playerTargets[Math.floor(Math.random() * playerTargets.length)];

					if (target) {
						const actionText = `${nextCombatant.name} menyerang ${target.name}.`;

						// REFAKTOR G-2: Ganti Panggilan "Two-Step" menjadi "One-Step"
						// PANGGILAN ATOMIK: Dapatkan Narasi Aksi Monster + Mekanik
						const response = await gameService.generateTurnResponse(
							campaign,
							players,
							actionText,
							nextCombatant.instanceId, // (Poin 6) Kirim ID pelaku aksi (monster)
							campaignActions.setThinkingState
						);

						// 1. Log Narasi
						if (response.reaction)
							campaignActions.logEvent(
								{ type: "dm_reaction", text: response.reaction },
								turnId
							);
                        // (Poin 3) Gunakan parser baru untuk dialog
                        parseAndLogNarration(response.narration, turnId, campaignActions);

						// 2. Proses Mekanik (yang akan di-auto-roll)
						// PANGGILAN AMAN: advanceTurn -> processMechanics
						processMechanics(turnId, response, actionText);
					} else {
						campaignActions.logEvent(
							{
								type: "dm_narration",
								text: `${nextCombatant.name} tidak menemukan target.`,
							},
							turnId
						);
						campaignActions.endTurn();
					}
				} catch (e) {
					console.error("AI Monster turn failed", e);
					campaignActions.logEvent(
						{
							type: "system",
							text: `${nextCombatant.name} ragu-ragu sejenak.`,
						},
						turnId
					);
					campaignActions.endTurn();
				}
			} else {
				// It's a player's turn
				const me = players.find((p) => p.id === nextPlayerId);
				if (
					me &&
					me.currentHp <= 0 &&
					me.deathSaves.failures < 3 &&
					me.deathSaves.successes < 3
				) {
					campaignActions.setActiveRollRequest({
						type: "deathSave",
						characterId: me.id,
						reason:
							"Membuat lemparan penyelamatan kematian untuk bertahan hidup.",
					});
					// (turnId tetap aktif, menunggu RollModal)
				}
				// Jika player hidup, kita tidak endTurn(). Kita tunggu aksi mereka.
			}
		} else {
			console.warn(`Combatant dengan ID ${nextPlayerId} tidak ditemukan.`);
			campaignActions.endTurn();
		}
	}, [campaign, players, campaignActions, processMechanics]); // <-- 'processMechanics' adalah dependensi yang valid

	// BARU: Helper untuk generate grid data (diadaptasi dari P2)
    const generateProceduralGrid = (width: number, height: number): GridCell[][] => {
        const gridMap = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => ({
                terrain: TerrainType.Plains, // Default Terrain
                elevation: 0,
            }))
        );
        // Tambahkan rintangan acak
        for (let i = 0; i < (width * height) * 0.1; i++) { // 10% rintangan
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            gridMap[y][x].terrain = TerrainType.Obstacle;
        }
        // Tambahkan medan sulit acak
        for (let i = 0; i < (width * height) * 0.15; i++) { // 15% medan sulit
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            if (gridMap[y][x].terrain === TerrainType.Plains) {
                gridMap[y][x].terrain = TerrainType.Difficult;
            }
        }
        return gridMap;
    };

	// Effect untuk memulai kombat (DI-UPGRADE)
	useEffect(() => {
        // Jangan jalankan jika (A) bukan kombat, (B) kombat sudah berjalan, (C) tidak ada monster
		if (
			campaign.gameState !== "combat" ||
			campaign.initiativeOrder.length > 0 ||
			campaign.monsters.length === 0
		) {
			return;
		}

        // --- BARU: Alur Persiapan Peta Tempur ---
        const setupBattlefield = async () => {
            const turnId = campaignActions.startTurn(); // Mulai "setup turn"
            
            // 1. Buat Data Grid (Logika P2)
            const gridData = generateProceduralGrid(30, 20); // 30x20
            
            // 2. Buat Data Unit (Logika P1 + P2)
            const playerUnits: Unit[] = players
                .filter(p => campaign.playerIds.includes(p.id))
                .map((p, i) => ({
                    id: p.id,
                    name: p.name,
                    isPlayer: true,
                    hp: p.currentHp,
                    maxHp: p.maxHp,
                    movementSpeed: Math.floor(p.speed / 5), // Konversi ft ke sel
                    remainingMovement: Math.floor(p.speed / 5),
                    gridPosition: { x: 2, y: 5 + i*2 } 
                }));

            const monsterUnits: Unit[] = campaign.monsters.map((m, i) => ({
                id: m.instanceId,
                name: m.name,
                isPlayer: false,
                hp: m.currentHp,
                maxHp: m.definition.maxHp,
                movementSpeed: 6, 
                remainingMovement: 6,
                gridPosition: { x: 25, y: 5 + i*2 } 
            }));
            
            const allUnits = [...playerUnits, ...monsterUnits];

            // 3. Hitung Inisiatif (Logika P1)
            const initiatives = allUnits.map(u => {
                let dexScore = 10;
                if(u.isPlayer) {
                    dexScore = players.find(p => p.id === u.id)?.abilityScores.dexterity || 10;
                } else {
                    dexScore = campaign.monsters.find(m => m.instanceId === u.id)?.definition.abilityScores.dexterity || 10;
                }
                return {
                    id: u.id,
                    initiative: rollInitiative(dexScore)
                };
            });
            initiatives.sort((a, b) => b.initiative - a.initiative);
            const order = initiatives.map(i => i.id);

            // 4. Kirim State Awal (Grid, Unit, Urutan) ke Reducer
            campaignActions.setBattleState({
                status: BattleStatus.Active,
                gridMap: gridData,
                units: allUnits,
                turnOrder: order,
                activeUnitId: order[0],
                mapImageUrl: undefined, // Belum di-render
            });
            
            campaignActions.setInitiativeOrder(order); // (Sinkronkan state lama & baru)
            campaignActions.setCurrentPlayerId(order[0]); // (Sinkronkan state lama & baru)
            
            campaignActions.logEvent(
                {
                    type: "system",
                    text: `Pertarungan dimulai! Urutan inisiatif telah ditentukan.`,
                },
                turnId
            );

            // 5. Render Peta (Async)
            try {
                // Panggil Pixel Renderer (Fase 1)
                const layoutB64 = renderMapLayout(gridData, true);
                
                const mapTheme = "Reruntuhan Hutan (Forest Ruins)"; 
                
                // Panggil AI Service (Fase 1)
                const imageUrl = await generationService.generateBattleMapVisual(layoutB64, mapTheme);
                
                // Kirim URL Gambar ke Reducer
				campaignActions.setBattleMapImage(imageUrl);

			} catch (e) {
				console.error("Gagal men-generate visual peta tempur:", e);
				// (Pertarungan tetap lanjut tanpa gambar HD)
			}

			// FASE 4 FIX: Pindahkan endTurn() ke SINI (setelah await)
			// untuk mencegah race condition.
			campaignActions.endTurn(); // Selesaikan "setup turn"
		};
        
        setupBattlefield();

	}, [
		campaign.gameState,
		campaign.initiativeOrder.length,
		campaign.monsters,
        campaign.playerIds,
		players,
		campaignActions,
	]);

	// Effect untuk memajukan giliran (Tidak berubah)
	useEffect(() => {
		if (campaign.gameState === "combat" && !campaign.turnId) {
			advanceTurn();
		}
	}, [campaign.gameState, campaign.turnId, advanceTurn]);

	// =================================================================
	// FUNGSI AKSI PLAYER (Tidak berubah dari implementasi Fase 2)
	// =================================================================

	const handlePlayerAttack = useCallback(
		(targetInstanceId: string, item: CharacterInventoryItem) => {
			if (
				character.currentHp <= 0 ||
				!campaign.turnId ||
				campaign.currentPlayerId !== character.id
			) {
				return;
			}

			const target = campaign.monsters.find(
				(m) => m.instanceId === targetInstanceId
			);
			if (!target) return;

			const turnId = campaign.turnId;

			// F2.3: Tentukan Advantage/Disadvantage dasar
			const isAdvantage = character.conditions.includes("Hidden");
			const isDisadvantage = character.conditions.includes("Prone");
			
			const attackRollRequest: RollRequest = {
				type: "attack",
				characterId: character.id,
				reason: `Menyerang ${target.name} dengan ${item.item.name}`,
				target: {
					id: target.instanceId,
					name: target.name,
					ac: target.definition.armorClass,
				},
				item: item,
				stage: "attack",
				damageDice: item.item.damageDice,
				isAdvantage,
				isDisadvantage,
			};
			campaignActions.logEvent(
				{
					type: "player_action",
					characterId: character.id,
					text: `Menyerang ${target.name} dengan ${item.item.name}.`,
				},
				turnId
			);
			campaignActions.setActiveRollRequest(attackRollRequest);
		},
		[
			campaign.monsters,
			campaign.turnId,
			campaign.currentPlayerId,
			character,
			campaignActions,
		]
	);

	const handleSecondWind = useCallback(async () => {
		if (
			character.currentHp <= 0 ||
			!campaign.turnId ||
			campaign.currentPlayerId !== character.id ||
			character.class !== "Fighter"
		) {
			return;
		}
		const turnId = campaign.turnId;

		if (character.usedBonusAction) {
			campaignActions.logEvent(
				{
					type: "system",
					text: `${character.name} sudah menggunakan Bonus Action.`,
				},
				turnId
			);
			return;
		}

		const roll = rollDice(`1d10`);
		const healing = roll.total + character.level;
		const newHp = Math.min(character.maxHp, character.currentHp + healing);
		const healedAmount = newHp - character.currentHp;

		if (healedAmount <= 0) {
			campaignActions.logEvent(
				{
					type: "system",
					text: `${character.name} mencoba menggunakan Second Wind, tapi HP sudah penuh.`,
				},
				turnId
			);
			return;
		}

		campaignActions.logEvent(
			{
				type: "system",
				text: `${character.name} menggunakan Second Wind (Bonus Action) dan memulihkan ${healedAmount} HP (Total Roll: ${healing})!`,
			},
			turnId
		);

		await updateCharacter({
			...character,
			currentHp: newHp,
			usedBonusAction: true,
		});
	},
		[
			character,
			campaign.turnId,
			campaign.currentPlayerId,
			onCharacterUpdate, // FASE 1 (Tugas 3)
			campaignActions,
		]
	);

	const handleItemUse = useCallback(
		async (item: CharacterInventoryItem) => {
			if (
				character.currentHp <= 0 ||
				!campaign.turnId ||
				campaign.currentPlayerId !== character.id
			) {
				return;
			}

			if (
				item.item.type === "consumable" &&
				item.item.effect?.type === "heal"
			) {
				const turnId = campaign.turnId;
				const healingResult = rollDice(item.item.effect.dice || "2d4+2");
				const healing = healingResult.total;
				const newHp = Math.min(character.maxHp, character.currentHp + healing);
				const healedAmount = newHp - character.currentHp;

				campaignActions.logEvent(
					{
						type: "system",
						text: `${character.name} menggunakan ${item.item.name} dan memulihkan ${healedAmount} HP (Total: ${healing}).`,
					},
					turnId
				);

				const newInventory = character.inventory
					.map((i) =>
						i.instanceId === item.instanceId
							? { ...i, quantity: i.quantity - 1 }
							: i
					)
					.filter((i) => i.quantity > 0);

				const updatedCharacter = {
					...character,
					currentHp: newHp,
					inventory: newInventory,
				};
				await updateCharacter(updatedCharacter);
				campaignActions.endTurn();
			}
		},
		[
			character,
			campaign.turnId,
			campaign.currentPlayerId,
			onCharacterUpdate, // FASE 1 (Tugas 3)
			campaignActions,
		]
	);

	const handleSpellCast = useCallback(
		async (spell: SpellDefinition) => {
			if (
				character.currentHp <= 0 ||
				!campaign.turnId ||
				campaign.currentPlayerId !== character.id
			) {
				return;
			}
			const turnId = campaign.turnId;
			let isTurnEndingAction = false;
			let usedAction = false;
			let updatedCharacterState = { ...character };

			if (spell.castingTime === "bonus_action") {
				if (character.usedBonusAction) {
					campaignActions.logEvent(
						{
							type: "system",
							text: `${character.name} sudah menggunakan Bonus Action.`,
						},
						turnId
					);
					return;
				}
				updatedCharacterState.usedBonusAction = true;
				campaignActions.logEvent(
					{
						type: "player_action",
						characterId: character.id,
						text: `Merapal ${spell.name} (Bonus Action).`,
					},
					turnId
				);
				usedAction = true;
			} else if (spell.castingTime === "reaction") {
				campaignActions.logEvent(
					{
						type: "system",
						text: `Spell reaksi seperti ${spell.name} tidak bisa dirapal dari panel aksi.`,
					},
					turnId
				);
				return;
			} else {
				// Asumsikan 'action'
				campaignActions.logEvent(
					{
						type: "player_action",
						characterId: character.id,
						text: `Merapal ${spell.name} (Aksi).`,
					},
					turnId
				);
				isTurnEndingAction = true;
				usedAction = true;
			}

			if (usedAction) {
				// Habiskan Spell Slot
				if (spell.level > 0) {
					const slotIndex = character.spellSlots.findIndex(
						(s) => s.level === spell.level && s.spent < s.max
					);
					if (slotIndex > -1) {
						const newSlots = [...character.spellSlots];
						newSlots[slotIndex] = {
							...newSlots[slotIndex],
							spent: newSlots[slotIndex].spent + 1,
						};
						updatedCharacterState.spellSlots = newSlots;
					} else {
						campaignActions.logEvent(
							{
								type: "system",
								text: `${character.name} tidak punya slot Lvl ${spell.level} tersisa!`,
							},
							turnId
						);
						return;
					}
				}
				await updateCharacter(updatedCharacterState);
			}

			if (isTurnEndingAction) {
				campaignActions.endTurn();
			}
		},
		[
			character,
			campaign.turnId,
			campaign.currentPlayerId,
			onCharacterUpdate, // FASE 1 (Tugas 3)
			campaignActions,
		]
	);

	return {
		handlePlayerAttack,
		handleRollComplete,
		handleItemUse,
		handleSpellCast,
		handleSecondWind,
	};
};
