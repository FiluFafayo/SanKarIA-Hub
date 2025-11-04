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
    }
];


// FUNGSI LAMA (Dipindah dari geminiService.ts)
class GameService {

    private buildPrompt(campaign: Campaign, players: Character[], playerAction: string): string {
        const worldState = `Saat ini adalah ${campaign.currentTime} hari, dengan cuaca ${campaign.currentWeather}.`;
        
        // Konteks Quest/NPC disederhanakan
        const questContext = `Misi Aktif: ${campaign.quests.filter(q => q.status === 'active').map(q => q.title).join(', ') || 'Tidak ada'}`;
        const npcContext = `NPC Terdekat: ${campaign.npcs.filter(n => n.location === campaign.currentPlayerLocation).map(n => n.name).join(', ') || 'Tidak ada'}`;
        
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
        
        return `KONTEKS KAMPANYE:
        - Cerita Jangka Panjang: ${campaign.longTermMemory}
        - State Dunia: ${worldState}. Lokasi Saat Ini: ${campaign.currentPlayerLocation || 'Tidak diketahui'}.
        - ${questContext}
        - ${npcContext}
        
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
        onStateChange: (state: 'thinking' | 'retrying') => void
    ): Promise<StructuredApiResponse> {
        onStateChange('thinking');

        let styleInstruction = '';
        if (campaign.dmNarrationStyle === 'Langsung & Percakapan') {
            styleInstruction = 'Gaya narasimu HARUS langsung, sederhana, dan seperti percakapan.';
        }

        // (Poin 2 & 3) Instruksi baru untuk gaya, dialog, dan opsi
        const systemInstruction = `Anda adalah AI Dungeon Master (DM) TTRPG.
        Kepribadian Anda: DM yang suportif namun menantang, fokus pada cerita.
        Panjang Respons: Standar.
        
        ATURAN GAYA (WAJIB DIPATUHI - Poin 2):
        1.  Gaya narasi HARUS langsung, sederhana, dan hidup (vivid). Gunakan kalimat aktif. Hindari frasa bertele-tele.
        2.  Gunakan format markdown (*tebal* untuk penekanan, *italics* untuk pikiran internal).
        
        ATURAN DIALOG (WAJIB DIPATUHI - Poin 3):
        1.  JANGAN PERNAH menulis dialog NPC (misal: "Elias berkata, 'Halo'") di dalam field 'narration' atau 'reaction'.
        2.  UNTUK DIALOG NPC, SELALU gunakan format tag ini TEPAT di dalam string 'narration': [DIALOGUE:Nama NPC|Teks dialog mereka di sini]
        3.  Contoh: Pintu berderit terbuka. [DIALOGUE:Elias|Siapa disana?] Dia mengangkat lentera.
        
        ATURAN MEKANIK (WAJIB DIPATUHI - Poin 2):
        1.  Tugas Anda adalah merespons aksi pemain secara ATOMIK: Berikan Narasi DAN Mekanik selanjutnya dalam SATU respons JSON.
        2.  Tentukan SATU MEKANIK UTAMA (choices, rollRequest, atau panggil alat 'spawn_monsters').
        3.  ATURAN EKSPLORASI: Jika 'exploration', Anda WAJIB mengisi 'choices' (selalu 3 pilihan).
        4.  PILIHAN KE-3: Pilihan 1 & 2 harus logis. Pilihan 3 harus sedikit 'brilian', berbahaya, atau acak/kreatif.
        5.  ALAT SEKUNDER: Anda BISA memanggil 'add_items', 'update_quest', 'log_npc', atau 'award_xp' BERSAMAAN dengan mekanik utama.
        6.  JANGAN panggil 'spawn_monsters' BERSAMAAN dengan 'choices' or 'rollRequest'.`;
        
        const prompt = this.buildPrompt(campaign, players, playerAction);

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash', // Cukup untuk respons terstruktur
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: COMBINED_RESPONSE_SCHEMA, // Gunakan SKEMA BARU
                    tools: [{ functionDeclarations: TOOLS }], // Sediakan ALAT
                    temperature: 0.7,
                }
            });

            // response.text DIJAMIN JSON karena responseSchema
            const jsonText = response.text;
            
            // 1. Urai Objek JSON Utama (Narasi, Choices, RollRequest)
            const mainResponse = parseStructuredApiResponse(jsonText);

            // 2. Urai Panggilan Alat (Tools)
            const tool_calls: ToolCall[] = [];
            if (response.functionCalls) {
                for (const fc of response.functionCalls) {
                     tool_calls.push({
                        functionName: fc.name as ToolCall['functionName'],
                        args: fc.args
                    });
                }
            }

            // 3. Gabungkan menjadi satu StructuredApiResponse
            return {
                ...mainResponse,
                tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
            };
        };
        
        try {
            return await geminiService.makeApiCall(call);
        } catch (error) {
             console.error("[G-2] Gagal total menghasilkan TurnResponse:", error);
            // Kembalikan respons fallback yang aman
            return {
                reaction: "DM tampak bingung sejenak...",
                narration: `Terjadi kesalahan saat DM merangkai kata. (Error: ${error.message})`,
                choices: ["Coba ulangi aksimu", "Lihat sekeliling"], // Fallback aman
                rollRequest: undefined,
                tool_calls: undefined,
            };
        }
    }
}

export const gameService = new GameService();