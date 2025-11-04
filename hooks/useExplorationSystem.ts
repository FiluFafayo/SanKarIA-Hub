// REFAKTOR G-2: Seluruh file ini di-refaktor untuk menggunakan SATU PANGGILAN AI (gameService.generateTurnResponse)
// Ini memperbaiki bug 'AI DM STUCK' (G-2) dan menyederhanakan logika secara drastis.

import { useCallback } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import { 
    Character, DiceRoll, RollRequest, Skill, StructuredApiResponse, 
    ToolCall, GameEvent, NPC 
} from '../types';
// Import service BARU (G-2)
import { gameService } from '../services/ai/gameService';
// Import service GENERASI (G-2)
import { generationService } from '../services/ai/generationService';
// (Cleanup DRY) Impor dari utils
import { parseAndLogNarration } from '../utils';

const WORLD_EVENT_THRESHOLD = 5; // Trigger event every 5 player turns

interface ExplorationSystemProps {
    campaign: CampaignState;
    character: Character;
    players: Character[];
    campaignActions: CampaignActions;
}

export function useExplorationSystem({ campaign, character, players, campaignActions }: ExplorationSystemProps) {

    // processToolCalls tetap sama (sudah di-patch G-1)
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
                // (Poin 7) Tangani tool XP
                case 'award_xp':
                    const player = players.find(p => p.id === call.args.characterId);
                    if (player) {
                        campaignActions.awardXp(call.args.characterId, call.args.amount);
                        message = `${player.name} menerima ${call.args.amount} XP untuk: ${call.args.reason}`;
                    }
                    break;
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
                campaignActions.logEvent({ type: 'system', text: `--- ${message} ---` }, turnId);
            }
        });
    }, [campaignActions]);

    // processMechanics disederhanakan (G-2)
    const processMechanics = useCallback(async (
        turnId: string, 
        response: Omit<StructuredApiResponse, 'reaction' | 'narration'>, 
        originalActionText: string
    ) => {
        
        const hasTools = response.tool_calls && response.tool_calls.length > 0;
        if (hasTools) {
            processToolCalls(turnId, response.tool_calls!);
        }

        // Cek apakah 'spawn_monsters' dipanggil
        const didSpawnMonsters = response.tool_calls?.some(c => c.functionName === 'spawn_monsters') || false;

        if (didSpawnMonsters) {
            // Combat akan mengambil alih. 'useCombatSystem' akan menangani 'advanceTurn'.
            // Kita TIDAK memanggil endTurn() di sini.
            return; 
        }

        const hasChoices = response.choices && response.choices.length > 0;
        const hasRollRequest = !!response.rollRequest;

        if (hasChoices) {
            campaignActions.setChoices(response.choices!);
            campaignActions.endTurn(); // Giliran selesai, pemain memilih
        } else if (hasRollRequest) {
            const fullRollRequest: RollRequest = {
                ...response.rollRequest!,
                characterId: character.id,
                originalActionText: originalActionText,
            };
            campaignActions.setActiveRollRequest(fullRollRequest);
            // JANGAN endTurn() di sini, kita menunggu RollModal
        } else {
            // TIDAK ada choices, TIDAK ada roll, TIDAK ada monster
            // Ini adalah kondisi fallback jika AI gagal mematuhi ATURAN EKSPLORASI.
            console.warn("[G-2] AI gagal memberikan mekanik lanjutan (choices/roll/spawn). Menerapkan fallback hardcoded.");
            const fallbackChoices = generateContextualFallbackChoices(campaign.eventLog);
            campaignActions.setChoices(fallbackChoices);
            campaignActions.endTurn(); // Pastikan giliran berakhir
        }
    }, [character.id, campaignActions, processToolCalls, campaign.eventLog]); // Tambah eventLog untuk fallback

    // Fallback hardcoded (Jaring pengaman terakhir)
    const generateContextualFallbackChoices = useCallback((log: GameEvent[]): string[] => {
        const recentEvents = log.slice(-5).reverse();
        let npcMentioned: NPC | undefined = undefined;
        let objectMentioned: { name: string, id: string } | undefined = undefined;

        for (const event of recentEvents) {
            if ((event.type === 'dm_narration' || event.type === 'dm_reaction') && event.text) {
                // Cari NPC
                const lastNpc = campaign.npcs
                                .filter(npc => event.text.toLowerCase().includes(npc.name.toLowerCase()))
                                .sort((a,b) => event.text.toLowerCase().lastIndexOf(b.name.toLowerCase()) - event.text.toLowerCase().lastIndexOf(a.name.toLowerCase()))[0];
                 if (lastNpc && !npcMentioned) {
                    npcMentioned = lastNpc;
                 }
                 // Cari [OBJECT]
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


    // =================================================================
    // REFAKTOR G-2: handlePlayerAction (Sekarang ATOMIK)
    // =================================================================
    const handlePlayerAction = useCallback(async (actionText: string, pendingSkill: Skill | null) => {
        if (campaign.turnId) return; // Mencegah aksi ganda

        const turnId = campaignActions.startTurn(); 
        campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: actionText }, turnId);
        campaignActions.clearChoices(); 

        // (Poin 8) Cek Random Encounter (5% chance)
        if (Math.random() < 0.05 && campaign.gameState === 'exploration') {
            console.warn("[Fase 2] Random Encounter Terpicu!");
            const encounterActionText = "Sedang bepergian, tiba-tiba ada ancaman baru muncul dari bayang-bayang...";
            
            try {
                const response = await gameService.generateTurnResponse(
                    campaign,
                    players,
                    encounterActionText, // Paksa prompt encounter
                    null, // (Poin 6) Aksi 'random encounter' tidak punya pelaku spesifik
                    campaignActions.setThinkingState
                );
                
                // Log narasi encounter
                parseAndLogNarration(response.narration, turnId, campaignActions);
                if (response.reaction) {
                    campaignActions.logEvent({ type: 'dm_reaction', text: response.reaction }, turnId);
                }
                
                // Proses mekanik encounter (HARUSNYA spawn_monsters)
                await processMechanics(turnId, response, encounterActionText);
                
            } catch (error) {
                // Fallback jika AI random encounter gagal
                console.error("[Fase 2] Gagal generate Random Encounter:", error);
                // (Lanjutkan ke aksi normal pemain di bawah)
            }
            
            return; // Hentikan eksekusi aksi asli pemain
        }

        try {
            // Cek World Event (jika perlu)
            if (campaign.worldEventCounter >= WORLD_EVENT_THRESHOLD) {
                // Gunakan generationService (G-2)
                // (Poin 5) Ganti updateWorldState
                const worldEventResult = await generationService.generateWorldEvent(campaign); 
                campaignActions.logEvent({ type: 'system', text: worldEventResult.event }, turnId);
                campaignActions.advanceTime(worldEventResult.secondsToAdd); // Tambahkan waktu
                campaignActions.setWeather(worldEventResult.nextWeather); // Atur cuaca
            }

            // ================== PANGGILAN ATOMIK G-2 ==================
            // SATU panggilan untuk Narasi + Mekanik
            const response = await gameService.generateTurnResponse(
                campaign,
                players,
                actionText,
                character.id, // (Poin 6) Kirim ID pelaku aksi
                campaignActions.setThinkingState
            );
            // ==========================================================

            // 1. Log Narasi (Sekarang aman)
            if (response.reaction) {
                campaignActions.logEvent({ type: 'dm_reaction', text: response.reaction }, turnId);
            }
            // (Poin 3) Gunakan parser baru untuk dialog
            parseAndLogNarration(response.narration, turnId, campaignActions);
            
            // 2. Proses Mekanik (Sekarang dijamin ada atau fallback)
            await processMechanics(turnId, response, actionText);

        } catch (error) {
            // Ini adalah FALLBACK PESIMIS G-2 (Visi #5)
            console.error("[G-2] Gagal total mendapatkan TurnResponse:", error);
            campaignActions.logEvent({
                type: 'system',
                text: "Terjadi kesalahan kritis saat menghubungi AI. DM perlu waktu sejenak."
            }, turnId);
            
            // Gunakan fallback hardcoded untuk mencegah 'stuck'
            const fallbackChoices = generateContextualFallbackChoices(campaign.eventLog);
            campaignActions.setChoices(fallbackChoices);
            campaignActions.endTurn(); // Selalu end turn jika error parah
        }
    }, [campaign, character.id, players, campaignActions, processMechanics, generateContextualFallbackChoices]);


    // =================================================================
    // REFAKTOR G-2: handleRollComplete (Sekarang ATOMIK)
    // =================================================================
    const handleRollComplete = useCallback(async (roll: DiceRoll, request: RollRequest, turnId: string) => {
        if (!turnId) {
             console.error("[G-2] RollComplete dipanggil tanpa turnId aktif.");
             return;
        };

        campaignActions.setActiveRollRequest(null); 
        campaignActions.logEvent({ type: 'roll_result', characterId: character.id, roll: roll, reason: request.reason }, turnId);

        // Input baru untuk AI adalah hasil dari lemparan
        const actionText = `Hasil dari lemparan dadu ${character.name} untuk "${request.reason}": ${roll.total} (${roll.success ? 'BERHASIL' : 'GAGAL'}). (Aksi asli: ${request.originalActionText})`;

        try {
            // ================== PANGGILAN ATOMIK G-2 (Setelah Roll) ==================
            const response = await gameService.generateTurnResponse(
                campaign,
                players,
                actionText, // Inputnya sekarang adalah hasil roll
                character.id, // (Poin 6) Kirim ID pelaku aksi
                campaignActions.setThinkingState
            );
            // ========================================================================

            // 1. Log Narasi
            if (response.reaction) { campaignActions.logEvent({ type: 'dm_reaction', text: response.reaction }, turnId); }
            // (Poin 3) Gunakan parser baru untuk dialog
            parseAndLogNarration(response.narration, turnId, campaignActions);
            
            // 2. Proses Mekanik
            await processMechanics(turnId, response, actionText);

        } catch (error) {
             // FALLBACK PESIMIS G-2 (Visi #5)
             console.error("[G-2] Gagal mendapatkan TurnResponse setelah roll:", error);
             campaignActions.logEvent({
                 type: 'system',
                 text: "Terjadi kesalahan kritis setelah lemparan. DM perlu waktu sejenak."
             }, turnId);
             
             const fallbackChoices = generateContextualFallbackChoices(campaign.eventLog);
             campaignActions.setChoices(fallbackChoices);
             campaignActions.endTurn(); // Pastikan giliran berakhir
        }
    }, [campaign, character.id, character.name, players, campaignActions, processMechanics, generateContextualFallbackChoices]);


    return {
        handlePlayerAction,
        handleRollComplete,
    };
}