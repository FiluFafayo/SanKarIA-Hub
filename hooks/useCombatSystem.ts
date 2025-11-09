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
    Skill,
    // BARU: Impor tipe dari Fase 1 & 3
    BattleState,
    BattleStatus,
    GridCell,
    TerrainType,
    Unit,
    DamageType,
} from "../types";
import { RACES } from "../data/races";
import { CONDITION_RULES } from "../types";
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
import { parseAndLogNarration, composeAbortSignals } from "../utils";
import { useGameStore } from "../store/gameStore";
import { canDash, canDisengage, canDodge, canHide } from "../services/rulesEngine";


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
        async (turnId: string, toolCalls: ToolCall[]) => {
            for (const call of toolCalls) {
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
                        try {
                            const autoEnabled = useGameStore.getState().runtime.runtimeSettings.autoNpcPortraits;
                            if (autoEnabled) {
                                // Tandai pending sebelum generate agar UI bisa menampilkan status
                                campaignActions.logNpcInteraction({ ...call.args, imagePending: true });
                                const portraitUrl = await generationService.autoCreateNpcPortrait(call.args.description || call.args.summary);
                                campaignActions.logNpcInteraction({ ...call.args, image: portraitUrl, imagePending: false });
                            } else {
                                // Jika dimatikan, tetap log interaksi tanpa gambar
                                campaignActions.logNpcInteraction({ ...call.args, imagePending: false });
                            }
                        } catch (err) {
                            console.warn('Gagal membuat potret NPC otomatis (combat):', err);
                            // Bersihkan pending agar tidak menggantung
                            campaignActions.logNpcInteraction({ ...call.args, imagePending: false });
                        }
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
            }
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

			// --- HANDLE SAVING THROW ---
			if (request.type === "savingThrow") {
				const target: MonsterInstance | Character | undefined = [
					...campaign.monsters,
					...players,
				].find(
					(c) => ("ownerId" in c ? c.id : c.instanceId) === request.target?.id
				);
				if (!target) {
					campaignActions.logEvent({ type: 'system', text: `Target saving throw tidak ditemukan.` }, turnId);
					campaignActions.endTurn();
					return;
				}

				const succeeded = !!roll.success;
				const reason = (request.reason || '').toLowerCase();
				let appliedCondition: string | null = null;
				if (!succeeded) {
					if (reason.includes('poison')) appliedCondition = 'Poisoned';
					else if (reason.includes('blind')) appliedCondition = 'Blinded';
					else if (reason.includes('fright')) appliedCondition = 'Frightened';
					else if (reason.includes('restrain') || reason.includes('entangle') || reason.includes('web')) appliedCondition = 'Restrained';
					else if (reason.includes('paraly')) appliedCondition = 'Paralyzed';
					else if (reason.includes('stun')) appliedCondition = 'Stunned';
					else if (reason.includes('charm')) appliedCondition = 'Charmed';
					else if (reason.includes('petrif') || reason.includes('flesh to stone')) appliedCondition = 'Petrified';
				}

				if (appliedCondition) {
					const text = `${target.name} gagal saving throw dan terkena kondisi ${appliedCondition}.`;
					campaignActions.logEvent({ type: 'system', text }, turnId);
					if ("ownerId" in target) {
						const updated = { ...target, conditions: [...target.conditions, appliedCondition] };
						onCharacterUpdate(updated);
					} else {
						const updated = { ...target, conditions: [...target.conditions, appliedCondition] };
						campaignActions.updateMonster(updated);
					}
				} else {
					const text = `${target.name} berhasil saving throw${reason ? ` terhadap '${request.reason}'` : ''}.`;
					campaignActions.logEvent({ type: 'system', text }, turnId);
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

				// Coba reaksi Shield pada target pemain bila serangan mengenai namun akan meleset dengan +5 AC
				let shieldNegated = false;
				if (roll.success && ("ownerId" in target)) {
					const hasShieldSpell = target.knownSpells?.some((s) => s.name === "Shield");
					const hasReaction = !target.usedReaction;
					const slotIndex = target.spellSlots.findIndex((s) => s.level >= 1 && s.spent < s.max);
					const wouldMissWithShield = roll.total < (targetAC + 5);
					if (hasShieldSpell && hasReaction && slotIndex > -1 && wouldMissWithShield) {
						const newSlots = [...target.spellSlots];
						newSlots[slotIndex] = { ...newSlots[slotIndex], spent: newSlots[slotIndex].spent + 1 };
						const shieldEffectId = `Shield-${Date.now()}`;
						const updatedTarget = {
							...target,
							spellSlots: newSlots,
							usedReaction: true,
							activeEffects: [
								...(target.activeEffects || []),
								{ id: shieldEffectId, label: 'Shield', sourceCharacterId: target.id, targetCharacterId: target.id, remainingRounds: 1, acBonus: 5 },
							],
							armorClass: target.armorClass + 5,
						};
						onCharacterUpdate(updatedTarget);
						campaignActions.logEvent({ type: 'system', text: `${target.name} menggunakan reaksi Shield: +5 AC hingga awal gilirannya berikutnya.` }, turnId);
						shieldNegated = true;
						successText = `gagal mengenai (Total ${roll.total} vs AC ${targetAC}+5)`;
					}
				}

				const isCritical = (request.type === "attack") && roll.rolls && roll.rolls[0] === 20;
				const rollMessage = `${attackerName} menyerang ${target.name} dan ${successText}${isCritical ? ' — KRITIS!' : ''}.`;
				campaignActions.logEvent({ type: "system", text: rollMessage }, turnId);

				if (roll.success && !shieldNegated) {
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
                        damageType: request.item?.item.damageType,
                        isCritical,
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
                // === DAMAGE PIPELINE ===
                let appliedDamage = roll.total;
                const appliedType = request.damageType;
                const wasCritical = !!request.isCritical;

                // Critical doubling
                if (wasCritical) {
                    appliedDamage = appliedDamage * 2;
                }

                // Collect defenses from target
                let resistances: DamageType[] = [];
                let immunities: DamageType[] = [];
                let vulnerabilities: DamageType[] = [];

                if ("ownerId" in target) {
                    const raceDef = RACES.find(r => r.name.toLowerCase() === target.race.toLowerCase());
                    resistances = raceDef?.damageResistances || [];
                    immunities = raceDef?.damageImmunities || [];
                    vulnerabilities = raceDef?.damageVulnerabilities || [];
                } else {
                    resistances = target.definition.damageResistances || [];
                    immunities = target.definition.damageImmunities || [];
                    vulnerabilities = target.definition.damageVulnerabilities || [];
                }

                // Apply type-based adjustments
                let pipelineNote = '';
                if (appliedType) {
                    if (immunities.includes(appliedType)) {
                        appliedDamage = 0;
                        pipelineNote = `(Imun terhadap ${appliedType})`;
                    } else if (resistances.includes(appliedType)) {
                        appliedDamage = Math.floor(appliedDamage / 2);
                        pipelineNote = `(Resistan terhadap ${appliedType})`;
                    } else if (vulnerabilities.includes(appliedType)) {
                        appliedDamage = appliedDamage * 2;
                        pipelineNote = `(Rentan terhadap ${appliedType})`;
                    }
                }

                const newHp = Math.max(0, target.currentHp - appliedDamage);
                const critText = wasCritical ? 'KRITIS! ' : '';
                const typeText = appliedType ? ` [${appliedType}]` : '';
                const rollMessage = `${target.name} menerima ${critText}${appliedDamage} kerusakan${typeText}${pipelineNote ? ' ' + pipelineNote : ''}! Sisa HP: ${newHp}.`;
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
        async (
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
                await processToolCalls(turnId, mechanics.tool_calls);
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
                            fullRollRequest.damageType = monsterAction.damageType;
                            fullRollRequest.target = {
                                id: targetPlayer.id,
                                name: targetPlayer.name,
                                ac: dc,
                            };

                            // Tentukan advantage/disadvantage dari kondisi
                            const attackerConds = monster.conditions || [];
                            const targetConds = targetPlayer.conditions || [];
                            const targetEffs = targetPlayer.activeEffects || [];
                            const hasAdvFromAttacker = attackerConds.some((c) => CONDITION_RULES[c]?.attackAdvantage);
                            const hasDisFromAttacker = attackerConds.some((c) => CONDITION_RULES[c]?.attackDisadvantage);
                            const hasAdvFromTarget = targetConds.some((c) => CONDITION_RULES[c]?.grantsAdvantageToAttackers) || targetEffs.some((e) => (e as any).grantsAdvantageToAttackers);
                            const hasDisFromTarget = targetConds.some((c) => CONDITION_RULES[c]?.grantsDisadvantageToAttackers) || targetEffs.some((e) => e.grantsDisadvantageToAttackers);
                            let isAdv = !!(hasAdvFromAttacker || hasAdvFromTarget);
                            let isDis = !!(hasDisFromAttacker || hasDisFromTarget);
                            if (isAdv && isDis) { isAdv = false; isDis = false; }
                            fullRollRequest.isAdvantage = fullRollRequest.isAdvantage || isAdv;
                            fullRollRequest.isDisadvantage = fullRollRequest.isDisadvantage || isDis;

                            // Roll dengan adv/disadv jika perlu
                            const first = rollDice(rollNotation);
                            let pick = first;
                            let details = '';
                            if (fullRollRequest.isAdvantage) {
                                const second = rollDice(rollNotation);
                                pick = (first.total >= second.total) ? first : second;
                                details = `Advantage (${first.total} vs ${second.total})`;
                            } else if (fullRollRequest.isDisadvantage) {
                                const second = rollDice(rollNotation);
                                pick = (first.total <= second.total) ? first : second;
                                details = `Disadvantage (${first.total} vs ${second.total})`;
                            }
                            const total = pick.total + modifier;
                            const success = total >= dc;
                            const simulatedRoll: DiceRoll = {
                                notation: rollNotation,
                                rolls: pick.rolls,
                                modifier: modifier,
                                total: total,
                                success: success,
                                type: request.type,
                                details,
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
        // Cancellation & stale guards for AI calls inside combat
        const aiAbortRef = (advanceTurn as any)._abortRef || { current: null };
        const seqRef = (advanceTurn as any)._seqRef || { current: 0 };
        (advanceTurn as any)._abortRef = aiAbortRef;
        (advanceTurn as any)._seqRef = seqRef;
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
                    campaignActions.setThinkingState,
                    composeAbortSignals(
                        (advanceTurn as any)._abortRef?.current?.signal,
                        useGameStore.getState().runtime.sessionAbortController?.signal
                    )
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
                await processMechanics(turnId, response, actionText);

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

		// Tick durasi efek & konsentrasi pada karakter kita (runtime lokal)
		if (character.activeEffects && character.activeEffects.length > 0) {
			let effectsChanged = false;
			let newArmorClass = character.armorClass;
			const updatedEffects = character.activeEffects
				.map((e) => ({ ...e, remainingRounds: Math.max(0, (e.remainingRounds || 0) - 1) }))
				.filter((e) => {
					if (e.remainingRounds === 0) {
						// Efek habis: rollback AC jika ada
						if (e.acBonus) {
							newArmorClass = newArmorClass - e.acBonus;
						}
						campaignActions.logEvent({ type: 'system', text: `${character.name}: Efek ${e.label} berakhir.` }, turnId);
						effectsChanged = true;
						return false;
					}
					return true;
				});
			if (effectsChanged) {
				onCharacterUpdate({ ...character, activeEffects: updatedEffects, armorClass: newArmorClass });
			}
		}

		// Tick konsentrasi jika ada
		if (character.concentration) {
			const newRemaining = Math.max(0, character.concentration.remainingRounds - 1);
			let updatedChar = { ...character, concentration: { ...character.concentration, remainingRounds: newRemaining } };
			let concentrationEnded = false;
			if (newRemaining === 0) {
				// Hapus efek yang bergantung pada konsentrasi dari caster
				const toRemoveIds = (character.activeEffects || []).filter(e => e.isConcentration && e.sourceCharacterId === character.id).map(e => e.id);
				let newEffects = (character.activeEffects || []).filter(e => !toRemoveIds.includes(e.id));
				let newArmorClass = updatedChar.armorClass;
				for (const e of (character.activeEffects || [])) {
					if (toRemoveIds.includes(e.id) && e.acBonus) newArmorClass -= e.acBonus;
				}
				updatedChar = { ...updatedChar, activeEffects: newEffects, armorClass: newArmorClass, concentration: null };
				concentrationEnded = true;
				campaignActions.logEvent({ type: 'system', text: `${character.name}: Konsentrasi pada ${character.concentration.spellName} berakhir.` }, turnId);
			}
			if (newRemaining !== character.concentration.remainingRounds || concentrationEnded) {
				onCharacterUpdate(updatedChar);
			}
		}

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
                    // Cancel any in-flight AI call (monster or player)
                    if (aiAbortRef.current) aiAbortRef.current.abort();
                    aiAbortRef.current = new AbortController();
                    const mySeq = ++seqRef.current;
                    const response = await gameService.generateTurnResponse(
                            campaign,
                            players,
                            actionText,
                            nextCombatant.instanceId, // (Poin 6) Kirim ID pelaku aksi (monster)
                            campaignActions.setThinkingState,
                            composeAbortSignals(
                                aiAbortRef.current?.signal,
                                useGameStore.getState().runtime.sessionAbortController?.signal
                            )
                        );

                        // Drop stale responses if a newer combat step started
                        if (seqRef.current !== mySeq || campaign.turnId !== turnId) {
                            return;
                        }

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
                        await processMechanics(turnId, response, actionText);
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
                    movementSpeed: (() => {
                        const conds = p.conditions || [];
                        const speedZero = conds.some(c => CONDITION_RULES[c]?.speedZero);
                        const mults = conds.map(c => CONDITION_RULES[c]?.speedMultiplier).filter(Boolean) as number[];
                        const base = Math.floor(p.speed / 5);
                        if (speedZero) return 0;
                        const mult = mults.length > 0 ? mults.reduce((a, b) => a * b, 1) : 1;
                        return Math.max(0, Math.floor(base * mult));
                    })(), // Konversi ft ke sel dengan modifier kondisi
                    remainingMovement: (() => {
                        const conds = p.conditions || [];
                        const speedZero = conds.some(c => CONDITION_RULES[c]?.speedZero);
                        const mults = conds.map(c => CONDITION_RULES[c]?.speedMultiplier).filter(Boolean) as number[];
                        const base = Math.floor(p.speed / 5);
                        if (speedZero) return 0;
                        const mult = mults.length > 0 ? mults.reduce((a, b) => a * b, 1) : 1;
                        return Math.max(0, Math.floor(base * mult));
                    })(),
                    gridPosition: { x: 2, y: 5 + i * 2 }
                }));

            const monsterUnits: Unit[] = campaign.monsters.map((m, i) => ({
                id: m.instanceId,
                name: m.name,
                isPlayer: false,
                hp: m.currentHp,
                maxHp: m.definition.maxHp,
                movementSpeed: (() => {
                    const conds = m.conditions || [];
                    const speedZero = conds.some(c => CONDITION_RULES[c]?.speedZero);
                    const mults = conds.map(c => CONDITION_RULES[c]?.speedMultiplier).filter(Boolean) as number[];
                    const base = 6;
                    if (speedZero) return 0;
                    const mult = mults.length > 0 ? mults.reduce((a, b) => a * b, 1) : 1;
                    return Math.max(0, Math.floor(base * mult));
                })(),
                remainingMovement: (() => {
                    const conds = m.conditions || [];
                    const speedZero = conds.some(c => CONDITION_RULES[c]?.speedZero);
                    const mults = conds.map(c => CONDITION_RULES[c]?.speedMultiplier).filter(Boolean) as number[];
                    const base = 6;
                    if (speedZero) return 0;
                    const mult = mults.length > 0 ? mults.reduce((a, b) => a * b, 1) : 1;
                    return Math.max(0, Math.floor(base * mult));
                })(),
                gridPosition: { x: 25, y: 5 + i * 2 }
            }));

			const allUnits = [...playerUnits, ...monsterUnits];

			// 3. Hitung Inisiatif (Logika P1) + tie-breaker Dex mod
			const initiatives = allUnits.map(u => {
				let dexScore = 10;
				if (u.isPlayer) {
					dexScore = players.find(p => p.id === u.id)?.abilityScores.dexterity || 10;
				} else {
					dexScore = campaign.monsters.find(m => m.instanceId === u.id)?.definition.abilityScores.dexterity || 10;
				}
				const dexMod = getAbilityModifier(dexScore);
				return {
					id: u.id,
					initiative: rollInitiative(dexScore),
					dexMod,
				};
			});
			initiatives.sort((a, b) => {
				if (b.initiative !== a.initiative) return b.initiative - a.initiative;
				if (b.dexMod !== a.dexMod) return b.dexMod - a.dexMod;
				return a.id.localeCompare(b.id);
			});
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

		onCharacterUpdate({
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

	// BARU: Aksi Dash (Aksi Utama)
	const handleDash = useCallback(async () => {
		if (
			character.currentHp <= 0 ||
			!campaign.turnId ||
			campaign.currentPlayerId !== character.id
		) {
			return;
		}

		const check = canDash(character, campaign);
		if (!check.ok) {
			campaignActions.logEvent(
				{ type: "system", text: check.reason || "Tidak dapat melakukan Dash." },
				campaign.turnId!
			);
			return;
		}

		const turnId = campaign.turnId!;
		campaignActions.logEvent(
			{ type: "player_action", characterId: character.id, text: `${character.name} melakukan Dash (Aksi).` },
			turnId
		);

		// Tingkatkan movement unit aktif (jika ada battleState)
		if (campaign.battleState && campaign.battleState.activeUnitId) {
			const activeId = campaign.battleState.activeUnitId;
			const units = campaign.battleState.units.map(u =>
				u.id === activeId
					? { ...u, remainingMovement: u.movementSpeed * 2 }
					: u
			);
			campaignActions.setBattleUnits(units);
		}

		// Tandai aksi utama digunakan & akhiri giliran
		onCharacterUpdate({ ...character, usedAction: true });
		campaignActions.endTurn();
	}, [character, campaign.turnId, campaign.currentPlayerId, campaign.battleState, onCharacterUpdate, campaignActions]);

	// BARU: Aksi Disengage (Aksi Utama)
	const handleDisengage = useCallback(async () => {
		if (
			character.currentHp <= 0 ||
			!campaign.turnId ||
			campaign.currentPlayerId !== character.id
		) {
			return;
		}

		const check = canDisengage(character, campaign);
		if (!check.ok) {
			campaignActions.logEvent(
				{ type: "system", text: check.reason || "Tidak dapat melakukan Disengage." },
				campaign.turnId!
			);
			return;
		}

		const turnId = campaign.turnId!;
		campaignActions.logEvent(
			{ type: "player_action", characterId: character.id, text: `${character.name} melakukan Disengage (Aksi).` },
			turnId
		);

		// Jika ada battleState dan unit aktif adalah karakter kita, tandai disengage pada unit
		if (campaign.battleState && campaign.battleState.activeUnitId === character.id) {
			const units = campaign.battleState.units.map(u =>
				u.id === character.id ? { ...u, hasDisengaged: true } : u
			);
			campaignActions.setBattleUnits(units);
		}

		onCharacterUpdate({ ...character, usedAction: true });
		campaignActions.endTurn();
	}, [character, campaign.turnId, campaign.currentPlayerId, onCharacterUpdate, campaignActions]);

	// BARU: Aksi Dodge (Aksi Utama)
	const handleDodge = useCallback(async () => {
		if (
			character.currentHp <= 0 ||
			!campaign.turnId ||
			campaign.currentPlayerId !== character.id
		) {
			return;
		}

		const check = canDodge(character, campaign);
		if (!check.ok) {
			campaignActions.logEvent(
				{ type: "system", text: check.reason || "Tidak dapat melakukan Dodge." },
				campaign.turnId!
			);
			return;
		}

		const turnId = campaign.turnId!;
		campaignActions.logEvent(
			{ type: "player_action", characterId: character.id, text: `${character.name} mengambil posisi Dodge (Aksi).` },
			turnId
		);

		// Catatan: Efek Dodge (disadvantage pada penyerang) belum dimodelkan.
		onCharacterUpdate({ ...character, usedAction: true });
		campaignActions.endTurn();
	}, [character, campaign.turnId, campaign.currentPlayerId, onCharacterUpdate, campaignActions]);

	// BARU: Aksi Hide (Aksi Utama + Skill Stealth)
	const handleHide = useCallback(async () => {
		if (
			character.currentHp <= 0 ||
			!campaign.turnId ||
			campaign.currentPlayerId !== character.id
		) {
			return;
		}

		const check = canHide(character, campaign);
		if (!check.ok) {
			campaignActions.logEvent(
				{ type: "system", text: check.reason || "Tidak dapat melakukan Hide." },
				campaign.turnId!
			);
			return;
		}

		const turnId = campaign.turnId!;
		// Tentukan DC: gunakan Passive Perception tertinggi musuh hidup
		const aliveMonsters = campaign.monsters.filter(m => m.currentHp > 0);
		const dc = aliveMonsters.length > 0
			? Math.max(...aliveMonsters.map(m => m.definition.senses.passivePerception))
			: 10;

		// Disadvantage jika mengenakan armor dengan stealthDisadvantage
		const hasStealthDisadvantage = character.inventory.some(i => i.isEquipped && i.item.type === 'armor' && i.item.stealthDisadvantage);

		const hideRoll: RollRequest = {
			type: 'skill',
			characterId: character.id,
			reason: 'Mencoba bersembunyi',
			skill: Skill.Stealth,
			ability: Ability.Dexterity,
			dc,
			isDisadvantage: hasStealthDisadvantage,
		};

		campaignActions.logEvent(
			{ type: 'player_action', characterId: character.id, text: `${character.name} mencoba bersembunyi (Aksi).` },
			turnId
		);
		campaignActions.setActiveRollRequest(hideRoll);
	}, [character, campaign.turnId, campaign.currentPlayerId, campaign.monsters, onCharacterUpdate, campaignActions]);

	// Helper: cek sel bersebelahan (jarak Manhattan 1)
	const isAdjacent = useCallback((a: { x: number; y: number }, b: { x: number; y: number }) => {
		return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
	}, []);

	// Reaction: Monster melakukan Opportunity Attack terhadap target yang meninggalkan adjacency
	const triggerOpportunityAttack = useCallback((attackerUnitId: string, targetUnitId: string) => {
		const attackerMonster = campaign.monsters.find(m => m.instanceId === attackerUnitId);
		const targetPlayer = players.find(p => p.id === targetUnitId);
		const targetMonster = campaign.monsters.find(m => m.instanceId === targetUnitId);

		// Hanya auto-roll untuk monster; lewati OA oleh pemain untuk sekarang
		if (!attackerMonster) return;

		const attackerName = attackerMonster.name;
		let targetAC = 10;
		let targetName = "Target";
		if (targetPlayer) {
			targetAC = targetPlayer.armorClass;
			targetName = targetPlayer.name;
		} else if (targetMonster) {
			targetAC = targetMonster.definition.armorClass;
			targetName = targetMonster.name;
		}

        const action = attackerMonster.definition.actions[0];
        const toHit = action?.toHitBonus ?? 0;
        const damageDice = action?.damageDice ?? "1d4";
        const damageType = action?.damageType;

		const d20 = rollDice("1d20");
		const total = d20.total + toHit;
		const success = total >= targetAC;

		campaignActions.logEvent(
			{ type: "system", text: `${attackerName} melakukan Opportunity Attack terhadap ${targetName} (Total ${total} vs AC ${targetAC})${success ? " dan mengenai!" : "."}` },
			campaign.turnId!
		);

        if (success) {
            const dmg = rollDice(damageDice);
            let appliedDamage = dmg.total;
            const isCrit = d20.rolls[0] === 20;
            if (isCrit) {
                appliedDamage *= 2;
            }

            // Collect defenses
            let resistances: DamageType[] = [];
            let immunities: DamageType[] = [];
            let vulnerabilities: DamageType[] = [];
            if (targetPlayer) {
                const raceDef = RACES.find(r => r.name.toLowerCase() === targetPlayer.race.toLowerCase());
                resistances = raceDef?.damageResistances || [];
                immunities = raceDef?.damageImmunities || [];
                vulnerabilities = raceDef?.damageVulnerabilities || [];
            } else if (targetMonster) {
                resistances = targetMonster.definition.damageResistances || [];
                immunities = targetMonster.definition.damageImmunities || [];
                vulnerabilities = targetMonster.definition.damageVulnerabilities || [];
            }

            // Apply type effects
            let pipelineNote = '';
            if (damageType) {
                if (immunities.includes(damageType)) {
                    appliedDamage = 0;
                    pipelineNote = `(Imun terhadap ${damageType})`;
                } else if (resistances.includes(damageType)) {
                    appliedDamage = Math.floor(appliedDamage / 2);
                    pipelineNote = `(Resistan terhadap ${damageType})`;
                } else if (vulnerabilities.includes(damageType)) {
                    appliedDamage = appliedDamage * 2;
                    pipelineNote = `(Rentan terhadap ${damageType})`;
                }
            }

            const critText = isCrit ? 'KRITIS! ' : '';
            campaignActions.logEvent(
                { type: "system", text: `${attackerName} memberikan ${critText}${appliedDamage} kerusakan${damageType ? ` [${damageType}]` : ''} ${pipelineNote} kepada ${targetName}.` },
                campaign.turnId!
            );

            if (targetPlayer) {
                const newHp = Math.max(0, targetPlayer.currentHp - appliedDamage);
                onCharacterUpdate({ ...targetPlayer, currentHp: newHp });
            } else if (targetMonster) {
                const newHp = Math.max(0, targetMonster.currentHp - appliedDamage);
                campaignActions.updateMonster({ ...targetMonster, currentHp: newHp });
            }
        }
	}, [campaign.monsters, players, campaign.turnId, campaignActions, onCharacterUpdate]);

	// Handler: Pergerakan unit dengan memicu OA jika meninggalkan adjacency
	const handleMovementWithOA = useCallback((unitId: string, path: { x: number; y: number }[], cost: number) => {
		if (!campaign.battleState) return;
		const { battleState } = campaign;
		const unit = battleState.units.find(u => u.id === unitId);
		if (!unit) return;

        // Cek kondisi yang mencegah pergerakan
        const sourceChar = unit.isPlayer ? players.find(p => p.id === unit.id) : undefined;
        const sourceMon = !unit.isPlayer ? campaign.monsters.find(m => m.instanceId === unit.id) : undefined;
        const conds = sourceChar?.conditions || sourceMon?.conditions || [];
        const preventsMove = conds.some(c => CONDITION_RULES[c]?.speedZero);
        if (preventsMove) {
            const turnId = campaign.turnId || '';
            campaignActions.logEvent({ type: 'system', text: `${unit.name} tidak bisa bergerak karena kondisi (kecepatan 0).` }, turnId);
            return;
        }

		const enemiesAdjacentBefore = battleState.units.filter(u => u.id !== unit.id && u.isPlayer !== unit.isPlayer && isAdjacent(u.gridPosition, unit.gridPosition));

		// Commit movement jika biaya valid
		if (cost <= (unit.remainingMovement ?? unit.movementSpeed)) {
			const finalPos = path[path.length - 1];
			campaignActions.moveUnit({ unitId, newPosition: finalPos, cost });
		}

		// Jika unit memiliki Disengage di turn ini, jangan trigger OA
		if (unit.hasDisengaged) return;

		// Cek adjacency setelah bergerak
		const updatedUnit = (campaign.battleState?.units || []).find(u => u.id === unitId) || unit;
		const enemiesNoLongerAdjacent = enemiesAdjacentBefore.filter(e => !isAdjacent(e.gridPosition, updatedUnit.gridPosition));

		// Trigger satu OA dari musuh pertama (monster) yang tidak lagi adjacent
		const attacker = enemiesNoLongerAdjacent.find(e => !e.isPlayer);
		if (attacker) {
			triggerOpportunityAttack(attacker.id, unitId);
		}
	}, [campaign.battleState, campaignActions, isAdjacent, triggerOpportunityAttack]);

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
				onCharacterUpdate(updatedCharacter);
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
				updatedCharacterState.usedAction = true;
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
				// Terapkan efek berdasarkan spell
				const effectId = `${spell.name}-${Date.now()}`;
				if (spell.name === 'Bless') {
					// Penyederhanaan: Bless ke diri sendiri
					const newEffect = {
						id: effectId,
						spellId: spell.id,
						label: 'Bless',
						sourceCharacterId: character.id,
						targetCharacterId: character.id,
						remainingRounds: spell.durationRounds || 10,
						isConcentration: spell.requiresConcentration,
						blessDie: '1d4',
					};
					updatedCharacterState.activeEffects = [
						...(updatedCharacterState.activeEffects || []),
						newEffect,
					];
					if (spell.requiresConcentration) {
						updatedCharacterState.concentration = {
							spellId: spell.id,
							spellName: spell.name,
							remainingRounds: spell.durationRounds || 10,
						};
					}
					campaignActions.logEvent({ type: 'system', text: `${character.name} memberkati dirinya (Bless): +1d4 untuk Attack & Saving Throw (${spell.duration}).` }, turnId);
				} else if (spell.name === 'Shield of Faith') {
					const newEffect = {
						id: effectId,
						spellId: spell.id,
						label: 'Shield of Faith',
						sourceCharacterId: character.id,
						targetCharacterId: character.id,
						remainingRounds: spell.durationRounds || 100,
						isConcentration: spell.requiresConcentration,
						acBonus: 2,
					};
					updatedCharacterState.activeEffects = [
						...(updatedCharacterState.activeEffects || []),
						newEffect,
					];
					updatedCharacterState.armorClass = (updatedCharacterState.armorClass || 10) + 2;
					if (spell.requiresConcentration) {
						updatedCharacterState.concentration = {
							spellId: spell.id,
							spellName: spell.name,
							remainingRounds: spell.durationRounds || 100,
						};
					}
					campaignActions.logEvent({ type: 'system', text: `${character.name} mendapatkan +2 AC dari Shield of Faith (${spell.duration}).` }, turnId);
				} else if (spell.name === 'Darkness') {
					const newEffect = {
						id: effectId,
						spellId: spell.id,
						label: 'Darkness',
						sourceCharacterId: character.id,
						targetCharacterId: character.id,
						remainingRounds: spell.durationRounds || 100,
						isConcentration: spell.requiresConcentration,
						grantsDisadvantageToAttackers: true,
					};
					updatedCharacterState.activeEffects = [
						...(updatedCharacterState.activeEffects || []),
						newEffect,
					];
					if (spell.requiresConcentration) {
						updatedCharacterState.concentration = {
							spellId: spell.id,
							spellName: spell.name,
							remainingRounds: spell.durationRounds || 100,
						};
					}
					campaignActions.logEvent({ type: 'system', text: `${character.name} menciptakan kegelapan pekat (Darkness). Penyerang memiliki disadvantage (${spell.duration}).` }, turnId);
				}

				onCharacterUpdate(updatedCharacterState);
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
		handleDash,
		handleDisengage,
		handleDodge,
		handleHide,
		handleMovementWithOA,
	};
};
