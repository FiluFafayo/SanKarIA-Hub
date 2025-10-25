import { useCallback } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import { Character, DiceRoll, RollRequest, Skill, StructuredApiResponse, ToolCall } from '../types';
import { geminiService } from '../services/geminiService';

const WORLD_EVENT_THRESHOLD = 5; // Trigger event every 5 player turns

interface ExplorationSystemProps {
    campaign: CampaignState;
    character: Character;
    players: Character[];
    campaignActions: CampaignActions;
}

export function useExplorationSystem({ campaign, character, players, campaignActions }: ExplorationSystemProps) {

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
                    message = `Bahaya! Musuh muncul!`;
                    break;
            }
            if (message) {
                campaignActions.logEvent({ type: 'system', text: `--- ${message} ---` }, turnId);
            }
        });
    }, [campaignActions]);

    const processMechanics = useCallback(async (turnId: string, mechanics: Omit<StructuredApiResponse, 'reaction' | 'narration'>, originalActionText: string) => {
        const hasTools = mechanics.tool_calls && mechanics.tool_calls.length > 0;
        if (hasTools) {
            processToolCalls(turnId, mechanics.tool_calls!);
        }

        const hasChoices = mechanics.choices && mechanics.choices.length > 0;
        const hasRollRequest = !!mechanics.rollRequest;

        if (hasChoices) {
            campaignActions.setChoices(mechanics.choices!);
        } else if (hasRollRequest) {
            const fullRollRequest: RollRequest = {
                ...mechanics.rollRequest!,
                characterId: character.id,
                originalActionText: originalActionText,
            };
            campaignActions.setActiveRollRequest(fullRollRequest);
        }

        if (!hasRollRequest) {
            campaignActions.endTurn();
        }
    }, [character.id, campaignActions, processToolCalls]);

    const handlePlayerAction = useCallback(async (actionText: string, pendingSkill: Skill | null) => {
        if (campaign.turnId) return; // Prevent action if a turn is already in progress

        const turnId = campaignActions.startTurn();
        campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: actionText }, turnId);
        campaignActions.clearChoices();

        try {
            // Check for world event before primary action
            if (campaign.worldEventCounter >= WORLD_EVENT_THRESHOLD) {
                const worldEventResult = await geminiService.generateWorldEvent(campaign);
                campaignActions.logEvent({ type: 'system', text: worldEventResult.event }, turnId);
                campaignActions.updateWorldState(worldEventResult.time, worldEventResult.weather);
            }

            // Step 1: Get Narration
            const narrationResult = await geminiService.generateNarration(campaign, players, actionText, campaignActions.setThinkingState);
            if (narrationResult.reaction) {
                campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
            }
            if (narrationResult.narration) {
                campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);
            } else {
                campaignActions.logEvent({ type: 'system', text: "DM merenung sejenak..." }, turnId);
            }

            // Step 2: Get Mechanics
            const mechanicsResult = await geminiService.determineNextStep(campaign, players, actionText, narrationResult.narration);
            await processMechanics(turnId, mechanicsResult, actionText);

        } catch (error) {
            console.error("Gagal mendapatkan langkah selanjutnya dari AI:", error);
            campaignActions.logEvent({
                type: 'system',
                text: "Terjadi kesalahan saat menghubungi AI. Silakan coba lagi."
            }, turnId);
            campaignActions.endTurn();
        }
    }, [campaign, character.id, players, campaignActions, processMechanics]);

    const handleRollComplete = useCallback(async (roll: DiceRoll, request: RollRequest, turnId: string) => {
        // const turnId = campaign.turnId; // <-- HAPUS BARIS INI
        if (!turnId) {
            console.error("Mencoba mencatat peristiwa eksplorasi tanpa turnId eksplisit.");
            return;
        };

        campaignActions.setActiveRollRequest(null);

        campaignActions.logEvent({ type: 'roll_result', characterId: character.id, roll: roll, reason: request.reason }, turnId);

        const actionText = `Hasil dari lemparan dadu ${character.name}: ${roll.success ? 'BERHASIL' : 'GAGAL'}. (Aksi asli: ${request.originalActionText})`;

        try {
            // Step 1: Get Narration
            const narrationResult = await geminiService.generateNarration(campaign, players, actionText, campaignActions.setThinkingState);
            if (narrationResult.reaction) campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
            if (narrationResult.narration) campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);

            // Step 2: Get Mechanics
            const mechanicsResult = await geminiService.determineNextStep(campaign, players, actionText, narrationResult.narration);
            await processMechanics(turnId, mechanicsResult, actionText);
        } catch (error) {
            console.error("Gagal mendapatkan langkah selanjutnya dari AI setelah lemparan:", error);
            campaignActions.logEvent({
                type: 'system',
                text: "Terjadi kesalahan saat menghubungi AI setelah lemparan. Silakan coba lagi."
            }, turnId);
            campaignActions.endTurn();
        }
    }, [campaign, character.id, character.name, players, campaignActions, processMechanics]);


    return {
        handlePlayerAction,
        handleRollComplete,
    };
}
