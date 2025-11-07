// REFAKTOR G-2: File BARU.
// Berisi semua logika AI yang TIDAK terkait langsung dengan game loop (turn-by-turn).
// Seperti pembuatan campaign, peta, adegan pembuka, dll.

import { Type, FunctionDeclaration, Modality } from "@google/genai";
import { Campaign, ToolCall, MapMarker, WorldTime, WorldWeather } from '../../types';
import { geminiService } from "../geminiService"; // Import klien inti
import { formatDndTime } from "../../utils"; // Import helper waktu

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
        const prompt = `Anda adalah Dungeon Master. Mulai kampanye baru dengan detail berikut dan tuliskan adegan pembuka yang menarik (1-2 paragraf).
        
        Judul: ${campaign.title}
        Deskripsi: ${campaign.description}
        Kepribadian DM: ${campaign.dmPersonality}

        ATURAN WAJIB (Poin 11):
        1.  **Transisi:** Mulai adegan *sebelum* pemain tiba di lokasi utama (misal: "Kalian telah berjalan selama tiga hari...", "Kereta kuda berderit berhenti di gerbang..."). JANGAN mulai di dalam ruangan/kota secara tiba-tiba.
        2.  **Hook:** Sertakan SATU alasan yang jelas mengapa para pemain ada di sana (misal: "Kalian semua menjawab panggilan pekerjaan dari...", "Rumor tentang artefak itu terlalu menggiurkan...", "Surat mendesak dari kerabatmu...").
        3.  Tulis adegan imersif yang mengatur panggung. Jangan ajukan pertanyaan.`;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            return response.text.trim();
        };
        return geminiService.makeApiCall(call);
    }

    // (Poin 5) Modifikasi untuk mengembalikan detik, bukan string
    async generateWorldEvent(campaign: Campaign): Promise<{ event: string, secondsToAdd: number, nextWeather: WorldWeather }> {
        const { currentTime, currentWeather } = campaign;
        const formattedTime = formatDndTime(currentTime); // Gunakan helper

        const prompt = `Ini adalah TTRPG fantasi. Waktu saat ini adalah ${formattedTime} dan cuacanya ${currentWeather}.
        
        Tuliskan peristiwa dunia singkat (1 kalimat) yang terjadi di latar belakang.
        
        Kemudian, tentukan jumlah WAKTU YANG BERLALU (misal 1 jam, 30 menit) dan cuaca BERIKUTNYA.
        
        Respons dalam format JSON: { "event": "...", "timePassedInMinutes": 60, "nextWeather": "..." }
        Contoh: { "event": "Angin dingin bertiup dari utara, membawa aroma hujan.", "timePassedInMinutes": 30, "nextWeather": "Berawan" }
        `;

        const call = async (client: any) => {
            const response = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            try {
                const parsed = JSON.parse(response.text);
                const minutesToAdd = parsed.timePassedInMinutes || 60; // Fallback 1 jam
                return {
                    event: parsed.event,
                    secondsToAdd: minutesToAdd * 60,
                    nextWeather: parsed.nextWeather
                };
            } catch {
                return { event: "Dunia bergeser secara halus.", secondsToAdd: 3600, weather: "Cerah" };
            }
        };
        return geminiService.makeApiCall(call);
    }

    async generateMapImage(description: string): Promise<string> {
        // REVISI FASE 1: Menggunakan logika P2 (ai-native...)
        // untuk membuat peta eksplorasi HD berdasarkan premis.
        const prompt = `
        Generate an atmospheric, top-down, HD fantasy TTRPG exploration map.
        Style: digital painting, fantasy art, detailed, high quality, vibrant colors, style of D&D 5e sourcebooks, gridless.
        Base Location: ${description}.
        The image should be an environment, with no characters or fog of war.
        `;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash-image', // (P0 FIX) Ganti ke model yang sesuai
                contents: { parts: [{ text: prompt }] },
                config: { responseModalities: [Modality.IMAGE] },
            });
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    // (P0 FIX) Kembalikan URL data base64, BUKAN URL picsum
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
            throw new Error("Tidak ada gambar yang dihasilkan untuk peta.");
        };
        return geminiService.makeApiCall(call);
    }

    // BARU: FASE 1 - Ditransplantasi dari P2 (ai-native...)
    async generateBattleMapVisual(base64Layout: string, theme: string): Promise<string> {
        const imagePart = {
            inlineData: {
                mimeType: 'image/png',
                data: base64Layout.split(',')[1], // Ambil data B64 mentah
            },
        };

        // Prompt dari P2, disesuaikan sedikit
        const textPart = {
            text: `Transform this simple pixel grid layout into a detailed, top-down fantasy battle map.
            - The layout is a blueprint: Black=Impassable Obstacle/Wall, Gray=Difficult Terrain, White=Clear Ground.
            - The overall theme is: "${theme}".
            - Style: digital painting, fantasy art, detailed, high quality, top-down perspective, grid-aligned.
            - Render the terrain faithfully based on the layout blueprint.`
        };

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, textPart] },
                config: { responseModalities: [Modality.IMAGE] },
            });
            if (response.candidates && response.candidates[0].content.parts[0].inlineData) {
                const base64ImageBytes: string = response.candidates[0].content.parts[0].inlineData.data;
                return `data:image/png;base64,${base64ImageBytes}`;
            } else {
                throw new Error("Tidak dapat menghasilkan peta tempur dari layout.");
            }
        };
        return geminiService.makeApiCall(call);
    }

    // BARU: FASE 1 - Ditransplantasi dari P2 (rpg-asset...)
    async stylizePixelLayout(base64Image: string, prompt: string, category: 'Map' | 'Sprite' | 'Item'): Promise<string> {

        const base64Data = base64Image.split(',')[1] || base64Image;
        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: 'image/png',
            },
        };

        let categoryGuidance = '';
        switch (category) {
            case 'Map':
                categoryGuidance = 'This is a top-down 2D RPG map layout. Walls should be impassable, floors should be walkable. Maintain the original structure.';
                break;
            case 'Sprite':
                categoryGuidance = 'This is a 2D character sprite pixel layout. The final image should be a full-color character portrait that fits this shape and composition for an RPG game.';
                break;
            case 'Item':
                categoryGuidance = 'This is a 2D RPG item icon. The final image should be a detailed item that fits this shape.';
                break;
        }

        const fullPrompt = `A high-fidelity, HD, 2D, digital painting of an RPG game asset.
        The desired style is: "${prompt}".
        Use the provided pixel art image as a *strict* structural, compositional, and color-block guide.
        ${categoryGuidance}`;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        imagePart,
                        { text: fullPrompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes: string = part.inlineData.data;
                    return `data:image/png;base64,${base64ImageBytes}`;
                }
            }
            throw new Error("Tidak ada gambar yang dihasilkan oleh API (stylizePixelLayout).");
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