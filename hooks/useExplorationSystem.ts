// REFAKTOR G-2: Seluruh file ini di-refaktor untuk menggunakan SATU PANGGILAN AI (gameService.generateTurnResponse)
// Ini memperbaiki bug 'AI DM STUCK' (G-2) dan menyederhanakan logika secara drastis.

import { useCallback, useRef, useEffect } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import {
    Character, DiceRoll, RollRequest, Skill, StructuredApiResponse,
    ToolCall, GameEvent, NPC
} from '../types';
// FASE 0: Hapus dependensi UI store dari hook logika
// import { useAppStore } from '../store/appStore'; 
// import { xpToNextLevel } from '../utils'; 
// Import service BARU (G-2)
import { gameService } from '../services/ai/gameService';
// Import service GENERASI (G-2)
import { generationService } from '../services/ai/generationService';
// (Cleanup DRY) Impor dari utils
import { parseAndLogNarration, composeAbortSignals } from '../utils';
import { useGameStore } from '../store/gameStore';

const WORLD_EVENT_THRESHOLD = 5; // Trigger event every 5 player turns

interface ExplorationSystemProps {
    campaign: CampaignState;
    character: Character;
    players: Character[];
    campaignActions: CampaignActions;
    onCharacterUpdate: (character: Character) => void; // FASE 2 FIX
}

export function useExplorationSystem({ campaign, character, players, campaignActions, onCharacterUpdate }: ExplorationSystemProps) {
    // Cancellation & stale guards
    const aiAbortRef = useRef<AbortController | null>(null);
    const seqRef = useRef(0);

    useEffect(() => {
        return () => {
            aiAbortRef.current?.abort();
        };
    }, []);

    // processToolCalls tetap sama (sudah di-patch G-1)
    const processToolCalls = useCallback(async (turnId: string, toolCalls: ToolCall[]) => {
        for (const call of toolCalls) {
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
                    try {
                        const autoEnabled = useGameStore.getState().runtime.runtimeSettings.autoNpcPortraits;
                        if (autoEnabled) {
                            // Tandai status pembuatan potret agar UI bisa menampilkan badge
                            campaignActions.logNpcInteraction({ ...call.args, imagePending: true });
                            const portraitUrl = await generationService.autoCreateNpcPortrait(call.args.description || call.args.summary);
                            campaignActions.logNpcInteraction({ ...call.args, image: portraitUrl, imagePending: false });
                        } else {
                            // Jika dimatikan, tetap log interaksi tanpa gambar
                            campaignActions.logNpcInteraction({ ...call.args, imagePending: false });
                        }
                    } catch (err) {
                        console.warn('Gagal membuat potret NPC otomatis:', err);
                        // Hapus status pending agar tidak “menggantung” di UI
                        campaignActions.logNpcInteraction({ ...call.args, imagePending: false });
                    }
                    message = `Catatan NPC diperbarui: ${call.args.npcName}`;
                    break;
                case 'spawn_monsters':
                    campaignActions.spawnMonsters(call.args.monsters);
                    message = `Bahaya! Musuh muncul!`;
                    break;
                // (Poin 7) Tangani tool XP
                case 'award_xp': { // FASE 2 FIX: Ubah ke block scope
                    const player = players.find(p => p.id === call.args.characterId);
                    if (player) {
                        // Panggil reducer.
                        campaignActions.awardXp(call.args.characterId, call.args.amount);
                        message = `${player.name} menerima ${call.args.amount} XP untuk: ${call.args.reason}`;

                        // FASE 2 FIX: Ambil state pasca-reducer dari campaign.players
                        // dan panggil controller (GameScreen) untuk menyimpan SSoT.
                        // FASE 3: Cek Level Up di sini (setelah state reducer ter-update).
                        const updatedPlayerState = campaign.players.find(p => p.id === call.args.characterId);
                        if (updatedPlayerState) {
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
                campaignActions.logEvent({ type: 'system', text: `--- ${message} ---` }, turnId);
            }
        }
    }, [campaignActions, players, onCharacterUpdate, campaign.players]); // FASE 2 FIX: Tambah dependensi

    // processMechanics disederhanakan (G-2)
    const processMechanics = useCallback(async (
        turnId: string,
        response: Omit<StructuredApiResponse, 'reaction' | 'narration'>,
        originalActionText: string
    ) => {

        const hasTools = response.tool_calls && response.tool_calls.length > 0;
        if (hasTools) {
            await processToolCalls(turnId, response.tool_calls!);
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
                    .sort((a, b) => event.text.toLowerCase().lastIndexOf(b.name.toLowerCase()) - event.text.toLowerCase().lastIndexOf(a.name.toLowerCase()))[0];
                if (lastNpc && !npcMentioned) {
                    npcMentioned = lastNpc;
                }
                // Cari [OBJECT]
                const objectMatch = event.text.match(/\[OBJECT:([^|]+)\|([^\]]+)\]/g);
                if (objectMatch && !objectMentioned) {
                    const lastObjectString = objectMatch[objectMatch.length - 1];
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

        // Cancel any in-flight AI call
        aiAbortRef.current?.abort();
        aiAbortRef.current = new AbortController();
        const mySeq = ++seqRef.current;

        // --- BARU: FASE 5 (Fog of War Reveal) ---
        // Diadaptasi dari P2 (pixel-vtt-stylizer ExplorationView)
        const FOG_REVEAL_RADIUS = 3.5;
        const { explorationGrid, fogOfWar, playerGridPosition } = campaign;

        // FASE 4 FIX: Periksa apakah grid/fog valid dan memiliki dimensi
        // (DataService Fase 1 sekarang memuat ini, tetapi kampanye lama mungkin tidak memilikinya)
        if (
            explorationGrid && Array.isArray(explorationGrid) && explorationGrid.length > 0 &&
            fogOfWar && Array.isArray(fogOfWar) && fogOfWar.length > 0 &&
            explorationGrid.length === fogOfWar.length && explorationGrid[0].length === fogOfWar[0].length &&
            playerGridPosition
        ) {
            const mapHeight = explorationGrid.length;
            const mapWidth = explorationGrid[0].length;
            const newFog = fogOfWar.map(row => [...row]);

            for (let y = 0; y < mapHeight; y++) {
                for (let x = 0; x < mapWidth; x++) {
                    const distance = Math.sqrt(Math.pow(x - playerGridPosition.x, 2) + Math.pow(y - playerGridPosition.y, 2));
                    if (distance < FOG_REVEAL_RADIUS && newFog[y][x]) {
                        newFog[y][x] = false;
                    }
                }
            }
            campaignActions.setFogOfWar(newFog); // Kirim fog baru ke state
        } else {
            console.warn("Data Peta Eksplorasi (grid/fog/posisi) tidak lengkap. Melewatkan update Fog of War.");
        }
        // --- AKHIR FASE 5 ---

        // (Poin 8) Cek Random Encounter (5% chance)
        if (Math.random() < 0.05 && campaign.gameState === 'exploration') {
            // FASE 4: Hapus console.warn debug
            // console.warn("[Fase 2] Random Encounter Terpicu!");
            const encounterActionText = "Sedang bepergian, tiba-tiba ada ancaman baru muncul dari bayang-bayang...";

            try {
                const response = await gameService.generateTurnResponse(
                    campaign,
                    players,
                    encounterActionText, // Paksa prompt encounter
                    null, // (Poin 6) Aksi 'random encounter' tidak punya pelaku spesifik
                    campaignActions.setThinkingState,
                    composeAbortSignals(
                        aiAbortRef.current?.signal,
                        useGameStore.getState().runtime.sessionAbortController?.signal
                    )
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
                campaignActions.setThinkingState,
                composeAbortSignals(
                    aiAbortRef.current?.signal,
                    useGameStore.getState().runtime.sessionAbortController?.signal
                )
            );
            // ==========================================================

            // Drop stale responses if a newer action started or turn changed
            if (seqRef.current !== mySeq || campaign.turnId !== turnId) {
                return;
            }

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
            // Cancel any in-flight AI call
            aiAbortRef.current?.abort();
            aiAbortRef.current = new AbortController();
            const mySeq = ++seqRef.current;
            // ================== PANGGILAN ATOMIK G-2 (Setelah Roll) ==================
            const response = await gameService.generateTurnResponse(
                campaign,
                players,
                actionText, // Inputnya sekarang adalah hasil roll
                character.id, // (Poin 6) Kirim ID pelaku aksi
                campaignActions.setThinkingState,
                composeAbortSignals(
                    aiAbortRef.current?.signal,
                    useGameStore.getState().runtime.sessionAbortController?.signal
                )
            );
            // ========================================================================

            // Drop stale responses if a newer action started or turn changed
            if (seqRef.current !== mySeq || campaign.turnId !== turnId) {
                return;
            }

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