// REFAKTOR G-2: File BARU.
// Berisi semua logika AI yang TIDAK terkait langsung dengan game loop (turn-by-turn).
// Seperti pembuatan campaign, peta, adegan pembuka, dll.

import { Type, FunctionDeclaration, Modality } from "@google/genai";
import { Campaign, ToolCall, MapMarker, WorldTime, WorldWeather } from '../../types';
import { geminiService } from "../geminiService"; // Import klien inti

// SKEMA LAMA (Dipindah dari geminiService.ts)
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

// Hanya tools yang relevan untuk setup
const SETUP_TOOLS: FunctionDeclaration[] = [
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
                // npcId tidak diperlukan saat setup
                npcName: { type: Type.STRING, description: "Nama NPC." },
                summary: { type: Type.STRING, description: "Ringkasan singkat berupa FAKTA dari interaksi saat ini. HARUS berupa catatan orang ketiga yang ringkas." },
                description: { type: Type.STRING, description: "Deskripsi fisik atau kepribadian NPC. Hanya berikan saat pertama kali bertemu." },
                location: { type: Type.STRING, description: "Lokasi saat ini atau biasa dari NPC." },
                disposition: { type: Type.STRING, enum: ['Friendly', 'Neutral', 'Hostile', 'Unknown'], description: "Sikap NPC terhadap pemain." }
            },
            required: ['npcName', 'summary']
        }
    }
];

// FUNGSI LAMA (Dipindah dari geminiService.ts)
class GenerationService {

    async generateCampaignFramework(pillars: { premise: string; keyElements: string; endGoal: string }): Promise<any> {
        const prompt = `Berdasarkan pilar-pilar kampanye D&D berikut, hasilkan kerangka kampanye yang kreatif dan menarik.
    
        Premis: ${pillars.premise}
        Elemen Kunci: ${pillars.keyElements}
        Tujuan Akhir: ${pillars.endGoal || 'Tidak ditentukan'}

        Kembangkan ini menjadi judul yang diusulkan, misi utama, dua NPC kunci, dan satu misi sampingan potensial. Respons HARUS dalam bahasa Indonesia.`;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: CAMPAIGN_FRAMEWORK_SCHEMA,
                }
            });
            return JSON.parse(response.text);
        }
        return geminiService.makeApiCall(call);
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
        
        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ functionDeclarations: SETUP_TOOLS }],
                }
            });

            if (response.functionCalls) {
                return response.functionCalls.map((fc: any) => ({
                    functionName: fc.name as ToolCall['functionName'],
                    args: fc.args,
                }));
            }
            console.warn("Mekanisasi kerangka tidak menghasilkan pemanggilan alat.");
            return [];
        }
        return geminiService.makeApiCall(call);
    }

    async generateOpeningScene(campaign: Campaign): Promise<string> {
        const prompt = `Anda adalah Dungeon Master. Mulai kampanye baru dengan detail berikut dan tuliskan adegan pembuka yang menarik dalam 1-2 paragraf.

        Judul: ${campaign.title}
        Deskripsi: ${campaign.description}
        Kepribadian DM: ${campaign.dmPersonality}

        Tulis adegan pembuka yang imersif yang menempatkan para pemain langsung ke dalam aksi atau misteri. Jangan ajukan pertanyaan, cukup atur panggungnya.`;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            return response.text.trim();
        };
        return geminiService.makeApiCall(call);
    }
    
    async generateWorldEvent(campaign: Campaign): Promise<{ event: string, time: WorldTime, weather: WorldWeather }> {
        const { currentTime, currentWeather } = campaign;
        const prompt = `Ini adalah TTRPG fantasi. Waktu saat ini adalah ${currentTime} dan cuacanya ${currentWeather}.
        
        Tuliskan peristiwa dunia singkat (1 kalimat) yang terjadi di latar belakang. Bisa berupa perubahan cuaca, suara, atau pengamatan kecil.
        
        Kemudian, tentukan waktu dan cuaca BERIKUTNYA.
        
        Respons dalam format JSON: { "event": "...", "nextTime": "...", "nextWeather": "..." }
        Contoh: { "event": "Angin dingin bertiup dari utara, membawa aroma hujan.", "nextTime": "Sore", "nextWeather": "Berawan" }
        `;

        const call = async (client: any) => {
            const response = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
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
        return geminiService.makeApiCall(call);
    }

    async generateMapImage(description: string): Promise<string> {
        const prompt = `Buat peta fantasi dunia 2D top-down, gaya perkamen antik, untuk kampanye TTRPG berdasarkan deskripsi ini: "${description}". Fokus pada geografi yang jelas seperti hutan, gunung, sungai, dan kota.`;
        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: 'gemini-pro-vision', // TODO: Pastikan model ini diizinkan untuk image gen
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
        return geminiService.makeApiCall(call);
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

        const call = async (client: any) => {
            const response = await client.models.generateContent({
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
        return geminiService.makeApiCall(call);
    }
}

export const generationService = new GenerationService();