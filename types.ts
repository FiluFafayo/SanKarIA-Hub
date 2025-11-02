// =================================================================
// 
//          FILE: types.ts (VERSI BARU - POST-REFAKTOR DB)
// 
// =================================================================

// ----------------------------------------------------
// Tipe Dasar & Enum (Sebagian besar tidak berubah)
// ----------------------------------------------------

export enum Location {
    StorytellersSpire = "Puncak Pencerita",
    HallOfEchoes = "Aula Gema",
    WanderersTavern = "Kedai Pengembara",
    MarketOfAThousandTales = "Pasar Seribu Kisah",
    MirrorOfSouls = "Cermin Jiwa",
    TinkerersWorkshop = "Bengkel Juru Cipta",
}

export type ThinkingState = 'idle' | 'thinking' | 'retrying';

export enum Ability {
    Strength = 'strength',
    Dexterity = 'dexterity',
    Constitution = 'constitution',
    Intelligence = 'intelligence',
    Wisdom = 'wisdom',
    Charisma = 'charisma',
}

export const ALL_ABILITIES: Ability[] = [
    Ability.Strength,
    Ability.Dexterity,
    Ability.Constitution,
    Ability.Intelligence,
    Ability.Wisdom,
    Ability.Charisma,
];

export type AbilityScores = Record<Ability, number>;

export enum Skill {
    Acrobatics = 'Acrobatics',
    AnimalHandling = 'Animal Handling',
    Arcana = 'Arcana',
    Athletics = 'Athletics',
    Deception = 'Deception',
    History = 'History',
    Insight = 'Insight',
    Intimidation = 'Intimidation',
    Investigation = 'Investigation',
    Medicine = 'Medicine',
    Nature = 'Nature',
    Perception = 'Perception',
    Performance = 'Performance',
    Persuasion = 'Persuasion',
    Religion = 'Religion',
    SleightOfHand = 'Sleight of Hand',
    Stealth = 'Stealth',
    Survival = 'Survival',
}

export const SKILL_ABILITY_MAP: Record<Skill, Ability> = {
    [Skill.Acrobatics]: Ability.Dexterity,
    [Skill.AnimalHandling]: Ability.Wisdom,
    [Skill.Arcana]: Ability.Intelligence,
    [Skill.Athletics]: Ability.Strength,
    [Skill.Deception]: Ability.Charisma,
    [Skill.History]: Ability.Intelligence,
    [Skill.Insight]: Ability.Wisdom,
    [Skill.Intimidation]: Ability.Charisma,
    [Skill.Investigation]: Ability.Intelligence,
    [Skill.Medicine]: Ability.Wisdom,
    [Skill.Nature]: Ability.Intelligence,
    [Skill.Perception]: Ability.Wisdom,
    [Skill.Performance]: Ability.Charisma,
    [Skill.Persuasion]: Ability.Charisma,
    [Skill.Religion]: Ability.Intelligence,
    [Skill.SleightOfHand]: Ability.Dexterity,
    [Skill.Stealth]: Ability.Dexterity,
    [Skill.Survival]: Ability.Wisdom,
};

export type WorldTime = 'Pagi' | 'Siang' | 'Sore' | 'Malam';
export type WorldWeather = 'Cerah' | 'Berawan' | 'Hujan' | 'Badai';
export type QuestStatus = 'active' | 'completed' | 'failed' | 'proposed';


// ----------------------------------------------------
// Tipe Data (JSONB) - Ini akan disimpan sebagai JSON
// ----------------------------------------------------

export interface DiceRoll {
    notation: string;
    rolls: number[];
    modifier: number;
    total: number;
    success?: boolean;
    type: 'attack' | 'damage' | 'skill' | 'savingThrow' | 'initiative' | 'deathSave';
    details?: string;
}

// Base event structure
interface BaseEvent {
    id: string;
    timestamp: string;
    turnId: string;
}

export interface PlayerActionEvent extends BaseEvent {
    type: 'player_action';
    characterId: string; // INI SEKARANG UUID KARAKTER
    text: string;
}

export interface DmNarrationEvent extends BaseEvent {
    type: 'dm_narration';
    text: string;
}

export interface DmReactionEvent extends BaseEvent {
    type: 'dm_reaction';
    text: string;
}

export interface SystemMessageEvent extends BaseEvent {
    type: 'system';
    text: string;
}

export interface RollResultEvent extends BaseEvent {
    type: 'roll_result';
    characterId: string; // INI SEKARANG UUID KARAKTER
    roll: DiceRoll;
    reason: string;
}

export type GameEvent = PlayerActionEvent | DmNarrationEvent | SystemMessageEvent | RollResultEvent | DmReactionEvent;

export interface MonsterAction {
    name: string;
    toHitBonus: number;
    damageDice: string;
}

export interface Monster {
    id: string; // Monster unik dalam sesi, misal 'goblin-1', 'goblin-2'
    name: string;
    maxHp: number;
    currentHp: number;
    armorClass: number;
    dexterity: number; // Untuk inisiatif
    actions: MonsterAction[];
    initiative: number;
    conditions: string[];
    
    // TAMBAHAN BARU DARI ROADMAP
    abilityScores: AbilityScores;
    skills: Partial<Record<Skill, number>>;
    traits: { name: string, description: string }[];
    senses: { darkvision: number, passivePerception: number };
    languages: string[];
    challengeRating: number;
    xp: number;
}

export interface Quest {
    id: string; // ID unik quest, misal 'selamatkan-desa-01'
    title: string;
    description: string;
    status: QuestStatus;
    isMainQuest?: boolean;
    reward?: string;
}

export interface NPC {
    id: string; // ID unik NPC
    name: string;
    description: string;
    location: string;
    disposition: 'Friendly' | 'Neutral' | 'Hostile' | 'Unknown';
    interactionHistory: string[];
}

export interface MapMarker {
    id: string;
    name: string;
    x: number; // Persentase dari kiri (0-100)
    y: number; // Persentase dari atas (0-100)
}

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'tool' | 'other';

export interface ItemEffect {
    type: 'heal' | 'damage';
    dice: string;
}

export interface InventoryItem {
    id: string; // ID unik untuk item ini, misal 'item-12345'
    name: string;
    quantity: number;
    type: ItemType;
    
    // Properti Opsional
    description?: string;
    isEquipped?: boolean;
    
    // Properti Senjata
    toHitBonus?: number;
    damageDice?: string;
    
    // Properti Konsumabel
    effect?: ItemEffect;

    // Properti Item Ajaib (dari Roadmap)
    isMagical?: boolean;
    rarity?: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';
    requiresAttunement?: boolean;
    attunedTo?: string | null; // ID Karakter
    bonuses?: {
        attack?: number;
        damage?: number;
        ac?: number;
        save?: number;
    };
}

export interface SpellSlot {
    level: number;
    max: number;
    used: number;
}

export type SpellTarget = 'self' | 'touch' | 'creature' | 'point' | 'area_cone' | 'area_sphere';

// Tipe Spell yang Dirombak (dari Roadmap)
export interface Spell {
    id: string; // ID unik untuk spell, misal 'spell-fireball'
    name: string;
    level: number;
    description: string;
    
    // Mekanik D&D Inti
    castingTime: 'action' | 'bonus_action' | 'reaction' | '1_minute' | '10_minutes' | '1_hour';
    range: 'self' | 'touch' | number; // 'number' dalam kaki
    components: ('V' | 'S' | 'M')[];
    duration: 'instantaneous' | '1_round' | 'concentration_1m' | 'concentration_10m' | 'concentration_1h' | '1_hour' | '8_hours' | '24_hours' | 'until_dispelled';

    // Mekanik Efek
    effectType: 'damage' | 'heal' | 'buff' | 'debuff' | 'control' | 'utility' | 'summoning';
    damageDice?: string;
    damageType?: string;
    
    // Untuk Saves
    saveRequired?: Ability;
    saveOnSuccess?: 'half_damage' | 'no_effect';
    
    // Untuk Buffs/Debuffs
    conditionApplied?: string; // misal 'paralyzed', 'charmed', 'frightened'
    bonusType?: 'ac' | 'attack_roll' | 'saving_throw';
    bonusValue?: string; // misal '+d4', '+2', '+5'
}

// ----------------------------------------------------
// TIPE TABEL DATABASE (BARU)
// ----------------------------------------------------

/**
 * Tabel: `characters`
 * Ini adalah SINGLE SOURCE OF TRUTH untuk state karakter.
 * Data ini GLOBAL dan PERSISTEN antar kampanye.
 */
export interface Character {
    id: string; // uuid
    owner_id: string; // uuid (dari auth.users)
    created_at: string; // timestamp
    
    // Info Dasar
    name: string;
    class: string;
    race: string;
    level: number;
    image_url: string | null; // URL ke Supabase Storage (generated-content)
    
    // Info Roleplay
    background: string | null;
    personality_trait: string | null;
    ideal: string | null;
    bond: string | null;
    flaw: string | null;
    
    // Statistik Inti
    ability_scores: AbilityScores; // jsonb
    max_hp: number;
    speed: number;
    armor_class: number;
    
    // Proficiencies
    proficient_skills: Skill[]; // text[]
    proficient_saving_throws: Ability[]; // text[]
    
    // === STATE GLOBAL YANG PERSISTEN ===
    current_hp: number;
    hit_dice: string;
    hit_dice_spent: number;
    death_saves: { successes: number; failures: number }; // jsonb
    conditions: string[]; // text[]
    inventory: InventoryItem[]; // jsonb[]
    spell_slots: SpellSlot[]; // jsonb[]
    known_spells: Spell[]; // jsonb[]
}

/**
 * Tabel: `campaigns`
 * Ini adalah STATE SESI. Hanya menyimpan data kampanye, 
 * BUKAN state karakter (HP/inventory).
 */
export interface Campaign {
    id: string; // uuid
    owner_id: string; // uuid (dari auth.users, ini adalah DM)
    created_at: string; // timestamp

    // Info Dasar Kampanye
    title: string;
    description: string | null;
    image_url: string | null; // URL ke Supabase Storage (generated-content)
    join_code: string;
    is_published: boolean;

    // State Cerita & Dunia (Spesifik Kampanye)
    event_log: GameEvent[]; // jsonb[]
    long_term_memory: string | null;
    quests: Quest[]; // jsonb[]
    npcs: NPC[]; // jsonb[]
    current_time: WorldTime;
    current_weather: WorldWeather;
    world_event_counter: number;
    
    // Info Peta (Spesifik Kampanye)
    map_image_url: string | null;
    map_markers: MapMarker[]; // jsonb[]
    current_player_location: string | null; // ID dari map_marker

    // State Sesi Real-time (Spesifik Kampanye)
    turn_id: string | null;
    game_state: 'exploration' | 'combat';
    monsters: Monster[]; // jsonb[]
    initiative_order: string[]; // text[] (berisi Character.id atau Monster.id)
    current_player_id: string | null; // ID karakter atau monster
    choices: string[]; // text[]
}

/**
 * Tabel: `campaign_players` (Junction Table)
 * Menghubungkan Karakter Global ke Sesi Kampanye.
 */
export interface CampaignPlayer {
    campaign_id: string; // uuid
    character_id: string; // uuid
    joined_at: string; // timestamp
}


// ----------------------------------------------------
// Tipe Helper (Tidak berubah)
// ----------------------------------------------------

export interface RollRequest {
    type: 'skill' | 'savingThrow' | 'attack' | 'damage' | 'deathSave';
    characterId: string;
    reason: string;
    skill?: Skill;
    ability?: Ability;
    dc?: number;
    target?: { id: string; name: string; ac: number }; // Untuk attack rolls
    item?: InventoryItem; // Untuk attack rolls with items
    originalActionText?: string;
    stage?: 'attack' | 'damage'; 
    damageDice?: string; 
    
    // TAMBAHAN BARU DARI ROADMAP (Prioritas Kritis #1)
    isAdvantage?: boolean;
    isDisadvantage?: boolean;
}

export interface ToolCall {
    functionName: 'add_items_to_inventory' | 'update_quest_log' | 'log_npc_interaction' | 'spawn_monsters' | 'apply_condition'; // 'apply_condition' ditambahkan dari roadmap
    args: any;
}

// Tipe ini TIDAK LAGI DIGUNAKAN untuk Narasi/Mekanik.
// Kita biarkan untuk referensi lama, tapi geminiService akan
// mengembalikan tipe yang lebih terpisah.
export interface StructuredApiResponse {
    reaction?: string;
    narration: string;
    choices?: string[];
    rollRequest?: Omit<RollRequest, 'characterId' | 'originalActionText'>;
    tool_calls?: ToolCall[];
}