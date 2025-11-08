// REFAKTOR G-2: File ini dilucuti.
// services/geminiService.ts SEKARANG HANYA bertanggung jawab atas manajemen kunci API
// dan eksekutor panggilan API (makeApiCall).
// SEMUA logika game (generateNarration, determineNextStep) dipindah ke services/ai/gameService.ts
// SEMUA logika setup (generateCampaignFramework, generateMapImage) dipindah ke services/ai/generationService.ts

import { GoogleGenAI } from "@google/genai";

class GeminiService {
    private apiKeys: string[] = [''];
    private currentKeyIndex = 0;
    private genAI: GoogleGenAI | null = null;

    public updateKeys(keys: string[]) {
        this.apiKeys = keys.filter(k => k.trim() !== '');
        if (this.apiKeys.length === 0) {
            console.warn("⚠️ Tidak ada Kunci API Gemini yang valid. Menggunakan fallback (jika ada).");
            this.apiKeys = ['']; // Fallback ke kunci kosong untuk mencegah crash
        }
        this.currentKeyIndex = 0;
        this.genAI = null; // Paksa re-inisialisasi
    }

    public getClient(): GoogleGenAI {
        if (this.genAI) return this.genAI;

        if (this.apiKeys.length === 0 || !this.apiKeys[this.currentKeyIndex]) {
            throw new Error("Tidak ada Kunci API Gemini yang valid.");
        }

        const key = this.apiKeys[this.currentKeyIndex];

        try {
            this.genAI = new GoogleGenAI({ apiKey: key });
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

    // Fungsi ini tetap di sini karena ini adalah utilitas murni, bukan logika game.
    async testApiKey(key: string): Promise<{ success: boolean; message: string }> {
        if (!key || key.trim() === '') {
            return { success: false, message: 'Kunci API tidak boleh kosong.' };
        }
        try {
            // Buat klien tes terisolasi
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

} // Akhir dari class GeminiService

// Ekspor instance tunggal
export const geminiService = new GeminiService();