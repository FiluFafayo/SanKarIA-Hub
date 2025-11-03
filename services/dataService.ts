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
    Skill,
    Ability
} from '../types';
import { generateId } from '../utils';
import { DEFAULT_CAMPAIGNS } from '../data/defaultCampaigns';
import { getRawCharactersForSeeding, getRawCharacterRelationsForSeeding } from '../data/defaultCharacters';
import { ITEM_DEFINITIONS } from '../data/items';
import { SPELL_DEFINITIONS } from '../data/spells';
import { MONSTER_DEFINITIONS } from '../data/monsters';

// =================================================================
// TIPE DATABASE (Raw/Mentah sebelum join)
// =================================================================

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

type DbItemDefinition = Omit<ItemDefinition, 'baseAc' | 'armorType' | 'stealthDisadvantage' | 'strengthRequirement'> & {
    base_ac: number;
    armor_type: string;
    stealth_disadvantage: boolean;
    strength_requirement: number;
};

type DbCharacterInventory = {
    id: string;
    character_id: string;
    item_id: string; 
    quantity: number;
    is_equipped: boolean;
};

type DbCharacterInventoryJoined = DbCharacterInventory & {
    item: DbItemDefinition
};

type DbCharacterSpell = {
    id: string;
    character_id: string;
    spell_id: string;
};

type DbCharacterSpellJoined = DbCharacterSpell & {
    spell: SpellDefinition
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
    dm_narration_style: 'Deskriptif' | 'Langsung & Percapan';
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
    monster_id: string; 
    name: string; // "Goblin 1"
    current_hp: number;
    conditions: string[];
    initiative: number;
};

type DbMonsterInstanceJoined = DbMonsterInstance & {
    monster: MonsterDefinition
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
    
    // Cache lokal untuk data definisi (Mandat 1.2 Free Tier)
    private itemDefinitions: ItemDefinition[] = [];
    private spellDefinitions: SpellDefinition[] = [];
    private monsterDefinitions: MonsterDefinition[] = [];
    private isSeeding = false;
    private hasSeeded = false;

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
    // METODE SEEDING DATA GLOBAL (Fase 1.E)
    // =================================================================
    public async seedGlobalData() {
        if (this.isSeeding || this.hasSeeded) return;
        this.isSeeding = true;
        
        console.log("Memulai pemeriksaan data global...");
        const supabase = this.ensureSupabase();
        
        try {
            // 1. Cek & Seed Items
            const { count: itemCount } = await supabase.from('items').select('*', { count: 'exact', head: true });
            if (itemCount === 0) {
                console.log("Seeding tabel 'items'...");
                const itemsToSeed = ITEM_DEFINITIONS.map(item => ({
                    ...item,
                    base_ac: item.baseAc,
                    armor_type: item.armorType,
                    stealth_disadvantage: item.stealthDisadvantage,
                    strength_requirement: item.strengthRequirement
                }));
                const { error } = await supabase.from('items').insert(itemsToSeed);
                if (error) throw new Error(`Seeding items gagal: ${error.message}`);
            }

            // 2. Cek & Seed Spells
            const { count: spellCount } = await supabase.from('spells').select('*', { count: 'exact', head: true });
            if (spellCount === 0) {
                console.log("Seeding tabel 'spells'...");
                const spellsToSeed = SPELL_DEFINITIONS.map(spell => ({
                    ...spell,
                    casting_time: spell.castingTime,
                    effect_type: spell.effectType,
                    damage_dice: spell.damageDice,
                    damage_type: spell.damageType,
                    save_required: spell.saveRequired,
                    save_on_success: spell.saveOnSuccess,
                    condition_applied: spell.conditionApplied
                }));
                const { error }_ = await supabase.from('spells').insert(spellsToSeed);
                if (error) throw new Error(`Seeding spells gagal: ${error.message}`);
            }

            // 3. Cek & Seed Monsters
            const { count: monsterCount } = await supabase.from('monsters').select('*', { count: 'exact', head: true });
            if (monsterCount === 0) {
                console.log("Seeding tabel 'monsters'...");
                const monstersToSeed = MONSTER_DEFINITIONS.map(monster => ({
                    ...monster,
                    armor_class: monster.armorClass,
                    max_hp: monster.maxHp,
                    ability_scores: monster.abilityScores,
                    challenge_rating: monster.challengeRating
                }));
                const { error }_ = await supabase.from('monsters').insert(monstersToSeed);
                if (error) throw new Error(`Seeding monsters gagal: ${error.message}`);
            }
            
            // 4. Cache data definisi (PENTING untuk performa)
            const { data: items } = await supabase.from('items').select('*');
            const { data: spells } = await supabase.from('spells').select('*');
            const { data: monsters } = await supabase.from('monsters').select('*');
            
            this.itemDefinitions = (items || []).map(i => ({...i, baseAc: i.base_ac, armorType: i.armor_type, stealthDisadvantage: i.stealth_disadvantage, strengthRequirement: i.strength_requirement})) as ItemDefinition[];
            this.spellDefinitions = (spells || []).map(s => ({...s, castingTime: s.casting_time, effectType: s.effect_type, damageDice: s.damage_dice, damageType: s.damage_type, saveRequired: s.save_required, saveOnSuccess: s.save_on_success, conditionApplied: s.condition_applied })) as SpellDefinition[];
            this.monsterDefinitions = (monsters || []).map(m => ({...m, armorClass: m.armor_class, maxHp: m.max_hp, abilityScores: m.ability_scores, challengeRating: m.challenge_rating})) as MonsterDefinition[];

            console.log(`Data global berhasil di-cache: ${this.itemDefinitions.length} item, ${this.spellDefinitions.length} spell, ${this.monsterDefinitions.length} monster.`);
            this.hasSeeded = true;

        } catch (error) {
            console.error("Gagal melakukan seeding data global:", error);
        } finally {
            this.isSeeding = false;
        }
    }
    
    // Helper untuk mendapatkan cache (untuk fallback jika App.tsx belum siap)
    private async getItemDefinitions(): Promise<ItemDefinition[]> {
        if (this.itemDefinitions.length === 0) await this.seedGlobalData();
        return this.itemDefinitions;
    }
    private async getSpellDefinitions(): Promise<SpellDefinition[]> {
        if (this.spellDefinitions.length === 0) await this.seedGlobalData();
        return this.spellDefinitions;
    }
     private async getMonsterDefinitions(): Promise<MonsterDefinition[]> {
        if (this.monsterDefinitions.length === 0) await this.seedGlobalData();
        return this.monsterDefinitions;
    }


    // =================================================================
    // METODE OTENTIKASI & PROFIL (Tidak Berubah)
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
     * Mengonversi DbCharacterInventoryJoined menjadi CharacterInventoryItem
     */
    private mapDbInventory(dbInv: DbCharacterInventoryJoined): CharacterInventoryItem {
        const itemDef = dbInv.item;
        return {
            instanceId: dbInv.id,
            item: {
                ...itemDef,
                baseAc: itemDef.base_ac,
                armorType: itemDef.armor_type,
                stealthDisadvantage: itemDef.stealth_disadvantage,
                strengthRequirement: itemDef.strength_requirement,
            } as ItemDefinition,
            quantity: dbInv.quantity,
            isEquipped: dbInv.is_equipped,
        };
    }
    
    /**
     * Mengonversi DbCharacterSpellJoined menjadi SpellDefinition
     */
    private mapDbSpell(dbSpell: DbCharacterSpellJoined): SpellDefinition {
         const spellDef = dbSpell.spell;
         return {
            ...spellDef,
            castingTime: spellDef.castingTime,
            effectType: spellDef.effectType,
            damageDice: spellDef.damageDice,
            damageType: spellDef.damageType,
            saveRequired: spellDef.saveRequired,
            saveOnSuccess: spellDef.saveOnSuccess,
            conditionApplied: spellDef.conditionApplied
         } as SpellDefinition;
    }
    
    /**
     * Mengonversi DbCharacter menjadi Character (SSoT)
     */
    private mapDbCharacter(dbChar: DbCharacter, allInventory: DbCharacterInventoryJoined[], allSpells: DbCharacterSpellJoined[]): Character {
        const inventory: CharacterInventoryItem[] = (allInventory || [])
            .filter(inv => inv.character_id === dbChar.id)
            .map(this.mapDbInventory);

        const knownSpells: SpellDefinition[] = (allSpells || [])
            .filter(spell => spell.character_id === dbChar.id)
            .map(this.mapDbSpell);
            
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
        };
    }

    async getMyCharacters(userId: string): Promise<Character[]> {
        const supabase = this.ensureSupabase();
        
        const { data: charData, error: charError } = await supabase
            .from('characters')
            .select('*')
            .eq('owner_id', userId);

        if (charError) throw charError;
        if (charData.length === 0) return [];

        const charIds = charData.map(c => c.id);

        const { data: inventoryData, error: invError } = await supabase
            .from('character_inventory')
            .select('*, item:item_id(*)')
            .in('character_id', charIds);
        
        const { data: spellData, error: spellError } = await supabase
            .from('character_spells')
            .select('*, spell:spell_id(*)')
            .in('character_id', charIds);

        if (invError) throw invError;
        if (spellError) throw spellError;

        const characters: Character[] = charData.map((dbChar: DbCharacter) => 
            this.mapDbCharacter(
                dbChar, 
                inventoryData as DbCharacterInventoryJoined[], 
                spellData as DbCharacterSpellJoined[]
            )
        );
        return characters;
    }

    /**
     * Menyimpan SATU karakter (SSoT).
     */
    async saveCharacter(character: Character): Promise<Character> {
        const supabase = this.ensureSupabase();
        const { inventory, knownSpells, ownerId, id, ...coreData } = character;
        
        const dbChar: Omit<DbCharacter, 'id' | 'owner_id'> = {
            ...coreData,
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
        
        // Kembalikan SSoT lengkap
        return this.mapDbCharacter(data as DbCharacter, inventory.map(i => ({...i, character_id: id, item_id: i.item.id, is_equipped: i.isEquipped, id: i.instanceId, item: i.item as DbItemDefinition})), []);
    }
    
    /**
     * Membuat karakter BARU dan data relasionalnya (Fase 1.E)
     */
    async saveNewCharacter(
        charData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'>,
        inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[],
        spellData: SpellDefinition[],
        ownerId: string
    ): Promise<Character> {
        const supabase = this.ensureSupabase();
        
        // 1. Pastikan cache definisi kita ada
        const allItems = await this.getItemDefinitions();
        const allSpells = await this.getSpellDefinitions();

        // 2. Siapkan data inti karakter
        const coreDbChar: Omit<DbCharacter, 'id' | 'owner_id'> = {
            ...charData,
            owner_id: ownerId, // (ini akan diabaikan oleh insert, tapi untuk tipe)
            ability_scores: charData.abilityScores,
            max_hp: charData.maxHp,
            current_hp: charData.currentHp,
            temp_hp: charData.tempHp,
            armor_class: charData.armorClass,
            hit_dice: charData.hitDice,
            death_saves: charData.deathSaves,
            racial_traits: charData.racialTraits,
            class_features: charData.classFeatures,
            proficient_skills: charData.proficientSkills,
            proficient_saving_throws: charData.proficientSavingThrows,
            spell_slots: charData.spellSlots,
            personality_trait: charData.personalityTrait,
        };

        // 3. Insert karakter baru
        const { data: newDbCharacter, error: charError } = await supabase
            .from('characters')
            .insert({ ...coreDbChar, owner_id: ownerId })
            .select()
            .single();
        
        if (charError) throw new Error(`Gagal menyimpan karakter baru: ${charError.message}`);
        
        const newCharacterId = newDbCharacter.id;

        // 4. Siapkan data relasional (Inventory)
        const inventoryToInsert: Omit<DbCharacterInventory, 'id' | 'character_id'>[] = inventoryData.map(inv => {
            const definition = allItems.find(def => def.name === inv.item.name);
            if (!definition) throw new Error(`Item definition cache miss: ${inv.item.name}`);
            return {
                item_id: definition.id,
                quantity: inv.quantity,
                is_equipped: inv.isEquipped,
                character_id: newCharacterId // Tambahkan ID karakter baru
            };
        });
        
        // 5. Siapkan data relasional (Spells)
        const spellsToInsert: Omit<DbCharacterSpell, 'id' | 'character_id'>[] = spellData.map(sp => {
            const definition = allSpells.find(def => def.name === sp.name);
            if (!definition) throw new Error(`Spell definition cache miss: ${sp.name}`);
            return {
                spell_id: definition.id,
                character_id: newCharacterId // Tambahkan ID karakter baru
            };
        });

        // 6. Batch insert data relasional
        if (inventoryToInsert.length > 0) {
            const { error: invError } = await supabase.from('character_inventory').insert(inventoryToInsert);
            if (invError) console.error("Gagal menyimpan inventory awal:", invError);
        }
        if (spellsToInsert.length > 0) {
            const { error: spellError } = await supabase.from('character_spells').insert(spellsToInsert);
            if (spellError) console.error("Gagal menyimpan spell awal:", spellError);
        }

        // 7. Ambil kembali data lengkap untuk SSoT
        const { data: finalInventory }_ = await supabase.from('character_inventory').select('*, item:item_id(*)').eq('character_id', newCharacterId);
        const { data: finalSpells }_ = await supabase.from('character_spells').select('*, spell:spell_id(*)').eq('character_id', newCharacterId);

        return this.mapDbCharacter(newDbCharacter as DbCharacter, finalInventory as DbCharacterInventoryJoined[], finalSpells as DbCharacterSpellJoined[]);
    }


    // =================================================================
    // METODE KAMPANYE (State Sesi)
    // =================================================================
    
    private mapDbCampaign(dbCampaign: DbCampaign): Campaign {
        const { 
            campaign_players, owner_id, dm_personality, dm_narration_style, response_length,
            game_state, current_player_id, initiative_order, long_term_memory, current_time,
            current_weather, world_event_counter, map_image_url, map_markers, 
            current_player_location, join_code, is_published,
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
        } as Campaign;
    }

    async getMyCampaigns(myCharacterIds: string[]): Promise<Campaign[]> {
        const supabase = this.ensureSupabase();
        if (myCharacterIds.length === 0) return [];

        const { data: playerLinks, error: linkError } = await supabase
            .from('campaign_players')
            .select('campaign_id')
            .in('character_id', myCharacterIds);

        if (linkError) throw linkError;
        if (!playerLinks || playerLinks.length === 0) return [];

        const campaignIds = [...new Set(playerLinks.map(p => p.campaign_id))];

        const { data: campaignsData, error: campaignError } = await supabase
            .from('campaigns')
            .select('*, campaign_players(character_id)')
            .in('id', campaignIds);
            
        if (campaignError) throw campaignError;
        
        return campaignsData.map(dbCampaign => this.mapDbCampaign(dbCampaign as DbCampaign));
    }
    
    async getPublishedCampaigns(): Promise<Campaign[]> {
        const supabase = this.ensureSupabase();
        
        const { data: campaignsData, error: campaignError } = await supabase
            .from('campaigns')
            .select('*, campaign_players(character_id)')
            .eq('is_published', true);
            
        if (campaignError) throw campaignError;
        
        return campaignsData.map(dbCampaign => this.mapDbCampaign(dbCampaign as DbCampaign));
    }
    
    async getCampaignByJoinCode(joinCode: string): Promise<Campaign | null> {
        const supabase = this.ensureSupabase();
        
        const { data: dbCampaign, error } = await supabase
            .from('campaigns')
            .select('*, campaign_players(character_id)')
            .eq('join_code', joinCode.toUpperCase()) // Pastikan case-insensitive
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            console.error("Error mencari campaign by join code:", error);
            throw error;
        }
        if (!dbCampaign) return null;
        
        return this.mapDbCampaign(dbCampaign as DbCampaign);
    }

    async saveCampaign(campaign: Campaign): Promise<Campaign> {
        const supabase = this.ensureSupabase();

        const { 
            eventLog, monsters, players, playerIds, 
            choices, turnId, thinkingState, activeRollRequest,
            ownerId, id, ...coreData 
        } = campaign as CampaignState;
        
        const dbCampaign: Partial<DbCampaign> = { // Gunakan Partial untuk update
            ...coreData,
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
        };
        
        // Hapus 'undefined' properties agar Supabase tidak error
        Object.keys(dbCampaign).forEach(key => dbCampaign[key as keyof typeof dbCampaign] === undefined && delete dbCampaign[key as keyof typeof dbCampaign]);

        const { data, error } = await supabase
            .from('campaigns')
            .update(dbCampaign)
            .eq('id', id)
            .select('*, campaign_players(character_id)')
            .single();

        if (error) {
            console.error('Gagal menyimpan campaign:', error);
            throw error;
        }
        
        return this.mapDbCampaign(data as DbCampaign);
    }
    
    async createCampaign(campaign: Omit<Campaign, 'id' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId' | 'initiativeOrder'>, ownerId: string): Promise<Campaign> {
        const supabase = this.ensureSupabase();

        const { ...coreData } = campaign;

        const dbCampaign: Omit<DbCampaign, 'id' | 'owner_id' | 'campaign_players'> & { owner_id: string } = {
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
        return this.mapDbCampaign({ ...savedData, campaign_players: [] });
    }

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
    
    async loadCampaignRuntimeData(campaignId: string, playerIds: string[]): Promise<{ 
        eventLog: GameEvent[], 
        monsters: MonsterInstance[],
        players: Character[]
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
            .select('*, monster:monster_id(*)')
            .eq('campaign_id', campaignId);
            
        if (monsterError) throw monsterError;

        const monsters: MonsterInstance[] = monsterInstances.map((inst: any) => ({
            instanceId: inst.id,
            definition: { ...inst.monster, armorClass: inst.monster.armor_class, maxHp: inst.monster.max_hp, abilityScores: inst.monster.ability_scores, challengeRating: inst.monster.challenge_rating } as MonsterDefinition,
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
        const players: Character[] = charData.map((dbChar: DbCharacter) => 
            this.mapDbCharacter(
                dbChar, 
                inventoryData as DbCharacterInventoryJoined[], 
                spellData as DbCharacterSpellJoined[]
            )
        );
        
        return { eventLog: events as GameEvent[], monsters, players };
    }

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