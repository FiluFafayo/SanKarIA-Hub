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

            // PERBAIKAN: Ganti 2 panggilan AI menjadi 1
            // PANGGILAN BARU:
            const result = await geminiService.generateTurnResult(campaign, players, actionText, campaignActions.setThinkingState);

            // Proses hasil gabungan
            if (result.reaction) {
                campaignActions.logEvent({ type: 'dm_reaction', text: result.reaction }, turnId);
            }
            if (result.narration) {
                campaignActions.logEvent({ type: 'dm_narration', text: result.narration }, turnId);
            } else {
                campaignActions.logEvent({ type: 'system', text: "DM merenung sejenak..." }, turnId);
            }

            // PENGECEKAN & PANGGILAN KEDUA (Fallback Robust)
            const hasPrimaryMechanic = result.choices || result.rollRequest || result.tool_calls?.some(tc => tc.functionName === 'spawn_monsters');

            if (!hasPrimaryMechanic && campaign.gameState === 'exploration') {
                console.log("AI utama tidak memberi mekanik. Meminta choices ke AI (panggilan kedua)...");
                const fallbackChoices = await geminiService.generateExplorationChoices(
                    campaign,
                    players,
                    result.narration, // Beri narasi terakhir sebagai konteks
                    campaignActions.setThinkingState // Biar ada indikator thinking lagi
                );

                if (fallbackChoices) {
                    result.choices = fallbackChoices; // Timpa choices di result dengan hasil fallback
                } else {
                    // Jika panggilan kedua GAGAL TOTAL (jarang terjadi), baru pakai fallback manual
                    console.error("Panggilan AI kedua untuk choices GAGAL. Menggunakan fallback manual.");
                    result.choices = ["Lanjutkan...", "Amati sekeliling", "Ulangi tindakan"];
                }
            }

            await processMechanics(turnId, result, actionText); // Lanjutkan dengan result yg sudah diperbarui (jika perlu)

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
            // PERBAIKAN: Ganti 2 panggilan AI menjadi 1
            // PANGGILAN BARU:
            const result = await geminiService.generateTurnResult(campaign, players, actionText, campaignActions.setThinkingState);

            // Proses hasil gabungan
            if (result.reaction) campaignActions.logEvent({ type: 'dm_reaction', text: result.reaction }, turnId);
            if (result.narration) campaignActions.logEvent({ type: 'dm_narration', text: result.narration }, turnId);
            
            // PENGECEKAN & PANGGILAN KEDUA (Fallback Robust) - Sama seperti di handlePlayerAction
            const hasPrimaryMechanic = result.choices || result.rollRequest || result.tool_calls?.some(tc => tc.functionName === 'spawn_monsters');

            if (!hasPrimaryMechanic && campaign.gameState === 'exploration') {
                console.log("AI utama tidak memberi mekanik setelah roll. Meminta choices ke AI (panggilan kedua)...");
                const fallbackChoices = await geminiService.generateExplorationChoices(
                    campaign,
                    players,
                    result.narration,
                    campaignActions.setThinkingState
                );

                if (fallbackChoices) {
                    result.choices = fallbackChoices;
                } else {
                    console.error("Panggilan AI kedua untuk choices GAGAL setelah roll. Menggunakan fallback manual.");
                    result.choices = ["Lanjutkan...", "Amati sekeliling"];
                }
            }
            await processMechanics(turnId, result, actionText); // Kirim 'result' yg berisi mekanik
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
