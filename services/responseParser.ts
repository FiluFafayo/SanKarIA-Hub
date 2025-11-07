// REFAKTOR G-2: File ini disederhanakan.
// Skema sekarang hidup di service (gameService.ts / generationService.ts).
// File ini HANYA bertanggung jawab untuk mem-parsing respons JSON tunggal
// dari 'generateTurnResponse' (gameService.ts).

import { StructuredApiResponse } from "../types";

// (SKEMA DIHAPUS, dipindah ke service terkait)

function safeJsonParse<T>(text: string, fallback: T): T {
    if (typeof text !== 'string' || !text.trim()) {
        return fallback;
    }
    try {
        const firstBracket = text.indexOf('{');
        const lastBracket = text.lastIndexOf('}');

        if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
            return fallback;
        }

        const jsonString = text.substring(firstBracket, lastBracket + 1);
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Gagal mem-parsing JSON:", error, "Teks Asli:", text);
        return fallback;
    }
}


/**
 * REFAKTOR G-2: Sekarang mem-parsing OBJEK RESPON LENGKAP (ATOMIK).
 * @param responseText The raw text string from the Gemini API response.
 * @returns An object with reaction, narration, choices, and rollRequest.
 */
export const parseStructuredApiResponse = (responseText: string): Omit<StructuredApiResponse, 'tool_calls'> => {
    const fallbackNarration = "DM terdiam sejenak, mungkin kehilangan kata-kata...";

    // Fallback awal jika parsing gagal total
    const fallbackResult: Omit<StructuredApiResponse, 'tool_calls'> = {
        reaction: undefined,
        narration: fallbackNarration,
        choices: ["Coba lagi...", "Lihat sekeliling"], // Fallback mekanik yang aman
        rollRequest: undefined,
    };

    if (!responseText || typeof responseText !== 'string' || !responseText.trim()) {
        console.warn("[G-2] Menerima responseText kosong atau tidak valid dari API.");
        return fallbackResult;
    }

    // Coba parse JSON lengkap
    const parsed = safeJsonParse(responseText, fallbackResult);

    const reaction = parsed.reaction || undefined;
    // Pastikan narasi tidak pernah string kosong
    const narration = parsed.narration && parsed.narration.trim() ? parsed.narration.trim() : fallbackNarration;

    const choices = parsed.choices || undefined;
    const rollRequest = parsed.rollRequest || undefined;

    return { reaction, narration, choices, rollRequest };
};

// (FungSI parseMechanicsResponse DIHAPUS karena digabung ke parseStructuredApiResponse)