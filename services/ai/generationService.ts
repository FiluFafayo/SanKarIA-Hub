// REFAKTOR G-2: File BARU.
// Berisi semua logika AI yang TIDAK terkait langsung dengan game loop (turn-by-turn).
// Seperti pembuatan campaign, peta, adegan pembuka, dll.

import { Type, FunctionDeclaration, Modality } from "@google/genai";
import { Campaign, ToolCall, MapMarker, WorldTime, WorldWeather } from '../../types';
import { geminiService } from "../geminiService"; // Import klien inti
import { renderNpcMiniSprite } from "../pixelRenderer";
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
    // Cache ringan untuk potret NPC agar tidak memanggil API berulang
    private portraitCache = new Map<string, string>();

    constructor() {
        this.loadCacheFromStorage();
    }

    private loadCacheFromStorage() {
        try {
            if (typeof window === 'undefined') return;
            const raw = window.localStorage.getItem('npcPortraitCache');
            if (!raw) return;
            const entries: Array<{ k: string; v: string }> = JSON.parse(raw);
            // Batasi maksimum 12 entri untuk menghindari membengkak
            for (const { k, v } of entries.slice(-12)) {
                this.portraitCache.set(k, v);
            }
        } catch (e) {
            console.warn('Gagal memuat cache potret NPC dari storage:', e);
        }
    }

    private persistCacheToStorage() {
        try {
            if (typeof window === 'undefined') return;
            // Ambil maksimum 12 entri terbaru
            const entries = Array.from(this.portraitCache.entries());
            const trimmed = entries.slice(-12).map(([k, v]) => ({ k, v }));
            window.localStorage.setItem('npcPortraitCache', JSON.stringify(trimmed));
        } catch (e) {
            console.warn('Gagal menyimpan cache potret NPC ke storage:', e);
        }
    }

    async generateCampaignFramework(pillars: { premise: string; keyElements: string; endGoal: string }): Promise<any> {
        const prompt = `Berdasarkan pilar-pilar kampanye D&D berikut, hasilkan kerangka kampanye yang kreatif dan menarik.
    
        Premis: ${pillars.premise}
        Elemen Kunci: ${pillars.keyElements}
        Tujuan Akhir: ${pillars.endGoal || 'Tidak ditentukan'}

        Kembangkan ini menjadi judul yang diusulkan, misi utama, dua NPC kunci, dan satu misi sampingan potensial. Respons HARUS dalam bahasa Indonesia.`;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: geminiService.getTextModelName(),
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
                model: geminiService.getTextModelName(),
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
        const prompt = `Anda adalah Dungeon Master.
        Tulis ADEGAN PEMBUKA SINGKAT (1 paragraf, 3–5 kalimat) bergaya aktif, konkret, tanpa fluff.
        Fokus langsung pada LOKASI dan SITUASI saat ini.
        
        Konteks kampanye:
        Judul: ${campaign.title}
        Deskripsi: ${campaign.description}
        Kepribadian DM: ${campaign.dmPersonality}

        Ketentuan gaya:
        - Gunakan kalimat aktif, kata-kata sederhana, dan detail konkret (suasana, benda, orang relevan).
        - Sertakan SATU hook halus (alasan berada di sana atau peluang tindakan) tanpa menggurui.
        - Hindari transisi perjalanan panjang, sejarah detil, atau paparan eksposisi; langsung ke lokasi/situasi.
        - Jangan ajukan pertanyaan ke pemain, jangan memberi instruksi eksplisit, jangan menutup dengan pilihan.
        - Jika ada dialog alami, gunakan format tag: [DIALOGUE:Nama NPC|Kalimat dialog] (opsional, hanya bila wajar).
        - Batas keras: tetap 1 paragraf dan maksimal 5 kalimat.`;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: geminiService.getTextModelName(),
                contents: prompt,
            });
            return response.text.trim();
        };
        return geminiService.makeApiCall(call);
    }

    // BARU: FASE 2 - The Oracle (AI Auto-Complete untuk Wizard)
    async suggestCampaignDetails(theme: string): Promise<{ title: string; description: string; dmPersonality: string }> {
        const prompt = `Anda adalah Oracle, penasihat Dungeon Master.
        Berikan saran SATU ide kampanye D&D 5e yang unik dan menarik berdasarkan tema: "${theme}".
        
        Berikan output JSON (tanpa markdown) dengan format:
        {
            "title": "Judul Kampanye (Indonesia, Keren, Singkat)",
            "description": "Sinopsis singkat (2-3 kalimat) yang memancing rasa ingin tahu.",
            "dmPersonality": "Saran kepribadian DM yang cocok (misal: 'Misterius & Kejam' atau 'Heroik & Bersemangat')"
        }`;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: geminiService.getTextModelName(),
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            return JSON.parse(response.text);
        };
        // Fallback jika gagal/offline
        try {
            return await geminiService.makeApiCall(call);
        } catch (e) {
            console.warn("Oracle diam membisu...", e);
            return {
                title: "Lembah Harapan Pupus",
                description: "Sebuah lembah yang tertutup kabut abadi, di mana para petualang masuk namun tak pernah keluar.",
                dmPersonality: "Misterius & Melankolis"
            };
        }
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
            const response = await client.models.generateContent({ model: geminiService.getTextModelName(), contents: prompt });
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
                model: geminiService.getImageModelName(),
                contents: { parts: [{ text: prompt }] },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
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

    // BARU: Generator eksplorasi berbasis layout (img2img)
    async generateExplorationMapVisual(base64Layout: string, theme: string): Promise<string> {
        const imagePart = {
            inlineData: {
                mimeType: 'image/png',
                data: base64Layout.split(',')[1] || base64Layout,
            },
        };

        const textPart = {
            text: `Transform this pixel exploration layout into a detailed, HD fantasy world map.
            - Style: digital painting, fantasy art, high quality, gridless.
            - Theme: "${theme}".
            - Ignore fog of war.
            - Preserve the original structure, terrain distribution, and coastline faithfully.`,
        };

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: geminiService.getImageModelName(),
                contents: { parts: [imagePart, textPart] },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
            });
            if (response.candidates && response.candidates[0].content.parts[0].inlineData) {
                const base64ImageBytes: string = response.candidates[0].content.parts[0].inlineData.data;
                return `data:image/png;base64,${base64ImageBytes}`;
            }
            throw new Error('Tidak dapat menghasilkan peta eksplorasi dari layout.');
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
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [imagePart, textPart] },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
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
                model: geminiService.getImageModelName(),
                contents: {
                    parts: [
                        imagePart,
                        { text: fullPrompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
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

    // FASE 3: Smart Visual Interpreter
    // Menerjemahkan data statistik game (Class, Skill, Equip) menjadi deskripsi visual konkret
    async generateVisualDescription(data: { 
        race: string; 
        gender: string; 
        class: string; 
        background: string; 
        skills: string[]; 
        abilityScores: Record<string, number>; 
        primaryHeld: string[]; 
        secondaryBack: string[]; 
    }): Promise<string[]> {
        const genderKey = (data.gender || '').toLowerCase();
        const genderEn = genderKey.includes('wanita') ? 'female' : 'male';
        const topEntry = Object.entries(data.abilityScores || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
        const topAttr = topEntry ? topEntry[0].toLowerCase() : '';
        const topDesc = (() => {
            switch (topAttr) {
                case 'strength': return 'power conveyed through a solid, muscular stance';
                case 'dexterity': return 'agility conveyed through a nimble, low-profile posture';
                case 'constitution': return 'endurance conveyed through a sturdy frame and resolute presence';
                case 'intelligence': return 'precision conveyed through a calculating gaze and deliberate motions';
                case 'wisdom': return 'awareness conveyed through calm focus and watchful eyes';
                case 'charisma': return 'presence conveyed through a confident posture and captivating expression';
                default: return 'readiness conveyed through a balanced, adventure-ready stance';
            }
        })();

        const raceKey = (data.race || '').toLowerCase();
        const classKey = (data.class || '').toLowerCase();
        const bgKey = (data.background || '').toLowerCase();

        const raceDesc = (() => {
            if (raceKey.includes('halfling')) return 'small build, rounded cheeks, subtly pointed ears, tough bare soles';
            if (raceKey.includes('dwarf')) return 'stocky frame, thick brows, braided beard with simple metal beads';
            if (raceKey.includes('elf')) return 'slender build, pointed ears, graceful bearing';
            if (raceKey.includes('tiefling')) return 'distinct horns and tail, warm skin tone, striking silhouette';
            return 'versatile features and average build';
        })();

        const ageTag = (() => {
            if (raceKey.includes('halfling')) return 'adult halfling';
            if (raceKey.includes('dwarf')) return 'adult dwarf';
            if (raceKey.includes('elf')) return 'adult elf';
            if (raceKey.includes('tiefling')) return 'adult tiefling';
            return 'young adult human';
        })();

        const demographic = `${genderEn} ${ageTag}`;

        const classDesc = (() => {
            if (classKey.includes('rogue')) return 'agile stance, hooded cowl, patched leather vest';
            if (classKey.includes('fighter')) return 'armored look, solid stance, practical straps';
            if (classKey.includes('cleric')) return 'sturdy mantle and simple robe, holy symbol subtly visible';
            if (classKey.includes('wizard')) return 'robe with focus-ready sleeves, attentive posture';
            return 'adventurer attire suited to travel';
        })();

        const bgDesc = (() => {
            if (bgKey.includes('folk')) return 'handwoven village sash and a small emblem';
            if (bgKey.includes('outlander')) return 'weathered cloak with rough stitches and a small bone charm';
            if (bgKey.includes('acolyte')) return 'priestly sash and clean straps, holy accents';
            if (bgKey.includes('soldier')) return 'rank insignia and tidy strap work';
            if (bgKey.includes('sage')) return 'ink flecks and a compact scroll strap';
            return 'subtle personal accents reflecting their origin';
        })();

        const envDesc = (() => {
            const c = classKey; const b = bgKey;
            if (c.includes('rogue') && b.includes('criminal')) return 'gritty slum alley with flickering lanterns';
            if (c.includes('rogue') && b.includes('outlander')) return 'edge of a dense forest camp with rough tents';
            if (c.includes('rogue') && b.includes('soldier')) return 'shadowed corner near a barracks yard';
            if (c.includes('rogue') && b.includes('sage')) return 'dusty archive hallway with dim sconces';
            if (c.includes('fighter') && b.includes('soldier')) return 'training yard with battered dummies and banners';
            if (c.includes('fighter') && b.includes('outlander')) return 'rocky canyon trail under a harsh sky';
            if (c.includes('fighter') && b.includes('sage')) return 'armory hallway lined with racks and scrolls';
            if (c.includes('cleric') && b.includes('acolyte')) return 'candlelit chapel with stained-glass shimmer';
            if (c.includes('cleric') && b.includes('soldier')) return 'field tent shrine amid distant marching lines';
            if (c.includes('cleric') && b.includes('outlander')) return 'stone circle clearing lit by moonlight';
            if (c.includes('wizard') && b.includes('sage')) return 'arcane library with tall shelves and floating motes';
            if (c.includes('wizard') && b.includes('soldier')) return 'arcane tower balcony overlooking a battlefield';
            if (c.includes('wizard') && b.includes('outlander')) return 'remote observatory under starry sky';
            if (b.includes('folk')) return 'humble village lane with woven banners';
            return 'moody fantasy backdrop suited to their role';
        })();

        const normalizeNames = (arr: string[]) => (arr || []).map(s => (s || '').toLowerCase());
        const heldNames = normalizeNames(data.primaryHeld || []);
        const backNames = normalizeNames(data.secondaryBack || []);

        const heldPhrase = (() => {
            const s = heldNames[0] || '';
            if (s.includes('rapier')) return 'slim rapier in hand';
            if (s.includes('shortsword')) return 'shortsword in hand';
            if (s.includes('longsword')) return 'longsword in hand';
            if (s.includes('dagger')) return 'small dagger in hand';
            if (s.includes('mace')) return 'mace in hand';
            if (s.includes('warhammer')) return 'warhammer in hand';
            if (s.includes('quarterstaff')) return 'quarterstaff in hand';
            if (s.includes('shield')) return 'round shield at forearm';
            if (s) return `${s} in hand`;
            return 'minimal primary kit in hand';
        })();

        const backPhrase = (() => {
            const hasShortbow = backNames.some(n => n.includes('shortbow'));
            const hasLongbow = backNames.some(n => n.includes('longbow'));
            const hasArrows = backNames.some(n => n.includes('arrows') || n.includes('bolts') || n.includes('quiver'));
            const parts: string[] = [];
            if (hasShortbow) parts.push('slim shortbow silhouette on back');
            if (hasLongbow) parts.push('slim longbow silhouette on back');
            if (hasArrows) parts.push('compact quiver with few tips visible');
            return parts.join(', ');
        })();

        const skillVisual = (skill: string) => {
            const k = (skill || '').toLowerCase();
            if (k.includes('stealth')) return 'low posture and rim-light on dark cloth';
            if (k.includes('investigation')) return 'focused gaze scanning ground-scratch markers';
            if (k.includes('deception')) return 'half-smile and a hidden hand under the cloak';
            if (k.includes('perception')) return 'watchful eyes and subtle head tilt toward distant sound';
            if (k.includes('survival')) return 'weathered mantle and mud flecks on boots';
            if (k.includes('athletics')) return 'taut muscles and planted feet';
            if (k.includes('intimidation')) return 'sharp glare and clenched fist';
            if (k.includes('acrobatics')) return 'balanced, light-footed poise';
            if (k.includes('persuasion')) return 'open hand gesture and confident smile';
            if (k.includes('insight')) return 'calm, measured gaze';
            if (k.includes('religion')) return 'holy symbol subtly framed';
            if (k.includes('arcana')) return 'arcane focus subtly glowing';
            if (k.includes('medicine')) return 'small bandage satchel visible';
            if (k.includes('sleight')) return 'quick fingers poised near belt pouch';
            return '';
        };

        const skillPhrases = (data.skills || []).slice(0, 2).map(skillVisual).filter(Boolean);
        const skillLine = skillPhrases.join('; ');

        const baseLine = `${demographic} ${data.class} from a ${data.background} background. ${raceDesc}. ${classDesc}. ${bgDesc}. ${topDesc}.`;
        const kitLine = `Minimal kit: ${heldPhrase}${backPhrase ? '; ' + backPhrase : ''}.`;
        const bgLine = `Background environment: ${envDesc}.`;

        const style1 = '16-bit SNES full-body pixel art, crisp pixels, high contrast, no anti-aliasing; 24–32 color palette tuned to GUI; low-resolution pixel blocks, visible pixel grid';
        const style2 = 'Game Boy Color-style full-body pixel art, 12–16 colors, subtle dithering, crisp 3/4 view; low-resolution pixel blocks, visible pixel grid';
        const style3 = 'Neo-Geo Pocket SD full-body pixel art, chibi proportions, bold pixels, blocky shading, 20–24 colors; low-resolution pixel blocks, visible pixel grid';

        const opt1 = `[SMART PROMPT] ${baseLine} ${skillLine ? `Visualize traits via ${skillLine}. ` : ''}${kitLine} ${bgLine} ${style1}. Full-body standing pose, head-to-toe visible (feet included), no crop, centered.`;
        const opt2 = `[SMART PROMPT] ${baseLine} ${skillLine ? `Visualize traits via ${skillLine}. ` : ''}${kitLine} ${bgLine} ${style2}. Full-body standing pose, head-to-toe visible (feet included), no crop, centered.`;
        const opt3 = `[SMART PROMPT] ${baseLine} ${skillLine ? `Visualize traits via ${skillLine}. ` : ''}${kitLine} ${bgLine} ${style3}. Full-body standing pose, head-to-toe visible (feet included), no crop, centered.`;
        
        return [opt1, opt2, opt3];
    }

    // FASE GRATIS: Pollinations.ai Bridge
    async generateCharacterPortrait(visualDescription: string, race: string, gender: string): Promise<string> {
        console.log("[FREE-GEN] Mengalihkan request gambar ke Pollinations (Hemat Kuota)...");

        // 1. Susun Prompt Spesifik untuk External Generator
        const genderKey = (gender || '').toLowerCase();
        const genderEn = genderKey.includes('wanita') ? 'female' : 'male';
        const finalPrompt = `pixel art style, 16-bit retro rpg character portrait, ${genderEn} ${race}, ${visualDescription}, heavy pixelation, visible pixel grid, nearest-neighbor aesthetic, crisp 1px outlines, no anti-aliasing, high contrast, full body standing pose, head-to-toe visible (feet included), centered, no crop`;
        console.log("[FREE-GEN] T2I Prompt:", finalPrompt);
        
        // 2. Parameter URL (Portrait Ratio ~3:4)
        const seed = Math.floor(Math.random() * 1000000);
        const width = 480;
        const height = 720;
        const encodedPrompt = encodeURIComponent(finalPrompt);
        
        // 3. Panggil API Publik (Tanpa Key)
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

        try {
            // 4. Fetch dan Konversi ke Base64 agar kompatibel dengan UI kita
            const response = await fetch(url);
            if (!response.ok) throw new Error("Gagal menghubungi layanan gambar eksternal");
            
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("[FREE-GEN] Gagal generate gambar:", e);
            // Fallback ke avatar statis jika internet putus
            return ""; // UI akan otomatis pakai fallback statis jika string kosong/null
        }
    }

    async autoCreateNpcPortrait(summary: string): Promise<string> {
        const key = `npc:${summary.trim()}`.slice(0, 256);
        const cached = this.portraitCache.get(key);
        if (cached) return cached;

        const base64Mini = renderNpcMiniSprite(summary);
        // Update style NPC juga agar konsisten (opsional, tapi disarankan)
        const stylePrompt = `16-bit pixel art NPC portrait, retro RPG style, detailed face, distinctive features`;
        const result = await this.stylizePixelLayout(base64Mini, stylePrompt, 'Sprite');
        this.portraitCache.set(key, result);
        this.persistCacheToStorage();
        return result;
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
                model: geminiService.getTextModelName(),
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

    // UPGRADE FASE 2: The Oracle (Multi-Option Generator)
    async suggestIncantation(currentTheme: string, userConcept: string = ""): Promise<Array<{ title: string; description: string; villain: string }>> {
        const prompt = `Anda adalah The Oracle, penasihat Dungeon Master.
        Pengguna ingin membuat kampanye D&D.
        Tema: "${currentTheme || 'Acak'}".
        Inspirasi/Konsep Awal Pengguna: "${userConcept || 'Tidak ada, berikan ide liar'}".
        
        Tugas: Berikan 3 VARIASI ide kampanye yang berbeda berdasarkan input tersebut.
        1. Opsi Klasik/Straightforward.
        2. Opsi Twist/Subversif.
        3. Opsi Misterius/Gelap.

        Output HARUS berupa JSON Array berisi 3 objek:
        [
            {
                "title": "Judul (Indonesia, Keren)",
                "description": "Premis menarik (2-3 kalimat).",
                "villain": "Musuh Utama (Nama & Gelar)"
            },
            ...
        ]`;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: geminiService.getTextModelName(),
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            const result = JSON.parse(response.text);
            // Handle jika AI mengembalikan object tunggal atau array
            return Array.isArray(result) ? result : [result];
        };
        
        // Fallback Robust
        try {
            return await geminiService.makeApiCall(call);
        } catch (e) {
            console.warn("Oracle gagal, menggunakan fallback vision.", e);
            return [
                {
                    title: "Lembah Harapan Pupus",
                    description: "Sebuah lembah yang tertutup kabut abadi, di mana para petualang masuk namun tak pernah keluar.",
                    villain: "Umbra, Penelan Cahaya"
                },
                {
                    title: "Pemberontakan Mesin Uap",
                    description: "Golem kuno mulai bangkit sendiri dan menolak perintah penciptanya.",
                    villain: "Prime Gear, Kesadaran Pertama"
                },
                {
                    title: "Bisikan dari Laut Dalam",
                    description: "Nelayan mulai menghilang, digantikan oleh sosok yang terlihat 'salah' di bawah sinar bulan.",
                    villain: "Dagon, Pendeta Lautan"
                }
            ];
        }
    }

    // BARU: FASE 2 - The Whisper (Secret Agenda Generator)
    async suggestSecretAgenda(data: { name: string; race: string; class: string; background: string }): Promise<{
        light: { agenda: string; desire: string; trigger: string };
        dark: { agenda: string; desire: string; trigger: string };
        gray: { agenda: string; desire: string; trigger: string };
    }> {
        const prompt = `Anda adalah 'The Whisper', suara hati terdalam dari karakter RPG ini.
        Identitas: ${data.name} (${data.race} ${data.class}, Background: ${data.background}).

        Berikan 3 RAHASIA GELAP/KOMPLEKS yang mungkin mereka sembunyikan dari party mereka (teman petualang).
        Rahasia ini harus memicu potensi KONFLIK atau DRAMA di masa depan.
        
        1. LIGHT (Devosi/Pengorbanan): Niat baik tapi berbahaya.
        2. DARK (Ambisi/Dendam): Egois atau jahat.
        3. GRAY (Dilema/Hutang Budi): Terpaksa melakukan sesuatu.

        Output JSON Format:
        {
            "light": { "agenda": "...", "desire": "...", "trigger": "Jika party menyakiti [X], aku akan berkhianat." },
            "dark": { "agenda": "...", "desire": "...", "trigger": "..." },
            "gray": { "agenda": "...", "desire": "...", "trigger": "..." }
        }
        Bahasa Indonesia.`;

        const call = async (client: any) => {
            const response = await client.models.generateContent({
                model: geminiService.getTextModelName(),
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            return JSON.parse(response.text);
        };

        try {
            return await geminiService.makeApiCall(call);
        } catch (e) {
            // Fallback generic
            return {
                light: { agenda: "Melindungi artefak suci keluarga.", desire: "Menebus dosa masa lalu.", trigger: "Jika artefak dicuri." },
                dark: { agenda: "Mencari kekuatan terlarang.", desire: "Menjadi dewa.", trigger: "Jika ada yang menghalangi ritual." },
                gray: { agenda: "Membayar hutang pada sindikat.", desire: "Kebebasan.", trigger: "Jika sindikat menagih nyawa." }
            };
        }
    }
}

export const generationService = new GenerationService();