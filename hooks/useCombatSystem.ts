import { useCallback, useEffect } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import { 
    Character, DiceRoll, RollRequest, CharacterInventoryItem, SpellDefinition, MonsterInstance, 
    StructuredApiResponse, ToolCall, Ability
} from '../types';
import { rollInitiative, rollDice, getAbilityModifier, getProficiencyBonus } from '../../utils';
import { geminiService } from '../services/geminiService';

interface CombatSystemProps {
    campaign: CampaignState;
    character: Character; // Karakter *kita*
    players: Character[]; // SEMUA karakter di sesi ini
    campaignActions: CampaignActions;
    updateCharacter: (character: Character) => Promise<void>; // Ini untuk SSoT
}

export const useCombatSystem = ({ campaign, character, players, campaignActions, updateCharacter }: CombatSystemProps) => {

    const processToolCalls = useCallback((turnId: string, toolCalls: ToolCall[]) => {
        toolCalls.forEach(call => {
            let message = '';
            switch (call.functionName) {
                case 'add_items_to_inventory':
                    campaignActions.addItemsToInventory(call.args);
                    message = `Inventaris diperbarui: ${call.args.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ')}`;
                    break;
                case 'update_quest_log':
                    campaignActions.updateQuestLog(call.args);
                    message = `Jurnal diperbarui: ${call.args.title}`;
                    break;
                case 'log_npc_interaction':
                    campaignActions.logNpcInteraction(call.args);
                    message = `Catatan NPC diperbarui: ${call.args.npcName}`;
                    break;
                case 'spawn_monsters':
                    campaignActions.spawnMonsters(call.args.monsters);
                    message = `Bahaya! Musuh baru muncul!`;
                    break;
            }
            if (message) {
                campaignActions.logEvent({ type: 'system', text: `--- ${message} ---` }, turnId);
            }
        });
    }, [campaignActions]);

    // =================================================================
    // FUNGSI INTI 1: handleRollComplete (HANYA menangani hasil roll)
    // =================================================================
    const handleRollComplete = useCallback(async (roll: DiceRoll, request: RollRequest, turnId: string) => {
        if (!turnId) {
            console.error("Mencoba mencatat peristiwa kombat tanpa turnId eksplisit.");
            return;
        }

        campaignActions.setActiveRollRequest(null);

        // ==================================
        // HANDLE DEATH SAVE (Mandat 3.4 SSoT)
        // ==================================
        if (request.type === 'deathSave') {
            const playerToSave = players.find(p => p.id === request.characterId);
            if (!playerToSave) return;

            const newSaves = { ...playerToSave.deathSaves };
            let message = `${playerToSave.name} membuat lemparan penyelamatan kematian... `;
            
            if (roll.total >= 10) { // Sukses
                newSaves.successes++;
                if (roll.total === 20) { // Kritis sukses
                    message += ` LEMPARAN KRITIS! Dia sadar dengan 1 HP!`;
                    const updatedChar = { ...playerToSave, currentHp: 1, deathSaves: { successes: 0, failures: 0 } };
                    await updateCharacter(updatedChar); 
                    campaignActions.logEvent({ type: 'system', text: message }, turnId);
                    campaignActions.endTurn();
                    return;
                }
                message += `dan berhasil! (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
            } else { // Gagal
                newSaves.failures++;
                 if (roll.total === 1) { // Kritis gagal
                    newSaves.failures++;
                    message += " LEMPARAN KRITIS! Dihitung sebagai 2 kegagalan.";
                 }
                message += `dan gagal. (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
            }
            
            campaignActions.logEvent({ type: 'system', text: message }, turnId);
            const updatedChar = { ...playerToSave, deathSaves: newSaves };
            await updateCharacter(updatedChar);

            if (newSaves.successes >= 3) {
                campaignActions.logEvent({ type: 'system', text: `${playerToSave.name} telah stabil!` }, turnId);
            } else if (newSaves.failures >= 3) {
                campaignActions.logEvent({ type: 'system', text: `${playerToSave.name} telah tewas.` }, turnId);
            }

            campaignActions.endTurn();
            return;
        }

        // ==================================
        // HANDLE ATTACK & DAMAGE
        // ==================================
        let target: MonsterInstance | Character | undefined = [...campaign.monsters, ...players].find(c => ('ownerId' in c ? c.id : c.instanceId) === request.target?.id);

        if (!target) {
            console.error("Target tidak ditemukan untuk penyelesaian lemparan kombat");
            campaignActions.endTurn();
            return;
        }

        // --- STAGE: ATTACK ---
        if (request.stage === 'attack') {
            const targetAC = ('ownerId' in target) ? target.armorClass : target.definition.armorClass;
            const successText = roll.success ? `mengenai (Total ${roll.total} vs AC ${targetAC})` : `gagal mengenai (Total ${roll.total} vs AC ${targetAC})`;
            
            const attacker = [...players, ...campaign.monsters].find(c => ('ownerId' in c ? c.id : c.instanceId) === request.characterId);
            const attackerName = attacker?.name || 'Seseorang';
            
            const rollMessage = `${attackerName} menyerang ${target.name} dan ${successText}.`;
            campaignActions.logEvent({ type: 'system', text: rollMessage }, turnId);

            if (roll.success) {
                let finalDamageDice = request.damageDice;

                // FITUR KELAS: Rogue - Sneak Attack (Kesenjangan #4)
                if (attacker && 'ownerId' in attacker && attacker.class === 'Rogue') {
                    const isAdvantage = request.isAdvantage || false;
                    const hasAllyNearby = players.some(p => p.id !== attacker.id && p.currentHp > 0 && campaign.initiativeOrder.includes(p.id));

                    if (isAdvantage || hasAllyNearby) {
                        const sneakAttackDice = `${Math.floor((attacker.level + 1) / 2)}d6`;
                        finalDamageDice = finalDamageDice ? `${finalDamageDice}+${sneakAttackDice}` : sneakAttackDice;
                        const reason = isAdvantage ? "(via Advantage)" : "(via Sekutu)";
                        campaignActions.logEvent({ type: 'system', text: `${attacker.name} menambahkan ${sneakAttackDice} Sneak Attack! ${reason}` }, turnId);
                    }
                }

                const damageRollRequest: RollRequest = {
                    type: 'damage', characterId: request.characterId, reason: `Menentukan kerusakan terhadap ${target.name}`,
                    target: { id: ('ownerId' in target ? target.id : target.instanceId), name: target.name, ac: targetAC },
                    stage: 'damage', damageDice: finalDamageDice,
                };
                
                if ('definition' in attacker) { // Ini MonsterInstance
                    const damageResult = rollDice(damageRollRequest.damageDice || '1d4');
                    const simulatedDamageRoll: DiceRoll = {
                        notation: damageRollRequest.damageDice || '1d4',
                        rolls: damageResult.rolls,
                        modifier: damageResult.modifier,
                        total: damageResult.total,
                        type: 'damage',
                    };
                    setTimeout(() => {
                        if (campaign.turnId === turnId) {
                            handleRollComplete(simulatedDamageRoll, damageRollRequest, turnId);
                        } else {
                            console.warn(`Timeout damage roll untuk turn ${turnId} dibatalkan karena giliran sudah berakhir.`);
                        }
                    }, 500);
                } else {
                    campaignActions.setActiveRollRequest(damageRollRequest);
                }
            } else {
                campaignActions.endTurn();
            }
        
        // --- STAGE: DAMAGE ---
        } else if (request.stage === 'damage') {
            const newHp = Math.max(0, target.currentHp - roll.total);
            const rollMessage = `${target.name} menerima ${roll.total} kerusakan! Sisa HP: ${newHp}.`;
            campaignActions.logEvent({ type: 'system', text: rollMessage }, turnId);

            if ('ownerId' in target) { // it's a Character (Player)
                const updatedTarget = { ...target, currentHp: newHp };
                await updateCharacter(updatedTarget);
            } else { // it's a Monster
                const updatedTarget = { ...target, currentHp: newHp };
                campaignActions.updateMonster(updatedTarget);
            }

            if (newHp === 0) {
                campaignActions.logEvent({ type: 'system', text: `${target.name} telah dikalahkan!` }, turnId);
                if (!('ownerId' in target)) {
                    campaignActions.removeMonster(target.instanceId);
                }
                
                const remainingMonsters = campaign.monsters.filter(m => m.instanceId !== (target as MonsterInstance).instanceId && m.currentHp > 0);

                // ==================================
                // LOGIKA AKHIR KOMBAT (DIPINDAH KE SINI)
                // ==================================
                if (remainingMonsters.length === 0) {
                    campaignActions.logEvent({ type: 'system', text: 'Semua musuh telah dikalahkan! Pertarungan berakhir.' }, turnId);
                    campaignActions.setGameState('exploration');
                    try {
                        const actionText = "Pertarungan telah berakhir. Apa yang terjadi selanjutnya?";
                        
                        // PANGGILAN 1: Dapatkan Narasi Akhir Kombat
                        const narrationResult = await geminiService.generateNarration(campaign, players, actionText, campaignActions.setThinkingState);
                        if (narrationResult.reaction) campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
                        if (narrationResult.narration) campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);
                        
                        const contextNarration = narrationResult.narration || narrationResult.reaction || "Pertarungan berakhir.";

                        // PANGGILAN 2: Dapatkan Mekanik (loot, quest, dll)
                        const mechanicsResult = await geminiService.determineNextStep(
                            campaign, 
                            players, 
                            actionText, 
                            contextNarration, 
                            campaignActions.setThinkingState
                        );

                        if (mechanicsResult.tool_calls && mechanicsResult.tool_calls.length > 0) {
                            processToolCalls(turnId, mechanicsResult.tool_calls);
                        }
                        if (mechanicsResult.choices && mechanicsResult.choices.length > 0) {
                            campaignActions.setChoices(mechanicsResult.choices!);
                        }
                    } finally {
                        campaignActions.endTurn();
                    }
                    return;
                }
            }
            campaignActions.endTurn();
        } else {
            campaignActions.endTurn();
        }
    }, [campaign, players, campaignActions, updateCharacter, processToolCalls]);

    // =================================================================
    // FUNGSI INTI 2: processMechanics (HANYA menentukan aksi berikutnya)
    // =================================================================
    const processMechanics = useCallback((turnId: string, mechanics: Omit<StructuredApiResponse, 'reaction' | 'narration'>, originalActionText: string) => {
        if (!turnId) {
            console.error("processMechanics dipanggil tanpa turnId aktif!");
            return;
        }

        let turnShouldEnd = true;

        if (mechanics.tool_calls && mechanics.tool_calls.length > 0) {
            processToolCalls(turnId, mechanics.tool_calls);
            // Jika monster baru di-spawn, jangan akhiri giliran, biarkan combat loop berjalan
            if (mechanics.tool_calls.some(c => c.functionName === 'spawn_monsters')) {
                turnShouldEnd = false;
            }
        }

        const hasChoices = mechanics.choices && mechanics.choices.length > 0;
        const hasRollRequest = !!mechanics.rollRequest;
        const isMonsterTurn = campaign.monsters.some(m => m.instanceId === campaign.currentPlayerId);

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
                isAdvantage: request.isAdvantage, // Teruskan adv/disadv
                isDisadvantage: request.isDisadvantage
            };

            if (isMonsterTurn) {
                // --- Logika Auto-Roll Monster ---
                const monster = campaign.monsters.find(m => m.instanceId === campaign.currentPlayerId)!;
                let rollNotation = '1d20';
                let modifier = 0;
                let dc = 10;
                let damageDice = '1d4';

                if (request.type === 'attack') {
                    const targetPlayer = players.find(p => p.id === request.target?.id) || players.find(p => p.currentHp > 0) || players[0];
                    if (!targetPlayer) {
                        console.warn(`Monster ${monster.name} tidak punya target pemain yang valid.`);
                        campaignActions.logEvent({ type: 'system', text: `${monster.name} tidak menemukan target.` }, turnId);
                    } else {
                        const monsterAction = monster.definition.actions.find(a => request.reason.toLowerCase().includes(a.name.toLowerCase())) || monster.definition.actions[0];
                        
                        modifier = monsterAction.toHitBonus || 0;
                        dc = targetPlayer.armorClass;
                        damageDice = monsterAction.damageDice || '1d4';
                        
                        fullRollRequest.stage = 'attack';
                        fullRollRequest.damageDice = damageDice;
                        fullRollRequest.target = { id: targetPlayer.id, name: targetPlayer.name, ac: dc };

                        const result = rollDice(rollNotation);
                        const total = result.total + modifier;
                        const success = total >= dc;
                        const simulatedRoll: DiceRoll = {
                            notation: rollNotation, rolls: result.rolls, modifier: modifier,
                            total: total, success: success, type: request.type,
                        };

                        setTimeout(() => {
                            if (campaign.turnId === turnId) {
                                handleRollComplete(simulatedRoll, fullRollRequest, turnId);
                            } else {
                                console.warn(`Timeout handleRollComplete untuk turn ${turnId} dibatalkan.`);
                            }
                        }, 500);
                        turnShouldEnd = false;
                    }
                } else {
                    console.warn(`Jenis roll monster ${request.type} belum diimplementasikan untuk auto-roll.`);
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
    }, [campaign.currentPlayerId, campaign.monsters, players, campaignActions, processToolCalls, handleRollComplete, campaign.activeRollRequest, campaign.turnId]);

    // Effect untuk memulai kombat
    useEffect(() => {
        if (campaign.gameState === 'combat' && campaign.initiativeOrder.length === 0 && campaign.monsters.length > 0) {
            const turnId = campaignActions.startTurn();
            const combatants: (Character | MonsterInstance)[] = [
                ...players.filter(p => campaign.playerIds.includes(p.id)), 
                ...campaign.monsters
            ];
            
            const initiatives = combatants.map(c => {
                const id = ('ownerId' in c) ? c.id : c.instanceId;
                const dexScore = ('ownerId' in c) ? c.abilityScores.dexterity : c.definition.abilityScores.dexterity;
                return {
                    id: id,
                    initiative: rollInitiative(dexScore)
                };
            });

            initiatives.sort((a, b) => b.initiative - a.initiative);
            const order = initiatives.map(i => i.id);
            
            campaignActions.setInitiativeOrder(order);
            campaignActions.setCurrentPlayerId(order[0]);
            campaignActions.logEvent({ type: 'system', text: `Pertarungan dimulai! Urutan inisiatif telah ditentukan.` }, turnId);
            campaignActions.endTurn();
        }
    }, [campaign.gameState, campaign.initiativeOrder.length, campaign.monsters, players, campaignActions, campaign.playerIds]);


    const advanceTurn = useCallback(async () => {
        const { initiativeOrder, currentPlayerId, monsters } = campaign;
        if (initiativeOrder.length === 0 || campaign.turnId) return; 

        const currentIndex = initiativeOrder.findIndex(id => id === currentPlayerId);
        const nextIndex = (currentIndex + 1) % initiativeOrder.length;
        const nextPlayerId = initiativeOrder[nextIndex];

        const turnId = campaignActions.startTurn();
        campaignActions.setCurrentPlayerId(nextPlayerId);

        const nextCombatant = [...players, ...monsters].find(c => ('ownerId' in c ? c.id : c.instanceId) === nextPlayerId);

        if (nextCombatant) {
            campaignActions.logEvent({ type: 'system', text: `Sekarang giliran ${nextCombatant.name}.` }, turnId);

            if ('definition' in nextCombatant) { // It's a MonsterInstance
                try {
                    const playerTargets = players.filter(p => p.currentHp > 0);
                    const target = playerTargets[Math.floor(Math.random() * playerTargets.length)];
                    
                    if (target) {
                        const actionText = `${nextCombatant.name} menyerang ${target.name}.`;

                        // PANGGILAN 1: Dapatkan Narasi Aksi Monster
                        const narrationResult = await geminiService.generateNarration(
                            campaign, players, actionText, campaignActions.setThinkingState
                        );
                        if (narrationResult.reaction) campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
                        if (narrationResult.narration) campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);
                        
                        const contextNarration = narrationResult.narration || narrationResult.reaction || "Monster itu bertindak.";

                        // PANGGILAN 2: Dapatkan Mekanik (yang akan di-auto-roll)
                        const mechanicsResult = await geminiService.determineNextStep(
                            campaign, players, actionText, contextNarration, campaignActions.setThinkingState
                        );
                        
                        processMechanics(turnId, mechanicsResult, actionText);
                    } else {
                        campaignActions.logEvent({ type: 'dm_narration', text: `${nextCombatant.name} tidak menemukan target.` }, turnId);
                        campaignActions.endTurn();
                    }
                } catch (e) {
                    console.error("AI Monster turn failed", e);
                    campaignActions.logEvent({ type: 'system', text: `${nextCombatant.name} ragu-ragu sejenak.` }, turnId);
                    campaignActions.endTurn();
                }
            } else { 
                // It's a player's turn
                const me = players.find(p => p.id === nextPlayerId);
                if (me && me.currentHp <= 0 && me.deathSaves.failures < 3 && me.deathSaves.successes < 3) {
                     campaignActions.setActiveRollRequest({
                        type: 'deathSave',
                        characterId: me.id,
                        reason: 'Membuat lemparan penyelamatan kematian untuk bertahan hidup.',
                    });
                     // (turnId tetap aktif, menunggu RollModal)
                }
                // Jika player hidup, kita tidak endTurn(). Kita tunggu aksi mereka.
            }
        } else {
             console.warn(`Combatant dengan ID ${nextPlayerId} tidak ditemukan.`);
            campaignActions.endTurn();
        }

    }, [campaign, players, campaignActions, processMechanics]); 

    // Effect untuk memajukan giliran
    useEffect(() => {
        if (campaign.gameState === 'combat' && !campaign.turnId) {
            advanceTurn();
        }
    }, [campaign.gameState, campaign.turnId, advanceTurn]);


    const handlePlayerAttack = useCallback((targetInstanceId: string, item: CharacterInventoryItem) => {
        if (character.currentHp <= 0 || !campaign.turnId || campaign.currentPlayerId !== character.id) {
            return;
        }

        const target = campaign.monsters.find(m => m.instanceId === targetInstanceId);
        if (!target) return;

        const turnId = campaign.turnId;

        // Cek Advantage/Disadvantage (Contoh: Aksi 'Hide' sebelumnya, Kesenjangan #5)
        // Untuk saat ini, kita cek kondisi simpel:
        const isAdvantage = false; // TODO: Cek kondisi 'invisible' atau 'hidden'
        const isDisadvantage = false; // TODO: Cek kondisi 'poisoned' atau 'restrained'

        const attackRollRequest: RollRequest = {
            type: 'attack', 
            characterId: character.id, 
            reason: `Menyerang ${target.name} dengan ${item.item.name}`,
            target: { id: target.instanceId, name: target.name, ac: target.definition.armorClass },
            item: item, 
            stage: 'attack', 
            damageDice: item.item.damageDice,
            isAdvantage,
            isDisadvantage
        };
        campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: `Menyerang ${target.name} dengan ${item.item.name}.` }, turnId);
        campaignActions.setActiveRollRequest(attackRollRequest);

    }, [campaign.monsters, campaign.turnId, campaign.currentPlayerId, character, campaignActions]);

    // FITUR KELAS: Fighter - Second Wind (Kesenjangan #4)
    const handleSecondWind = useCallback(async () => {
        if (character.currentHp <= 0 || !campaign.turnId || campaign.currentPlayerId !== character.id || character.class !== 'Fighter') {
            return;
        }
        const turnId = campaign.turnId;

        if (character.usedBonusAction) {
            campaignActions.logEvent({ type: 'system', text: `${character.name} sudah menggunakan Bonus Action.` }, turnId);
            return;
        }

        const roll = rollDice(`1d10`);
        const healing = roll.total + character.level;
        const newHp = Math.min(character.maxHp, character.currentHp + healing);
        const healedAmount = newHp - character.currentHp;

        if (healedAmount <= 0) {
             campaignActions.logEvent({ type: 'system', text: `${character.name} mencoba menggunakan Second Wind, tapi HP sudah penuh.` }, turnId);
             return;
        }

        campaignActions.logEvent({ type: 'system', text: `${character.name} menggunakan Second Wind (Bonus Action) dan memulihkan ${healedAmount} HP (Total Roll: ${healing})!` }, turnId);
        
        // Update SSoT Runtime (HP dan Status Bonus Action)
        // Kita panggil SSoT update, yang akan memicu update state di App.tsx -> GameScreen -> hook ini
        await updateCharacter({ ...character, currentHp: newHp, usedBonusAction: true });
        
    }, [character, campaign.turnId, campaign.currentPlayerId, updateCharacter, campaignActions]);

    const handleItemUse = useCallback(async (item: CharacterInventoryItem) => {
        if (character.currentHp <= 0 || !campaign.turnId || campaign.currentPlayerId !== character.id) {
            return;
        }

        if (item.item.type === 'consumable' && item.item.effect?.type === 'heal') {
            const turnId = campaign.turnId;
            const healingResult = rollDice(item.item.effect.dice || '2d4+2');
            const healing = healingResult.total;
            const newHp = Math.min(character.maxHp, character.currentHp + healing);
            const healedAmount = newHp - character.currentHp;

            campaignActions.logEvent({ type: 'system', text: `${character.name} menggunakan ${item.item.name} dan memulihkan ${healedAmount} HP (Total: ${healing}).` }, turnId);

            const newInventory = character.inventory.map(i => 
                i.instanceId === item.instanceId 
                ? { ...i, quantity: i.quantity - 1 } 
                : i
            ).filter(i => i.quantity > 0);

            const updatedCharacter = {
                ...character,
                currentHp: newHp,
                inventory: newInventory
            };
            await updateCharacter(updatedCharacter);
            campaignActions.endTurn(); 
        }
    }, [character, campaign.turnId, campaign.currentPlayerId, updateCharacter, campaignActions]);

    const handleSpellCast = useCallback(async (spell: SpellDefinition) => {
        if (character.currentHp <= 0 || !campaign.turnId || campaign.currentPlayerId !== character.id) {
            return;
        }
        const turnId = campaign.turnId;
        let isTurnEndingAction = false;
        let usedAction = false;
        let updatedCharacterState = { ...character };

        if (spell.castingTime === 'bonus_action') {
            if (character.usedBonusAction) {
                campaignActions.logEvent({ type: 'system', text: `${character.name} sudah menggunakan Bonus Action.` }, turnId);
                return;
            }
            updatedCharacterState.usedBonusAction = true;
            campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: `Merapal ${spell.name} (Bonus Action).` }, turnId);
            usedAction = true;

        } else if (spell.castingTime === 'reaction') {
            campaignActions.logEvent({ type: 'system', text: `Spell reaksi seperti ${spell.name} tidak bisa dirapal dari panel aksi.` }, turnId);
            return;

        } else { // Asumsikan 'action'
            campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: `Merapal ${spell.name} (Aksi).` }, turnId);
            isTurnEndingAction = true;
            usedAction = true;
        }
        
        if (usedAction) {
            // TODO (Fase 2): Terapkan logika spell (roll, damage, heal) di sini
            
            // Habiskan Spell Slot
            if (spell.level > 0) {
                const slotIndex = character.spellSlots.findIndex(s => s.level === spell.level && s.spent < s.max);
                if (slotIndex > -1) {
                    const newSlots = [...character.spellSlots];
                    newSlots[slotIndex] = { ...newSlots[slotIndex], spent: newSlots[slotIndex].spent + 1 };
                    updatedCharacterState.spellSlots = newSlots;
                } else {
                     campaignActions.logEvent({ type: 'system', text: `${character.name} tidak punya slot Lvl ${spell.level} tersisa!` }, turnId);
                     return; // Gagal merapal
                }
            }
            // Update SSoT
            await updateCharacter(updatedCharacterState);
        }

        if (isTurnEndingAction) {
            campaignActions.endTurn(); 
        }
    }, [character, campaign.turnId, campaign.currentPlayerId, campaignActions, updateCharacter]);
    
    return {
        handlePlayerAttack,
        handleRollComplete,
        handleItemUse,
        handleSpellCast,
        handleSecondWind, // Ekspor fungsi baru
    };
}