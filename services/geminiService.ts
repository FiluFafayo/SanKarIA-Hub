import { GoogleGenAI, Type, FunctionDeclaration, Modality, Part, Content } from "@google/genai";
import { Campaign, Character, StructuredApiResponse, ToolCall, GameEvent, MapMarker, WorldTime, WorldWeather, RollRequest } from '../types';
import { RESPONSE_SCHEMA, MECHANICS_SCHEMA, parseStructuredApiResponse, parseMechanicsResponse } from "./responseParser";

// ... (Salin semua skema dari file lamamu: CAMPAIGN_FRAMEWORK_SCHEMA, MAP_MARKER_SCHEMA, PROPOSE_CHOICES_TOOL, REQUEST_ROLL_TOOL, SPAWN_MONSTERS_TOOL, dan TOOLS) ...
// ... (Pastikan semua skema dan konstanta TOOLS ada di sini) ...

// PASTIIN SEMUA SKEMA DI ATAS SUDAH DI-SALIN LENGKAP
const CAMPAIGN_FRAMEWORK_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        proposedTitle: { 
            type: Type.STRING,
            description: "Judul yang menarik dan ringkas untuk kampanye."
        },
        proposedMainQuest: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "Judul untuk misi utama." },
                description: { type: Type.STRING, description: "Deskripsi singkat tentang tujuan misi utama." },
            },
            required: ['title', 'description'],
        },
        proposedMainNPCs: {
            type: Type.ARRAY,
            description: "Dua karakter non-pemain (NPC) kunci yang akan ditemui pemain.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Nama NPC." },
                    description: { type: Type.STRING, description: "Deskripsi singkat tentang peran atau kepribadian NPC." },
                },
                required: ['name', 'description'],
            },
        },
        potentialSideQuests: {
            type: Type.ARRAY,
            description: "Satu misi sampingan potensial yang dapat ditemukan pemain.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "Judul untuk misi sampingan." },
                    description: { type: Type.STRING, description: "Deskripsi singkat tentang tujuan misi sampingan." },
                },
                required: ['title', 'description'],
            },
        },
    },
    required: ['proposedTitle', 'proposedMainQuest', 'proposedMainNPCs', 'potentialSideQuests'],
};

const MAP_MARKER_SCHEMA = {
    type: Type.ARRAY,
    description: "Daftar penanda lokasi pada peta.",
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: "ID unik untuk penanda, dalam format kebab-case (misal, 'desa-awal')." },
            name: { type: Type.STRING, description: "Nama lokasi." },
            x: { type: Type.NUMBER, description: "Koordinat X sebagai persentase dari kiri (0-100)." },
            y: { type: Type.NUMBER, description: "Koordinat Y sebagai persentase dari atas (0-100)." },
        },
        required: ["id", "name", "x", "y"]
    }
}

const PROPOSE_CHOICES_TOOL: FunctionDeclaration = {
    name: 'propose_choices',
    description: "Memberikan pemain daftar pilihan tindakan yang bisa diambil. Gunakan ini jika tidak ada lemparan dadu yang diperlukan.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            choices: {
                type: Type.ARRAY,
                description: "Daftar 3-4 tindakan yang dapat diambil pemain.",
                items: { type: Type.STRING }
            }
        },
        required: ['choices']
    }
};

const REQUEST_ROLL_TOOL: FunctionDeclaration = {
    name: 'request_roll',
    description: "Meminta pemain untuk melempar dadu untuk menyelesaikan tindakan dengan hasil yang tidak pasti.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['skill', 'savingThrow', 'attack'] },
            reason: { type: Type.STRING },
            skill: { type: Type.STRING, nullable: true },
            ability: { type: Type.STRING, enum: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'], nullable: true },
            dc: { type: Type.INTEGER, description: "Wajib diisi untuk tipe 'skill' dan 'savingThrow'. Menentukan tingkat kesulitan.", nullable: true },
            target: {
              type: Type.OBJECT,
              description: "Wajib untuk tipe 'attack'. Menjelaskan target.",
              nullable: true,
              properties: {
                  name: { type: Type.STRING, description: "Nama NPC atau makhluk target." },
                  ac: { type: Type.INTEGER, description: "Armor Class target." }
              }
            }
        },
        required: ['type', 'reason']
    }
};

const SPAWN_MONSTERS_TOOL: FunctionDeclaration = {
    name: 'spawn_monsters',
    description: "Memulai mode pertarungan dengan memunculkan satu atau lebih musuh.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            monsters: {
                type: Type.ARRAY,
                description: "Daftar monster yang akan muncul.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "Nama monster. HARUS cocok dengan nama dari daftar default (misal 'Goblin', 'Penduduk Desa') jika ada." },
                        quantity: { type: Type.INTEGER },
                        stats: {
                            type: Type.OBJECT,
                            description: "HANYA digunakan jika monster TIDAK ADA di daftar default (misal 'Rubah', 'Kapten Penjaga').",
                            nullable: true,
                            properties: {
                                maxHp: { type: Type.INTEGER },
                                armorClass: { type: Type.INTEGER },
                                dexterity: { type: Type.INTEGER },
                                actions: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            toHitBonus: { type: Type.INTEGER },
                                            damageDice: { type: Type.STRING, description: "Contoh: '1d8+2'" }
                                        },
                                        required: ['name', 'toHitBonus', 'damageDice']
                                    }
                                }
                            },
                        }
                    },
                    required: ['name', 'quantity']
                }
            }
        },
        required: ['monsters']
    }
};

const TOOLS: FunctionDeclaration[] = [
    SPAWN_MONSTERS_TOOL,
    PROPOSE_CHOICES_TOOL,
    REQUEST_ROLL_TOOL,
    {
        name: 'add_items_to_inventory',
        description: "Menambahkan satu atau lebih item ke inventaris karakter pemain. Gunakan ini saat pemain menemukan loot, mengambil item, atau diberi hadiah.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                characterId: { type: Type.STRING, description: "ID karakter yang menerima item. (Gunakan ID karakter yang sedang beraksi atau yang paling relevan)." },
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Nama item. Contoh: 'Potion of Healing', 'Longsword', 'Gold Coins'." },
                            quantity: { type: Type.INTEGER }
                        },
                        required: ['name', 'quantity'] // REFAKTOR: Hanya butuh nama & kuantitas
                    }
                }
            },
            required: ['characterId', 'items']
        }
    },
    {
        name: 'update_quest_log',
        description: "Menambah atau memperbarui misi di jurnal pemain.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "ID unik untuk misi (misal, 'nama-desa-01'). Tetap konsisten jika memperbarui." },
                title: { type: Type.STRING },
                description: { type: Type.STRING, description: "Deskripsi misi. Harus jelas dan memberikan tujuan yang bisa ditindaklanjuti oleh pemain." },
                status: { type: Type.STRING, enum: ['proposed', 'active', 'completed', 'failed'] },
                isMainQuest: { type: Type.BOOLEAN, description: "Setel ke true jika ini adalah bagian dari alur cerita utama." },
                reward: { type: Type.STRING, description: "Imbalan yang dijanjikan untuk menyelesaikan misi (misal, '100 Keping Emas', 'Pedang Ajaib')." }
            },
            required: ['id', 'title', 'description', 'status']
        }
    },
    {
        name: 'log_npc_interaction',
        description: "Mencatat atau memperbarui informasi tentang NPC yang ditemui pemain.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                npcId: { type: Type.STRING, description: "ID NPC yang ada dari konteks, jika memperbarui. Biarkan kosong jika ini adalah NPC yang benar-benar baru." },
                npcName: { type: Type.STRING, description: "Nama NPC. Gunakan nama yang sama untuk memperbarui NPC yang ada, atau berikan nama baru jika sebelumnya tidak diketahui (misal, 'Penjaga Toko' menjadi 'Bartholomew')." },
                summary: { type: Type.STRING, description: "Ringkasan singkat berupa FAKTA dari interaksi saat ini. HARUS berupa catatan orang ketiga yang ringkas (misalnya, 'Berhasil diintimidasi, mengungkapkan info soal kegilaan di gunung.'), BUKAN prosa naratif." },
                description: { type: Type.STRING, description: "Deskripsi fisik atau kepribadian NPC. Hanya berikan saat pertama kali bertemu." },
                location: { type: Type.STRING, description: "Lokasi saat ini atau biasa dari NPC." },
                disposition: { type: Type.STRING, enum: ['Friendly', 'Neutral', 'Hostile', 'Unknown'], description: "Sikap NPC terhadap pemain." }
            },
            required: ['npcName', 'summary']
        }
    }
];


class GeminiService {
    private apiKeys: string[] = [''];
    private currentKeyIndex = 0;
    private genAI: GoogleGenAI | null = null;

    public updateKeys(keys: string[]) {
        this.apiKeys = keys.filter(k => k.trim() !== '');
        this.currentKeyIndex = 0;
        this.genAI = null;
    }

    private getClient(): GoogleGenAI {
        if (this.genAI) return this.genAI;
        if (this.apiKeys.length === 0) throw new Error("Tidak ada Kunci API Gemini yang valid.");
        const key = this.apiKeys[this.currentKeyIndex];
        this.genAI = new GoogleGenAI({ apiKey: key });
        return this.genAI;
    }

    private rotateKey() {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        this.genAI = null;
        console.log(`Beralih ke Kunci API #${this.currentKeyIndex + 1}`);
    }

    private async makeApiCall<T>(call: () => Promise<T>): Promise<T> {
        let attempts = 0;
        while (attempts < Math.max(1, this.apiKeys.length)) {
             try {
                const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("API call timed out after 30 seconds")), 30000));
                // @ts-ignore
                const result = await Promise.race([call(), timeoutPromise]);
                return result;
            } catch (error) {
                console.error(`Upaya API ${attempts + 1} gagal:`, error);
                attempts++;
                if (this.apiKeys.length > 1) this.rotateKey();
                if (attempts >= Math.max(1, this.apiKeys.length)) {
                    throw new Error("Semua upaya panggilan API gagal.");
                }
            }
        }
        throw new Error("Gagal melakukan panggilan API.");
    }

    // ... (Salin fungsi: generateCampaignFramework, mechanizeCampaignFramework) ...
    async generateCampaignFramework(pillars: { premise: string; keyElements: string; endGoal: string }): Promise<any> {
        const prompt = `Berdasarkan pilar-pilar kampanye D&D berikut, hasilkan kerangka kampanye yang kreatif dan menarik.
    
        Premis: ${pillars.premise}
        Elemen Kunci: ${pillars.keyElements}
        Tujuan Akhir: ${pillars.endGoal || 'Tidak ditentukan'}

        Kembangkan ini menjadi judul yang diusulkan, misi utama, dua NPC kunci, dan satu misi sampingan potensial. Respons HARUS dalam bahasa Indonesia.`;

        const call = async () => {
             const ai = this.getClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: CAMPAIGN_FRAMEWORK_SCHEMA,
                }
            });
            return JSON.parse(response.text);
        }
        return this.makeApiCall(call);
    }

    async mechanizeCampaignFramework(framework: any): Promise<ToolCall[]> {
        const prompt = `Konversikan kerangka kampanye berikut menjadi serangkaian pemanggilan alat terstruktur.
        - Buat misi utama menggunakan 'update_quest_log'. Atur statusnya menjadi 'active' dan isMainQuest menjadi true. Berikan 'id' yang unik dan relevan.
        - Buat setiap NPC kunci menggunakan 'log_npc_interaction'. Berikan ringkasan berdasarkan deskripsi mereka.
        - JANGAN buat pemanggilan alat untuk misi sampingan.

        Kerangka:
        Judul: ${framework.proposedTitle}
        Misi Utama: ${framework.proposedMainQuest.title} - ${framework.proposedMainQuest.description}
        NPC: ${framework.proposedMainNPCs.map((npc: any) => `${npc.name} - ${npc.description}`).join('; ')}
        `;
        
        const call = async () => {
            const ai = this.getClient();
            const relevantTools = TOOLS.filter(t => t.name === 'update_quest_log' || t.name === 'log_npc_interaction');

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ functionDeclarations: relevantTools }],
                }
            });

            if (response.functionCalls) {
                return response.functionCalls.map(fc => ({
                    functionName: fc.name as ToolCall['functionName'],
                    args: fc.args,
                }));
            }
            console.warn("Mekanisasi kerangka tidak menghasilkan pemanggilan alat.");
            return [];
        }
        return this.makeApiCall(call);
    }
    
    // =================================================================
    // FUNGSI BARU 1: Hanya Menghasilkan Narasi (Tugas Simpel & Robust)
    // =================================================================
    async generateNarration(
        campaign: Campaign, 
        players: Character[], 
        playerAction: string, 
        onStateChange: (state: 'thinking' | 'retrying') => void
    ): Promise<Omit<StructuredApiResponse, 'tool_calls' | 'choices' | 'rollRequest'>> {
        onStateChange('thinking');

        let styleInstruction = '';
        if (campaign.dmNarrationStyle === 'Langsung & Percakapan') {
            styleInstruction = 'Gaya narasimu HARUS langsung, sederhana, dan seperti percakapan. Hindari deskripsi puitis.';
        }

        const systemInstruction = `Anda adalah AI Dungeon Master (DM) untuk TTRPG fantasi. Kepribadian Anda: ${campaign.dmPersonality}. Panjang respons: ${campaign.responseLength}. ${styleInstruction}
        
        ATURAN UTAMA:
        1.  Tugas Anda HANYA merespons aksi pemain dengan narasi.
        2.  JANGAN panggil fungsi/alat apa pun.
        3.  JANGAN berikan pilihan atau minta lemparan dadu.
        4.  Fokus HANYA pada penceritaan (reaction dan narration) sebagai respons terhadap aksi pemain.
        5.  Tandai objek interaktif (peti, tuas, pintu) dalam 'narration' menggunakan format [OBJECT:nama-objek|id-unik].
        6.  Respons Anda HARUS berupa objek JSON yang valid sesuai skema 'RESPONSE_SCHEMA'.`;

        const prompt = this.buildPrompt(campaign, players, playerAction);

        const call = async () => {
            const ai = this.getClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Model flash cepat untuk narasi
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json", // Minta JSON
                    responseSchema: RESPONSE_SCHEMA,     // Paksa skema narasi
                    tools: [], // <-- PENTING: Jangan berikan alat apa pun
                    temperature: 0.7,
                }
            });
            // response.text dijamin JSON karena kita pakai responseSchema
            return parseStructuredApiResponse(response.text); 
        };
        
        try {
            return await this.makeApiCall(call);
        } catch (error) {
             console.error("Gagal total menghasilkan Narration:", error);
            return {
                reaction: "DM tampak bingung sejenak...",
                narration: "Terjadi kesalahan saat DM merangkai kata. (Error: Gagal generateNarration)",
            };
        }
    }

    // =================================================================
    // FUNGSI BARU 2: Hanya Menentukan Mekanik (Tugas Simpel & Robust)
    // =================================================================
    async determineNextStep(
        campaign: Campaign, 
        players: Character[], 
        playerAction: string,
        narrationContext: string, // Narasi yang BARU SAJA terjadi
        onStateChange: (state: 'thinking' | 'retrying') => void
    ): Promise<Omit<StructuredApiResponse, 'reaction' | 'narration'>> {
        onStateChange('thinking');

        const systemInstruction = `Anda adalah AI Logika Permainan TTRPG.
        
        ATURAN UTAMA:
        1.  Tugas Anda HANYA menentukan kelanjutan mekanik permainan.
        2.  Anda HARUS memanggil TEPAT SATU dari ('propose_choices', 'request_roll', 'spawn_monsters') JIKA diperlukan oleh konteks.
        3.  Anda DAPAT memanggil alat tambahan ('add_items_to_inventory', 'update_quest_log') jika dibenarkan oleh konteks.
        4.  JANGAN HASILKAN TEKS NARASI/REAKSI. Fokus hanya pada pemanggilan fungsi.
        5.  WAJIB LANJUTAN EKSPLORASI: Jika status game 'exploration' DAN aksi pemain/narasi tidak memicu 'request_roll' atau 'spawn_monsters', Anda WAJIB memanggil 'propose_choices'.`;

        // Prompt untuk mekanik sedikit berbeda, lebih fokus pada "setelah ini, lalu apa"
        const prompt = `KONTEKS KAMPANYE:
        - Cerita Jangka Panjang: ${campaign.longTermMemory}
        - State Dunia: ${campaign.currentTime}, ${campaign.currentWeather}.
        - Game State: ${campaign.gameState}
        
        KONTEKS LANGSUNG:
        - Aksi Pemain: "${playerAction}"
        - Narasi DM (Hasil Aksi): "${narrationContext}"
        
        Tentukan langkah mekanik selanjutnya berdasarkan Konteks Langsung di atas. Panggil fungsi yang sesuai.`;


        const call = async () => {
            const ai = this.getClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Model flash cukup untuk logika tool
                contents: prompt,
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: TOOLS }], // <-- PENTING: Hanya berikan alat
                    temperature: 0.5,
                }
            });

            // Urai hasil pemanggilan fungsi
            let choices: string[] | undefined = undefined;
            let rollRequest: Omit<RollRequest, 'characterId' | 'originalActionText'> | undefined = undefined;
            const tool_calls: ToolCall[] = [];
            let didSpawnMonsters = false;

            if (response.functionCalls) {
                for (const fc of response.functionCalls) {
                    switch (fc.name) {
                        case 'propose_choices':
                            choices = fc.args.choices as string[];
                            break;
                        case 'request_roll':
                            rollRequest = fc.args as any;
                            break;
                        case 'spawn_monsters':
                            tool_calls.push({ functionName: fc.name, args: fc.args });
                            didSpawnMonsters = true;
                            break;
                        case 'add_items_to_inventory':
                        case 'update_quest_log':
                        case 'log_npc_interaction':
                            tool_calls.push({
                                functionName: fc.name as ToolCall['functionName'],
                                args: fc.args
                            });
                            break;
                    }
                }
            }
            
            // Kembalikan objek mekanik
            return { choices, rollRequest, tool_calls, didSpawnMonsters }; // Tambahkan didSpawnMonsters untuk logika fallback
        };
        
        try {
            return await this.makeApiCall(call);
        } catch (error) {
             console.error("Gagal total menghasilkan Mechanics:", error);
            // Kembalikan state aman (kosong) jika terjadi error
            return {
                choices: undefined,
                rollRequest: undefined,
                tool_calls: [],
            };
        }
    }


    private buildPrompt(campaign: Campaign, players: Character[], playerAction: string): string {
        const worldState = `Saat ini adalah ${campaign.currentTime} hari, dengan cuaca ${campaign.currentWeather}.`;
        const questContext = `Misi Saat Ini: ${JSON.stringify(campaign.quests.map(q => ({id: q.id, title: q.title, status: q.status})))}`;
        const npcContext = `NPC Saat Ini: ${JSON.stringify(campaign.npcs.map(n => ({id: n.id, name: n.name, disposition: n.disposition})))}`;
        
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
                    return `SYSTEM: ${roller ? roller.name : 'Player'} rolled ${event.roll.total} for ${event.reason} (${event.roll.success ? 'Success' : 'Failure'}).`;
                case 'system':
                    return `SYSTEM: ${event.text}`;
                default:
                    return '';
            }
        }).filter(Boolean).join('\n');
        
        return `KONTEKS KAMPANYE:
        - Cerita Jangka Panjang: ${campaign.longTermMemory}
        - ${worldState}
        - ${questContext}
        - ${npcContext}
        
        PERISTIWA TERBARU:
        ${recentEvents}
        
        AKSI PEMAIN SAAT INI: "${playerAction}"`;
    }

    // ... (Salin fungsi: generateOpeningScene, generateWorldEvent, generateMapImage, generateMapMarkers, testApiKey) ...
    async generateOpeningScene(campaign: Campaign): Promise<string> {
        const prompt = `Anda adalah Dungeon Master. Mulai kampanye baru dengan detail berikut dan tuliskan adegan pembuka yang menarik dalam 1-2 paragraf.

        Judul: ${campaign.title}
        Deskripsi: ${campaign.description}
        Kepribadian DM: ${campaign.dmPersonality}

        Tulis adegan pembuka yang imersif yang menempatkan para pemain langsung ke dalam aksi atau misteri. Jangan ajukan pertanyaan, cukup atur panggungnya.`;

        const call = async () => {
            const ai = this.getClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            return response.text.trim();
        };
        return this.makeApiCall(call);
    }
    
    async generateWorldEvent(campaign: Campaign): Promise<{ event: string, time: WorldTime, weather: WorldWeather }> {
        const { currentTime, currentWeather } = campaign;
        const prompt = `Ini adalah TTRPG fantasi. Waktu saat ini adalah ${currentTime} dan cuacanya ${currentWeather}.
        
        Tuliskan peristiwa dunia singkat (1 kalimat) yang terjadi di latar belakang. Bisa berupa perubahan cuaca, suara, atau pengamatan kecil.
        
        Kemudian, tentukan waktu dan cuaca BERIKUTNYA.
        
        Respons dalam format JSON: { "event": "...", "nextTime": "...", "nextWeather": "..." }
        Contoh: { "event": "Angin dingin bertiup dari utara, membawa aroma hujan.", "nextTime": "Sore", "nextWeather": "Berawan" }
        `;

        const call = async () => {
            const ai = this.getClient();
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            try {
                const parsed = JSON.parse(response.text);
                return {
                    event: parsed.event,
                    time: parsed.nextTime,
                    weather: parsed.nextWeather
                };
            } catch {
                return { event: "Dunia bergeser secara halus.", time: "Siang", weather: "Cerah" };
            }
        };
        return this.makeApiCall(call);
    }

    async generateMapImage(description: string): Promise<string> {
        const prompt = `Buat peta fantasi dunia 2D top-down, gaya perkamen antik, untuk kampanye TTRPG berdasarkan deskripsi ini: "${description}". Fokus pada geografi yang jelas seperti hutan, gunung, sungai, dan kota.`;
        const call = async () => {
            const ai = this.getClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: prompt }] },
                config: { responseModalities: [Modality.IMAGE] },
            });
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data; // base64 string
                }
            }
            throw new Error("Tidak ada gambar yang dihasilkan untuk peta.");
        };
        return this.makeApiCall(call);
    }

    async generateMapMarkers(campaignFramework: any): Promise<{ markers: MapMarker[], startLocationId: string }> {
        const locations = [
            ...campaignFramework.proposedMainNPCs.map((npc: any) => npc.name),
            ...campaignFramework.potentialSideQuests.map((q: any) => q.title),
            campaignFramework.proposedMainQuest.title
        ];

        const prompt = `Berdasarkan kerangka kampanye ini, tempatkan lokasi-lokasi berikut pada peta 2D imajiner.
        Berikan koordinat X dan Y untuk setiap lokasi sebagai persentase (0-100).
        
        Kerangka:
        - Judul: ${campaignFramework.proposedTitle}
        - Deskripsi: ${campaignFramework.description}
        - Lokasi untuk Ditempatkan: ${locations.join(', ')}
        
        Tentukan juga lokasi awal yang paling masuk akal untuk para pemain.
        
        Respons HARUS berupa objek JSON dengan dua kunci: 'markers' (sebuah array objek penanda) dan 'startLocationId' (ID penanda awal).`;

        const call = async () => {
            const ai = this.getClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            markers: MAP_MARKER_SCHEMA,
                            startLocationId: { type: Type.STRING }
                        },
                        required: ["markers", "startLocationId"]
                    }
                }
            });
            return JSON.parse(response.text);
        }
        return this.makeApiCall(call);
    }

    async testApiKey(key: string): Promise<{ success: boolean; message: string }> {
        if (!key || key.trim() === '') {
            return { success: false, message: 'Kunci API tidak boleh kosong.' };
        }
        try {
            const testClient = new GoogleGenAI({ apiKey: key });
            const response = await testClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: 'Test'
            });

            if (response.text !== undefined && response.text !== null) {
                return { success: true, message: 'Kunci API valid dan berfungsi.' };
            } else {
                return { success: false, message: 'Kunci API tampaknya valid, tetapi respons tidak terduga.' };
            }
        } catch (error: any) {
            console.error("Test Kunci API gagal:", error);
            if (error.message && error.message.includes('API key not valid')) {
                return { success: false, message: 'Kunci API tidak valid. Periksa kembali kunci Anda.' };
            }
            if (error.message && error.message.includes('fetch')) {
                 return { success: false, message: 'Gagal menghubungi server Google. Periksa koneksi jaringan Anda.' };
            }
            return { success: false, message: 'Kunci API tidak valid atau terjadi kesalahan jaringan.' };
        }
    }

    // =================================================================
    // FUNGSI FALLBACK CERDAS (dari solusi kita sebelumnya, ini tetap KRUSIAL)
    // =================================================================
    async generateExplorationChoices(
        campaign: Campaign,
        players: Character[],
        lastNarration: string,
        onStateChange: (state: 'thinking' | 'retrying') => void
    ): Promise<string[] | undefined> {
        onStateChange('thinking');
        const systemInstruction = `Anda adalah AI Logika Permainan TTRPG. Tugas Anda HANYA memanggil fungsi 'propose_choices'. Berikan 3-4 pilihan aksi yang relevan berdasarkan narasi terakhir.`;

        const simplePrompt = `KONTEKS KAMPANYE:
        - Cerita Jangka Panjang: ${campaign.longTermMemory}
        - State Dunia: ${campaign.currentTime}, ${campaign.currentWeather}.
        - Pemain saat ini: ${players.find(p => p.id === campaign.currentPlayerId)?.name || 'Pemain'}

        NARASI TERAKHIR DARI DM: "${lastNarration}"

        Tentukan pilihan aksi selanjutnya untuk pemain dengan memanggil fungsi 'propose_choices'.`;

        const call = async () => {
            const ai = this.getClient();
            const choiceTool: FunctionDeclaration[] = [PROPOSE_CHOICES_TOOL];

            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash', 
                contents: simplePrompt,
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: choiceTool }],
                    temperature: 0.5,
                }
            });

            if (response.functionCalls) {
                const choiceCall = response.functionCalls.find(fc => fc.name === 'propose_choices');
                if (choiceCall && choiceCall.args.choices) {
                    return choiceCall.args.choices as string[];
                }
            }
            console.warn("Panggilan AI kedua untuk choices gagal menghasilkan function call.");
            return undefined;
        };

        try {
            return await this.makeApiCall(call);
        } catch (error) {
            console.error("Gagal total menghasilkan exploration choices:", error);
            return undefined;
        } finally {
             //  Perbaikan: Jangan set 'idle' di sini, biarkan pemanggil yang atur
             //  onStateChange('idle'); 
        }
    }

} // Akhir dari class GeminiService

export const geminiService = new GeminiService();