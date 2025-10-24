// services/dataService.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Campaign, Character } from '../types';

class DataService {
    private supabase: SupabaseClient | null = null;
    private initPromise: Promise<SupabaseClient | null> | null = null; // Track initialization

    // Fungsi init baru, mengembalikan promise client
    public initialize(url: string, anonKey: string): Promise<SupabaseClient | null> {
        // Jika sudah ada client atau sedang proses init, kembalikan promise yg ada
        if (this.supabase) {
            return Promise.resolve(this.supabase);
        }
        if (this.initPromise) {
            return this.initPromise;
        }

        if (url && anonKey) {
            console.log("Memulai inisialisasi Supabase client...");
            this.initPromise = new Promise(async (resolve, reject) => {
                try {
                    const client = createClient(url, anonKey, {
                        auth: {
                            persistSession: true,
                            autoRefreshToken: true,
                            detectSessionInUrl: false, // Biasanya false untuk SPA
                            storageKey: 'sankaria-supabase-auth' // Key unik biar ga konflik
                        }
                    });
                    // Coba ambil sesi awal untuk memastikan koneksi OK
                    const { data: { session }, error: sessionError } = await client.auth.getSession();
                    if (sessionError) {
                        console.error("Gagal getSession saat init:", sessionError);
                        // Jangan reject, mungkin koneksi network sementara, tapi client tetap dibuat
                    }
                    console.log("Koneksi Supabase berhasil diinisialisasi. Sesi awal:", session ? session.user.id : 'null');
                    this.supabase = client; // Simpan client setelah berhasil
                    resolve(this.supabase);
                } catch (e) {
                    console.error("Gagal membuat klien Supabase:", e);
                    this.supabase = null;
                    this.initPromise = null; // Reset promise on failure
                    reject(e); // Reject promise jika createClient gagal total
                }
            });
            return this.initPromise;
        } else {
            console.warn("URL/Key Supabase kosong, inisialisasi dibatalkan.");
            this.supabase = null;
            return Promise.resolve(null); // Resolve dengan null jika tidak ada kredensial
        }
    }

    // Getter aman untuk client, HARUS dipanggil SETELAH initialize resolve
    private getClient(): SupabaseClient {
        if (!this.supabase) {
            throw new Error("Supabase client belum diinisialisasi atau gagal. Panggil initialize() dan tunggu promise-nya.");
        }
        return this.supabase;
    }

    // --- Method Auth (pakai getClient) ---
    async signInWithFirebaseToken(token: string): Promise<void> {
      // Tidak perlu getClient di sini karena auth ada di instance
      if (!this.supabase) throw new Error("Supabase client belum diinisialisasi.");
      console.log("Mencoba sign in ke Supabase dengan token Firebase (tanpa provider)...");

      // @ts-ignore - Mengabaikan error TS karena 'provider' wajib (workaround)
      const { data, error } = await this.supabase.auth.signInWithIdToken({
        token: token,
      });

      if (error) {
        console.error("Supabase signInWithIdToken gagal:", error);
        throw error;
      }
      if (data && data.user) {
          console.log("Supabase sign in berhasil:", data.user.id);
      } else {
          console.warn("Supabase sign in tidak error, tapi data user null.");
          throw new Error("Supabase sign in succeeded but returned null user data.");
      }
    }

    async signOut(): Promise<void> {
      // Jangan error jika belum init
      if (!this.supabase) return;
      console.log("Signing out from Supabase...");
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        console.error("Supabase signOut gagal:", error);
      } else {
        console.log("Supabase sign out berhasil.");
      }
    }

    // --- Method Data (pakai getClient) ---
    async getCampaigns(): Promise<Campaign[]> {
        try {
            const client = this.getClient();
            const { data, error } = await client.from('campaigns').select('*');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Gagal mengambil kampanye:', error);
            // Fallback ke local storage jika Supabase gagal (opsional)
            // return this.getFromLocalStorage<Campaign[]>('sankaria-campaigns', []);
            throw error; // Atau lempar error saja
        }
    }

    async saveCampaign(campaign: Campaign): Promise<Campaign> {
        try {
            const client = this.getClient();
            const { data, error } = await client.from('campaigns').upsert(campaign).select().single();
            if (error) throw error;
            if (!data) throw new Error("Upsert campaign tidak mengembalikan data.");
            return data;
        } catch (error) {
            console.error('Gagal menyimpan kampanye:', error);
            throw error;
        }
    }

    async saveCampaigns(campaigns: Campaign[]): Promise<Campaign[]> {
        try {
            const client = this.getClient();
            const { data, error } = await client.from('campaigns').upsert(campaigns).select();
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Gagal menyimpan kampanye (plural):', error);
            throw error;
        }
    }

    async getCharacters(): Promise<Character[]> {
        try {
            const client = this.getClient();
            // Policy RLS SELECT characters `USING (auth.role() = 'authenticated')` akan mengizinkan ini
            // Filter by ownerId dilakukan di App.tsx
            const { data, error } = await client.from('characters').select('*');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Gagal mengambil karakter:', error);
            throw error;
        }
    }

    async saveCharacter(characterData: Omit<Character, 'ownerId'> | Character): Promise<Character> {
        try {
            const client = this.getClient();
            // RLS INSERT: CHECK (auth.uid() = "ownerId")
            // RLS UPDATE: USING (auth.uid() = "ownerId") WITH CHECK (auth.uid() = "ownerId")
            const { data, error } = await client.from('characters').upsert(characterData).select().single();
            if (error) throw error;
            if (!data) throw new Error("Upsert character tidak mengembalikan data.");
            return data as Character;
        } catch (error) {
            console.error('Gagal menyimpan karakter:', error);
            throw error;
        }
    }

    async saveCharacters(characters: Character[] | Omit<Character, 'ownerId'>[]): Promise<Character[]> {
        try {
            const client = this.getClient();
            const { data, error } = await client.from('characters').upsert(characters).select();
            if (error) throw error;
            return (data || []) as Character[];
        } catch (error) {
            console.error('Gagal menyimpan karakter (plural):', error);
            throw error;
        }
    }
}

export const dataService = new DataService();