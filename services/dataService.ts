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

// (Tipe-tipe DB mentah tetap sama)
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
    // FASE 1: Tambahkan data visual
    gender: string;
    body_type: string;
    scars: string[];
    hair: string;
    facial_hair: string;
    head_accessory: string;
    // AKHIR FASE 1
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

type DbItemDefinition = {
    id: string;
    name: string;
    description?: string;
    type: 'weapon' | 'armor' | 'consumable' | 'tool' | 'other';
    is_magical: boolean;
    rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';
    requires_attunement: boolean;
    bonuses?: { attack?: number; damage?: number; ac?: number };
    damage_dice?: string;
    damage_type?: string;
    base_ac?: number;
    armor_type?: 'light' | 'medium' | 'heavy' | 'shield';
    stealth_disadvantage?: boolean;
    strength_requirement?: number;
    effect?: { type: 'heal' | 'damage'; dice: string };
};

type DbSpellDefinition = {
    id: string;
    name: string;
    level: number;
    description: string;
    casting_time: 'action' | 'bonus_action' | 'reaction' | 'minute' | 'hour';
    range: string;
    components: ('V' | 'S' | 'M')[];
    duration: string;
    school: string;
    effect_type: 'damage' | 'heal' | 'buff' | 'debuff' | 'control' | 'utility';
    damage_dice?: string;
    damage_type?: string;
    save_required?: Ability;
    save_on_success?: 'half_damage' | 'no_effect';
    condition_applied?: string;
};

type DbMonsterDefinition = {
    id: string;
    name: string;
    armor_class: number;
    max_hp: number;
    ability_scores: AbilityScores;
    skills: Partial<Record<Skill, number>>;
    traits: { name: string; description: string }[];
    actions: { name: string; toHitBonus?: number; damageDice?: string; description?: string }[];
    senses: { darkvision: number; passivePerception: number; tremorsense?: number; truesight?: number };
    languages: string[];
    challenge_rating: number;
    xp: number;
};


type DbCharacterInventory = {
    id: string;
    character_id: string;
    item_id: string;
    quantity: number;
    is_equipped: boolean;
};

type DbCharacterInventoryJoined = Omit<DbCharacterInventory, 'item_id'> & {
    item: DbItemDefinition
};

type DbCharacterSpell = {
    id: string;
    character_id: string;
    spell_id: string;
};

type DbCharacterSpellJoined = Omit<DbCharacterSpell, 'spell_id'> & {
    spell: DbSpellDefinition
};

type DbCampaign = {
    id: string;
    owner_id: string;
    title: string;
    description: string; // FASE 1: Menambahkan properti yang hilang
    image: string; // FASE 1: Menambahkan properti yang hilang
    join_code: string; // FASE 1: Menambahkan properti yang hilang
    is_published: boolean; // FASE 1: Menambahkan properti yang hilang
    maxPlayers: number; // FASE 1: Menambahkan properti yang hilang
    theme: string; // FASE 1: Menambahkan properti yang hilang
    mainGenre: string; // FASE 1: Menambahkan properti yang hilang
    subGenre: string; // FASE 1: Menambahkan properti yang hilang
    duration: string; // FASE 1: Menambahkan properti yang hilang
    isNSFW: boolean; // FASE 1: Menambahkan properti yang hilang
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
    current_time: number; // FASE 1: Diubah ke number (bigint)
    current_weather: 'Cerah' | 'Berawan' | 'Hujan' | 'Badai';
    world_event_counter: number;
    map_image_url?: string;
    map_markers: any[]; // jsonb
    // FASE 1: Tambahkan kolom peta
    exploration_grid: any; // jsonb
    fog_of_war: any; // jsonb
    battle_state: any; // jsonb
    player_grid_position: any; // jsonb
    // AKHIR FASE 1
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

type DbMonsterInstanceJoined = Omit<DbMonsterInstance, 'monster_id'> & {
    monster: DbMonsterDefinition
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

    private itemDefinitions: ItemDefinition[] = [];
    private spellDefinitions: SpellDefinition[] = [];
    private monsterDefinitions: MonsterDefinition[] = [];
    private isLoadingCache = false;
    private hasLoadedCache = false;

    public init(url: string, anonKey: string) {
        if (url && anonKey && (!this.supabase || this.supabase.supabaseUrl !== url)) {
            try {
                this.supabase = createClient(url, anonKey);
                // console.log("Koneksi Supabase berhasil diinisialisasi."); // Dihapus (Pembersihan)
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
    // METODE CACHING DATA GLOBAL (Sudah Benar)
    // =================================================================
    public async cacheGlobalData() {
        if (this.isLoadingCache || this.hasLoadedCache) return;
        this.isLoadingCache = true;

        const supabase = this.ensureSupabase();

        try {
            const { data: items, error: itemError } = await supabase.from('items').select('*');
            if (itemError) throw new Error(`Gagal mengambil items: ${itemError.message}`);

            const { data: spells, error: spellError } = await supabase.from('spells').select('*');
            if (spellError) throw new Error(`Gagal mengambil spells: ${spellError.message}`);

            const { data: monsters, error: monsterError } = await supabase.from('monsters').select('*');
            if (monsterError) throw new Error(`Gagal mengambil monsters: ${monsterError.message}`);

            this.itemDefinitions = (items || []).map(this.mapDbItemToApp);
            this.spellDefinitions = (spells || []).map(this.mapDbSpellToApp);
            this.monsterDefinitions = (monsters || []).map(this.mapDbMonsterToApp);

            this.hasLoadedCache = true;

        } catch (error) {
            console.error("Gagal melakukan caching data global:", error);
            this.hasLoadedCache = false;
            this.isLoadingCache = false;
            throw error;
        } finally {
            this.isLoadingCache = false;
        }
    }

    // =================================================================
    // HELPER MAPPING (DB -> APP) (Sudah Benar)
    // =================================================================

    private mapDbItemToApp = (dbItem: DbItemDefinition): ItemDefinition => ({
        id: dbItem.id,
        name: dbItem.name,
        description: dbItem.description,
        type: dbItem.type,
        isMagical: dbItem.is_magical,
        rarity: dbItem.rarity,
        requiresAttunement: dbItem.requires_attunement,
        bonuses: dbItem.bonuses,
        damageDice: dbItem.damage_dice,
        damageType: dbItem.damage_type,
        baseAc: dbItem.base_ac,
        armorType: dbItem.armor_type,
        stealthDisadvantage: dbItem.stealth_disadvantage,
        strengthRequirement: dbItem.strength_requirement,
        effect: dbItem.effect
    });

    private mapDbSpellToApp = (dbSpell: DbSpellDefinition): SpellDefinition => ({
        id: dbSpell.id,
        name: dbSpell.name,
        level: dbSpell.level,
        description: dbSpell.description,
        castingTime: dbSpell.casting_time,
        range: dbSpell.range,
        components: dbSpell.components,
        duration: dbSpell.duration,
        school: dbSpell.school,
        effectType: dbSpell.effect_type,
        damageDice: dbSpell.damage_dice,
        damageType: dbSpell.damage_type,
        saveRequired: dbSpell.save_required,
        saveOnSuccess: dbSpell.save_on_success,
        conditionApplied: dbSpell.condition_applied
    });

    private mapDbMonsterToApp = (dbMonster: DbMonsterDefinition): MonsterDefinition => ({
        id: dbMonster.id,
        name: dbMonster.name,
        armorClass: dbMonster.armor_class,
        maxHp: dbMonster.max_hp,
        abilityScores: dbMonster.ability_scores,
        skills: dbMonster.skills,
        traits: dbMonster.traits,
        actions: dbMonster.actions,
        senses: dbMonster.senses,
        languages: dbMonster.languages,
        challengeRating: dbMonster.challenge_rating,
        xp: dbMonster.xp
    });

    // Helper untuk mendapatkan cache (Sudah Benar)
    private async getItemDefinitions(): Promise<ItemDefinition[]> {
        if (!this.hasLoadedCache && !this.isLoadingCache) await this.cacheGlobalData();
        return this.itemDefinitions;
    }
    private async getSpellDefinitions(): Promise<SpellDefinition[]> {
        if (!this.hasLoadedCache && !this.isLoadingCache) await this.cacheGlobalData();
        return this.spellDefinitions;
    }
    private async getMonsterDefinitions(): Promise<MonsterDefinition[]> {
        if (!this.hasLoadedCache && !this.isLoadingCache) await this.cacheGlobalData();
        return this.monsterDefinitions;
    }

    // REFAKTOR G-5/Pembersihan: Fungsi-fungsi 'find...Definition' yang usang dihapus.
    // Aplikasi sekarang harus menggunakan data/registry.ts

    // =================================================================
    // METODE OTENTIKASI & PROFIL (Sudah Benar)
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

    // REFAKTOR G-4/Pembersihan: Fungsi ini tidak (lagi) digunakan.
    // public async getProfile(userId: string): Promise<DbProfile | null> {
    //     const supabase = this.ensureSupabase();
    //     const { data, error } = await supabase
    //         .from('profiles')
    //         .select('*')
    //         .eq('id', userId)
    //         .single();

    //     if (error) {
    //         if (error.code !== 'PGRST116') {
    //             console.error('Gagal mengambil profil:', error);
    //         }
    //         return null;
    //     }
    //     return data;
    // }

    public onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        if (!this.supabase) {
            return { data: { subscription: { unsubscribe: () => { } } } };
        }
        return this.supabase.auth.onAuthStateChange(callback);
    }

    // =================================================================
    // METODE KARAKTER (MANDAT 3.4: SSoT KARAKTER)
    // =================================================================

    private mapDbInventory(dbInv: DbCharacterInventoryJoined): CharacterInventoryItem {
        return {
            instanceId: dbInv.id,
            item: this.mapDbItemToApp(dbInv.item),
            quantity: dbInv.quantity,
            isEquipped: dbInv.is_equipped,
        };
    }

    private mapDbSpell(dbSpell: DbCharacterSpellJoined): SpellDefinition {
        return this.mapDbSpellToApp(dbSpell.spell);
    }

    private mapDbCharacter(dbChar: DbCharacter, allInventory: DbCharacterInventoryJoined[], allSpells: DbCharacterSpellJoined[]): Character {
        const inventory: CharacterInventoryItem[] = (allInventory || [])
            .filter(inv => inv.character_id === dbChar.id)
            .map(this.mapDbInventory.bind(this));

        const knownSpells: SpellDefinition[] = (allSpells || [])
            .filter(spell => spell.character_id === dbChar.id)
            .map(this.mapDbSpell.bind(this));

        // --- VERSI LENGKAP DENGAN BIDANG VISUAL ---
        return {
            id: dbChar.id,
            ownerId: dbChar.owner_id,
            name: dbChar.name,
            class: dbChar.class,
            race: dbChar.race,
            level: dbChar.level,
            xp: dbChar.xp,
            image: dbChar.image,

            // --- TAMBAHKAN BIDANG YANG HILANG INI ---
            gender: dbChar.gender as 'Pria' | 'Wanita', // Ambil dari DB
            bodyType: dbChar.body_type,                   // Ambil dari DB
            scars: dbChar.scars || [],                    // Ambil dari DB (dengan fallback)
            hair: dbChar.hair,                            // Ambil dari DB
            facialHair: dbChar.facial_hair,               // Ambil dari DB
            headAccessory: dbChar.head_accessory,         // Ambil dari DB
            // ------------------------------------

            background: dbChar.background,
            personalityTrait: dbChar.personality_trait || '',
            ideal: dbChar.ideal || '',
            bond: dbChar.bond || '',
            flaw: dbChar.flaw || '',
            abilityScores: dbChar.ability_scores,
            maxHp: dbChar.max_hp,
            currentHp: dbChar.current_hp,
            tempHp: dbChar.temp_hp,
            armorClass: dbChar.armor_class,
            speed: dbChar.speed,
            hitDice: dbChar.hit_dice,
            deathSaves: dbChar.death_saves,
            conditions: dbChar.conditions || [],
            racialTraits: dbChar.racial_traits || [],
            classFeatures: dbChar.class_features || [],
            proficientSkills: dbChar.proficient_skills || [],
            proficientSavingThrows: dbChar.proficient_saving_throws || [],
            spellSlots: dbChar.spell_slots || [],
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
        if (!charData || charData.length === 0) return [];

        const charIds = charData.map(c => c.id);

        const { data: inventoryData, error: invError } = await supabase
            .from('character_inventory')
            .select('*, item:item_id!inner(*)')
            .in('character_id', charIds);

        const { data: spellData, error: spellError } = await supabase
            .from('character_spells')
            .select('*, spell:spell_id!inner(*)')
            .in('character_id', charIds);

        // Tidak error jika inventory/spell kosong, tapi log jika ada error lain
        if (invError && invError.code !== 'PGRST116') throw invError;
        if (spellError && spellError.code !== 'PGRST116') throw spellError;

        const characters: Character[] = charData.map((dbChar: DbCharacter) =>
            this.mapDbCharacter(
                dbChar,
                (inventoryData || []) as DbCharacterInventoryJoined[],
                (spellData || []) as DbCharacterSpellJoined[]
            )
        );
        return characters;
    }

    async saveCharacter(character: Character): Promise<Character> {
        const supabase = this.ensureSupabase();
        // Saring properti runtime sebelum mengirim ke DB
        const {
            inventory, knownSpells, ownerId, id,
            usedBonusAction, usedReaction, // <- KELUARKAN INI
            ...coreData
        } = character as any;

        // =================================================================
        // PERBAIKAN BUG CAMELCASE (saveCharacter)
        // Hapus spread operator, petakan manual
        // =================================================================
        const dbChar: Omit<DbCharacter, 'id' | 'owner_id'> = {
            name: coreData.name,
            class: coreData.class,
            race: coreData.race,
            level: coreData.level,
            xp: coreData.xp,
            image: coreData.image,
            // FASE 1: Petakan data visual
            gender: coreData.gender,
            body_type: coreData.bodyType,
            scars: coreData.scars,
            hair: coreData.hair,
            facial_hair: coreData.facialHair,
            head_accessory: coreData.headAccessory,
            // AKHIR FASE 1
            background: coreData.background,
            personality_trait: coreData.personalityTrait,
            ideal: coreData.ideal,
            bond: coreData.bond,
            flaw: coreData.flaw,
            ability_scores: coreData.abilityScores,
            max_hp: coreData.maxHp,
            current_hp: coreData.currentHp,
            temp_hp: coreData.tempHp,
            armor_class: coreData.armorClass,
            speed: coreData.speed,
            hit_dice: coreData.hitDice,
            death_saves: coreData.deathSaves,
            conditions: coreData.conditions,
            racial_traits: coreData.racialTraits,
            class_features: coreData.classFeatures,
            proficient_skills: coreData.proficientSkills,
            proficient_saving_throws: coreData.proficientSavingThrows,
            spell_slots: coreData.spellSlots,
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

        const joinedInventory = inventory.map(i => ({
            ...i,
            character_id: id,
            item_id: i.item.id,
            is_equipped: i.isEquipped,
            id: i.instanceId,
            item: {
                ...i.item,
                is_magical: i.item.isMagical,
                requires_attunement: i.item.requiresAttunement,
                damage_dice: i.item.damageDice,
                damage_type: i.item.damageType,
                base_ac: i.item.baseAc,
                armor_type: i.item.armorType,
                stealth_disadvantage: i.item.stealthDisadvantage,
                strength_requirement: i.item.strengthRequirement
            }
        })) as DbCharacterInventoryJoined[];

        const joinedSpells = knownSpells.map(s => ({
            id: s.id,
            character_id: id,
            spell_id: s.id,
            spell: {
                ...s,
                casting_time: s.castingTime,
                effect_type: s.effectType,
                damage_dice: s.damageDice,
                damage_type: s.damageType,
                save_required: s.saveRequired,
                save_on_success: s.saveOnSuccess,
                condition_applied: s.conditionApplied
            }
        })) as DbCharacterSpellJoined[];

        return this.mapDbCharacter(data as DbCharacter, joinedInventory, joinedSpells);
    }

    async saveNewCharacter(
        charData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'>,
        inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[],
        spellData: SpellDefinition[],
        ownerId: string
    ): Promise<Character> {
        const supabase = this.ensureSupabase();

        const allItems = await this.getItemDefinitions();
        const allSpells = await this.getSpellDefinitions();

        // =================================================================
        // PERBAIKAN BUG CAMELCASE (saveNewCharacter)
        // Hapus spread operator, petakan manual
        // =================================================================
        const coreDbChar: Omit<DbCharacter, 'id' | 'owner_id'> = {
            name: charData.name,
            class: charData.class,
            race: charData.race,
            level: charData.level,
            xp: charData.xp,
            image: charData.image,
            // FASE 1: Petakan data visual
            gender: charData.gender,
            body_type: charData.bodyType,
            scars: charData.scars,
            hair: charData.hair,
            facial_hair: charData.facialHair,
            head_accessory: charData.headAccessory,
            // AKHIR FASE 1
            background: charData.background,
            personality_trait: charData.personalityTrait,
            ideal: charData.ideal,
            bond: charData.bond,
            flaw: charData.flaw,
            ability_scores: charData.abilityScores,
            max_hp: charData.maxHp,
            current_hp: charData.currentHp,
            temp_hp: charData.tempHp,
            armor_class: charData.armorClass,
            speed: charData.speed,
            hit_dice: charData.hitDice,
            death_saves: charData.deathSaves,
            conditions: charData.conditions,
            racial_traits: charData.racialTraits,
            class_features: charData.classFeatures,
            proficient_skills: charData.proficientSkills,
            proficient_saving_throws: charData.proficientSavingThrows,
            spell_slots: charData.spellSlots,
        };

        const { data: newDbCharacter, error: charError } = await supabase
            .from('characters')
            .insert({ ...coreDbChar, owner_id: ownerId })
            .select()
            .single();

        if (charError) throw new Error(`Gagal menyimpan karakter baru: ${charError.message}`);

        const newCharacterId = newDbCharacter.id;

        const inventoryToInsert: Omit<DbCharacterInventory, 'id'>[] = inventoryData.map(inv => {
            // FIX: Lakukan lookup item ID dari cache 'allItems' menggunakan nama item
            const definition = allItems.find(item => item.name.toLowerCase() === inv.item.name.toLowerCase());

            if (!definition || !definition.id) {
                throw new Error(`[saveNewCharacter] Gagal menemukan ID database yang valid untuk item: ${inv.item.name}`);
            }

            return {
                character_id: newCharacterId,
                item_id: definition.id, // <-- Gunakan ID yang sudah di-lookup
                quantity: inv.quantity,
                is_equipped: inv.isEquipped,
            };
        });

        const spellsToInsert: Omit<DbCharacterSpell, 'id'>[] = spellData.map(sp => {
            // FIX: Lakukan lookup spell ID dari cache 'allSpells' menggunakan nama spell
            const definition = allSpells.find(spell => spell.name.toLowerCase() === sp.name.toLowerCase());

            if (!definition || !definition.id) {
                throw new Error(`[saveNewCharacter] Gagal menemukan ID database yang valid untuk spell: ${sp.name}`);
            }

            return {
                character_id: newCharacterId,
                spell_id: definition.id, // <-- Gunakan ID yang sudah di-lookup
            };
        });

        if (inventoryToInsert.length > 0) {
            const { error: invError } = await supabase.from('character_inventory').insert(inventoryToInsert);
            if (invError) console.error("Gagal menyimpan inventory awal:", invError);
        }
        if (spellsToInsert.length > 0) {
            const { error: spellError } = await supabase.from('character_spells').insert(spellsToInsert);
            if (spellError) console.error("Gagal menyimpan spell awal:", spellError);
        }

        const { data: finalInventory } = await supabase.from('character_inventory').select('*, item:item_id!inner(*)').eq('character_id', newCharacterId);
        const { data: finalSpells } = await supabase.from('character_spells').select('*, spell:spell_id!inner(*)').eq('character_id', newCharacterId);

        return this.mapDbCharacter(
            newDbCharacter as DbCharacter,
            (finalInventory || []) as DbCharacterInventoryJoined[],
            (finalSpells || []) as DbCharacterSpellJoined[]
        );
    }


    // =================================================================
    // METODE KAMPANYE (State Sesi) (Sudah Benar)
    // =================================================================

    private mapDbCampaign(dbCampaign: DbCampaign): Campaign {
        const {
            campaign_players, owner_id, dm_personality, dm_narration_style, response_length,
            game_state, current_player_id, initiative_order, long_term_memory, current_time,
            current_weather, world_event_counter, map_image_url, map_markers,
            current_player_location, join_code, is_published,
            quests, npcs, // <-- TAMBAHKAN INI
            ...rest
        } = dbCampaign as any;

        const playerIds = (campaign_players || []).map((p: { character_id: string }) => p.character_id);

        return {
            ...rest,
            quests: quests || [], // <-- TAMBAHKAN INI
            npcs: npcs || [], // <-- TAMBAHKAN INI
            ownerId: owner_id,
            joinCode: join_code,
            isPublished: is_published,
            dmPersonality: dm_personality,
            dmNarrationStyle: dm_narration_style,
            responseLength: response_length,
            gameState: game_state,
            currentPlayerId: current_player_id,
            initiativeOrder: initiative_order || [], // Map snake_case ke camelCase + beri fallback array kosong
            long_term_memory: long_term_memory,
            currentTime: parseInt(current_time, 10) || 43200, // FASE 1: Konversi bigint (string) ke number
            currentWeather: current_weather,
            worldEventCounter: world_event_counter,
            mapImageUrl: map_image_url,
            mapMarkers: map_markers,
            currentPlayerLocation: current_player_location,
            // FASE 1: Muat data peta
            explorationGrid: dbCampaign.exploration_grid || [],
            fogOfWar: dbCampaign.fog_of_war || [],
            battleState: dbCampaign.battle_state || null,
            playerGridPosition: dbCampaign.player_grid_position || { x: 50, y: 50 },
            // AKHIR FASE 1
            playerIds: playerIds,
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

        return campaignsData.map(dbCampaign => this.mapDbCampaign(dbCampaign as any));
    }

    async getPublishedCampaigns(): Promise<Campaign[]> {
        const supabase = this.ensureSupabase();

        const { data: campaignsData, error: campaignError } = await supabase
            .from('campaigns')
            .select('*, campaign_players(character_id)')
            .eq('is_published', true);

        if (campaignError) throw campaignError;

        return campaignsData.map(dbCampaign => this.mapDbCampaign(dbCampaign as any));
    }

    async getCampaignByJoinCode(joinCode: string): Promise<Campaign | null> {
        const supabase = this.ensureSupabase();

        const { data: dbCampaign, error } = await supabase
            .from('campaigns')
            .select('*, campaign_players(character_id)')
            .eq('join_code', joinCode.toUpperCase())
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            console.error("Error mencari campaign by join code:", error);
            throw error;
        }
        if (!dbCampaign) return null;

        return this.mapDbCampaign(dbCampaign as any);
    }

    async saveCampaign(campaign: Campaign): Promise<Campaign> {
        const supabase = this.ensureSupabase();

        // Destrukturisasi state runtime dan SSoT
        const {
            eventLog, monsters, players, playerIds,
            choices, turnId, thinkingState, activeRollRequest,
            ownerId, id,
            // Ambil data SSoT (camelCase)
            title, description, image, joinCode, isPublished, maxPlayers, theme,
            mainGenre, subGenre, duration, isNSFW, dmPersonality, dmNarrationStyle,
            responseLength, gameState, currentPlayerId, initiativeOrder, longTermMemory,
            currentTime, currentWeather, worldEventCounter, mapImageUrl, mapMarkers,
            currentPlayerLocation, quests, npcs,
            // FASE 1: Ambil data peta
            explorationGrid, fogOfWar, battleState, playerGridPosition
        } = campaign as CampaignState;

        // BUGFIX G-1: Petakan manual camelCase (App) ke snake_case (DB)
        // Penggunaan ...spread operator sebelumnya menyebabkan silent failure
        const dbCampaign: Omit<DbCampaign, 'id' | 'owner_id' | 'campaign_players'> = {
            title: title,
            description: description,
            image: image,
            join_code: joinCode,
            is_published: isPublished,
            maxPlayers: maxPlayers,
            theme: theme,
            mainGenre: mainGenre,
            subGenre: subGenre,
            duration: duration,
            isNSFW: isNSFW,
            dm_personality: dmPersonality,
            dm_narration_style: dmNarrationStyle,
            response_length: responseLength,
            game_state: gameState,
            current_player_id: currentPlayerId,
            initiative_order: initiativeOrder,
            long_term_memory: longTermMemory,
            current_time: currentTime, // FASE 1: Ini sudah number (bigint)
            current_weather: currentWeather,
            world_event_counter: worldEventCounter,
            map_image_url: mapImageUrl,
            map_markers: mapMarkers,
            current_player_location: currentPlayerLocation,
            quests: quests,
            npcs: npcs,
            // FASE 1: Petakan data peta
            exploration_grid: explorationGrid,
            fog_of_war: fogOfWar,
            battle_state: battleState,
            player_grid_position: playerGridPosition,
            // AKHIR FASE 1
        };

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

        // Map kembali ke camelCase untuk aplikasi
        return this.mapDbCampaign(data as any);
    }

    async createCampaign(campaign: Omit<Campaign, 'id' | 'ownerId' | 'eventLog' | 'monsters' | 'players' | 'playerIds' | 'choices' | 'turnId' | 'initiativeOrder'>, ownerId: string): Promise<Campaign> {
        const supabase = this.ensureSupabase();

        // BUGFIX G-1: Petakan manual camelCase (App) ke snake_case (DB)
        // Penggunaan ...spread operator sebelumnya menyebabkan silent failure
        const dbCampaign: Omit<DbCampaign, 'id' | 'campaign_players'> = {
            owner_id: ownerId,
            title: campaign.title,
            description: campaign.description,
            image: campaign.image,
            join_code: campaign.joinCode,
            is_published: campaign.isPublished,
            maxPlayers: campaign.maxPlayers,
            theme: campaign.theme,
            mainGenre: campaign.mainGenre,
            subGenre: campaign.subGenre,
            duration: campaign.duration,
            isNSFW: campaign.isNSFW,
            dm_personality: campaign.dmPersonality,
            dm_narration_style: campaign.dmNarrationStyle,
            response_length: campaign.responseLength,
            game_state: campaign.gameState,
            current_player_id: campaign.currentPlayerId,
            initiative_order: campaign.initiativeOrder,
            long_term_memory: campaign.longTermMemory,
            current_time: campaign.currentTime, // FASE 1: Ini sudah number (bigint)
            current_weather: campaign.currentWeather,
            world_event_counter: campaign.worldEventCounter,
            map_image_url: campaign.mapImageUrl,
            map_markers: campaign.mapMarkers,
            current_player_location: campaign.currentPlayerLocation,
            quests: campaign.quests,
            npcs: campaign.npcs,
            // FASE 1: Petakan data peta
            exploration_grid: campaign.explorationGrid,
            fog_of_war: campaign.fogOfWar,
            battle_state: campaign.battleState,
            player_grid_position: campaign.playerGridPosition,
            // AKHIR FASE 1
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
    // METODE RUNTIME (Multiplayer & State Dinamis - Mandat 2.2) (Sudah Benar)
    // =================================================================

    async loadCampaignRuntimeData(campaignId: string, playerIds: string[]): Promise<{
        eventLog: GameEvent[],
        monsters: MonsterInstance[],
        players: Character[]
    }> {
        const supabase = this.ensureSupabase();

        const { data: events, error: eventError } = await supabase
            .from('game_events')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('timestamp', { ascending: true });

        if (eventError) throw eventError;

        const { data: monsterInstances, error: monsterError } = await supabase
            .from('campaign_monsters')
            .select('*, monster:monster_id!inner(*)')
            .eq('campaign_id', campaignId);

        if (monsterError && monsterError.code !== 'PGRST116') throw monsterError; // (Abaikan jika tidak ada monster)

        const monsters: MonsterInstance[] = (monsterInstances || []).map((inst: any) => ({
            instanceId: inst.id,
            definition: this.mapDbMonsterToApp(inst.monster),
            name: inst.name,
            currentHp: inst.current_hp,
            conditions: inst.conditions,
            initiative: inst.initiative
        }));

        const { data: charData, error: charError } = await supabase
            .from('characters')
            .select('*')
            .in('id', playerIds);

        if (charError) throw charError;

        const { data: inventoryData, error: invError } = await supabase
            .from('character_inventory')
            .select('*, item:item_id!inner(*)')
            .in('character_id', playerIds);

        const { data: spellData, error: spellError } = await supabase
            .from('character_spells')
            .select('*, spell:spell_id!inner(*)')
            .in('character_id', playerIds);

        if (invError && invError.code !== 'PGRST116') throw invError;
        if (spellError && spellError.code !== 'PGRST116') throw spellError;

        const players: Character[] = (charData || []).map((dbChar: DbCharacter) =>
            this.mapDbCharacter(
                dbChar,
                (inventoryData || []) as DbCharacterInventoryJoined[],
                (spellData || []) as DbCharacterSpellJoined[]
            )
        );

        return { eventLog: events as GameEvent[], monsters, players };
    }

    async logGameEvent(event: Omit<GameEvent, 'id' | 'timestamp'> & { campaignId: string }) {
        const supabase = this.ensureSupabase();

        // PERBAIKAN: Tangkap 'turnId' secara manual dari 'event'
        const { campaignId, characterId, roll, reason, turnId, ...eventData } = event as any;

        const dbEvent: Omit<DbGameEvent, 'id' | 'timestamp'> = {
            ...eventData, // (eventData sekarang tidak lagi berisi 'turnId')
            campaign_id: campaignId,
            character_id: characterId || null,
            roll: roll || null,
            reason: reason || null,
            turn_id: turnId // Petakan manual ke snake_case
        }

        const { error } = await supabase.from('game_events').insert(dbEvent);
        if (error) {
            console.error("Gagal mencatat event:", error);
            throw error;
        }
    }
}

export const dataService = new DataService();