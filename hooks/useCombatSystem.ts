import { useCallback, useEffect } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import { 
    Character, DiceRoll, RollRequest, InventoryItem, Spell, MonsterInstance, 
    StructuredApiResponse, ToolCall, CharacterInventoryItem, SpellDefinition 
} from '../types';
import { rollInitiative, rollDice } from '../utils';
import { geminiService } from '../services/geminiService';

interface CombatSystemProps {
    campaign: CampaignState;
    character: Character; // Karakter *kita*
    players: Character[]; // SEMUA karakter di sesi ini
    campaignActions: CampaignActions;
    updateCharacter: (character: Character) => Promise<void>; // Ini untuk SSoT
}

export function useCombatSystem({ campaign, character, players, campaignActions, updateCharacter }: CombatSystemProps) {

    // (processToolCalls identik dengan exploration system, jadi kita salin)
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
            if (!playerToSave) return; // Seharusnya tidak terjadi

            const newSaves = { ...playerToSave.deathSaves };
            let message = `${playerToSave.name} membuat lemparan penyelamatan kematian... `;
            
            if (roll.total >= 10) { // Sukses
                newSaves.successes++;
                message += `dan berhasil! (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
                if (roll.total === 20) { // Kritis sukses
                    message += " Lemparan kritis! Dia sadar dengan 1 HP!";
                    const updatedChar = { ...playerToSave, currentHp: 1, deathSaves: { successes: 0, failures: 0 } };
                    await updateCharacter(updatedChar); // Simpan SSoT
                    campaignActions.logEvent({ type: 'system', text: message }, turnId);
                    campaignActions.endTurn();
                    return;
                }
            } else { // Gagal
                newSaves.failures++;
                message += `dan gagal. (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
                 if (roll.total === 1) { // Kritis gagal
                    newSaves.failures++;
                    message += " Lemparan kritis! Dihitung sebagai 2 kegagalan.";
                 }
            }
            
            campaignActions.logEvent({ type: 'system', text: message }, turnId);

            const updatedChar = { ...playerToSave, deathSaves: newSaves };
            await updateCharacter(updatedChar); // Simpan SSoT

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
                const damageRollRequest: RollRequest = {
                    type: 'damage', characterId: request.characterId, reason: `Menentukan kerusakan terhadap ${target.name}`,
                    target: { id: ('ownerId' in target ? target.id : target.instanceId), name: target.name, ac: targetAC },
                    stage: 'damage', damageDice: request.damageDice,
                };
                
                // Jika ini monster, auto-roll damage
                if ('definition' in attacker) { // Ini MonsterInstance
                    const damageResult = rollDice(request.damageDice || '1d4');
                    const simulatedDamageRoll: DiceRoll = {
                        notation: request.damageDice || '1d4',
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
                    // Ini Player, minta roll
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
                await updateCharacter(updatedTarget); // Simpan SSoT (Mandat 3.4)
            } else { // it's a Monster
                const updatedTarget = { ...target, currentHp: newHp };
                campaignActions.updateMonster(updatedTarget); // Update state runtime
            }

            if (newHp === 0) {
                campaignActions.logEvent({ type: 'system', text: `${target.name} telah dikalahkan!` }, turnId);
                if (!('ownerId' in target)) {
                    campaignActions.removeMonster(target.instanceId);
                }
                
                // REFAKTOR: Cek akhir kombat
                const remainingMonsters = campaign.monsters.filter(m => m.instanceId !== target.instanceId && m.currentHp > 0);

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


    const processMechanics = useCallback((turnId: string, mechanics: Omit<StructuredApiResponse, 'reaction' | 'narration'>, originalActionText: string) => {
        if (!turnId) {
            console.error("processMechanics dipanggil tanpa turnId aktif!");
            return;
        }

        let turnShouldEnd = true;

        if (mechanics.tool_calls && mechanics.tool_calls.length > 0) {
            processToolCalls(turnId, mechanics.tool_calls);
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
                characterId: campaign.currentPlayerId!, // Ini bisa ID player atau monster instance
                originalActionText: originalActionText,
            };

            if (isMonsterTurn) {
                // --- Logika Auto-Roll Monster ---
                const monster = campaign.monsters.find(m => m.instanceId === campaign.currentPlayerId)!;
                let rollNotation = '1d20';
                let modifier = 0;
                let dc = 10;
                let damageDice = '1d4';

                if (request.type === 'attack') {
                    // REFAKTOR: Target adalah Character (Player)
                    const targetPlayer = players.find(p => p.id === request.target?.id) || players.find(p => p.currentHp > 0) || players[0];
                    if (!targetPlayer) {
                        console.warn(`Monster ${monster.name} tidak punya target pemain yang valid.`);
                        campaignActions.logEvent({ type: 'system', text: `${monster.name} tidak menemukan target.` }, turnId);
                    } else {
                        // REFAKTOR: Gunakan stat block dari 'definition'
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
            // REFAKTOR: Combatants sekarang adalah Character dan MonsterInstance
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
        const nextPlayerId = initiativeOrder[nextIndex]; // Ini bisa jadi ID player atau ID monster instance

        const turnId = campaignActions.startTurn();
        campaignActions.setCurrentPlayerId(nextPlayerId);

        // REFAKTOR: Cari combatant berdasarkan ID
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
                // Cek apakah player ini mati -> otomatis picu death save
                const me = players.find(p => p.id === nextPlayerId);
                if (me && me.currentHp <= 0 && me.deathSaves.failures < 3 && me.deathSaves.successes < 3) {
                     campaignActions.setActiveRollRequest({
                        type: 'deathSave',
                        characterId: me.id,
                        reason: 'Membuat lemparan penyelamatan kematian untuk bertahan hidup.',
                    });
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

        // REFAKTOR: Cari monster berdasarkan instanceId
        const target = campaign.monsters.find(m => m.instanceId === targetInstanceId);
        if (!target) return;

        const turnId = campaign.turnId;

        // REFAKTOR: Gunakan data dari item.definition
        const attackRollRequest: RollRequest = {
            type: 'attack', 
            characterId: character.id, 
            reason: `Menyerang ${target.name} dengan ${item.item.name}`,
            target: { id: target.instanceId, name: target.name, ac: target.definition.armorClass },
            item: item, 
            stage: 'attack', 
            damageDice: item.item.damageDice,
        };
        campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: `Menyerang ${target.name} dengan ${item.item.name}.` }, turnId);
        campaignActions.setActiveRollRequest(attackRollRequest);

    }, [campaign.monsters, campaign.turnId, campaign.currentPlayerId, character, campaignActions]);

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

            // REFAKTOR: Logika SSoT. Update inventory.
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
            await updateCharacter(updatedCharacter); // Simpan SSoT
            campaignActions.endTurn(); 
        }
    }, [character, campaign.turnId, campaign.currentPlayerId, updateCharacter, campaignActions]);

    const handleSpellCast = useCallback((spell: SpellDefinition) => {
        if (character.currentHp <= 0 || !campaign.turnId || campaign.currentPlayerId !== character.id) {
            return;
        }
        const turnId = campaign.turnId;

        campaignActions.logEvent({ type: 'system', text: `${character.name} merapal ${spell.name}!` }, turnId);
        // TODO (Fase 2): Terapkan logika spell (roll, damage, heal) di sini
        campaignActions.endTurn(); 
    }, [character, campaign.turnId, campaign.currentPlayerId, campaignActions]);

    // (useEffect untuk death save dipindahkan ke advanceTurn)
    
    return {
        handlePlayerAttack,
        handleRollComplete,
        handleItemUse,
        handleSpellCast,
    };
}