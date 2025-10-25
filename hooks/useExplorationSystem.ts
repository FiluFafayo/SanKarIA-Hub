import { useCallback, useEffect } from 'react'; // PASTIKAN useEffect di-import
import { CampaignState, CampaignActions } from './useCampaign';
import { Character, DiceRoll, RollRequest, Skill, StructuredApiResponse, ToolCall, GameEvent, PlayerActionEvent, DmNarrationEvent, DmReactionEvent, NPC } from '../types';
import { geminiService } from '../services/geminiService';

const WORLD_EVENT_THRESHOLD = 5; // Trigger event every 5 player turns
const MAX_AI_ATTEMPTS = 3; // Jumlah maksimal percobaan panggil AI

interface ExplorationSystemProps {
    campaign: CampaignState;
    character: Character;
    players: Character[];
    campaignActions: CampaignActions;
}

export function useExplorationSystem({ campaign, character, players, campaignActions }: ExplorationSystemProps) {

    // Fungsi processToolCalls tetap sama seperti sebelumnya
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

    // Fungsi processMechanics tetap sama seperti sebelumnya
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

        // Akhiri giliran HANYA jika TIDAK ada roll request yang perlu ditunggu pemain
        if (!hasRollRequest) {
            campaignActions.endTurn();
        }
    }, [character.id, campaignActions, processToolCalls]);

    // Fungsi helper fallback KONTEKSTUAL (HARDCODED)
    // Ini adalah jaring pengaman *terakhir* jika fallback AI cerdas juga gagal.
    const generateContextualFallbackChoices = useCallback((log: GameEvent[]): string[] => {
        const recentEvents = log.slice(-5).reverse();
        let npcMentioned: NPC | undefined = undefined;
        let objectMentioned: { name: string, id: string } | undefined = undefined;

        for (const event of recentEvents) {
            if ((event.type === 'dm_narration' || event.type === 'dm_reaction') && event.text) {
                const lastNpc = campaign.npcs
                                .filter(npc => event.text.toLowerCase().includes(npc.name.toLowerCase()))
                                .sort((a,b) => event.text.toLowerCase().lastIndexOf(b.name.toLowerCase()) - event.text.toLowerCase().lastIndexOf(a.name.toLowerCase()))[0];
                 if (lastNpc && !npcMentioned) {
                    npcMentioned = lastNpc;
                 }
                const objectMatch = event.text.match(/\[OBJECT:([^|]+)\|([^\]]+)\]/g);
                if (objectMatch && !objectMentioned) {
                    const lastObjectString = objectMatch[objectMatch.length-1];
                    const parts = lastObjectString.match(/\[OBJECT:([^|]+)\|([^\]]+)\]/);
                    if (parts) {
                        objectMentioned = { name: parts[1], id: parts[2] };
                    }
                }
            }
            if (npcMentioned) break;
            if (objectMentioned) break;
        }

        if (npcMentioned) {
            return [`Bicara dengan ${npcMentioned.name}`, "Lihat sekeliling lebih teliti", "Lanjutkan..."];
        }
        if (objectMentioned) {
            return [`Periksa ${objectMentioned.name}`, "Lihat sekeliling lebih teliti", "Lanjutkan..."];
        }

        return ["Lihat sekeliling lebih teliti", "Pikirkan langkah selanjutnya", "Lanjutkan..."];
    }, [campaign.npcs]);


    // Fungsi handlePlayerAction DIMODIFIKASI dengan retry loop dan fallback KONTEKSTUAL
    const handlePlayerAction = useCallback(async (actionText: string, pendingSkill: Skill | null) => {
        if (campaign.turnId) return; 

        const turnId = campaignActions.startTurn(); 
        campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: actionText }, turnId);
        campaignActions.clearChoices(); 

        let result: StructuredApiResponse | null = null;
        let attempt = 0;
        let hasPrimaryMechanic = false;

        try {
            if (campaign.worldEventCounter >= WORLD_EVENT_THRESHOLD) {
                const worldEventResult = await geminiService.generateWorldEvent(campaign);
                campaignActions.logEvent({ type: 'system', text: worldEventResult.event }, turnId);
                campaignActions.updateWorldState(worldEventResult.time, worldEventResult.weather);
            }

            // ================== Retry Loop untuk AI Utama ==================
            while (attempt < MAX_AI_ATTEMPTS && !hasPrimaryMechanic) {
                attempt++;
                console.log(`Mencoba panggil AI utama (Percobaan ${attempt}/${MAX_AI_ATTEMPTS})...`);
                const currentResult = await geminiService.generateTurnResult(
                    campaign,
                    players,
                    attempt > 1 ? `${actionText} (Tolong berikan kelanjutan mekanik seperti pilihan aksi atau permintaan lemparan dadu kali ini)` : actionText,
                    campaignActions.setThinkingState
                );

                result = currentResult;
                hasPrimaryMechanic = !!(result.choices || result.rollRequest || result.tool_calls?.some(tc => tc.functionName === 'spawn_monsters'));

                if (hasPrimaryMechanic) {
                    console.log(`AI utama berhasil memberi mekanik pada percobaan ${attempt}.`);
                    break;
                } else if (campaign.gameState !== 'exploration') {
                     console.log(`AI tidak memberi mekanik saat BUKAN eksplorasi pada percobaan ${attempt}, dianggap valid.`);
                     break;
                } else {
                    console.warn(`AI utama tidak memberi mekanik eksplorasi pada percobaan ${attempt}. Mencoba lagi...`);
                }
            }
            // ================== Akhir Retry Loop ==================

            if (!result) {
                throw new Error("Hasil AI utama (result) null setelah retry loop selesai.");
            }

            if (result.reaction) {
                campaignActions.logEvent({ type: 'dm_reaction', text: result.reaction }, turnId);
            }
            if (result.narration) {
                campaignActions.logEvent({ type: 'dm_narration', text: result.narration }, turnId);
            } else {
                campaignActions.logEvent({ type: 'system', text: "DM terdiam sejenak..." }, turnId);
            }

            // ================== FALLBACK AI CERDAS (INI SOLUSINYA) ==================
            if (!hasPrimaryMechanic && campaign.gameState === 'exploration') {
                console.error(`Semua ${MAX_AI_ATTEMPTS} percobaan AI gagal memberi mekanik eksplorasi. Memanggil generateExplorationChoices sebagai fallback...`);
                
                // Ambil narasi terakhir sebagai konteks
                const contextNarration = result.narration || [...campaign.eventLog].reverse().find(e => e.type === 'dm_narration' || e.type === 'dm_reaction')?.text || "Situasinya hening.";

                // PANGGIL AI SEKALI LAGI, TAPI DENGAN TUGAS SPESIFIK
                const fallbackChoices = await geminiService.generateExplorationChoices(
                    campaign,
                    players,
                    contextNarration, // Beri konteks narasi terakhir
                    campaignActions.setThinkingState // Biarkan dia update 'thinking' state
                );

                if (fallbackChoices && fallbackChoices.length > 0) {
                    console.log("Fallback AI (generateExplorationChoices) berhasil.");
                    result.choices = fallbackChoices;
                } else {
                    // JIKA PANGGILAN KEDUA INI JUGA GAGAL, baru pakai hardcoded
                    console.error("Fallback AI (generateExplorationChoices) GAGAL. Menggunakan fallback hardcoded kontekstual.");
                    result.choices = generateContextualFallbackChoices(campaign.eventLog);
                }
                
                campaignActions.logEvent({ type: 'system', text: `(DM tampak berpikir sejenak sebelum melanjutkan...)` }, turnId);
            }
            // ================== Akhir Fallback AI Cerdas ==================

            await processMechanics(turnId, result, actionText);

        } catch (error) {
            console.error("Gagal total mendapatkan langkah selanjutnya dari AI:", error);
            campaignActions.logEvent({
                type: 'system',
                text: "Terjadi kesalahan kritis saat menghubungi AI. Silakan coba lagi nanti atau segarkan halaman."
            }, turnId);
            campaignActions.endTurn(); 
        }
    }, [campaign, character.id, players, campaignActions, processMechanics, generateContextualFallbackChoices]); // Tambah generateContextualFallbackChoices

    // Fungsi handleRollComplete DIMODIFIKASI dengan fallback AI cerdas
    const handleRollComplete = useCallback(async (roll: DiceRoll, request: RollRequest, turnId: string) => {
        if (!turnId) {
             console.error("Mencoba mencatat peristiwa eksplorasi setelah roll tanpa turnId eksplisit.");
             return;
        };

        campaignActions.setActiveRollRequest(null); 
        campaignActions.logEvent({ type: 'roll_result', characterId: character.id, roll: roll, reason: request.reason }, turnId);

        const actionText = `Hasil dari lemparan dadu ${character.name} untuk "${request.reason}": ${roll.total} (${roll.success ? 'BERHASIL' : 'GAGAL'}). (Aksi asli: ${request.originalActionText})`;

        let result: StructuredApiResponse | null = null;
        let attempt = 0;
        let hasPrimaryMechanic = false;

        try {
            // ================== Retry Loop untuk AI Utama (Sama seperti di handlePlayerAction) ==================
             while (attempt < MAX_AI_ATTEMPTS && !hasPrimaryMechanic) {
                attempt++;
                console.log(`Mencoba panggil AI setelah roll (Percobaan ${attempt}/${MAX_AI_ATTEMPTS})...`);
                const currentResult = await geminiService.generateTurnResult(
                    campaign,
                    players,
                    attempt > 1 ? `${actionText} (Tolong berikan kelanjutan mekanik yang jelas)` : actionText,
                    campaignActions.setThinkingState
                );
                result = currentResult;
                hasPrimaryMechanic = !!(result.choices || result.rollRequest || result.tool_calls?.some(tc => tc.functionName === 'spawn_monsters'));

                if (hasPrimaryMechanic) {
                    console.log(`AI setelah roll berhasil memberi mekanik pada percobaan ${attempt}.`);
                    break; 
                } else if (campaign.gameState !== 'exploration') {
                     console.log(`AI tidak memberi mekanik saat BUKAN eksplorasi setelah roll pada percobaan ${attempt}, dianggap valid.`);
                     break;
                } else {
                    console.warn(`AI setelah roll tidak memberi mekanik eksplorasi pada percobaan ${attempt}. Mencoba lagi...`);
                }
            }
            // ================== Akhir Retry Loop ==================

            if (!result) {
                 throw new Error("Hasil AI setelah roll (result) null setelah retry loop.");
            }

            if (result.reaction) { campaignActions.logEvent({ type: 'dm_reaction', text: result.reaction }, turnId); }
            if (result.narration) { campaignActions.logEvent({ type: 'dm_narration', text: result.narration }, turnId); }
            else { campaignActions.logEvent({ type: 'system', text: "DM melanjutkan cerita..." }, turnId); }


            // ================== FALLBACK AI CERDAS (INI SOLUSINYA) ==================
            if (!hasPrimaryMechanic && campaign.gameState === 'exploration') {
                 console.error(`Semua ${MAX_AI_ATTEMPTS} percobaan AI setelah roll gagal memberi mekanik eksplorasi. Memanggil generateExplorationChoices sebagai fallback...`);
                 
                 const contextNarration = result.narration || [...campaign.eventLog].reverse().find(e => e.type === 'dm_narration' || e.type === 'dm_reaction')?.text || "Situasinya hening.";

                 const fallbackChoices = await geminiService.generateExplorationChoices(
                    campaign,
                    players,
                    contextNarration, 
                    campaignActions.setThinkingState
                 );

                 if (fallbackChoices && fallbackChoices.length > 0) {
                    console.log("Fallback AI (generateExplorationChoices) setelah roll berhasil.");
                    result.choices = fallbackChoices;
                } else {
                    console.error("Fallback AI (generateExplorationChoices) setelah roll GAGAL. Menggunakan fallback hardcoded kontekstual.");
                    result.choices = generateContextualFallbackChoices(campaign.eventLog);
                }
                 campaignActions.logEvent({ type: 'system', text: `(DM tampak merangkai kelanjutan...)` }, turnId);
            }
            // ================== Akhir Fallback AI Cerdas ==================

            await processMechanics(turnId, result, actionText);
        } catch (error) {
             console.error("Gagal mendapatkan langkah selanjutnya dari AI setelah lemparan:", error);
             campaignActions.logEvent({
                 type: 'system',
                 text: "Terjadi kesalahan kritis setelah lemparan. Coba segarkan halaman."
             }, turnId);
             campaignActions.endTurn();
        }
    }, [campaign, character.id, character.name, players, campaignActions, processMechanics, generateContextualFallbackChoices]); // Tambah generateContextualFallbackChoices


    return {
        handlePlayerAction,
        handleRollComplete,
    };
}