// REFAKTOR G-2: File BARU.
// Ini adalah jantung baru dari logika AI DM, menggantikan alur "Two-Step" yang rapuh.
// Berisi fungsi ATOMIK 'generateTurnResponse' yang menghasilkan Narasi + Mekanik
// dalam SATU panggilan.

import { Type, FunctionDeclaration } from "@google/genai";
import {
    Campaign, Character, StructuredApiResponse, ToolCall,
    GameEvent, RollRequest
} from '../../types';
import { geminiService } from "../geminiService"; // Import klien inti
import { parseStructuredApiResponse } from "../responseParser"; // Import parser
import { formatDndTime } from "../../utils"; // [FIX FASE 3] Import Missing Utility

// =================================================================
// SKEMA & TOOLS (Dipindah dari geminiService.ts)
// =================================================================

// (Poin 3) Tipe event baru untuk dialog NPC
// Kita akan mem-parse ini dari string narasi, tapi kita definisikan di sini untuk referensi
// Format yang diharapkan: [DIALOGUE:Nama NPC|Teks dialog]

// SKEMA G-2 (BARU): Menggabungkan Narasi dan Mekanik menjadi SATU skema respons.
// Ini adalah inti dari perbaikan 'AI DM STUCK'.
export const COMBINED_RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        reaction: {
            type: Type.STRING,
            description: "Reaksi langsung yang singkat dan cepat terhadap tindakan pemain (1-2 kalimat). Opsional.",
            nullable: true,
        },
        narration: {
            type: Type.STRING,
            description: "Narasi cerita yang lebih rinci yang mengikuti reaksi. Ini menjelaskan dunia dan apa yang terjadi selanjutnya. WAJIB ADA.",
        },
        // Mekanik digabung di sini
        choices: {
            type: Type.ARRAY,
            description: "Daftar 3-4 tindakan yang dapat diambil pemain. HARUS KOSONG jika ada rollRequest atau spawn_monsters.",
            nullable: true,
            items: { type: Type.STRING }
        },
        rollRequest: {
            type: Type.OBJECT,
            description: "Permintaan bagi pemain untuk melempar dadu. HARUS NULL jika ada choices atau spawn_monsters.",
            nullable: true,
            properties: {
                type: { type: Type.STRING, enum: ['skill', 'savingThrow', 'attack'] },
                reason: { type: Type.STRING },
                skill: { type: Type.STRING, nullable: true },
                ability: { type: Type.STRING, enum: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'], nullable: true },
                dc: { type: Type.INTEGER, description: "Wajib diisi untuk tipe 'skill' dan 'savingThrow'.", nullable: true },
                target: {
                    type: Type.OBJECT,
                    description: "Wajib untuk tipe 'attack'.",
                    nullable: true,
                    properties: {
                        id: { type: Type.STRING, description: "ID Karakter atau InstanceId Monster target." },
                        name: { type: Type.STRING, description: "Nama NPC atau makhluk target." },
                        ac: { type: Type.INTEGER, description: "Armor Class target." }
                    }
                },
                // Adv/Disadv ditambahkan
                isAdvantage: { type: Type.BOOLEAN, description: "Set true jika pemain punya advantage.", nullable: true },
                isDisadvantage: { type: Type.BOOLEAN, description: "Set true jika pemain punya disadvantage.", nullable: true },
            },
            // Target tidak wajib required, karena DC bisa dipakai untuk non-serangan
            required: ['type', 'reason']
        }
    },
    required: ['narration']
};


// TOOLS (Dipindah dari geminiService.ts dan disederhanakan)
// propose_choices dan request_roll sekarang menjadi bagian dari SKEMA RESPON, bukan alat.
// Ini mengurangi kompleksitas panggilan AI (function call vs response object).
const TOOLS: FunctionDeclaration[] = [
    {
        name: 'spawn_monsters',
        description: "Memulai mode pertarungan dengan memunculkan satu atau lebih musuh. Ini adalah ALAT MEKANIK UTAMA. Jika dipanggil, JANGAN berikan 'choices' or 'rollRequest'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                monsters: {
                    type: Type.ARRAY,
                    description: "Daftar monster yang akan muncul.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Nama monster. HARUS cocok dengan SSoT (misal 'Goblin', 'Orc')." },
                            quantity: { type: Type.INTEGER },
                        },
                        required: ['name', 'quantity']
                    }
                }
            },
            required: ['monsters']
        }
    },
    {
        name: 'add_items_to_inventory',
        description: "Menambahkan satu atau lebih item ke inventaris karakter pemain (misal: loot, hadiah). Ini adalah ALAT SEKUNDER.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                characterId: { type: Type.STRING, description: "ID karakter yang menerima item. (Gunakan ID karakter yang sedang beraksi)." },
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Nama item. HARUS cocok dengan SSoT (misal 'Potion of Healing', 'Longsword')." },
                            quantity: { type: Type.INTEGER }
                        },
                        required: ['name', 'quantity']
                    }
                }
            },
            required: ['characterId', 'items']
        }
    },
    {
        name: 'update_quest_log',
        description: "Menambah atau memperbarui misi di jurnal pemain. Ini adalah ALAT SEKUNDER.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "ID unik untuk misi (misal, 'nama-desa-01')." },
                title: { type: Type.STRING },
                description: { type: Type.STRING, description: "Deskripsi misi." },
                status: { type: Type.STRING, enum: ['proposed', 'active', 'completed', 'failed'] },
                isMainQuest: { type: Type.BOOLEAN, description: "Setel ke true jika ini misi utama." },
                reward: { type: Type.STRING, description: "Imbalan yang dijanjikan." }
            },
            required: ['id', 'title', 'description', 'status']
        }
    },
    {
        name: 'log_npc_interaction',
        description: "Mencatat atau memperbarui informasi tentang NPC. Ini adalah ALAT SEKUNDER.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                npcName: { type: Type.STRING, description: "Nama NPC. Gunakan nama yang sama untuk memperbarui." },
                summary: { type: Type.STRING, description: "Ringkasan FAKTA singkat dari interaksi saat ini." },
                description: { type: Type.STRING, description: "Deskripsi fisik/kepribadian (hanya saat pertama bertemu)." },
                location: { type: Type.STRING, description: "Lokasi NPC." },
                disposition: { type: Type.STRING, enum: ['Friendly', 'Neutral', 'Hostile', 'Unknown'], description: "Sikap NPC." }
            },
            required: ['npcName', 'summary']
        }
    },
    // (Poin 7) Alat baru untuk XP
    {
        name: 'award_xp',
        description: "Memberikan Poin Pengalaman (XP) kepada pemain atas pencapaian non-kombat (menyelesaikan quest, roleplay cerdas, menemukan rahasia).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                characterId: { type: Type.STRING, description: "ID karakter yang menerima XP." },
                amount: { type: Type.INTEGER, description: "Jumlah XP yang diberikan (misal: 50, 100, 250)." },
                reason: { type: Type.STRING, description: "Alasan singkat pemberian XP (misal: 'Menyelesaikan Quest: Misteri Kuil')." }
            },
            required: ['characterId', 'amount', 'reason']
        }
    },
    // (Poin 4) Alat baru untuk Opini NPC
    {
        name: 'update_npc_opinion',
        description: "Memperbarui opini (hubungan) NPC terhadap seorang karakter berdasarkan interaksi sosial.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                npcId: { type: Type.STRING, description: "ID NPC yang opininya berubah (dari konteks)." },
                characterId: { type: Type.STRING, description: "ID karakter yang berinteraksi." },
                change: { type: Type.INTEGER, description: "Jumlah perubahan opini (misal: 1 untuk positif, -1 untuk negatif, 2 untuk sangat positif)." },
                reason: { type: Type.STRING, description: "Alasan singkat perubahan opini (misal: 'Pemain mengancamnya')." }
            },
            required: ['npcId', 'characterId', 'change', 'reason']
        }
    },
    // FASE 3: ATLAS PROTOCOL TOOLS
    {
        name: 'travel_to_location',
        description: "Memindahkan party ke lokasi/peta baru. Panggil ini saat pemain memutuskan untuk pergi ke tempat lain (misal: Masuk Dungeon, Pergi ke Kota Sebelah).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                locationName: { type: Type.STRING, description: "Nama lokasi tujuan (misal: 'Goa Kristal', 'Ibukota')." },
                travelTimeDays: { type: Type.NUMBER, description: "Lama perjalanan dalam hari (0 jika instan)." },
                encounterChance: { type: Type.STRING, enum: ['Safe', 'Low', 'High'], description: "Risiko perjalanan." }
            },
            required: ['locationName']
        }
    },
    {
        name: 'advance_story_node',
        description: "Menandai kemajuan signifikan dalam cerita (Checkpoint). Panggil saat bos kalah, rahasia besar terungkap, atau pemain mencapai tujuan utama.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nodeTitle: { type: Type.STRING, description: "Judul babak baru cerita (misal: 'Kebangkitan Raja Iblis')." },
                summary: { type: Type.STRING, description: "Ringkasan apa yang baru saja diselesaikan." }
            },
            required: ['nodeTitle', 'summary']
        }
    }
];


// FUNGSI LAMA (Dipindah dari geminiService.ts)
class GameService {

    private buildPrompt(campaign: Campaign, players: Character[], playerAction: string, actingCharacterId: string | null): string { // (Poin 6)
        const worldState = `Saat ini adalah ${formatDndTime(campaign.currentTime)} hari, dengan cuaca ${campaign.currentWeather}.`;
        const turnTrace = `TRACE: Turn ID = ${campaign.turnId || 'none'}`;

        // (Poin 4) Konteks Quest/NPC diperkaya
        const questContext = `Misi Aktif: ${JSON.stringify(campaign.quests.filter(q => q.status === 'active').map(q => ({ title: q.title, id: q.id }))) || 'Tidak ada'}`;
        
        // FASE 3: Konteks Atlas & Grand Line
        const locationContext = `Lokasi Aktif: ${campaign.activeMapId ? `Peta ID: ${campaign.activeMapId}` : campaign.currentPlayerLocation || 'Tidak diketahui'}`;
        const storyContext = `Babak Cerita: ${campaign.currentStoryNodeId || 'Awal Petualangan'}`;

        // (Poin 4) Kirim opini NPC (tapi BUKAN rahasia)
        const npcContext = `Konteks NPC: ${JSON.stringify(campaign.npcs.map(n => ({ id: n.id, name: n.name, disposition: n.disposition, location: n.location, opinion: n.opinion || {} }))) || 'Tidak ada NPC'}`;

        const recentEvents = campaign.eventLog.slice(-10).map((event: GameEvent) => {
            switch (event.type) {
                case 'player_action':
                    const player = players.find(p => p.id === event.characterId);
                    return `${player ? player.name : 'Player'}: ${event.text}`;
                case 'dm_narration':
                case 'dm_reaction':
                    return `DM: ${event.text}`;
                case 'roll_result':
                    const roller = players.find(p => p.id === event.characterId);
                    return `SYSTEM: ${roller ? roller.name : 'Player'} melempar ${event.roll.total} untuk ${event.reason} (${event.roll.success ? 'Berhasil' : 'Gagal'}).`;
                case 'system':
                    return `SYSTEM: ${event.text}`;
                default:
                    return '';
            }
        }).filter(Boolean).join('\n');

        // (Poin 6) Temukan pelaku aksi dan inventarisnya
        const actingCharacter = players.find(p => p.id === actingCharacterId);
        const inventoryContext = actingCharacter
            ? `Inventaris ${actingCharacter.name}: ${actingCharacter.inventory.map(i => `${i.item.name} (x${i.quantity})`).join(', ') || 'Kosong'}`
            : 'Inventaris pemain tidak diketahui.';

        return `KONTEKS KAMPANYE:
        - ${turnTrace}
        - Cerita Jangka Panjang: ${campaign.longTermMemory}
        - State Dunia: ${worldState}.
        - ${locationContext}
        - ${storyContext}
        - ${questContext}
        - ${npcContext}
        
        KONTEKS PEMAIN SAAT INI:
        - ${inventoryContext}

        PERISTIWA TERBARU:
        ${recentEvents}
        
        AKSI PEMAIN SAAT INI: "${playerAction}"`;
    }

    // =================================================================
    // FUNGSI INTI (BARU - G-2): Menggantikan generateNarration + determineNextStep
    // =================================================================
    async generateTurnResponse(
        campaign: Campaign,
        players: Character[],
        playerAction: string,
        actingCharacterId: string | null,
        onStateChange: (state: 'thinking' | 'retrying') => void,
        signal?: AbortSignal
    ): Promise<StructuredApiResponse> {
        onStateChange('thinking');
        
        // [INSTRUMENTATION] Start Trace
        const traceId = `REQ-${Date.now().toString().slice(-6)}`;
        console.groupCollapsed(`🧠 [GameService] Generate Turn (${traceId})`);
        console.log("🎬 Action:", playerAction);

        let styleInstruction = '';
        if (campaign.dmNarrationStyle === 'Langsung & Percakapan') {
            styleInstruction = 'Gaya narasimu HARUS langsung, sederhana, dan seperti percakapan.';
        }

        // (Poin 2 & 3) Instruksi baru untuk gaya, dialog, dan opsi
        const systemInstruction = `Anda adalah AI Dungeon Master (DM) TTRPG.
        Kepribadian Anda: DM yang suportif namun menantang, fokus pada cerita.
        Panjang Respons: Standar.
        
        ATURAN GAYA (WAJIB DIPATUHI):
        1.  Gaya narasi HARUS langsung, sederhana, dan hidup (vivid). Gunakan kalimat aktif. Hindari frasa bertele-tele.
        2.  Gunakan format markdown (*tebal* untuk penekanan, *italics* untuk pikiran internal).
        
        ATURAN DIALOG (WAJIB DIPATUHI):
        1.  JANGAN PERNAH menulis dialog NPC (misal: "Elias berkata, 'Halo'") di dalam field 'narration' atau 'reaction'.
        2.  UNTUK DIALOG NPC, SELALU gunakan format tag ini TEPAT di dalam string 'narration': [DIALOGUE:Nama NPC|Teks dialog mereka di sini]
        3.  Contoh: Pintu berderit terbuka. [DIALOGUE:Elias|Siapa disana?] Dia mengangkat lentera.
        
        ATURAN SOSIAL (NPC):
        1.  Anda HARUS membaca 'Konteks NPC' (terutama field 'opinion') untuk menentukan bagaimana NPC bereaksi.
        2.  Jika aksi pemain bersifat sosial (membujuk, mengintimidasi, membantu), Anda HARUS memanggil tool 'update_npc_opinion' untuk mencatat perubahan hubungan.
        
        ATURAN MEKANIK (WAJIB DIPATUHI):
        1.  Validasi Inventaris: Anda HARUS memvalidasi aksi pemain terhadap 'KONTEKS PEMAIN SAAT INI (Inventaris)'. Jika pemain mencoba menggunakan item yang tidak mereka miliki (misal 'Potion of Healing' padahal inventaris kosong), 'narration' Anda HARUS menyatakan bahwa mereka tidak memilikinya, dan 'choices' Anda harus merefleksikan kegagalan itu.
        2.  Tugas Anda adalah merespons aksi pemain secara ATOMIK: Berikan Narasi DAN Mekanik selanjutnya dalam SATU respons JSON.
        3.  Tentukan SATU MEKANIK UTAMA (choices, rollRequest, atau panggil alat 'spawn_monsters').
        4.  ATURAN EKSPLORASI: Jika 'exploration', Anda WAJIB mengisi 'choices' (selalu 3 pilihan).
        5.  PILIHAN KE-3: Pilihan 1 & 2 harus logis. Pilihan 3 harus sedikit 'brilian', berbahaya, atau acak/kreatif.
        6.  ALAT SEKUNDER: Anda BISA memanggil 'add_items', 'update_quest', 'log_npc', atau 'award_xp' BERSAMAAN dengan mekanik utama.
        7.  TRAVEL & STORY: Jika pemain berpindah tempat, GUNAKAN 'travel_to_location'. Jika babak cerita selesai, GUNAKAN 'advance_story_node'.
        8.  JANGAN panggil 'spawn_monsters' BERSAMAAN dengan 'choices' or 'rollRequest'.`;

        const prompt = this.buildPrompt(campaign, players, playerAction, actingCharacterId);
        
        // [INSTRUMENTATION] Log Context Payload
        console.log("📜 Constructed Prompt Preview:", prompt.slice(0, 500) + "...");
        console.log("📏 Context Length:", prompt.length, "chars");

        const call = async (client: any) => {
            console.time(`⏱️ Latency (${traceId})`);
            const response = await client.models.generateContent({
                model: geminiService.getTextModelName(),
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: COMBINED_RESPONSE_SCHEMA,
                    tools: [{ functionDeclarations: TOOLS }],
                    temperature: 0.7,
                }
            });
            console.timeEnd(`⏱️ Latency (${traceId})`);

            const jsonText = response.text(); // FIX: .text() is usually a method or getter in some SDKs, ensure consistency
            console.log("📦 Raw JSON Received:", jsonText);

            try {
                // 1. Urai Objek JSON Utama
                const mainResponse = parseStructuredApiResponse(jsonText);
                return {
                    ...mainResponse,
                    tool_calls: response.functionCalls?.map(fc => ({
                        functionName: fc.name,
                        args: fc.args
                    })) || undefined,
                };
            } catch (parseError) {
                console.error("❌ JSON Parse Failed. Raw Text:", jsonText);
                throw new Error(`Invalid JSON from AI: ${parseError.message}`);
            }
        };

        try {
            const result = await geminiService.makeApiCall(call, signal);
            console.log("✅ Request Success");
            console.groupEnd();
            return result;
        } catch (error: any) {
            console.error(`❌ [GameService] Request Failed (${traceId}):`, error);
            console.groupEnd();

            // Kembalikan respons fallback yang aman
            return {
                reaction: "DM tampak bingung sejenak...",
                narration: `(Sistem) Maaf, koneksi ke 'otak' DM terputus atau terjadi kesalahan internal. \n\nError: ${error.message || 'Unknown Error'}`,
                choices: ["Coba lagi (Resend)", "Tunggu sebentar"],
                rollRequest: undefined,
                tool_calls: undefined,
            };
        }
    }
}

export const gameService = new GameService();