import { useCallback, useEffect } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import { Character, DiceRoll, RollRequest, InventoryItem, Spell, Monster, StructuredApiResponse, ToolCall } from '../types';
import { rollInitiative } from '../utils';
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
            }
            if(message) {
                campaignActions.logEvent({ type: 'system', text: `--- ${message} ---` }, turnId);
            }
        });
    }, [campaignActions]);

    const processMechanics = useCallback((turnId: string, mechanics: Omit<StructuredApiResponse, 'reaction' | 'narration'>, originalActionText: string) => {
        if (mechanics.tool_calls && mechanics.tool_calls.length > 0) {
            processToolCalls(turnId, mechanics.tool_calls);
        }

        const hasChoices = mechanics.choices && mechanics.choices.length > 0;
        const hasRollRequest = !!mechanics.rollRequest;

        if (hasChoices) {
            campaignActions.setChoices(mechanics.choices!);
        } 
        if (hasRollRequest) {
            const fullRollRequest: RollRequest = {
                ...mechanics.rollRequest!,
                characterId: campaign.currentPlayerId || character.id,
                originalActionText: originalActionText,
            };
            campaignActions.setActiveRollRequest(fullRollRequest);
        }
        
        const isMonsterTurn = campaign.monsters.some(m => m.id === campaign.currentPlayerId);
        if (isMonsterTurn && !hasRollRequest) {
            campaignActions.endTurn();
        }

    }, [campaign.currentPlayerId, character.id, campaign.monsters, campaignActions, processToolCalls]);


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
                        processMechanics(turnId, mechanicsResult, actionText);

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
       
    }, [campaign, players, campaignActions, processMechanics]);
    
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
            const rollMessage = `${character.name} menyerang ${target.name} dan ${successText}.`;
            campaignActions.logEvent({ type: 'system', text: rollMessage }, turnId);

            if (roll.success) {
                const damageRollRequest: RollRequest = {
                    type: 'damage', characterId: character.id, reason: `Menentukan kerusakan terhadap ${target.name}`,
                    target: { id: target.id, name: target.name, ac: target.armorClass },
                    stage: 'damage', damageDice: request.damageDice,
                };
                campaignActions.setActiveRollRequest(damageRollRequest);
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
                 if (remainingMonsters.length === 0) {
                     campaignActions.logEvent({ type: 'system', text: 'Semua musuh telah dikalahkan! Pertarungan berakhir.' }, turnId);
                     campaignActions.setGameState('exploration');
                     try {
                        const actionText = "Pertarungan telah berakhir. Apa yang terjadi selanjutnya?";
                        // Step 1: Get Narration
                        const narrationResult = await geminiService.generateNarration(campaign, players, actionText, campaignActions.setThinkingState);
                        if (narrationResult.reaction) campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
                        if (narrationResult.narration) campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);

                        // Step 2: Get Mechanics
                        const mechanicsResult = await geminiService.determineNextStep(campaign, players, actionText, narrationResult.narration);
                        processMechanics(turnId, mechanicsResult, actionText);
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
    }, [campaign, character, players, campaignActions, updateCharacter, processMechanics]);

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
            const healing = 5; // simplified
            const newHp = Math.min(character.maxHp, character.currentHp + healing);
            const healedAmount = newHp - character.currentHp;

            campaignActions.logEvent({ type: 'system', text: `${character.name} menggunakan ${item.name} dan memulihkan ${healedAmount} HP.`}, turnId);
            
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
