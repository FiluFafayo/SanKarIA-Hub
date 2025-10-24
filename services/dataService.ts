import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Campaign, Character } from '../types';

class DataService {
    private supabase: SupabaseClient | null = null;

    public init(url: string, anonKey: string) {
        if (url && anonKey) {
            try {
                this.supabase = createClient(url, anonKey);
                console.log("Koneksi Supabase berhasil diinisialisasi.");
            } catch (e) {
                console.error("Gagal menginisialisasi klien Supabase:", e);
                this.supabase = null;
            }
        } else {
            this.supabase = null;
        }
    }

    private getFromLocalStorage<T>(key: string, defaultValue: T): T {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Gagal membaca localStorage “${key}”:`, error);
            return defaultValue;
        }
    }

    private saveToLocalStorage<T>(key: string, value: T) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
             console.error(`Gagal menyimpan ke localStorage “${key}”:`, error);
        }
    }

    // Campaign Methods
    async getCampaigns(): Promise<Campaign[]> {
        if (this.supabase) {
            const { data, error } = await this.supabase.from('campaigns').select('*');
            if (error) {
                console.error('Gagal mengambil kampanye dari Supabase:', error);
                throw error;
            }
            return data || [];
        } else {
            return this.getFromLocalStorage<Campaign[]>('sankaria-campaigns', []);
        }
    }

    async saveCampaign(campaign: Campaign): Promise<Campaign> {
        if (this.supabase) {
            const { data, error } = await this.supabase.from('campaigns').upsert(campaign).select().single();
            if (error) {
                console.error('Gagal menyimpan kampanye ke Supabase:', error);
                throw error;
            }
            return data;
        } else {
            const campaigns = this.getFromLocalStorage<Campaign[]>('sankaria-campaigns', []);
            const index = campaigns.findIndex(c => c.id === campaign.id);
            if (index > -1) {
                campaigns[index] = campaign;
            } else {
                campaigns.push(campaign);
            }
            this.saveToLocalStorage('sankaria-campaigns', campaigns);
            return campaign;
        }
    }
    
    async saveCampaigns(campaigns: Campaign[]): Promise<Campaign[]> {
        if (this.supabase) {
             const { data, error } = await this.supabase.from('campaigns').upsert(campaigns).select();
             if (error) {
                console.error('Gagal menyimpan kampanye ke Supabase:', error);
                throw error;
            }
            return data || [];
        } else {
            this.saveToLocalStorage('sankaria-campaigns', campaigns);
            return campaigns;
        }
    }

    // Character Methods
    async getCharacters(): Promise<Character[]> {
        if (this.supabase) {
             const { data, error } = await this.supabase.from('characters').select('*');
            if (error) {
                console.error('Gagal mengambil karakter dari Supabase:', error);
                throw error;
            }
            return data || [];
        } else {
             return this.getFromLocalStorage<Character[]>('sankaria-characters', []);
        }
    }

    async saveCharacter(character: Character): Promise<Character> {
         if (this.supabase) {
            const { data, error } = await this.supabase.from('characters').upsert(character).select().single();
            if (error) {
                console.error('Gagal menyimpan karakter ke Supabase:', error);
                throw error;
            }
            return data;
        } else {
            const characters = this.getFromLocalStorage<Character[]>('sankaria-characters', []);
            const index = characters.findIndex(c => c.id === character.id);
            if (index > -1) {
                characters[index] = character;
            } else {
                characters.push(character);
            }
            this.saveToLocalStorage('sankaria-characters', characters);
            return character;
        }
    }
    
    async saveCharacters(characters: Character[]): Promise<Character[]> {
        if (this.supabase) {
            const { data, error } = await this.supabase.from('characters').upsert(characters).select();
            if (error) {
                console.error('Gagal menyimpan karakter ke Supabase:', error);
                throw error;
            }
            return data || [];
        } else {
             this.saveToLocalStorage('sankaria-characters', characters);
             return characters;
        }
    }
}

export const dataService = new DataService();
