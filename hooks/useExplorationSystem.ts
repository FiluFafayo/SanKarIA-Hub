import { useCallback } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import { Character, DiceRoll, RollRequest, Skill, StructuredApiResponse, ToolCall, GameEvent, PlayerActionEvent, DmNarrationEvent, DmReactionEvent, NPC } from '../types'; // Ditambah import GameEvent, NPC, dll.
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

    // Fungsi helper BARU untuk fallback kontekstual
    const generateContextualFallbackChoices = (log: GameEvent[]): string[] => {
        // Lihat 5 event terakhir
        const recentEvents = log.slice(-5).reverse();
        let npcMentioned: NPC | undefined = undefined;
        let objectMentioned: { name: string, id: string } | undefined = undefined;

        for (const event of recentEvents) {
            if ((event.type === 'dm_narration' || event.type === 'dm_reaction') && event.text) {
                // Cari penyebutan NPC terakhir
                // Mencari NPC yang namanya ada di teks event, diurutkan berdasarkan posisi terakhir disebut
                const lastNpc = campaign.npcs
                                .filter(npc => event.text.toLowerCase().includes(npc.name.toLowerCase()))
                                .sort((a,b) => event.text.toLowerCase().lastIndexOf(b.name.toLowerCase()) - event.text.toLowerCase().lastIndexOf(a.name.toLowerCase()))[0];
                 if (lastNpc && !npcMentioned) {
                    npcMentioned = lastNpc;
                 }
                // Cari penyebutan OBJECT terakhir
                const objectMatch = event.text.match(/\[OBJECT:([^|]+)\|([^\]]+)\]/g);
                if (objectMatch && !objectMentioned) {
                    const lastObjectString = objectMatch[objectMatch.length-1]; // Ambil yang paling belakang
                    const parts = lastObjectString.match(/\[OBJECT:([^|]+)\|([^\]]+)\]/);
                    if (parts) {
                        objectMentioned = { name: parts[1], id: parts[2] };
                    }
                }
            }
            // Prioritaskan NPC jika keduanya ada di event yang sama atau berdekatan
            if (npcMentioned) break; // Jika sudah nemu NPC, cukup
            if (objectMentioned) break; // Jika sudah nemu Object (dan belum nemu NPC), cukup
        }

        // Buat pilihan berdasarkan konteks yang ditemukan
        if (npcMentioned) {
            return [`Bicara dengan ${npcMentioned.name}`, "Lihat sekeliling lebih teliti"];
        }
        if (objectMentioned) {
            return [`Periksa ${objectMentioned.name}`, "Lihat sekeliling lebih teliti"];
        }

        // Fallback paling akhir jika tidak ada konteks NPC atau Object sama sekali
        return ["Lihat sekeliling lebih teliti", "Pikirkan langkah selanjutnya"];
    };


    // Fungsi handlePlayerAction DIMODIFIKASI dengan retry loop dan fallback kontekstual
    const handlePlayerAction = useCallback(async (actionText: string, pendingSkill: Skill | null) => {
        if (campaign.turnId) return; // Jangan lakukan apa-apa jika giliran sedang berjalan

        const turnId = campaignActions.startTurn(); // Mulai giliran baru
        campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: actionText }, turnId);
        campaignActions.clearChoices(); // Hapus pilihan lama

        let result: StructuredApiResponse | null = null;
        let attempt = 0;
        let hasPrimaryMechanic = false;

        try {
            // Cek World Event (jika perlu) - Bagian ini tidak berubah
            if (campaign.worldEventCounter >= WORLD_EVENT_THRESHOLD) {
                const worldEventResult = await geminiService.generateWorldEvent(campaign);
                campaignActions.logEvent({ type: 'system', text: worldEventResult.event }, turnId);
                campaignActions.updateWorldState(worldEventResult.time, worldEventResult.weather);
                // Reset counter ada di reducer `UPDATE_WORLD_STATE`
            }

            // ================== Retry Loop untuk AI Utama ==================
            while (attempt < MAX_AI_ATTEMPTS && !hasPrimaryMechanic) {
                attempt++;
                console.log(`Mencoba panggil AI utama (Percobaan ${attempt}/${MAX_AI_ATTEMPTS})...`);
                // Panggil AI untuk mendapatkan narasi dan mekanik
                const currentResult = await geminiService.generateTurnResult(
                    campaign,
                    players,
                    // Tambahkan hint di prompt untuk percobaan kedua dst agar AI lebih patuh
                    attempt > 1 ? `${actionText} (Tolong berikan kelanjutan mekanik seperti pilihan aksi atau permintaan lemparan dadu kali ini)` : actionText,
                    campaignActions.setThinkingState // Update UI jadi 'thinking'
                );

                result = currentResult; // Simpan hasil dari percobaan terakhir

                // Cek apakah hasil percobaan ini sudah mengandung mekanik utama
                hasPrimaryMechanic = !!(result.choices || result.rollRequest || result.tool_calls?.some(tc => tc.functionName === 'spawn_monsters'));

                if (hasPrimaryMechanic) {
                    console.log(`AI utama berhasil memberi mekanik pada percobaan ${attempt}.`);
                    break; // Berhasil, keluar dari loop retry
                } else if (campaign.gameState !== 'exploration') {
                     // Jika BUKAN eksplorasi (misal kombat), AI tidak memberi mekanik itu bisa jadi valid (misal monster stun/diam). Keluar loop.
                     console.log(`AI tidak memberi mekanik saat BUKAN eksplorasi pada percobaan ${attempt}, dianggap valid.`);
                     break;
                } else {
                    // Jika eksplorasi TAPI GAGAL, log warning dan coba lagi
                    console.warn(`AI utama tidak memberi mekanik eksplorasi pada percobaan ${attempt}. Mencoba lagi...`);
                    // Bisa tambahkan delay kecil di sini jika mau
                    // await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            // ================== Akhir Retry Loop ==================

            // Pastikan 'result' tidak null setelah loop (sebagai pengaman)
            if (!result) {
                throw new Error("Hasil AI utama (result) null setelah retry loop selesai.");
            }

            // Log narasi dari hasil AI (baik dari percobaan pertama atau terakhir)
            if (result.reaction) {
                campaignActions.logEvent({ type: 'dm_reaction', text: result.reaction }, turnId);
            }
            if (result.narration) {
                campaignActions.logEvent({ type: 'dm_narration', text: result.narration }, turnId);
            } else {
                // Jika narasi benar-benar kosong (seharusnya jarang terjadi karena ada schema)
                campaignActions.logEvent({ type: 'system', text: "DM terdiam sejenak..." }, turnId);
            }

            // ================== Fallback Kontekstual ==================
            // Cek JIKA semua percobaan gagal DAN kita sedang dalam mode eksplorasi
            if (!hasPrimaryMechanic && campaign.gameState === 'exploration') {
                console.error(`Semua ${MAX_AI_ATTEMPTS} percobaan AI gagal memberi mekanik eksplorasi. Menggunakan fallback kontekstual.`);
                // Panggil helper fallback yang baru kita buat
                result.choices = generateContextualFallbackChoices(campaign.eventLog);
                // Tambahkan pesan sistem biar pemain tahu ada sedikit 'hiccup'
                campaignActions.logEvent({ type: 'system', text: `(DM tampak berpikir sejenak sebelum melanjutkan...)` }, turnId);
            }
            // ================== Akhir Fallback Kontekstual ==================

            // Lanjutkan proses mekanik dengan 'result' yang mungkin sudah diisi fallback
            await processMechanics(turnId, result, actionText);

        } catch (error) {
            // Error handling jika ada masalah saat panggil AI atau proses lainnya
            console.error("Gagal total mendapatkan langkah selanjutnya dari AI:", error);
            campaignActions.logEvent({
                type: 'system',
                text: "Terjadi kesalahan kritis saat menghubungi AI. Silakan coba lagi nanti atau segarkan halaman."
            }, turnId);
            campaignActions.endTurn(); // Akhiri giliran biar nggak stuck
        }
    }, [campaign, character.id, players, campaignActions, processMechanics]); // Dependensi lengkap

    // Fungsi handleRollComplete DIMODIFIKASI dengan retry loop dan fallback kontekstual
    const handleRollComplete = useCallback(async (roll: DiceRoll, request: RollRequest, turnId: string) => {
        if (!turnId) {
             console.error("Mencoba mencatat peristiwa eksplorasi setelah roll tanpa turnId eksplisit.");
             return;
        };

        campaignActions.setActiveRollRequest(null); // Sembunyikan modal roll

        // Log hasil roll (Bagian ini tidak berubah)
        campaignActions.logEvent({ type: 'roll_result', characterId: character.id, roll: roll, reason: request.reason }, turnId);

        // Buat teks input untuk AI berdasarkan hasil roll (Bagian ini tidak berubah)
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
                    // Beri hint lagi di percobaan kedua dst.
                    attempt > 1 ? `${actionText} (Tolong berikan kelanjutan mekanik yang jelas)` : actionText,
                    campaignActions.setThinkingState
                );
                result = currentResult; // Simpan hasil terakhir
                // Cek mekanik utama
                hasPrimaryMechanic = !!(result.choices || result.rollRequest || result.tool_calls?.some(tc => tc.functionName === 'spawn_monsters'));

                if (hasPrimaryMechanic) {
                    console.log(`AI setelah roll berhasil memberi mekanik pada percobaan ${attempt}.`);
                    break; // Berhasil
                } else if (campaign.gameState !== 'exploration') {
                     console.log(`AI tidak memberi mekanik saat BUKAN eksplorasi setelah roll pada percobaan ${attempt}, dianggap valid.`);
                     break; // Mungkin kombat sudah selesai atau giliran berakhir
                } else {
                    console.warn(`AI setelah roll tidak memberi mekanik eksplorasi pada percobaan ${attempt}. Mencoba lagi...`);
                    // await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            // ================== Akhir Retry Loop ==================

            if (!result) {
                 throw new Error("Hasil AI setelah roll (result) null setelah retry loop.");
            }

            // Log narasi dari hasil AI (Bagian ini tidak berubah)
            if (result.reaction) { campaignActions.logEvent({ type: 'dm_reaction', text: result.reaction }, turnId); }
            if (result.narration) { campaignActions.logEvent({ type: 'dm_narration', text: result.narration }, turnId); }
            else { campaignActions.logEvent({ type: 'system', text: "DM melanjutkan cerita..." }, turnId); }


            // ================== Fallback Kontekstual (Sama seperti di handlePlayerAction) ==================
            if (!hasPrimaryMechanic && campaign.gameState === 'exploration') {
                 console.error(`Semua ${MAX_AI_ATTEMPTS} percobaan AI setelah roll gagal memberi mekanik eksplorasi. Menggunakan fallback kontekstual.`);
                 result.choices = generateContextualFallbackChoices(campaign.eventLog); // Panggil helper fallback
                 campaignActions.logEvent({ type: 'system', text: `(DM tampak merangkai kelanjutan...)` }, turnId); // Flavour
            }
            // ================== Akhir Fallback Kontekstual ==================

            // Lanjutkan proses mekanik dengan 'result'
            await processMechanics(turnId, result, actionText);
        } catch (error) {
             console.error("Gagal mendapatkan langkah selanjutnya dari AI setelah lemparan:", error);
             campaignActions.logEvent({
                 type: 'system',
                 text: "Terjadi kesalahan kritis setelah lemparan. Coba segarkan halaman."
             }, turnId);
             campaignActions.endTurn(); // Akhiri giliran biar nggak stuck
        }
    }, [campaign, character.id, character.name, players, campaignActions, processMechanics]); // Dependensi lengkap


    return {
        handlePlayerAction,
        handleRollComplete,
    };
}