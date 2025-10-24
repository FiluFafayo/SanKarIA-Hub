import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Campaign, Character } from '../types'; // Pastikan path ke types.ts benar
import { generateId } from '../utils';

class DataService {
    private supabase: SupabaseClient | null = null;
    private localCampaigns: Campaign[] = []; // Fallback local storage
    private localCharacters: Character[] = []; // Fallback local storage

    public init(url: string, anonKey: string) {
        if (url && anonKey) {
            try {
                this.supabase = createClient(url, anonKey);
                console.log("Koneksi Supabase berhasil diinisialisasi via dataService.");
            } catch (e) {
                console.error("Gagal menginisialisasi klien Supabase di dataService:", e);
                this.supabase = null;
                this.loadLocalFallback(); // Muat fallback kalo Supabase gagal init
            }
        } else {
            this.supabase = null;
            this.loadLocalFallback(); // Muat fallback kalo URL/Key kosong
        }
    }

    // Fungsi fallback ke localStorage jika Supabase tidak tersedia
    private loadLocalFallback() {
        console.warn("Supabase tidak terkonfigurasi, menggunakan localStorage sebagai fallback.");
        try {
            const storedCampaigns = window.localStorage.getItem('sankarla-campaigns');
            this.localCampaigns = storedCampaigns ? JSON.parse(storedCampaigns) : [];
            const storedCharacters = window.localStorage.getItem('sankarla-characters');
            this.localCharacters = storedCharacters ? JSON.parse(storedCharacters) : [];
        } catch (error) {
            console.error("Gagal memuat data fallback localStorage:", error);
            this.localCampaigns = [];
            this.localCharacters = [];
        }
    }

    private saveLocalFallbackCampaigns() {
        try {
            window.localStorage.setItem('sankarla-campaigns', JSON.stringify(this.localCampaigns));
        } catch (error) {
            console.error("Gagal menyimpan fallback campaigns:", error);
        }
    }

    private saveLocalFallbackCharacters() {
        try {
            window.localStorage.setItem('sankarla-characters', JSON.stringify(this.localCharacters));
        } catch (error) {
            console.error("Gagal menyimpan fallback characters:", error);
        }
    }

    // Campaign Methods
    async getCampaigns(): Promise<Campaign[]> {
        if (this.supabase) {
            // Ambil semua campaign (RLS: hanya user terautentikasi yg bisa)
            const { data, error } = await this.supabase
                .from('campaigns')
                .select('*');

            if (error) {
                console.error('Gagal mengambil kampanye dari Supabase:', error);
                throw error; // Lempar error biar bisa ditangani di UI
            }
            // Pastikan tipe data sesuai, terutama array JSONB
            return (data || []).map(c => ({
                ...c,
                playerIds: Array.isArray(c.playerIds) ? c.playerIds : [],
                eventLog: Array.isArray(c.eventLog) ? c.eventLog : [],
                monsters: Array.isArray(c.monsters) ? c.monsters : [],
                initiativeOrder: Array.isArray(c.initiativeOrder) ? c.initiativeOrder : [],
                choices: Array.isArray(c.choices) ? c.choices : [],
                quests: Array.isArray(c.quests) ? c.quests : [],
                npcs: Array.isArray(c.npcs) ? c.npcs : [],
                mapMarkers: Array.isArray(c.mapMarkers) ? c.mapMarkers : [],
            }));
        } else {
            // Fallback localStorage
            return Promise.resolve([...this.localCampaigns]);
        }
    }

    async saveCampaign(campaign: Campaign): Promise<Campaign> {
        if (this.supabase) {
            // Cek jika ID sudah ada (UUID) atau belum (ID lokal sementara)
            const campaignData = campaign.id.startsWith('campaign-')
                ? { ...campaign, id: undefined } // Hapus ID lokal, biarkan Supabase generate UUID
                : campaign;

            const { data, error } = await this.supabase
                .from('campaigns')
                .upsert(campaignData) // upsert akan insert jika belum ada, update jika sudah
                .select()
                .single(); // Ambil satu hasil yang diupsert

            if (error) {
                console.error('Gagal menyimpan kampanye ke Supabase:', error);
                throw error;
            }
            if (!data) {
                throw new Error("Supabase tidak mengembalikan data setelah save campaign.");
            }
            // Pastikan tipe data balikannya benar
            return {
                ...data,
                playerIds: Array.isArray(data.playerIds) ? data.playerIds : [],
                eventLog: Array.isArray(data.eventLog) ? data.eventLog : [],
                monsters: Array.isArray(data.monsters) ? data.monsters : [],
                initiativeOrder: Array.isArray(data.initiativeOrder) ? data.initiativeOrder : [],
                choices: Array.isArray(data.choices) ? data.choices : [],
                quests: Array.isArray(data.quests) ? data.quests : [],
                npcs: Array.isArray(data.npcs) ? data.npcs : [],
                mapMarkers: Array.isArray(data.mapMarkers) ? data.mapMarkers : [],
            };
        } else {
            // Fallback localStorage
            const index = this.localCampaigns.findIndex(c => c.id === campaign.id);
            if (index > -1) {
                this.localCampaigns[index] = campaign;
            } else {
                const newLocalCampaign = { ...campaign, id: campaign.id || generateId('campaign') }; // Generate ID lokal jika belum ada
                this.localCampaigns.push(newLocalCampaign);
                campaign = newLocalCampaign; // Update campaign object dengan ID baru
            }
            this.saveLocalFallbackCampaigns();
            return Promise.resolve(campaign);
        }
    }

    async saveCampaigns(campaigns: Campaign[]): Promise<Campaign[]> {
        if (this.supabase) {
            // Pastikan tidak ada ID lokal saat insert batch
            const campaignsToUpsert = campaigns.map(c => c.id.startsWith('campaign-') ? { ...c, id: undefined } : c);

            const { data, error } = await this.supabase
                .from('campaigns')
                .upsert(campaignsToUpsert)
                .select();

            if (error) {
                console.error('Gagal menyimpan multiple campaigns ke Supabase:', error);
                throw error;
            }
            // Pastikan tipe data balikannya benar
            return (data || []).map(c => ({
                ...c,
                playerIds: Array.isArray(c.playerIds) ? c.playerIds : [],
                eventLog: Array.isArray(c.eventLog) ? c.eventLog : [],
                monsters: Array.isArray(c.monsters) ? c.monsters : [],
                initiativeOrder: Array.isArray(c.initiativeOrder) ? c.initiativeOrder : [],
                choices: Array.isArray(c.choices) ? c.choices : [],
                quests: Array.isArray(c.quests) ? c.quests : [],
                npcs: Array.isArray(c.npcs) ? c.npcs : [],
                mapMarkers: Array.isArray(c.mapMarkers) ? c.mapMarkers : [],
            }));
        } else {
            // Fallback localStorage (replace all)
            this.localCampaigns = campaigns.map(c => ({ ...c, id: c.id || generateId('campaign') }));
            this.saveLocalFallbackCampaigns();
            return Promise.resolve([...this.localCampaigns]);
        }
    }

    // Character Methods
    // Tambahkan parameter userId, karena kita hanya fetch karakter milik user tertentu
    async getCharacters(userId: string): Promise<Character[]> {
        if (!userId) return Promise.resolve([]); // Jangan fetch jika tidak ada user ID

        if (this.supabase) {
            const { data, error } = await this.supabase
                .from('characters')
                .select('*')
                .eq('ownerId', userId); // Filter berdasarkan ownerId

            if (error) {
                console.error('Gagal mengambil karakter dari Supabase:', error);
                throw error;
            }
            // Pastikan tipe data sesuai
            return (data || []).map(c => ({
                ...c,
                abilityScores: typeof c.abilityScores === 'object' ? c.abilityScores : {},
                deathSaves: typeof c.deathSaves === 'object' ? c.deathSaves : { successes: 0, failures: 0 },
                conditions: Array.isArray(c.conditions) ? c.conditions : [],
                proficientSkills: Array.isArray(c.proficientSkills) ? c.proficientSkills : [],
                proficientSavingThrows: Array.isArray(c.proficientSavingThrows) ? c.proficientSavingThrows : [],
                inventory: Array.isArray(c.inventory) ? c.inventory : [],
                spellSlots: Array.isArray(c.spellSlots) ? c.spellSlots : [],
                knownSpells: Array.isArray(c.knownSpells) ? c.knownSpells : [],
            }));
        } else {
            // Fallback localStorage (filter local data)
            return Promise.resolve(this.localCharacters.filter(c => c.ownerId === userId));
        }
    }

    // Perhatikan: saveCharacter sekarang bisa menerima data tanpa ID (untuk insert)
    async saveCharacter(characterData: Omit<Character, 'id'> | Character): Promise<Character> {
        if (this.supabase) {
            const { data, error } = await this.supabase
                .from('characters')
                .upsert(characterData) // Langsung upsert
                .select()
                .single();

            if (error) {
                console.error('Gagal menyimpan karakter ke Supabase:', error);
                throw error;
            }
            if (!data) {
                throw new Error("Supabase tidak mengembalikan data setelah save character.");
            }
            // Pastikan tipe data balikannya benar
            return {
                ...data,
                abilityScores: typeof data.abilityScores === 'object' ? data.abilityScores : {},
                deathSaves: typeof data.deathSaves === 'object' ? data.deathSaves : { successes: 0, failures: 0 },
                conditions: Array.isArray(data.conditions) ? data.conditions : [],
                proficientSkills: Array.isArray(data.proficientSkills) ? data.proficientSkills : [],
                proficientSavingThrows: Array.isArray(data.proficientSavingThrows) ? data.proficientSavingThrows : [],
                inventory: Array.isArray(data.inventory) ? data.inventory : [],
                spellSlots: Array.isArray(data.spellSlots) ? data.spellSlots : [],
                knownSpells: Array.isArray(data.knownSpells) ? data.knownSpells : [],
            };
        } else {
            // Fallback localStorage
            let character = characterData as Character; // Anggap punya ID
            const index = this.localCharacters.findIndex(c => c.id === character.id);
            if (index > -1) {
                this.localCharacters[index] = character;
            } else {
                // Jika tidak ada ID atau ID tidak ditemukan, generate ID lokal baru
                const newLocalCharacter = { ...characterData, id: generateId('char') } as Character;
                this.localCharacters.push(newLocalCharacter);
                character = newLocalCharacter; // Update object dengan ID baru
            }
            this.saveLocalFallbackCharacters();
            return Promise.resolve(character);
        }
    }

    // Perhatikan: saveCharacters sekarang bisa menerima data tanpa ID (untuk insert batch)
    async saveCharacters(charactersData: Array<Omit<Character, 'id'> | Character>): Promise<Character[]> {
        if (this.supabase) {
            const { data, error } = await this.supabase
                .from('characters')
                .upsert(charactersData) // Langsung upsert array
                .select();

            if (error) {
                console.error('Gagal menyimpan multiple characters ke Supabase:', error);
                throw error;
            }
            // Pastikan tipe data balikannya benar
            return (data || []).map(c => ({
                ...c,
                abilityScores: typeof c.abilityScores === 'object' ? c.abilityScores : {},
                deathSaves: typeof c.deathSaves === 'object' ? c.deathSaves : { successes: 0, failures: 0 },
                conditions: Array.isArray(c.conditions) ? c.conditions : [],
                proficientSkills: Array.isArray(c.proficientSkills) ? c.proficientSkills : [],
                proficientSavingThrows: Array.isArray(c.proficientSavingThrows) ? c.proficientSavingThrows : [],
                inventory: Array.isArray(c.inventory) ? c.inventory : [],
                spellSlots: Array.isArray(c.spellSlots) ? c.spellSlots : [],
                knownSpells: Array.isArray(c.knownSpells) ? c.knownSpells : [],
            }));
        } else {
            // Fallback localStorage (replace all characters for the owner)
            const ownerId = charactersData[0]?.ownerId; // Asumsi semua char punya owner yg sama
            if (ownerId) {
                const otherUsersChars = this.localCharacters.filter(c => c.ownerId !== ownerId);
                const newChars = charactersData.map(c => ({ ...c, id: (c as Character).id || generateId('char') })) as Character[];
                this.localCharacters = [...otherUsersChars, ...newChars];
                this.saveLocalFallbackCharacters();
                return Promise.resolve(newChars);
            }
            return Promise.resolve([]);
        }
    }

    // Tambahkan fungsi helper untuk mendapatkan Supabase client jika diperlukan di luar service
    getClient(): SupabaseClient | null {
        return this.supabase;
    }
}

export const dataService = new DataService();
