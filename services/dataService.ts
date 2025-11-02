// =================================================================
// 
//       FILE: dataService.ts (VERSI BARU - POST-REFAKTOR DB)
// 
// =================================================================

import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
// Impor tipe baru dari types.ts yang sudah kita refaktor
import { Campaign, Character, CampaignPlayer } from '../types'; 

// Membuat tipe database untuk Supabase client
// Ini memberi kita intellisense dan keamanan tipe berdasarkan skema DB kita
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      characters: {
        Row: Character; // Tipe saat SELECT
        Insert: Omit<Character, 'id' | 'created_at' | 'owner_id'>; // Tipe saat INSERT
        Update: Partial<Character>; // Tipe saat UPDATE
      };
      campaigns: {
        Row: Campaign; // Tipe saat SELECT
        Insert: Omit<Campaign, 'id' | 'created_at' | 'owner_id'>; // Tipe saat INSERT
        Update: Partial<Campaign>; // Tipe saat UPDATE
      };
      campaign_players: {
        Row: CampaignPlayer; // Tipe saat SELECT
        Insert: CampaignPlayer; // Tipe saat INSERT
        Update: Partial<CampaignPlayer>; // Tipe saat UPDATE
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
}


class DataService {
    // Tipe SupabaseClient sekarang menggunakan Database interface kita
    private supabase: SupabaseClient<Database> | null = null;

    public init(url: string, anonKey: string) {
        if (url && anonKey && (!this.supabase || this.supabase.supabaseUrl !== url)) {
            try {
                // Inisialisasi client dengan tipe Database kita
                this.supabase = createClient<Database>(url, anonKey);
                console.log("Koneksi Supabase (V2) berhasil diinisialisasi.");
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

    // --- METODE OTENTIKASI (Tidak berubah) ---
    
    public async signInWithGoogle() {
        const supabase = this.ensureSupabase();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin // Pastikan redirect kembali ke app
            }
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
            return { data: { subscription: { unsubscribe: () => {} } } };
        }
        return this.supabase.auth.onAuthStateChange(callback);
    }
    
    // --- METODE KARAKTER (GLOBAL - Sesuai Mandat) ---

    /**
     * Mengambil HANYA karakter milik user yang sedang login.
     * RLS 'Allow owner SELECT' akan menangani ini.
     */
    async getMyCharacters(): Promise<Character[]> {
        const supabase = this.ensureSupabase();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.log("Tidak ada sesi, tidak bisa mengambil karakter.");
            return [];
        }

        const { data, error } = await supabase
            .from('characters')
            .select('*')
            .eq('owner_id', session.user.id); // Kita tetap filter manual untuk kejelasan
            
        if (error) {
            console.error('Gagal mengambil karakter dari Supabase:', error);
            throw error;
        }
        return data || [];
    }

    /**
     * Mengambil satu data karakter global.
     * RLS 'Allow owner SELECT' atau 'Allow teammates SELECT' akan berlaku.
     */
    async getCharacter(characterId: string): Promise<Character | null> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase
            .from('characters')
            .select('*')
            .eq('id', characterId)
            .single();
            
        if (error) {
            console.error('Gagal mengambil satu karakter:', error);
            // 'single()' akan error jika tidak ada data, jadi kita return null
            return null;
        }
        return data;
    }

    /**
     * Menyimpan/Membuat satu karakter global.
     * Ini adalah *Single Source of Truth* untuk HP, inventory, dll.
     */
    async saveCharacter(character: Character): Promise<Character> {
        const supabase = this.ensureSupabase();
        // 'upsert' akan INSERT jika id belum ada, atau UPDATE jika sudah ada.
        const { data, error } = await supabase
            .from('characters')
            .upsert(character)
            .select()
            .single();
            
        if (error) {
            console.error('Gagal menyimpan karakter ke Supabase:', error);
            throw error;
        }
        return data!; // Data pasti ada setelah upsert+select
    }
    
    /**
     * Menyimpan/Membuat BANYAK karakter global (untuk seeding data).
     */
    async saveCharacters(characters: Character[]): Promise<Character[]> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase
            .from('characters')
            .upsert(characters)
            .select();
            
        if (error) {
            console.error('Gagal menyimpan karakter (batch) ke Supabase:', error);
            throw error;
        }
        return data || [];
    }


    // --- METODE KAMPANYE (SESI) ---

    /**
     * Mengambil SEMUA kampanye yang bisa dilihat user.
     * RLS ('Allow participants SELECT') akan otomatis memfilter:
     * 1. Kampanye yang dia buat (owner_id).
     * 2. Kampanye yang dia ikuti (via campaign_players).
     */
    async getCampaigns(): Promise<Campaign[]> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase.from('campaigns').select('*');
        if (error) {
            console.error('Gagal mengambil kampanye dari Supabase:', error);
            throw error;
        }
        return data || [];
    }

    /**
     * Mengambil data satu kampanye.
     * RLS ('Allow participants SELECT') akan berlaku.
     */
    async getCampaign(campaignId: string): Promise<Campaign | null> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();
            
        if (error) {
            console.error('Gagal mengambil satu kampanye:', error);
            return null;
        }
        return data;
    }

    /**
     * Menyimpan state sesi kampanye.
     * RLS ('Allow participants UPDATE') mengizinkan DM atau Player untuk update.
     * PERHATIAN: Ini rawan race condition (akan di-solve di Fase 1).
     */
    async saveCampaign(campaign: Campaign): Promise<Campaign> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase
            .from('campaigns')
            .upsert(campaign)
            .select()
            .single();
            
        if (error) {
            console.error('Gagal menyimpan kampanye ke Supabase:', error);
            throw error;
        }
        return data!;
    }
    
    /**
     * Menyimpan BANYAK kampanye (untuk seeding data).
     */
    async saveCampaigns(campaigns: Campaign[]): Promise<Campaign[]> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase
            .from('campaigns')
            .upsert(campaigns)
            .select();
            
        if (error) {
            console.error('Gagal menyimpan kampanye (batch) ke Supabase:', error);
            throw error;
        }
        return data || [];
    }

    // --- METODE JUNCTION (PENGHUBUNG) ---

    /**
     * Mengambil semua karakter (data lengkap) yang ada di satu kampanye.
     * Ini adalah query krusial untuk GameScreen.
     */
    async getCharactersForCampaign(campaignId: string): Promise<Character[]> {
        const supabase = this.ensureSupabase();
        
        // 1. Ambil dulu ID karakter dari tabel junction
        const { data: playerLinks, error: linkError } = await supabase
            .from('campaign_players')
            .select('character_id')
            .eq('campaign_id', campaignId);

        if (linkError) {
            console.error("Gagal mengambil link pemain kampanye:", linkError);
            throw linkError;
        }
        
        if (!playerLinks || playerLinks.length === 0) {
            return []; // Kampanye kosong
        }

        const characterIds = playerLinks.map(p => p.character_id);

        // 2. Ambil data lengkap karakter berdasarkan ID yang didapat
        // RLS 'Allow teammates SELECT' akan mengizinkan ini.
        const { data: characters, error: charError } = await supabase
            .from('characters')
            .select('*')
            .in('id', characterIds);
            
        if (charError) {
            console.error("Gagal mengambil data karakter untuk kampanye:", charError);
            throw charError;
        }
        
        return characters || [];
    }

    /**
     * Menggabungkan karakter ke kampanye.
     */
    async joinCampaign(campaignId: string, characterId: string): Promise<CampaignPlayer | null> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase
            .from('campaign_players')
            .insert({
                campaign_id: campaignId,
                character_id: characterId
            })
            .select()
            .single();
            
        if (error) {
            // '23505' adalah kode error 'unique_violation', artinya sudah join.
            if (error.code === '23505') {
                console.log("Karakter sudah ada di kampanye ini.");
                // Kembalikan entri yang ada
                const { data: existing } = await supabase
                    .from('campaign_players')
                    .select('*')
                    .eq('campaign_id', campaignId)
                    .eq('character_id', characterId)
                    .single();
                return existing;
            }
            console.error("Gagal join kampanye:", error);
            throw error;
        }
        return data;
    }

    /**
     * Mengeluarkan karakter dari kampanye.
     */
    async leaveCampaign(campaignId: string, characterId: string): Promise<void> {
        const supabase = this.ensureSupabase();
        const { error } = await supabase
            .from('campaign_players')
            .delete()
            .eq('campaign_id', campaignId)
            .eq('character_id', characterId);
            
        if (error) {
            console.error("Gagal leave kampanye:", error);
            throw error;
        }
        console.log("Karakter berhasil keluar dari kampanye.");
    }
}

// Ekspor instance singleton
export const dataService = new DataService();