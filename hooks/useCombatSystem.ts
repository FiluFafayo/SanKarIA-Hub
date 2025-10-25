import { useCallback, useEffect } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import { Character, DiceRoll, RollRequest, InventoryItem, Spell, Monster, StructuredApiResponse, ToolCall } from '../types';
import { rollInitiative, rollDice } from '../utils'; // Pastikan rollDice di-impor
import { geminiService } from '../services/geminiService';

interface CombatSystemProps {
    campaign: CampaignState;
    character: Character;
    players: Character[];
    campaignActions: CampaignActions;
    updateCharacter: (character: Character) => Promise<void>;
}

export function useCombatSystem({ campaign, character, players, campaignActions, updateCharacter }: CombatSystemProps) {

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
                // Tambahkan case untuk spawn_monsters jika tool call terjadi di tengah kombat
                case 'spawn_monsters':
                     campaignActions.spawnMonsters(call.args.monsters);
                     message = `Bahaya! Musuh baru muncul!`;
                    break;
            }
            if(message) {
                campaignActions.logEvent({ type: 'system', text: `--- ${message} ---` }, turnId);
            }
        });
    }, [campaignActions]);


    // =================================================================
    // LANGKAH 1: DEKLARASIKAN handleRollComplete SEBELUM processMechanics
    // =================================================================
    const handleRollComplete = useCallback(async (roll: DiceRoll, request: RollRequest) => {
        const turnId = campaign.turnId;
        if (!turnId) {
             console.error("Tidak dapat mencatat peristiwa: tidak ada giliran aktif.");
             return;
        }

        campaignActions.setActiveRollRequest(null);

        // Handle Death Save
        if (request.type === 'deathSave') {
            const newSaves = { ...character.deathSaves };
            let message = `${character.name} membuat lemparan penyelamatan kematian... `;
            if (roll.success) {
                newSaves.successes++;
                message += `dan berhasil! (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
            } else {
                newSaves.failures++;
                message += `dan gagal. (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
            }
            campaignActions.logEvent({ type: 'system', text: message }, turnId);

            const updatedChar = { ...character, deathSaves: newSaves };
            await updateCharacter(updatedChar);

            if (newSaves.successes >= 3) {
                 campaignActions.logEvent({ type: 'system', text: `${character.name} telah stabil!` }, turnId);
            } else if (newSaves.failures >= 3) {
                 campaignActions.logEvent({ type: 'system', text: `${character.name} telah tewas.` }, turnId);
            }
            
            campaignActions.endTurn();
            return;
        }

        let target: Monster | Character | undefined = [...campaign.monsters, ...players].find(c => c.id === request.target?.id);

        if (!target) {
            console.error("Target tidak ditemukan untuk penyelesaian lemparan");
            campaignActions.endTurn();
            return;
        }

        // --- STAGE: ATTACK ---
        if (request.stage === 'attack') {
            const successText = roll.success ? `mengenai (Total ${roll.total} vs AC ${target.armorClass})` : `gagal mengenai (Total ${roll.total} vs AC ${target.armorClass})`;
            const attackerName = 'ownerId' in target ? 'ownerId' in request ? character.name : campaign.monsters.find(m => m.id === request.characterId)?.name : character.name;
            const rollMessage = `${attackerName} menyerang ${target.name} dan ${successText}.`;
            
            campaignActions.logEvent({ type: 'system', text: rollMessage }, turnId);

            if (roll.success) {
                const damageRollRequest: RollRequest = {
                    type: 'damage', characterId: request.characterId, reason: `Menentukan kerusakan terhadap ${target.name}`,
                    target: { id: target.id, name: target.name, ac: target.armorClass },
                    stage: 'damage', damageDice: request.damageDice,
                };
                 // Jika ini monster, auto-roll damage
                 if (campaign.monsters.some(m => m.id === request.characterId)) {
                    const damageResult = rollDice(request.damageDice || '1d4');
                    const simulatedDamageRoll: DiceRoll = {
                        notation: request.damageDice || '1d4',
                        rolls: damageResult.rolls,
                        modifier: damageResult.modifier,
                        total: damageResult.total,
                        type: 'damage',
                    };
                    setTimeout(() => handleRollComplete(simulatedDamageRoll, damageRollRequest), 500);
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
             
             if ('ownerId' in target) { // it's a Character
                const updatedTarget = { ...target, currentHp: newHp };
                await updateCharacter(updatedTarget);
             } else { // it's a Monster
                const updatedTarget = { ...target, currentHp: newHp };
                campaignActions.updateMonster(updatedTarget);
             }

             if (newHp === 0) {
                 campaignActions.logEvent({ type: 'system', text: `${target.name} telah dikalahkan!` }, turnId);
                 if (!('ownerId' in target)) {
                     campaignActions.removeMonster(target.id);
                 }
                 const remainingMonsters = campaign.monsters.filter(m => m.id !== target?.id && m.currentHp > 0);
                 
                 // =================================================================
                 // LANGKAH 2: PUTUS LINGKARAN - REPLIKASI LOGIKA AKHIR KOMBAT
                 // =================================================================
                 if (remainingMonsters.length === 0) {
                     campaignActions.logEvent({ type: 'system', text: 'Semua musuh telah dikalahkan! Pertarungan berakhir.' }, turnId);
                     campaignActions.setGameState('exploration');
                     try {
                        const actionText = "Pertarungan telah berakhir. Apa yang terjadi selanjutnya?";
                        // Step 1: Get Narration
                        const narrationResult = await geminiService.generateNarration(campaign, players, actionText, campaignActions.setThinkingState);
                        if (narrationResult.reaction) campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
                        if (narrationResult.narration) campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);

                        // Step 2: Get Mechanics (JANGAN PANGGIL processMechanics)
                        const mechanicsResult = await geminiService.determineNextStep(campaign, players, actionText, narrationResult.narration);
                        
                        if (mechanicsResult.tool_calls && mechanicsResult.tool_calls.length > 0) {
                            processToolCalls(turnId, mechanicsResult.tool_calls);
                        }
                        if (mechanicsResult.choices && mechanicsResult.choices.length > 0) {
                            campaignActions.setChoices(mechanicsResult.choices!);
                        } 
                        if (mechanicsResult.rollRequest) {
                            const fullRollRequest: RollRequest = {
                                ...mechanicsResult.rollRequest!,
                                characterId: character.id, // default ke pemain
                                originalActionText: actionText,
                            };
                            campaignActions.setActiveRollRequest(fullRollRequest);
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
    // =================================================================
    // LANGKAH 3: PERBARUI DEPENDENSI (HAPUS processMechanics)
    // =================================================================
    }, [campaign, character, players, campaignActions, updateCharacter, processToolCalls]);


    // =================================================================
    // LANGKAH 4: DEKLARASIKAN processMechanics (SEKARANG AMAN)
    // =================================================================
    const processMechanics = useCallback((turnId: string, mechanics: Omit<StructuredApiResponse, 'reaction' | 'narration'>, originalActionText: string) => {
        if (mechanics.tool_calls && mechanics.tool_calls.length > 0) {
            processToolCalls(turnId, mechanics.tool_calls);
        }

        const hasChoices = mechanics.choices && mechanics.choices.length > 0;
        const hasRollRequest = !!mechanics.rollRequest;
        const isMonsterTurn = campaign.monsters.some(m => m.id === campaign.currentPlayerId);

        if (hasChoices) {
            campaignActions.setChoices(mechanics.choices!);
        } 
        
        if (hasRollRequest && !isMonsterTurn) { // --- INI UNTUK PEMAIN ---
            const fullRollRequest: RollRequest = {
                ...mechanics.rollRequest!,
                characterId: campaign.currentPlayerId || character.id,
                originalActionText: originalActionText,
            };
            campaignActions.setActiveRollRequest(fullRollRequest);
        } else if (hasRollRequest && isMonsterTurn) { // --- INI LOGIKA UNTUK MONSTER ---
            const monster = campaign.monsters.find(m => m.id === campaign.currentPlayerId)!;
            const request = mechanics.rollRequest!;
            
            let rollNotation = '1d20';
            let modifier = 0;
            let dc = 10; 
            let stage: 'attack' | 'damage' = 'attack';
            let damageDice = '1d4'; // default damage

            if (request.type === 'attack') {
                const targetPlayer = players.find(p => p.id === request.target?.id) || players[0];
                const monsterAction = monster.actions.find(a => a.name.toLowerCase().includes(request.reason.toLowerCase())) || monster.actions[0];
                
                modifier = monsterAction.toHitBonus;
                dc = targetPlayer.armorClass; // Serang AC pemain
                stage = 'attack';
                rollNotation = '1d20';
                damageDice = monsterAction.damageDice;
            }

            const result = rollDice(rollNotation);
            const total = result.total + modifier;
            const success = total >= dc;

            const simulatedRoll: DiceRoll = {
                notation: rollNotation, rolls: result.rolls, modifier: modifier,
                total: total, success: success, type: request.type,
            };

            const fullRollRequest: RollRequest = {
                ...request,
                characterId: monster.id,
                originalActionText: originalActionText,
                stage: stage,
                damageDice: damageDice,
                target: { id: request.target?.id || players[0].id, name: request.target?.name || players[0].name, ac: dc } // Pastikan target ada
            };

            // Langsung panggil handleRollComplete (sekarang sudah di-deklarasikan)
            setTimeout(() => {
                handleRollComplete(simulatedRoll, fullRollRequest);
            }, 500);
        }
        
        if (isMonsterTurn && !hasRollRequest) {
            campaignActions.endTurn();
        }

    }, [campaign.currentPlayerId, character.id, campaign.monsters, players, campaignActions, processToolCalls, handleRollComplete]); // <-- Tambahkan handleRollComplete


    // Effect to start combat if it hasn't been started
    useEffect(() => {
        if (campaign.gameState === 'combat' && campaign.initiativeOrder.length === 0 && campaign.monsters.length > 0) {
            const turnId = campaignActions.startTurn();
            const combatants = [...players.filter(p => campaign.playerIds.includes(p.id)), ...campaign.monsters];
            const initiatives = combatants.map(c => ({
                id: c.id,
                initiative: rollInitiative('dexterity' in c ? c.dexterity : c.abilityScores.dexterity)
            }));
            initiatives.sort((a, b) => b.initiative - a.initiative);
            const order = initiatives.map(i => i.id);
            campaignActions.setInitiativeOrder(order);
            campaignActions.setCurrentPlayerId(order[0]);
            campaignActions.logEvent({ type: 'system', text: `Pertarungan dimulai! Urutan inisiatif telah ditentukan.` }, turnId);
            campaignActions.endTurn(); // End this setup turn
        }
    }, [campaign.gameState, campaign.initiativeOrder.length, campaign.monsters, players, campaignActions, campaign.playerIds]);
    
    
    // =================================================================
    // LANGKAH 5: PERBARUI DEPENDENSI advanceTurn
    // =================================================================
    const advanceTurn = useCallback(async () => {
        const { initiativeOrder, currentPlayerId, monsters } = campaign;
        if (initiativeOrder.length === 0 || campaign.turnId) return; // Don't advance if a turn is in progress

        const currentIndex = initiativeOrder.findIndex(id => id === currentPlayerId);
        const nextIndex = (currentIndex + 1) % initiativeOrder.length;
        const nextPlayerId = initiativeOrder[nextIndex];
        
        const turnId = campaignActions.startTurn();

        campaignActions.setCurrentPlayerId(nextPlayerId);
        
        const nextCombatant = [...players, ...monsters].find(c => c.id === nextPlayerId);
        
        if (nextCombatant) {
             campaignActions.logEvent({ type: 'system', text: `Sekarang giliran ${nextCombatant.name}.` }, turnId);
             
             if ('actions' in nextCombatant) { // It's a monster
                 try {
                    const playerTargets = players.filter(p => p.currentHp > 0);
                    const target = playerTargets[Math.floor(Math.random() * playerTargets.length)];
                    if(target) {
                        const actionText = `${nextCombatant.name} menyerang ${target.name}.`;
                        
                        // Step 1: Get Narration
                        const narrationResult = await geminiService.generateNarration(campaign, players, actionText, campaignActions.setThinkingState);
                        if (narrationResult.reaction) campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
                        if (narrationResult.narration) campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);

                        // Step 2: Get Mechanics
                        const mechanicsResult = await geminiService.determineNextStep(campaign, players, actionText, narrationResult.narration);
                        processMechanics(turnId, mechanicsResult, actionText); // <-- PANGGILAN INI SEKARANG AMAN

                    } else {
                        campaignActions.logEvent({type: 'dm_narration', text: `${nextCombatant.name} melihat sekeliling, tidak menemukan target.`}, turnId);
                        campaignActions.endTurn();
                    }
                 } catch (e) {
                     console.error("AI Monster turn failed", e);
                     campaignActions.logEvent({ type: 'system', text: `${nextCombatant.name} ragu-ragu sejenak.` }, turnId);
                     campaignActions.endTurn();
                 }
             } else { // It's a player's turn
                campaignActions.endTurn(); // End the turn immediately, waiting for player input.
             }
        } else {
            campaignActions.endTurn();
        }
       
    }, [campaign, players, campaignActions, processMechanics]); // <-- Pastikan processMechanics ada di sini
    
    // This effect runs after a turn ends to advance to the next combatant
    useEffect(() => {
        if (campaign.gameState === 'combat' && !campaign.turnId) {
            advanceTurn();
        }
    }, [campaign.gameState, campaign.turnId, advanceTurn]);


    const handlePlayerAttack = useCallback((targetId: string, item: InventoryItem) => {
        if (campaign.turnId || character.currentHp <= 0) return;
        
        const target = campaign.monsters.find(m => m.id === targetId);
        if (!target) return;

        const turnId = campaignActions.startTurn();

        const attackRollRequest: RollRequest = {
            type: 'attack', characterId: character.id, reason: `Menyerang ${target.name} dengan ${item.name}`,
            target: { id: target.id, name: target.name, ac: target.armorClass },
            item, stage: 'attack', damageDice: item.damageDice,
        };
        campaignActions.logEvent({type: 'player_action', characterId: character.id, text: `Menyerang ${target.name} dengan ${item.name}.`}, turnId);
        campaignActions.setActiveRollRequest(attackRollRequest);

    }, [campaign.monsters, campaign.turnId, character, campaignActions]);
    
    const handleItemUse = useCallback(async (item: InventoryItem) => {
        if(campaign.turnId || character.currentHp <= 0) return;
        if (item.name.toLowerCase().includes('healing')) {
            const turnId = campaignActions.startTurn();
            // Logika penyembuhan (bisa disederhanakan atau pakai rollDice)
            const healingResult = rollDice(item.effect?.dice || '2d4+2');
            const healing = healingResult.total;
            const newHp = Math.min(character.maxHp, character.currentHp + healing);
            const healedAmount = newHp - character.currentHp;

            campaignActions.logEvent({ type: 'system', text: `${character.name} menggunakan ${item.name} dan memulihkan ${healedAmount} HP (Total: ${healing}).`}, turnId);
            
            const updatedCharacter = {
                ...character,
                currentHp: newHp,
                inventory: character.inventory.map(i => i.name === item.name ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0)
            };
            await updateCharacter(updatedCharacter);
            campaignActions.endTurn();
        }
    }, [character, campaign.turnId, updateCharacter, campaignActions]);

    const handleSpellCast = useCallback((spell: Spell) => {
        if(campaign.turnId || character.currentHp <= 0) return;
        const turnId = campaignActions.startTurn();
        campaignActions.logEvent({ type: 'system', text: `${character.name} merapal ${spell.name}!` }, turnId);
        // TODO: Terapkan logika spell (roll, damage, heal) di sini
        campaignActions.endTurn();
    }, [character.name, character.currentHp, campaign.turnId, campaignActions]);

    useEffect(() => {
        const isMyTurn = campaign.currentPlayerId === character.id;
        if (campaign.gameState === 'combat' && isMyTurn && !campaign.turnId && character.currentHp <= 0 && character.deathSaves.failures < 3 && character.deathSaves.successes < 3) {
            const turnId = campaignActions.startTurn();
            campaignActions.setActiveRollRequest({
                type: 'deathSave',
                characterId: character.id,
                reason: 'Membuat lemparan penyelamatan kematian untuk bertahan hidup.',
            });
        }
    }, [campaign.currentPlayerId, campaign.turnId, character.id, character.currentHp, character.deathSaves, campaign.gameState, campaignActions]);


    return {
        handlePlayerAttack,
        handleRollComplete,
        handleItemUse,
        handleSpellCast,
    };
}