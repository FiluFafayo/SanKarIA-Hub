// REFAKTOR G-2: File ini dilucuti.
// services/geminiService.ts SEKARANG HANYA bertanggung jawab atas manajemen kunci API
// dan eksekutor panggilan API (makeApiCall).
// SEMUA logika game (generateNarration, determineNextStep) dipindah ke services/ai/gameService.ts
// SEMUA logika setup (generateCampaignFramework, generateMapImage) dipindah ke services/ai/generationService.ts

import { GoogleGenAI } from "@google/genai";

class GeminiService {
    // FIX: Auto-load dari Env Var saat inisialisasi
    private apiKeys: string[] = this.loadKeysFromEnv();
    private currentKeyIndex = 0;
    private genAI: GoogleGenAI | null = null;
    private resolvedTextModel: string | null = null;
    private resolvedImageModel: string | null = null;

    // Helper untuk membaca Env Var (Support comma-separated untuk rotasi)
    private loadKeysFromEnv(): string[] {
        // Coba baca VITE_GEMINI_API_KEYS (standar Vite)
        const envKey = import.meta.env.VITE_GEMINI_API_KEYS || '';
        
        if (envKey) {
            console.log("[GeminiService] API Key ditemukan di Environment Variables.");
            // Support multiple keys dipisah koma
            return envKey.split(',').map(k => k.trim()).filter(k => k !== '');
        }
        
        console.warn("[GeminiService] Tidak ada API Key di Environment Variables (VITE_GEMINI_API_KEYS). Menunggu input manual.");
        return ['']; // Fallback agar tidak crash saat akses indeks 0
    }

    public updateKeys(keys: string[]) {
        const validKeys = keys.filter(k => k.trim() !== '');
        if (validKeys.length === 0) {
            console.warn("⚠️ Percobaan updateKeys dengan array kosong diabaikan. Mempertahankan keys lama jika ada.");
            if (this.apiKeys.length === 0 || (this.apiKeys.length === 1 && this.apiKeys[0] === '')) {
                 this.apiKeys = ['']; // Tetap kosong jika memang belum ada
            }
        } else {
            this.apiKeys = validKeys;
            this.currentKeyIndex = 0;
            this.genAI = null; // Paksa re-inisialisasi
            console.log(`[GeminiService] Keys diperbarui. Total: ${this.apiKeys.length}`);
        }
    }

    public getClient(): GoogleGenAI {
        if (this.genAI) return this.genAI;

        if (this.apiKeys.length === 0 || !this.apiKeys[this.currentKeyIndex]) {
            throw new Error("Tidak ada Kunci API Gemini yang valid.");
        }

        const key = this.apiKeys[this.currentKeyIndex];

        try {
            this.genAI = new GoogleGenAI({ apiKey: key });
            // Deteksi model secara asynchronous, tidak menghalangi alur
            this.detectPreferredModels(this.genAI).catch(() => {});
            return this.genAI;
        } catch (error) {
            console.error(`Gagal inisialisasi GoogleGenAI dengan kunci #${this.currentKeyIndex + 1}:`, error);
            // Coba rotasi jika gagal inisialisasi (misal kunci format salah)
            if (this.apiKeys.length > 1) {
                this.rotateKey();
                return this.getClient(); // Coba lagi dengan kunci berikutnya
            }
            throw error; // Lemparkan error jika hanya 1 kunci dan gagal
        }
    }

    private rotateKey() {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        this.genAI = null; // Hapus instance lama
        console.warn(`[G-2] Beralih ke Kunci API #${this.currentKeyIndex + 1}`);
    }

    public async makeApiCall<T>(call: (client: GoogleGenAI) => Promise<T>, signal?: AbortSignal): Promise<T> {
        let attempts = 0;
        const maxAttempts = Math.max(1, this.apiKeys.length);

        while (attempts < maxAttempts) {
            try {
                const client = this.getClient(); // Dapatkan klien (mungkin baru setelah rotasi)
                // Pastikan deteksi model sudah pernah dicoba
                this.detectPreferredModels(client).catch(() => {});
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`API call timed out after 30 seconds (Attempt ${attempts + 1}/${maxAttempts})`)), 30000)
                );

                const abortPromise = signal
                    ? new Promise<never>((_, reject) => {
                        if (signal.aborted) {
                            reject(new Error('API call aborted'));
                            return;
                        }
                        signal.addEventListener('abort', () => reject(new Error('API call aborted')), { once: true });
                    })
                    : null;

                // @ts-ignore
                const racers = [call(client), timeoutPromise];
                if (abortPromise) racers.push(abortPromise);
                const result = await Promise.race(racers);
                return result;

            } catch (error: any) {
                console.error(`[G-2] Upaya API ${attempts + 1}/${maxAttempts} gagal:`, error.message);
                attempts++;

                // Jika masih ada upaya tersisa, rotasi kunci
                if (attempts < maxAttempts && this.apiKeys.length > 1) {
                    this.rotateKey();
                } else if (attempts >= maxAttempts) {
                    // Upaya terakhir gagal
                    console.error("[G-2] Semua upaya panggilan API gagal.");
                    throw new Error(`Semua (${maxAttempts}) upaya panggilan API gagal. Error terakhir: ${error.message}`);
                }
            }
        }
        // Ini seharusnya tidak akan tercapai, tapi untuk keamanan typescript
        throw new Error("Gagal melakukan panggilan API setelah semua upaya.");
    }

    private async detectPreferredModels(client: GoogleGenAI) {
        if (this.resolvedTextModel && this.resolvedImageModel) return;
        try {
            // @ts-ignore: list tersedia di SDK
            const models = await client.models.list();
            const names: string[] = Array.isArray(models.models)
                ? models.models.map((m: any) => m.name || m.model || '')
                : [];

            const textPriority = [
                'gemini-2.0-flash',
                'gemini-flash-latest',
                // 'gemini-1.5-pro',
                // 'gemini-flash',
                // 'gemini-pro',
            ];
            const imagePriority = [
                'gemini-2.5-flash-image-preview',
                'gemini-2.5-flash-image',
                // 'gemini-2.0-flash-lite-preview',
                'imagen-4.0-generate-preview-06-06',
            ];

            this.resolvedTextModel = textPriority.find((n) => names.includes(n)) || this.resolvedTextModel;
            this.resolvedImageModel = imagePriority.find((n) => names.includes(n)) || this.resolvedImageModel;
        } catch (e) {
            // Abaikan kegagalan; fallback akan dipakai
        }
    }

    public getTextModelName(): string {
        return this.resolvedTextModel || 'gemini-2.0-flash';
    }

    public getImageModelName(): string {
        return this.resolvedImageModel || 'gemini-2.5-flash-image-preview';
    }

    // Fungsi ini tetap di sini karena ini adalah utilitas murni, bukan logika game.
    async testApiKey(key: string): Promise<{ success: boolean; message: string }> {
        if (!key || key.trim() === '') {
            return { success: false, message: 'Kunci API tidak boleh kosong.' };
        }
        try {
            // Buat klien tes terisolasi
            const testClient = new GoogleGenAI({ apiKey: key });
            const response = await testClient.models.generateContent({
                model: 'gemini-2.0-flash',
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

} // Akhir dari class GeminiService

// Ekspor instance tunggal
export const geminiService = new GeminiService();