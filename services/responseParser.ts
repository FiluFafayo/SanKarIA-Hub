import { Type } from "@google/genai";
import { StructuredApiResponse } from "../types";

// This schema is used for the NARRATION call.
export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reaction: {
      type: Type.STRING,
      description: "Reaksi langsung yang singkat dan cepat terhadap tindakan pemain (1-2 kalimat). Ini adalah dampak langsung. Opsional.",
      nullable: true,
    },
    narration: {
      type: Type.STRING,
      description: "Narasi cerita yang lebih rinci yang mengikuti reaksi. Ini menjelaskan dunia dan apa yang terjadi selanjutnya. WAJIB ADA.",
    },
  },
  required: ['narration']
};

// This schema is used for the MECHANICS call.
export const MECHANICS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
     choices: {
      type: Type.ARRAY,
      description: "Daftar 3-4 tindakan yang dapat diambil pemain. Harus kosong jika ada rollRequest.",
      items: {
        type: Type.STRING,
      }
    },
    rollRequest: {
      type: Type.OBJECT,
      description: "Permintaan bagi pemain untuk melempar dadu. Harus null jika ada pilihan.",
      nullable: true,
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
  }
}

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
 * Safely parses the JSON string from the NARRATION API call.
 * @param responseText The raw text string from the Gemini API response.
 * @returns An object with reaction and narration.
 */
export const parseStructuredApiResponse = (responseText: string): Omit<StructuredApiResponse, 'tool_calls' | 'choices' | 'rollRequest'> => {
    const fallbackNarration = "DM terdiam sejenak, mungkin kehilangan kata-kata...";
    // Fallback awal jika parsing gagal total
    const fallbackResult = { reaction: undefined, narration: fallbackNarration };

    if (!responseText || typeof responseText !== 'string' || !responseText.trim()) {
        console.warn("Menerima responseText kosong atau tidak valid dari API narasi.");
        return fallbackResult;
    }

    const parsed = safeJsonParse(responseText, { reaction: undefined, narration: undefined }); // Coba parse tanpa fallback teks

    const reaction = parsed.reaction || undefined;
    // Pastikan narasi tidak pernah string kosong
    const narration = parsed.narration && parsed.narration.trim() ? parsed.narration.trim() : fallbackNarration;

    return { reaction, narration };
};

/**
 * Safely parses the JSON string from the MECHANICS API call.
 * @param responseText The raw text string from the Gemini API response.
 * @returns An object with choices and rollRequest.
 */
export const parseMechanicsResponse = (responseText: string): Omit<StructuredApiResponse, 'tool_calls' | 'reaction' | 'narration'> => {
     // FIX: Add `rollRequest` to the fallback object to ensure `parsed` has the correct type shape.
     const fallback = { choices: ["Lanjutkan...", "Amati sekeliling"], rollRequest: undefined };
     const parsed = safeJsonParse(responseText, fallback);

     return {
         choices: parsed.choices || undefined,
         rollRequest: parsed.rollRequest || undefined,
     };
}