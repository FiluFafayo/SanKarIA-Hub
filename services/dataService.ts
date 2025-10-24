// services/dataService.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Campaign, Character } from '../types';

class DataService {
    private supabase: SupabaseClient | null = null;

    public init(url: string, anonKey: string) {
        if (url && anonKey && !this.supabase) {
            try {
                this.supabase = createClient(url, anonKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
                console.log("Koneksi Supabase berhasil diinisialisasi.");
            } catch (e) {
                console.error("Gagal menginisialisasi klien Supabase:", e);
                this.supabase = null;
            }
        } else if (!url || !anonKey) {
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

    async signInWithFirebaseToken(token: string): Promise<void> {
      if (!this.supabase) throw new Error("Supabase client belum diinisialisasi.");
      console.log("Mencoba sign in ke Supabase dengan token Firebase...");
      const { data, error } = await this.supabase.auth.signInWithIdToken({
        provider: 'google',
        token: token,
      });

      if (error) {
        console.error("Supabase signInWithIdToken gagal:", error);
        throw error;
      }
      console.log("Supabase sign in berhasil:", data.user?.id);
    }

    async signOut(): Promise<void> {
      if (!this.supabase) return;
      console.log("Signing out from Supabase...");
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        console.error("Supabase signOut gagal:", error);
      } else {
        console.log("Supabase sign out berhasil.");
      }
    }

    async getCampaigns(): Promise<Campaign[]> {
        if (this.supabase) {
            // RLS Policy "Allow authenticated read access" mengizinkan ini
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
            // RLS Policy INSERT dan UPDATE campaigns mengizinkan ini untuk user authenticated
            const { data, error } = await this.supabase.from('campaigns').upsert(campaign).select().single();
            if (error) {
                console.error('Gagal menyimpan kampanye ke Supabase:', error);
                throw error;
            }
            return data;
        } else {
            const campaigns = this.getFromLocalStorage<Campaign[]>('sankaria-campaigns', []);
            const index = campaigns.findIndex(c => c.id === campaign.id);
            if (index > -1) campaigns[index] = campaign;
            else campaigns.push(campaign);
            this.saveToLocalStorage('sankaria-campaigns', campaigns);
            return campaign;
        }
    }

    async saveCampaigns(campaigns: Campaign[]): Promise<Campaign[]> {
        if (this.supabase) {
             // RLS Policy INSERT campaigns mengizinkan ini untuk user authenticated
             const { data, error } = await this.supabase.from('campaigns').upsert(campaigns).select();
             if (error) {
                 console.error('Gagal menyimpan kampanye (plural) ke Supabase:', error);
                 throw error;
             }
             return data || [];
        } else {
             this.saveToLocalStorage('sankaria-campaigns', campaigns);
             return campaigns;
        }
    }

    async getCharacters(): Promise<Character[]> {
        if (this.supabase) {
             // RLS Policy SELECT characters mengizinkan user authenticated membaca semua,
             // tapi kita filter di App.tsx. Atau bisa ubah policy SELECT jadi `USING (auth.uid() = "ownerId")`
             // jika ingin Supabase yang filter. Untuk sekarang, filter di App.tsx lebih fleksibel.
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

    // Menerima data karakter TANPA ownerId untuk insert/update
    async saveCharacter(characterData: Omit<Character, 'ownerId'> | Character): Promise<Character> {
       if (this.supabase) {
           // Upsert akan:
           // - INSERT jika ID belum ada (ownerId diisi default auth.uid() oleh DB, RLS INSERT check auth.uid())
           // - UPDATE jika ID sudah ada (RLS UPDATE check auth.uid() = "ownerId")
           // Kita bisa kirim data dengan atau tanpa ownerId, upsert seharusnya handle
           const { data, error } = await this.supabase.from('characters').upsert(characterData).select().single();
           if (error) {
               console.error('Gagal menyimpan karakter ke Supabase:', error);
               throw error;
           }
           // Supabase mengembalikan data lengkap termasuk ownerId
           return data as Character;
       } else {
           console.warn("Menyimpan karakter ke Local Storage, ownerId mungkin tidak sesuai format Supabase.");
           const characters = this.getFromLocalStorage<Character[]>('sankaria-characters', []);
           // @ts-ignore ownerId mungkin ada atau tidak, paksa tipe untuk local storage
           const charToSave: Character = { ...characterData, ownerId: 'ownerId' in characterData ? characterData.ownerId : 'local-user' };
           const index = characters.findIndex(c => c.id === charToSave.id);
           if (index > -1) characters[index] = charToSave;
           else characters.push(charToSave);
           this.saveToLocalStorage('sankaria-characters', characters);
           return charToSave;
       }
   }

   // Fungsi ini sekarang lebih fokus untuk bulk UPDATE atau INSERT oleh user yang sama
   // Jika insert, ownerId akan diisi otomatis oleh DB. Jika update, RLS akan cek ownerId.
   async saveCharacters(characters: Character[] | Omit<Character, 'ownerId'>[]): Promise<Character[]> {
       if (this.supabase) {
           const { data, error } = await this.supabase.from('characters').upsert(characters).select();
           if (error) {
               console.error('Gagal menyimpan karakter (plural) ke Supabase:', error);
               throw error;
           }
           return (data || []) as Character[];
       } else {
           // Logic local storage mungkin perlu penyesuaian lebih lanjut jika sering dipakai
           console.warn("Menyimpan karakter (plural) ke Local Storage.");
           const allChars = this.getFromLocalStorage<Character[]>('sankaria-characters', []);
           const updatedChars = [...allChars];
           characters.forEach(char => {
               // @ts-ignore ownerId mungkin ada atau tidak
               const charToSave: Character = { ...char, ownerId: 'ownerId' in char ? char.ownerId : 'local-user' };
               const index = updatedChars.findIndex(c => c.id === charToSave.id);
               if (index > -1) updatedChars[index] = charToSave;
               else updatedChars.push(charToSave);
           });
           this.saveToLocalStorage('sankaria-characters', updatedChars);
           // Mengembalikan array input sebagai konfirmasi (mungkin tidak ideal)
           return characters as Character[];
       }
   }
}

export const dataService = new DataService();