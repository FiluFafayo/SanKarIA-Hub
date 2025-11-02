
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { Campaign, Character } from '../types';

class DataService {
    private supabase: SupabaseClient | null = null;

    public init(url: string, anonKey: string) {
        if (url && anonKey && (!this.supabase || this.supabase.supabaseUrl !== url)) {
            try {
                this.supabase = createClient(url, anonKey);
                console.log("Koneksi Supabase berhasil diinisialisasi.");
            } catch (e) {
                console.error("Gagal menginisialisasi klien Supabase:", e);
                this.supabase = null;
            }
        } else if (!url || !anonKey) {
            this.supabase = null;
        }
    }

    private ensureSupabase() {
        if (!this.supabase) {
            throw new Error("Klien Supabase tidak diinisialisasi. Periksa konfigurasi Anda.");
        }
        return this.supabase;
    }


    // Metode Kampanye
    async getCampaigns(): Promise<Campaign[]> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase.from('campaigns').select('*');
        if (error) {
            console.error('Gagal mengambil kampanye dari Supabase:', error);
            throw error;
        }
        return data || [];
    }

    async saveCampaign(campaign: Campaign): Promise<Campaign> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase.from('campaigns').upsert(campaign).select().single();
        if (error) {
            console.error('Gagal menyimpan kampanye ke Supabase:', error);
            throw error;
        }
        return data;
    }
    
    async saveCampaigns(campaigns: Campaign[]): Promise<Campaign[]> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase.from('campaigns').upsert(campaigns).select();
        if (error) {
            console.error('Gagal menyimpan kampanye ke Supabase:', error);
            throw error;
        }
        return data || [];
    }

    // Metode Karakter
    async getCharacters(): Promise<Character[]> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase.from('characters').select('*');
        if (error) {
            console.error('Gagal mengambil karakter dari Supabase:', error);
            throw error;
        }
        return data || [];
    }

    async saveCharacter(character: Character): Promise<Character> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase.from('characters').upsert(character).select().single();
        if (error) {
            console.error('Gagal menyimpan karakter ke Supabase:', error);
            throw error;
        }
        return data;
    }
    
    async saveCharacters(characters: Character[]): Promise<Character[]> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase.from('characters').upsert(characters).select();
        if (error) {
            console.error('Gagal menyimpan karakter ke Supabase:', error);
            throw error;
        }
        return data || [];
    }
    
    // --- METODE OTENTIKASI ---
    public async signInWithGoogle() {
        const supabase = this.ensureSupabase();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) {
            console.error('Error logging in with Google:', error);
            alert(`Gagal masuk dengan Google: ${error.message}`);
        }
    }

    public async signOut() {
        if (!this.supabase) return;
        const { error } = await this.supabase.auth.signOut();
        if (error) console.error('Error logging out:', error);
    }

    public async getSession() {
        if (!this.supabase) return { data: { session: null }, error: new Error("Supabase not initialized") };
        return this.supabase.auth.getSession();
    }

    public onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        if (!this.supabase) {
            // Kembalikan objek langganan dummy jika supabase tidak diinisialisasi
            return { data: { subscription: { unsubscribe: () => {} } } };
        }
        return this.supabase.auth.onAuthStateChange(callback);
    }
}

export const dataService = new DataService();
