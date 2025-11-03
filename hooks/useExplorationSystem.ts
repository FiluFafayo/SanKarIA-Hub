import { useCallback } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import { Character, DiceRoll, RollRequest, Skill, StructuredApiResponse, ToolCall, GameEvent, PlayerActionEvent, DmNarrationEvent, DmReactionEvent, NPC, ItemDefinition } from '../types';
import { geminiService } from '../services/geminiService';
// (Kita tidak butuh ITEM_DEFINITIONS di sini, 'add_items_to_inventory' hanya meneruskan nama)

const WORLD_EVENT_THRESHOLD = 5;
const MAX_AI_ATTEMPTS = 2; 

interface ExplorationSystemProps {
    campaign: CampaignState;
    character: Character;
    players: Character[];
    campaignActions: CampaignActions;
}

export function useExplorationSystem({ campaign, character, players, campaignActions }: ExplorationSystemProps) {

    // REFAKTOR: processToolCalls sekarang harus menangani payload 'add_items_to_inventory' yang baru
    const processToolCalls = useCallback((turnId: string, toolCalls: ToolCall[]) => {
        toolCalls.forEach(call => {
            let message = '';
            switch (call.functionName) {
                case 'add_items_to_inventory':
                    // Payload dari AI adalah { characterId, items: [{ name, quantity }] }
                    campaignActions.addItemsToInventory(call.args); // useCampaign akan menangani ini
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
        
        // REFAKTOR: Cek spawn monsters dari tool call, bukan properti 'didSpawnMonsters'
        const didSpawnMonsters = mechanics.tool_calls?.some(c => c.functionName === 'spawn_monsters') || false;

        if (didSpawnMonsters) {
            // Jika monster muncul, game state akan diubah oleh spawnMonsters.
            // Kita tidak perlu set choices atau roll request.
            // Kita juga *tidak* panggil endTurn() di sini.
            // 'useCombatSystem' akan mengambil alih.
            return; 
        }

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

    // Fallback hardcoded (Jaring pengaman terakhir)
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


    const handlePlayerAction = useCallback(async (actionText: string, pendingSkill: Skill | null) => {
        if (campaign.turnId) return; 

        const turnId = campaignActions.startTurn(); 
        campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: actionText }, turnId);
        campaignActions.clearChoices(); 

        let narrationResult: Omit<StructuredApiResponse, 'tool_calls' | 'choices' | 'rollRequest'> | null = null;
        let mechanicsResult: Omit<StructuredApiResponse, 'reaction' | 'narration'> | null = null;

        try {
            if (campaign.worldEventCounter >= WORLD_EVENT_THRESHOLD) {
                const worldEventResult = await geminiService.generateWorldEvent(campaign);
                campaignActions.logEvent({ type: 'system', text: worldEventResult.event }, turnId);
                campaignActions.updateWorldState(worldEventResult.time, worldEventResult.weather);
            }

            // ================== PANGGILAN 1: NARASI ==================
            for (let i = 0; i < MAX_AI_ATTEMPTS; i++) {
                narrationResult = await geminiService.generateNarration(
                    campaign,
                    players,
                    actionText,
                    campaignActions.setThinkingState
                );
                if (narrationResult && !narrationResult.narration.includes("Error: Gagal generateNarration")) {
                    break;
                }
                console.warn(`Panggilan Narasi gagal (Percobaan ${i + 1}/${MAX_AI_ATTEMPTS})...`);
            }
            
            if (!narrationResult) throw new Error("Gagal total mendapatkan narasi dari AI.");

            if (narrationResult.reaction) {
                campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
            }
            if (narrationResult.narration) {
                campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);
            }
            
            const contextNarration = narrationResult.narration || narrationResult.reaction || "Tindakan itu terjadi.";

            // ================== PANGGILAN 2: MEKANIK ==================
            for (let i = 0; i < MAX_AI_ATTEMPTS; i++) {
                 mechanicsResult = await geminiService.determineNextStep(
                    campaign,
                    players,
                    actionText,
                    contextNarration,
                    campaignActions.setThinkingState
                );

                const didSpawnMonsters = mechanicsResult.tool_calls?.some(c => c.functionName === 'spawn_monsters') || false;
                const hasPrimaryMechanic = !!(mechanicsResult.choices || mechanicsResult.rollRequest || didSpawnMonsters);
                
                if (hasPrimaryMechanic || campaign.gameState !== 'exploration') {
                    break;
                }
                 console.warn(`Panggilan Mekanik gagal (Percobaan ${i + 1}/${MAX_AI_ATTEMPTS})...`);
            }

            if (!mechanicsResult) throw new Error("Gagal total mendapatkan mekanik dari AI.");

            // ================== FALLBACK CERDAS (Untuk Panggilan 2) ==================
            const didSpawnMonsters = mechanicsResult.tool_calls?.some(c => c.functionName === 'spawn_monsters') || false;
            const hasPrimaryMechanic = !!(mechanicsResult.choices || mechanicsResult.rollRequest || didSpawnMonsters);
            
            if (!hasPrimaryMechanic && campaign.gameState === 'exploration') {
                console.error(`Semua ${MAX_AI_ATTEMPTS} percobaan AI Mekanik gagal. Memanggil generateExplorationChoices sebagai fallback...`);
                
                const fallbackChoices = await geminiService.generateExplorationChoices(
                    campaign,
                    players,
                    contextNarration, 
                    campaignActions.setThinkingState
                );

                if (fallbackChoices && fallbackChoices.length > 0) {
                    console.log("Fallback AI (generateExplorationChoices) berhasil.");
                    mechanicsResult.choices = fallbackChoices;
                } else {
                    console.error("Fallback AI (generateExplorationChoices) GAGAL. Menggunakan fallback hardcoded kontekstual.");
                    mechanicsResult.choices = generateContextualFallbackChoices(campaign.eventLog);
                }
                
                campaignActions.logEvent({ type: 'system', text: `(DM tampak berpikir sejenak sebelum melanjutkan...)` }, turnId);
            }
            // ================== Akhir Fallback Cerdas ==================

            await processMechanics(turnId, mechanicsResult, actionText);

        } catch (error) {
            console.error("Gagal total mendapatkan langkah selanjutnya dari AI:", error);
            campaignActions.logEvent({
                type: 'system',
                text: "Terjadi kesalahan kritis saat menghubungi AI. Silakan coba lagi nanti atau segarkan halaman."
            }, turnId);
            campaignActions.endTurn();
        }
    }, [campaign, character.id, players, campaignActions, processMechanics, generateContextualFallbackChoices]);


    const handleRollComplete = useCallback(async (roll: DiceRoll, request: RollRequest, turnId: string) => {
        if (!turnId) {
             console.error("Mencoba mencatat peristiwa eksplorasi setelah roll tanpa turnId eksplisit.");
             return;
        };

        campaignActions.setActiveRollRequest(null); 
        campaignActions.logEvent({ type: 'roll_result', characterId: character.id, roll: roll, reason: request.reason }, turnId);

        const actionText = `Hasil dari lemparan dadu ${character.name} untuk "${request.reason}": ${roll.total} (${roll.success ? 'BERHASIL' : 'GAGAL'}). (Aksi asli: ${request.originalActionText})`;

        let narrationResult: Omit<StructuredApiResponse, 'tool_calls' | 'choices' | 'rollRequest'> | null = null;
        let mechanicsResult: Omit<StructuredApiResponse, 'reaction' | 'narration'> | null = null;

        try {
            // ================== PANGGILAN 1: NARASI (setelah roll) ==================
            for (let i = 0; i < MAX_AI_ATTEMPTS; i++) {
                narrationResult = await geminiService.generateNarration(
                    campaign,
                    players,
                    actionText, 
                    campaignActions.setThinkingState
                );
                if (narrationResult && !narrationResult.narration.includes("Error: Gagal generateNarration")) {
                    break;
                }
                console.warn(`Panggilan Narasi (setelah roll) gagal (Percobaan ${i + 1}/${MAX_AI_ATTEMPTS})...`);
            }
            
            if (!narrationResult) throw new Error("Gagal total mendapatkan narasi dari AI setelah roll.");

            if (narrationResult.reaction) { campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId); }
            if (narrationResult.narration) { campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId); }
            
            const contextNarration = narrationResult.narration || narrationResult.reaction || "Hasil lemparan itu berdampak pada dunia.";

            // ================== PANGGILAN 2: MEKANIK (setelah roll) ==================
            for (let i = 0; i < MAX_AI_ATTEMPTS; i++) {
                 mechanicsResult = await geminiService.determineNextStep(
                    campaign,
                    players,
                    actionText,
                    contextNarration, 
                    campaignActions.setThinkingState
                );
                const didSpawnMonsters = mechanicsResult.tool_calls?.some(c => c.functionName === 'spawn_monsters') || false;
                const hasPrimaryMechanic = !!(mechanicsResult.choices || mechanicsResult.rollRequest || didSpawnMonsters);
                
                if (hasPrimaryMechanic || campaign.gameState !== 'exploration') {
                    break; 
                }
                 console.warn(`Panggilan Mekanik (setelah roll) gagal (Percobaan ${i + 1}/${MAX_AI_ATTEMPTS})...`);
            }

            if (!mechanicsResult) throw new Error("Gagal total mendapatkan mekanik dari AI setelah roll.");

            // ================== FALLBACK CERDAS (Untuk Panggilan 2) ==================
            const didSpawnMonsters = mechanicsResult.tool_calls?.some(c => c.functionName === 'spawn_monsters') || false;
            const hasPrimaryMechanic = !!(mechanicsResult.choices || mechanicsResult.rollRequest || didSpawnMonsters);
            
            if (!hasPrimaryMechanic && campaign.gameState === 'exploration') {
                console.error(`Semua ${MAX_AI_ATTEMPTS} percobaan AI Mekanik (setelah roll) gagal. Memanggil fallback cerdas...`);
                
                const fallbackChoices = await geminiService.generateExplorationChoices(
                    campaign,
                    players,
                    contextNarration, 
                    campaignActions.setThinkingState
                );

                if (fallbackChoices && fallbackChoices.length > 0) {
                    mechanicsResult.choices = fallbackChoices;
                } else {
                    mechanicsResult.choices = generateContextualFallbackChoices(campaign.eventLog);
                }
                campaignActions.logEvent({ type: 'system', text: `(DM tampak merangkai kelanjutan...)` }, turnId);
            }
            // ================== Akhir Fallback Cerdas ==================

            await processMechanics(turnId, mechanicsResult, actionText);

        } catch (error) {
             console.error("Gagal mendapatkan langkah selanjutnya dari AI setelah lemparan:", error);
             campaignActions.logEvent({
                 type: 'system',
                 text: "Terjadi kesalahan kritis setelah lemparan. Coba segarkan halaman."
             }, turnId);
             campaignActions.endTurn();
        }
    }, [campaign, character.id, character.name, players, campaignActions, processMechanics, generateContextualFallbackChoices]);


    return {
        handlePlayerAction,
        handleRollComplete,
    };
}