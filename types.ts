// types.ts

// =================================================================
// BAGIAN 1: TIPE ENUM & UTILITAS DASAR D&D
// =================================================================

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


// =================================================================
// BAGIAN 2: TIPE DEFINISI GLOBAL (Data Aturan dari DB)
// =================================================================

// Merepresentasikan tabel 'items'
export interface ItemDefinition {
    id: string;
    name: string;
    description?: string;
    type: 'weapon' | 'armor' | 'consumable' | 'tool' | 'other';
    isMagical: boolean;
    rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';
    requiresAttunement: boolean;
    bonuses?: { attack?: number; damage?: number; ac?: number };
    damageDice?: string;
    damageType?: string;
    baseAc?: number;
    armorType?: 'light' | 'medium' | 'heavy' | 'shield';
    stealthDisadvantage?: boolean;
    strengthRequirement?: number;
    effect?: { type: 'heal' | 'damage'; dice: string };
}

// Merepresentasikan tabel 'spells'
export interface SpellDefinition {
    id: string;
    name: string;
    level: number;
    description: string;
    castingTime: 'action' | 'bonus_action' | 'reaction' | 'minute' | 'hour';
    range: string;
    components: ('V' | 'S' | 'M')[];
    duration: string; // 'Instantaneous', 'Concentration, 1 minute'
    school: string;
    effectType: 'damage' | 'heal' | 'buff' | 'debuff' | 'control' | 'utility';
    damageDice?: string;
    damageType?: string;
    saveRequired?: Ability;
    saveOnSuccess?: 'half_damage' | 'no_effect';
    conditionApplied?: string;
}

// Merepresentasikan tabel 'monsters'
export interface MonsterDefinition {
    id: string;
    name: string;
    armorClass: number;
    maxHp: number;
    abilityScores: AbilityScores;
    skills: Partial<Record<Skill, number>>;
    traits: { name: string; description: string }[];
    actions: { name: string; toHitBonus?: number; damageDice?: string; description?: string }[];
    senses: { darkvision: number; passivePerception: number; tremorsense?: number; truesight?: number };
    languages: string[];
    challengeRating: number;
    xp: number;
}

// =================================================================
// BAGIAN 3: TIPE KARAKTER (SSoT - Mandat 3.4)
// =================================================================

// Fitur dari Ras atau Kelas
export interface CharacterFeature {
    name: string;
    description: string;
    // (Akan ditambah di Fase 2)
    // uses?: { max: number; spent: number; resetOn: 'short_rest' | 'long_rest' };
}

// Item spesifik di inventory karakter
export interface CharacterInventoryItem {
    instanceId: string; // ID unik dari tabel 'character_inventory'
    item: ItemDefinition; // Data definisi dari tabel 'items'
    quantity: number;
    isEquipped: boolean;
    // (Akan ditambah di Fase 1)
    // isAttuned: boolean; 
}

// Slot sihir karakter
export interface CharacterSpellSlot {
    level: number;
    max: number;
    spent: number;
}

// Tipe Karakter SSoT (Single Source of Truth)
// Ini adalah gabungan dari data di tabel 'characters', 
// 'character_inventory', dan 'character_spells'.
// Ini adalah SSoT untuk Karakter, persisten di semua campaign.
export interface Character {
    id: string;
    ownerId: string; // 'owner_id' dari 'profiles'
    name: string;
    class: string;
    race: string;
    level: number;
    xp: number;
    image: string;
    
    // Detail Karakter (dari Background - Fase 1)
    background: string;
    personalityTrait: string;
    ideal: string;
    bond: string;
    flaw: string;
    
    // Status & Mekanika Inti (Data Persisten per Mandat 3.4)
    abilityScores: AbilityScores;
    maxHp: number;
    currentHp: number; // STATE PERSISTEN
    tempHp: number;
    armorClass: number; // Akan di-cache di sini
    speed: number; // Akan di-cache di sini
    hitDice: Record<string, { max: number; spent: number }>; // e.g., { "d10": { max: 1, spent: 0 } }
    deathSaves: { successes: number; failures: number };
    conditions: string[]; // e.g., 'poisoned', 'exhaustion_1', 'Prone', 'Hidden'
    
    // Proficiency & Fitur (dari Ras & Kelas - Fase 1)
    racialTraits: CharacterFeature[];
    classFeatures: CharacterFeature[];
    proficientSkills: Skill[];
    proficientSavingThrows: Ability[];
    
    // Resource (Data Persisten per Mandat 3.4)
    spellSlots: CharacterSpellSlot[]; // STATE PERSISTEN

    // Data Relasional (digabungkan saat loading)
    inventory: CharacterInventoryItem[]; // STATE PERSISTEN
    knownSpells: SpellDefinition[];

    // Status Runtime (Non-Persisten) untuk kombat
    usedBonusAction?: boolean;
    usedReaction?: boolean;
}


// =================================================================
// BAGIAN 4: TIPE KAMPANYE (State Sesi Permainan)
// =================================================================

export type QuestStatus = 'active' | 'completed' | 'failed' | 'proposed';

export interface Quest {
    id: string;
    title: string;
    description: string;
    status: QuestStatus;
    isMainQuest?: boolean;
    reward?: string;
}

export interface NPC {
    id: string;
    name: string;
    description: string;
    location: string;
    disposition: 'Friendly' | 'Neutral' | 'Hostile' | 'Unknown';
    interactionHistory: string[];
}

export interface MapMarker {
    id: string;
    name: string;
    x: number; // Percentage from left
    y: number; // Percentage from top
}

// export type WorldTime = 'Pagi' | 'Siang' | 'Sore' | 'Malam'; // (Poin 5) Dihapus, diganti number
export type WorldWeather = 'Cerah' | 'Berawan' | 'Hujan' | 'Badai';

// Ini adalah *instansi* monster dalam campaign
export interface MonsterInstance {
    instanceId: string; // ID unik dari 'campaign_monsters'
    definition: MonsterDefinition; // Stat block dari 'monsters'
    name: string; // "Goblin 1"
    currentHp: number;
    conditions: string[];
    initiative: number;
}

// Base event structure
interface BaseEvent {
    id: string;
    timestamp: string;
    turnId: string;
}

export interface PlayerActionEvent extends BaseEvent {
    type: 'player_action';
    characterId: string;
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

// (Poin 3) Tipe event baru untuk dialog NPC
export interface DmDialogueEvent extends BaseEvent {
    type: 'dm_dialogue';
    npcName: string;
    text: string;
}

export interface SystemMessageEvent extends BaseEvent {
    type: 'system';
    text: string;
}

export interface DiceRoll {
    notation: string;
    rolls: number[];
    modifier: number;
    total: number;
    success?: boolean;
    type: 'attack' | 'damage' | 'skill' | 'savingThrow' | 'initiative' | 'deathSave';
    details?: string;
}

export interface RollResultEvent extends BaseEvent {
    type: 'roll_result';
    characterId: string;
    roll: DiceRoll;
    reason: string;
}

export type GameEvent = PlayerActionEvent | DmNarrationEvent | SystemMessageEvent | RollResultEvent | DmReactionEvent | DmDialogueEvent;

// Ini adalah objek Campaign DEFINISI (yang kita dapat dari list)
export interface Campaign {
    id: string;
    ownerId: string;
    title: string;
    description: string;
    image: string;
    joinCode: string;
    isPublished: boolean;
    maxPlayers: number; // Saya tambahkan ini dari file lama, penting
    theme: string; // Saya tambahkan ini dari file lama, penting
    mainGenre: string; // Saya tambahkan ini dari file lama
    subGenre: string; // Saya tambahkan ini dari file lama
    duration: string; // Saya tambahkan ini dari file lama
    isNSFW: boolean; // Saya tambahkan ini dari file lama

    // DM Settings
    dmPersonality: string;
    dmNarrationStyle: 'Deskriptif' | 'Langsung & Percakapan';
    responseLength: 'Singkat' | 'Standar' | 'Rinci';
    
    // Game State (disimpan di DB)
    gameState: 'exploration' | 'combat';
    currentPlayerId: string | null; // ID Karakter
    initiativeOrder: string[]; // Array of 'character.id' dan 'monster.instanceId'
    longTermMemory: string;
    
    // World State (disimpan di DB)
    currentTime: number; // (Poin 5) Diubah dari WorldTime (string) ke number (total detik)
    currentWeather: WorldWeather;
    worldEventCounter: number;
    
    // Map State (disimpan di DB)
    mapImageUrl?: string;
    mapMarkers: MapMarker[];
    currentPlayerLocation?: string;
    
    // Dynamic Data (disimpan di DB)
    quests: Quest[];
    npcs: NPC[];

    // Data relasional (di-load saat runtime)
    monsters: MonsterInstance[];
    eventLog: GameEvent[];
    playerIds: string[]; // Daftar ID Karakter yang ada di campaign ini

    // Runtime-only state (Tidak disimpan di DB 'campaigns')
    choices: string[];
    turnId: string | null;
}

// =================================================================
// BAGIAN 5: TIPE INTERAKSI & AI
// =================================================================

// Tipe ini merepresentasikan state gabungan yang dikirim ke AI
// dan juga state yang di-pass ke GameScreen
export interface CampaignState extends Campaign {
    thinkingState: ThinkingState;
    activeRollRequest: RollRequest | null;
    players: Character[]; // Daftar objek Karakter *lengkap* yang ada di sesi ini
}


export interface RollRequest {
    type: 'skill' | 'savingThrow' | 'attack' | 'damage' | 'deathSave';
    characterId: string; // 'character.id' atau 'monster.instanceId'
    reason: string;
    skill?: Skill;
    ability?: Ability;
    dc?: number;
    target?: { id: string; name: string; ac: number }; // ID bisa 'character.id' atau 'monster.instanceId'
    item?: CharacterInventoryItem; // Untuk serangan dengan item
    originalActionText?: string;
    stage?: 'attack' | 'damage';
    damageDice?: string;
    isAdvantage?: boolean;
    isDisadvantage?: boolean;
}

export interface ToolCall {
    functionName: 'add_items_to_inventory' | 'update_quest_log' | 'log_npc_interaction' | 'spawn_monsters';
    args: any;
}

export interface StructuredApiResponse {
    reaction?: string;
    narration: string;
    choices?: string[];
    rollRequest?: Omit<RollRequest, 'characterId' | 'originalActionText'>;
    tool_calls?: ToolCall[];
}