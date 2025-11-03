// services/dataService.ts

import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { 
    Campaign, 
    Character, 
    GameEvent, 
    MonsterInstance, 
    CharacterInventoryItem, 
    ItemDefinition, 
    SpellDefinition, 
    MonsterDefinition,
    AbilityScores,
    CharacterFeature,
    CharacterSpellSlot,
    Skill
} from '../types';

// =================================================================
// TIPE DATABASE (Raw/Mentah sebelum join)
// =================================================================
// Tipe-tipe ini merepresentasikan data 'mentah' di DB sebelum di-join
// Ini adalah praktik yang baik untuk memisahkan tipe DB dari tipe Aplikasi

type DbProfile = {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
};

type DbCharacter = {
    id: string;
    owner_id: string;
    name: string;
    class: string;
    race: string;
    level: number;
    xp: number;
    image: string;
    background: string;
    personality_trait: string;
    ideal: string;
    bond: string;
    flaw: string;
    ability_scores: AbilityScores;
    max_hp: number;
    current_hp: number;
    temp_hp: number;
    armor_class: number;
    speed: number;
    hit_dice: Record<string, { max: number; spent: number }>;
    death_saves: { successes: number; failures: number };
    conditions: string[];
    racial_traits: CharacterFeature[];
    class_features: CharacterFeature[];
    proficient_skills: Skill[];
    proficient_saving_throws: Ability[];
    spell_slots: CharacterSpellSlot[];
};

type DbItemDefinition = ItemDefinition & {
    base_ac: number;
    armor_type: string;
    stealth_disadvantage: boolean;
    strength_requirement: number;
};

type DbCharacterInventory = {
    id: string;
    character_id: string;
    item_id: DbItemDefinition; // Ini akan di-join oleh Supabase
    quantity: number;
    is_equipped: boolean;
};

type DbCharacterSpell = {
    id: string;
    character_id: string;
    spell_id: SpellDefinition; // Ini akan di-join oleh Supabase
};

type DbCampaign = {
    id: string;
    owner_id: string;
    title: string;
    description: string;
    image: string;
    join_code: string;
    is_published: boolean;
    maxPlayers: number;
    theme: string;
    mainGenre: string;
    subGenre: string;
    duration: string;
    isNSFW: boolean;
    dm_personality: string;
    dm_narration_style: 'Deskriptif' | 'Langsung & Percakapan';
    response_length: 'Singkat' | 'Standar' | 'Rinci';
    game_state: 'exploration' | 'combat';
    current_player_id: string | null;
    initiative_order: string[];
    long_term_memory: string;
    current_time: 'Pagi' | 'Siang' | 'Sore' | 'Malam';
    current_weather: 'Cerah' | 'Berawan' | 'Hujan' | 'Badai';
    world_event_counter: number;
    map_image_url?: string;
    map_markers: any[]; // jsonb
    current_player_location?: string;
    quests: any[]; // jsonb
    npcs: any[]; // jsonb
    campaign_players: { character_id: string }[]; // Ini hasil join
};

type DbGameEvent = {
    id: string;
    campaign_id: string;
    timestamp: string;
    turn_id: string;
    type: string;
    character_id: string | null;
    text: string;
    roll: any; // jsonb
    reason: string;
};

type DbMonsterInstance = {
    id: string; // instanceId
    campaign_id: string;
    monster_id: MonsterDefinition; // Ini akan di-join
    name: string; // "Goblin 1"
    current_hp: number;
    conditions: string[];
    initiative: number;
};

type DbCampaignPlayer = {
    id: string;
    campaign_id: string;
    character_id: string;
};


// =================================================================
// KELAS DATA SERVICE
// =================================================================

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

    // =================================================================
    // METODE OTENTIKASI & PROFIL
    // =================================================================
    public async signInWithGoogle() {
        const supabase = this.ensureSupabase();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
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
    
    public async getProfile(userId: string): Promise<DbProfile | null> {
        const supabase = this.ensureSupabase();
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) {
            console.error('Gagal mengambil profil:', error);
            throw error;
        }
        return data;
    }

    public onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        if (!this.supabase) {
            return { data: { subscription: { unsubscribe: () => {} } } };
        }
        return this.supabase.auth.onAuthStateChange(callback);
    }

    // =================================================================
    // METODE KARAKTER (MANDAT 3.4: SSoT KARAKTER)
    // =================================================================

    /**
     * Mengambil SEMUA karakter yang dimiliki oleh user.
     * Ini sekarang juga mengambil data relasional (inventory & spells).
     */
    async getMyCharacters(userId: string): Promise<Character[]> {
        const supabase = this.ensureSupabase();
        
        // 1. Ambil data karakter dasar
        const { data: charData, error: charError } = await supabase
            .from('characters')
            .select('*')
            .eq('owner_id', userId);

        if (charError) {
            console.error('Gagal mengambil karakter:', charError);
            throw charError;
        }

        // 2. Ambil semua data relasional untuk semua karakter user
        const charIds = charData.map(c => c.id);
        if (charIds.length === 0) return [];

        const { data: inventoryData, error: invError } = await supabase
            .from('character_inventory')
            .select('*, item:item_id(*)') // Ambil data inventory DAN join dengan 'items'
            .in('character_id', charIds);
        
        const { data: spellData, error: spellError } = await supabase
            .from('character_spells')
            .select('*, spell:spell_id(*)') // Ambil data spell DAN join dengan 'spells'
            .in('character_id', charIds);

        if (invError) throw invError;
        if (spellError) throw spellError;

        // 3. Gabungkan data menjadi objek Character[] yang lengkap
        const characters: Character[] = charData.map((dbChar: DbCharacter) => {
            
            const inventory: CharacterInventoryItem[] = (inventoryData || [])
                .filter(inv => inv.character_id === dbChar.id)
                .map((inv: any) => ({
                    instanceId: inv.id,
                    item: inv.item as ItemDefinition, // Supabase magic
                    quantity: inv.quantity,
                    isEquipped: inv.is_equipped,
                }));

            const knownSpells: SpellDefinition[] = (spellData || [])
                .filter(spell => spell.character_id === dbChar.id)
                .map((spell: any) => spell.spell as SpellDefinition); // Supabase magic

            return {
                ...dbChar,
                ownerId: dbChar.owner_id,
                inventory,
                knownSpells,
            } as Character;
        });

        return characters;
    }

    /**
     * Menyimpan SATU karakter (SSoT). Ini HANYA menyimpan data di tabel 'characters'.
     * Ini mematuhi Mandat 3.4 (Persistent Character State).
     */
    async saveCharacter(character: Character): Promise<Character> {
        const supabase = this.ensureSupabase();

        // 1. Pisahkan data relasional
        const { inventory, knownSpells, ownerId, id, ...coreData } = character;
        
        const dbChar: Omit<DbCharacter, 'id' | 'owner_id'> = {
            ...coreData,
            // Konversi nama field jika perlu (cth: abilityScores -> ability_scores)
            ability_scores: coreData.abilityScores,
            max_hp: coreData.maxHp,
            current_hp: coreData.currentHp,
            temp_hp: coreData.tempHp,
            armor_class: coreData.armorClass,
            hit_dice: coreData.hitDice,
            death_saves: coreData.deathSaves,
            racial_traits: coreData.racialTraits,
            class_features: coreData.classFeatures,
            proficient_skills: coreData.proficientSkills,
            proficient_saving_throws: coreData.proficientSavingThrows,
            spell_slots: coreData.spellSlots,
            personality_trait: coreData.personalityTrait,
        };

        // 2. Upsert data inti karakter
        const { data, error } = await supabase
            .from('characters')
            .update(dbChar)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Gagal menyimpan karakter:', error);
            throw error;
        }

        // 3. Kembalikan data lengkap (inventory & spells dari input, karena tidak disimpan di sini)
        return { ...(data as DbCharacter), ownerId: data.owner_id, inventory, knownSpells } as Character;
    }
    
    // (Kita akan butuh saveCharacterInventory, saveCharacterSpells, dll. Nanti)

    // =================================================================
    // METODE KAMPANYE (State Sesi)
    // =================================================================

    /**
     * Mengambil SEMUA campaign di mana karakter user terdaftar.
     */
    async getMyCampaigns(myCharacterIds: string[]): Promise<Campaign[]> {
        const supabase = this.ensureSupabase();
        if (myCharacterIds.length === 0) return [];

        // 1. Cari campaign mana saja yang kita ikuti
        const { data: playerLinks, error: linkError } = await supabase
            .from('campaign_players')
            .select('campaign_id')
            .in('character_id', myCharacterIds);

        if (linkError) throw linkError;
        if (!playerLinks || playerLinks.length === 0) return [];

        const campaignIds = [...new Set(playerLinks.map(p => p.campaign_id))]; // Deduplicate

        // 2. Ambil data campaign tersebut
        const { data: campaignsData, error: campaignError } = await supabase
            .from('campaigns')
            .select('*, campaign_players(character_id)')
            .in('id', campaignIds);
            
        if (campaignError) throw campaignError;

        // 3. Format data
        const campaigns: Campaign[] = campaignsData.map((dbCampaign: any) => {
            const { 
                campaign_players, 
                owner_id,
                dm_personality,
                dm_narration_style,
                response_length,
                game_state,
                current_player_id,
                initiative_order,
                long_term_memory,
                current_time,
                current_weather,
                world_event_counter,
                map_image_url,
                map_markers,
                current_player_location,
                join_code,
                is_published,
                mainGenre, // Asumsi nama kolom cocok
                subGenre,
                duration,
                isNSFW,
                maxPlayers,
                theme,
                ...rest 
            } = dbCampaign;
            
            const playerIds = campaign_players.map((p: {character_id: string}) => p.character_id);

            return {
                ...rest,
                ownerId: owner_id,
                joinCode: join_code,
                isPublished: is_published,
                dmPersonality: dm_personality,
                dmNarrationStyle: dm_narration_style,
                responseLength: response_length,
                gameState: game_state,
                currentPlayerId: current_player_id,
                initiativeOrder: initiative_order,
                longTermMemory: long_term_memory,
                currentTime: current_time,
                currentWeather: current_weather,
                worldEventCounter: world_event_counter,
                mapImageUrl: map_image_url,
                mapMarkers: map_markers,
                currentPlayerLocation: current_player_location,
                playerIds: playerIds,
                // Data runtime diinisialisasi sebagai kosong
                eventLog: [],
                monsters: [],
                players: [], 
                choices: [],
                turnId: null,
                maxPlayers: maxPlayers,
                theme: theme,
                mainGenre: mainGenre,
                subGenre: subGenre,
                duration: duration,
                isNSFW: isNSFW,
            } as Campaign;
        });

        return campaigns;
    }
    
    /**
     * Mengambil SEMUA campaign yang dipublikasikan (untuk Marketplace)
     */
    async getPublishedCampaigns(): Promise<Campaign[]> {
        const supabase = this.ensureSupabase();
        
        // Ambil data campaign dan join data players
        const { data: campaignsData, error: campaignError } = await supabase
            .from('campaigns')
            .select('*, campaign_players(character_id)')
            .eq('is_published', true);
            
        if (campaignError) throw campaignError;

        // Format data
        const campaigns: Campaign[] = campaignsData.map((dbCampaign: any) => {
             const { 
                campaign_players, 
                owner_id,
                dm_personality,
                dm_narration_style,
                response_length,
                game_state,
                current_player_id,
                initiative_order,
                long_term_memory,
                current_time,
                current_weather,
                world_event_counter,
                map_image_url,
                map_markers,
                current_player_location,
                join_code,
                is_published,
                mainGenre,
                subGenre,
                duration,
                isNSFW,
                maxPlayers,
                theme,
                ...rest 
            } = dbCampaign;

            const playerIds = campaign_players.map((p: {character_id: string}) => p.character_id);

            return {
                ...rest,
                ownerId: owner_id,
                joinCode: join_code,
                isPublished: is_published,
                dmPersonality: dm_personality,
                dmNarrationStyle: dm_narration_style,
                responseLength: response_length,
                gameState: game_state,
                currentPlayerId: current_player_id,
                initiativeOrder: initiative_order,
                longTermMemory: long_term_memory,
                currentTime: current_time,
                currentWeather: current_weather,
                worldEventCounter: world_event_counter,
                mapImageUrl: map_image_url,
                mapMarkers: map_markers,
                currentPlayerLocation: current_player_location,
                playerIds: playerIds,
                eventLog: [], monsters: [], players: [], 
                choices: [], turnId: null,
                maxPlayers: maxPlayers,
                theme: theme,
                mainGenre: mainGenre,
                subGenre: subGenre,
                duration: duration,
                isNSFW: isNSFW,
            } as Campaign;
        });

        return campaigns;
    }
    
    /**
     * Mencari campaign berdasarkan Join Code
     */
    async getCampaignByJoinCode(joinCode: string): Promise<Campaign | null> {
        const supabase = this.ensureSupabase();
        
        const { data: dbCampaign, error } = await supabase
            .from('campaigns')
            .select('*, campaign_players(character_id)')
            .eq('join_code', joinCode)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // "Not a single row"
                return null;
            }
            console.error("Error mencari campaign by join code:", error);
            throw error;
        }

        if (!dbCampaign) return null;

        // Format data
        const { 
            campaign_players, 
            owner_id,
            dm_personality,
            dm_narration_style,
            response_length,
            game_state,
            current_player_id,
            initiative_order,
            long_term_memory,
            current_time,
            current_weather,
            world_event_counter,
            map_image_url,
            map_markers,
            current_player_location,
            join_code,
            is_published,
            mainGenre,
            subGenre,
            duration,
            isNSFW,
            maxPlayers,
            theme,
            ...rest 
        } = dbCampaign as any;

        const playerIds = campaign_players.map((p: {character_id: string}) => p.character_id);

        return {
            ...rest,
            ownerId: owner_id,
            joinCode: join_code,
            isPublished: is_published,
            dmPersonality: dm_personality,
            dmNarrationStyle: dm_narration_style,
            responseLength: response_length,
            gameState: game_state,
            currentPlayerId: current_player_id,
            initiativeOrder: initiative_order,
            longTermMemory: long_term_memory,
            currentTime: current_time,
            currentWeather: current_weather,
            worldEventCounter: world_event_counter,
            mapImageUrl: map_image_url,
            mapMarkers: map_markers,
            currentPlayerLocation: current_player_location,
            playerIds: playerIds,
            eventLog: [], monsters: [], players: [], 
            choices: [], turnId: null,
            maxPlayers: maxPlayers,
            theme: theme,
            mainGenre: mainGenre,
            subGenre: subGenre,
            duration: duration,
            isNSFW: isNSFW,
        } as Campaign;
    }

    /**
     * Menyimpan SATU campaign. Ini HANYA menyimpan data di tabel 'campaigns'.
     */
    async saveCampaign(campaign: Campaign): Promise<Campaign> {
        const supabase = this.ensureSupabase();

        // 1. Pisahkan data runtime dan relasional
        const { 
            eventLog, monsters, players, playerIds, 
            choices, turnId, thinkingState, activeRollRequest,
            ownerId, id, ...coreData 
        } = campaign;
        
        // 2. Siapkan data untuk DB (konversi camelCase ke snake_case)
        const dbCampaign: Omit<DbCampaign, 'id' | 'owner_id' | 'campaign_players'> = {
            ...coreData,
            owner_id: ownerId,
            join_code: coreData.joinCode,
            is_published: coreData.isPublished,
            dm_personality: coreData.dmPersonality,
            dm_narration_style: coreData.dmNarrationStyle,
            response_length: coreData.responseLength,
            game_state: coreData.gameState,
            current_player_id: coreData.currentPlayerId,
            initiative_order: coreData.initiativeOrder,
            long_term_memory: coreData.longTermMemory,
            current_time: coreData.currentTime,
            current_weather: coreData.currentWeather,
            world_event_counter: coreData.worldEventCounter,
            map_image_url: coreData.mapImageUrl,
            map_markers: coreData.mapMarkers,
            current_player_location: coreData.currentPlayerLocation,
            mainGenre: coreData.mainGenre,
            subGenre: coreData.subGenre,
            maxPlayers: coreData.maxPlayers,
        };

        // 3. Upsert data inti campaign
        const { data, error } = await supabase
            .from('campaigns')
            .upsert(dbCampaign) // Upsert akan update jika ID cocok, atau insert jika tidak
            .eq('id', id) // Tentukan ID untuk update
            .select()
            .single();

        if (error) {
            console.error('Gagal menyimpan campaign:', error);
            throw error;
        }
        
        // 4. Kembalikan data lengkap (termasuk data runtime/relasional dari input)
        const savedData = data as any;
        return { 
            ...campaign, // Kembalikan state runtime asli
            ...coreData, // Timpa dengan data inti yang sudah disimpan
            id: savedData.id,
            ownerId: savedData.owner_id,
            joinCode: savedData.join_code,
            isPublished: savedData.is_published,
            dmPersonality: savedData.dm_personality,
            dmNarrationStyle: savedData.dm_narration_style,
            responseLength: savedData.response_length,
            gameState: savedData.game_state,
            currentPlayerId: savedData.current_player_id,
            initiativeOrder: savedData.initiative_order,
            longTermMemory: savedData.long_term_memory,
            currentTime: savedData.current_time,
            currentWeather: savedData.current_weather,
            worldEventCounter: savedData.world_event_counter,
            mapImageUrl: savedData.map_image_url,
            mapMarkers: savedData.map_markers,
            currentPlayerLocation: savedData.current_player_location,
        };
    }
    
    /**
     * Membuat campaign baru (insert)
     */
    async createCampaign(campaign: Omit<Campaign, 'id' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId'>, ownerId: string): Promise<Campaign> {
        const supabase = this.ensureSupabase();

        const { 
            activeRollRequest, 
            thinkingState,
            ...coreData 
        } = campaign as any; // (any untuk membuang tipe runtime)

        const dbCampaign: Omit<DbCampaign, 'id' | 'owner_id' | 'campaign_players'> & { owner_id: string } = {
            title: coreData.title,
            description: coreData.description,
            image: coreData.image,
            join_code: coreData.joinCode,
            is_published: coreData.isPublished,
            maxPlayers: coreData.maxPlayers,
            theme: coreData.theme,
            mainGenre: coreData.mainGenre,
            subGenre: coreData.subGenre,
            duration: coreData.duration,
            isNSFW: coreData.isNSFW,
            dm_personality: coreData.dmPersonality,
            dm_narration_style: coreData.dmNarrationStyle,
            response_length: coreData.responseLength,
            game_state: coreData.gameState,
            current_player_id: coreData.currentPlayerId,
            initiative_order: coreData.initiativeOrder,
            long_term_memory: coreData.longTermMemory,
            current_time: coreData.currentTime,
            current_weather: coreData.currentWeather,
            world_event_counter: coreData.worldEventCounter,
            map_image_url: coreData.mapImageUrl,
            map_markers: coreData.mapMarkers,
            current_player_location: coreData.currentPlayerLocation,
            quests: coreData.quests,
            npcs: coreData.npcs,
            owner_id: ownerId,
        };
        
        const { data, error } = await supabase
            .from('campaigns')
            .insert(dbCampaign)
            .select()
            .single();

        if (error) {
            console.error('Gagal membuat campaign baru:', error);
            throw error;
        }

        const savedData = data as any;
        // Format kembali ke tipe Campaign
        return {
            ...coreData,
            id: savedData.id,
            ownerId: savedData.owner_id,
            joinCode: savedData.join_code,
            isPublished: savedData.is_published,
            dmPersonality: savedData.dm_personality,
            dmNarrationStyle: savedData.dm_narration_style,
            responseLength: savedData.response_length,
            gameState: savedData.game_state,
            currentPlayerId: savedData.current_player_id,
            initiativeOrder: savedData.initiative_order,
            longTermMemory: savedData.long_term_memory,
            currentTime: savedData.current_time,
            currentWeather: savedData.current_weather,
            worldEventCounter: savedData.world_event_counter,
            mapImageUrl: savedData.map_image_url,
            mapMarkers: savedData.map_markers,
            currentPlayerLocation: savedData.current_player_location,
            // Inisialisasi data runtime
            playerIds: [],
            eventLog: [],
            monsters: [],
            players: [],
            choices: [],
            turnId: null,
        } as Campaign;
    }

    /**
     * Menambahkan player ke campaign
     */
    async addPlayerToCampaign(campaignId: string, characterId: string): Promise<DbCampaignPlayer> {
        const supabase = this.ensureSupabase();
        
        const { data, error } = await supabase
            .from('campaign_players')
            .insert({ campaign_id: campaignId, character_id: characterId })
            .select()
            .single();
            
        if (error) {
            console.error("Gagal menambahkan player ke campaign:", error);
            throw error;
        }
        return data as DbCampaignPlayer;
    }

    // =================================================================
    // METODE RUNTIME (Multiplayer & State Dinamis - Mandat 2.2)
    // =================================================================
    
    /**
     * Mengambil data runtime untuk campaign yang sedang aktif.
     * Ini dipanggil saat 'GameScreen' dimuat.
     */
    async loadCampaignRuntimeData(campaignId: string, playerIds: string[]): Promise<{ 
        eventLog: GameEvent[], 
        monsters: MonsterInstance[],
        players: Character[] // Memuat data SSoT player lain
    }> {
        const supabase = this.ensureSupabase();
        
        // 1. Ambil Event Log
        const { data: events, error: eventError } = await supabase
            .from('game_events')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('timestamp', { ascending: true });
            
        if (eventError) throw eventError;

        // 2. Ambil Monster Instances (dan join stat blocknya)
        const { data: monsterInstances, error: monsterError } = await supabase
            .from('campaign_monsters')
            .select('*, monster:monster_id(*)') // Join dengan tabel 'monsters'
            .eq('campaign_id', campaignId);
            
        if (monsterError) throw monsterError;

        const monsters: MonsterInstance[] = monsterInstances.map((inst: any) => ({
            instanceId: inst.id,
            definition: inst.monster as MonsterDefinition,
            name: inst.name,
            currentHp: inst.current_hp,
            conditions: inst.conditions,
            initiative: inst.initiative
        }));
        
        // 3. Ambil data SSoT semua player di campaign ini (Mandat 2.2 & 3.4)
        const { data: charData, error: charError } = await supabase
            .from('characters')
            .select('*')
            .in('id', playerIds);
            
        if (charError) throw charError;
        
        // 4. Ambil inventory & spell untuk SEMUA player tersebut
        const { data: inventoryData, error: invError } = await supabase
            .from('character_inventory')
            .select('*, item:item_id(*)')
            .in('character_id', playerIds);
        
        const { data: spellData, error: spellError } = await supabase
            .from('character_spells')
            .select('*, spell:spell_id(*)')
            .in('character_id', playerIds);
            
        if (invError) throw invError;
        if (spellError) throw spellError;
        
        // 5. Gabungkan data karakter player
        const players: Character[] = charData.map((dbChar: DbCharacter) => {
            const inventory: CharacterInventoryItem[] = (inventoryData || [])
                .filter(inv => inv.character_id === dbChar.id)
                .map((inv: any) => ({
                    instanceId: inv.id,
                    item: inv.item as ItemDefinition,
                    quantity: inv.quantity,
                    isEquipped: inv.is_equipped,
                }));

            const knownSpells: SpellDefinition[] = (spellData || [])
                .filter(spell => spell.character_id === dbChar.id)
                .map((spell: any) => spell.spell as SpellDefinition);

            return {
                ...dbChar,
                ownerId: dbChar.owner_id,
                abilityScores: dbChar.ability_scores,
                maxHp: dbChar.max_hp,
                currentHp: dbChar.current_hp,
                tempHp: dbChar.temp_hp,
                armorClass: dbChar.armor_class,
                hitDice: dbChar.hit_dice,
                deathSaves: dbChar.death_saves,
                racialTraits: dbChar.racial_traits,
                classFeatures: dbChar.class_features,
                proficientSkills: dbChar.proficient_skills,
                proficientSavingThrows: dbChar.proficient_saving_throws,
                spellSlots: dbChar.spell_slots,
                personalityTrait: dbChar.personality_trait,
                inventory,
                knownSpells,
            } as Character;
        });

        return { eventLog: events as GameEvent[], monsters, players };
    }

    /**
     * Menulis satu event baru ke log. Ini akan memicu RLS dan
     * bisa di-subscribe oleh pemain lain.
     */
    async logGameEvent(event: Omit<GameEvent, 'id' | 'timestamp'> & { campaignId: string }) {
        const supabase = this.ensureSupabase();
        
        const { campaignId, characterId, roll, reason, ...eventData } = event as any;
        
        const dbEvent: Omit<DbGameEvent, 'id' | 'timestamp'> = {
            ...eventData,
            campaign_id: campaignId,
            character_id: characterId || null,
            roll: roll || null,
            reason: reason || null
        }
        
        const { error } = await supabase.from('game_events').insert(dbEvent);
        if (error) {
            console.error("Gagal mencatat event:", error);
            throw error;
        }
    }
}

export const dataService = new DataService();