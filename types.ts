// types.ts

// =================================================================
// BAGIAN 0: TIPE DATA PIXEL ART (BARU DARI P2)
// =================================================================

// Tipe Tile diadaptasi dari P2 (pixel-vtt-stylizer)
export interface Tile {
  id: number;
  name: string;
  color: string; // Warna Heksadesimal untuk digambar di canvas
  isImpassable?: boolean; // Untuk pathfinding
  movementCost?: number; // Untuk pathfinding (default 1)
  category: 'Terrain' | 'Wall' | 'Door' | 'Object' | 'Hazard' | 'Structure' | 'Biome' | 'POI';
}

// Tipe SpritePart diadaptasi dari P2 (pixel-vtt-stylizer)
export interface SpritePart {
  id: string;
  name: string;
  color: string;
  layer: SpriteLayer;
}

// Kategori Lapisan BARU (sesuai permintaan Fase 0)
export type SpriteLayer =
  | 'gender_base'
  | 'race_base'
  | 'body_type'
  | 'facial_feature'
  | 'head_accessory'
  | 'hair'
  | 'armor_torso'
  | 'armor_legs'
  | 'weapon_right_hand'
  | 'weapon_left_hand';

// Struktur Kategori BARU yang detail
export type SpriteLayerCategory = {
  gender_base: SpritePart[];
  race_base: SpritePart[];
  body_type: SpritePart[];
  facial_feature: SpritePart[];
  head_accessory: SpritePart[];
  hair: SpritePart[];
  armor_torso: SpritePart[];
  armor_legs: SpritePart[];
  weapon_right_hand: SpritePart[];
  weapon_left_hand: SpritePart[];
};

// Tipe AssembledCharacter diadaptasi dari P2 (pixel-vtt-stylizer)
export interface AssembledCharacter {
  gender_base: SpritePart;
  race_base: SpritePart;
  body_type: SpritePart;
  facial_feature: SpritePart;
  head_accessory: SpritePart;
  hair: SpritePart;
  armor_torso: SpritePart;
  armor_legs: SpritePart;
  weapon_right_hand: SpritePart;
  weapon_left_hand: SpritePart;
}

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
export enum DamageType {
    Bludgeoning = 'bludgeoning',
    Piercing = 'piercing',
    Slashing = 'slashing',
    Fire = 'fire',
    Cold = 'cold',
    Lightning = 'lightning',
    Thunder = 'thunder',
    Acid = 'acid',
    Poison = 'poison',
    Psychic = 'psychic',
    Radiant = 'radiant',
    Necrotic = 'necrotic',
    Force = 'force',
}

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
    damageType?: DamageType;
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
    damageType?: DamageType;
    saveRequired?: Ability;
    saveOnSuccess?: 'half_damage' | 'no_effect';
    conditionApplied?: string;
    // Tambahan untuk Tahap 5
    requiresConcentration?: boolean;
    // Durasi dalam ronde (untuk memudahkan ticking saat kombat)
    durationRounds?: number;
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
    actions: { name: string; toHitBonus?: number; damageDice?: string; description?: string; damageType?: DamageType }[];
    senses: { darkvision: number; passivePerception: number; tremorsense?: number; truesight?: number };
    languages: string[];
    challengeRating: number;
    xp: number;
    // BARU: Defenses bawaan monster
    damageResistances?: DamageType[];
    damageImmunities?: DamageType[];
    damageVulnerabilities?: DamageType[];
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

// Efek runtime berkelanjutan dari spell/ability
export interface ActiveEffect {
    id: string; // unique instance id
    spellId?: string; // optional: id dari SpellDefinition
    label: string; // e.g., 'Bless', 'Shield'
    sourceCharacterId: string; // siapa yang memberikan efek
    targetCharacterId: string; // siapa penerima efek
    remainingRounds: number; // berkurang setiap giliran
    isConcentration?: boolean; // true jika bergantung pada konsentrasi caster
    // Payload mekanikal sederhana (disederhanakan untuk tahap ini)
    blessDie?: string; // e.g., '1d4' untuk Bless
    acBonus?: number; // e.g., +5 untuk Shield, +2 untuk Shield of Faith
    grantsDisadvantageToAttackers?: boolean; // e.g., Darkness (disederhanakan)
}

// Tipe Karakter SSoT (Single Source of Truth)
// Ini adalah gabungan dari data di tabel 'characters', 
// 'character_inventory', dan 'character_spells'.
// Ini adalah SSoT untuk Karakter, persisten di semua campaign.
export interface CharacterArc {
    id?: string;
    characterId: string;
    campaignId: string;
    publicGoal: string;
    secretAgenda: string;
    trueDesire: string;
    loyaltyScore: number;
    breakingPoint: string;
    milestones?: string[];
    isCompleted?: boolean;
}

export interface Character {
    id: string;
    ownerId: string; // 'owner_id' dari 'profiles'
    name: string;
    class: string;
    race: string;
    level: number;
    xp: number;
    avatar_url: string;
    gender: 'Pria' | 'Wanita'; // (Penyederhanaan untuk Fase 2)
    bodyType: string; // (e.g., 'normal', 'missing_arm_right')
    scars: string[]; // (e.g., 'scar_eye_left')
    hair: string; // (e.g., 'Rambut Panjang Hitam')
    facialHair: string; // (e.g., 'Jenggot Panjang')
    headAccessory: string; // (e.g., 'Tanduk Kecil')
    
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

    // PATCH 1: Kepatuhan data tambahan (disimpan di DB)
    languages?: string[];
    toolProficiencies?: string[];
    weaponProficiencies?: string[];
    armorProficiencies?: string[];
    senses?: { darkvision?: number; tremorsense?: number; truesight?: number };
    passivePerception?: number;
    inspiration?: boolean;
    preparedSpells?: string[]; // daftar ID/nama spell yang sedang dipersiapkan
    featureUses?: Record<string, { max: number; spent: number; resetOn: 'short_rest' | 'long_rest' }>;

    // Data Relasional (digabungkan saat loading)
    inventory: CharacterInventoryItem[]; // STATE PERSISTEN
    knownSpells: SpellDefinition[];

    // Status Runtime (Non-Persisten) untuk kombat
    usedBonusAction?: boolean;
    usedReaction?: boolean;
    usedAction?: boolean;

    // Efek berkelanjutan (runtime, non-persisten)
    activeEffects?: ActiveEffect[];
    // Hanya satu konsentrasi aktif per caster
    concentration?: {
        spellId: string;
        spellName: string;
        remainingRounds: number; // dihitung dalam ronde/giliran
    } | null;
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
    image?: string; // URL potret NPC (opsional)
    imagePending?: boolean; // Status pembuatan potret otomatis
    // (Poin 4) NPC Mendalam
    opinion?: Record<string, number>; // mapping characterId -> opinion score
    secret?: string; // Rahasia tersembunyi
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

export interface CampaignRules {
    startingLevel: number;
    advancementType: 'xp' | 'milestone';
    rollPrivacy: 'public' | 'private_to_dm';
    allowHomebrew: boolean;
    maxPartySize: number;
}

// Ini adalah objek Campaign DEFINISI (yang kita dapat dari list)
export interface Campaign {
    id: string;
    ownerId: string;
    title: string;
    description: string;
    cover_url: string;
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

    // Config Mekanik (Disimpan di DB sebagai rules_config)
    rulesConfig: CampaignRules;

    // Runtime-only state (Tidak disimpan di DB 'campaigns')
    choices: string[];
    turnId: string | null;

    // =================================================================
    // BAGIAN 4B: TIPE BATTLE STATE (BARU DARI P2)
    // =================================================================
    
    // Grid Peta Eksplorasi (BARU)
    explorationGrid: number[][]; // (Skala Zoom-Out, 10000+)
    fogOfWar: boolean[][]; // Grid paralel untuk fog of war

    // Battle State (BARU)
    battleState: BattleState | null; // Null jika tidak sedang kombat
    
    // Posisi Pemain di Peta Eksplorasi (BARU: FASE 5)
    playerGridPosition: { x: number; y: number };
}

// =================================================================
// BAGIAN 4B: TIPE BATTLE STATE (BARU DARI P2)
// Diadaptasi dari ai-native-virtual-tabletop-architect
// =================================================================

export enum BattleStatus {
  Inactive = "Inactive",
  Active = "Active",
  Paused = "Paused",
}

export enum TerrainType {
  Plains = 0,
  Difficult = 1,
  Obstacle = 2,
}

export interface GridCell {
  terrain: TerrainType;
  elevation: number;
}

export interface Unit {
  id: string; // (Bisa Character.id atau MonsterInstance.instanceId)
  name: string;
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  movementSpeed: number; // (dalam sel grid)
  remainingMovement: number;
  gridPosition: { x: number; y: number };
  hasDisengaged?: boolean; // Menandai Disengage untuk mencegah OA hingga akhir giliran
}

export interface BattleState {
  status: BattleStatus;
  gridMap: GridCell[][]; // Grid layout data (30x30)
  mapImageUrl?: string; // URL Peta HD yang di-render AI
  units: Unit[];
  turnOrder: string[]; // array of unit IDs
  activeUnitId: string | null;
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

// FASE 0: Tipe Aksi Kampanye diperlukan oleh panel modular
export interface CampaignActions {
	logEvent: (event: any, turnId: string) => void;
	startTurn: () => string;
	endTurn: () => void;
	updateMonster: (monster: MonsterInstance) => void;
	removeMonster: (monsterInstanceId: string) => void;
	setInitiativeOrder: (order: string[]) => void;
	setCurrentPlayerId: (id: string | null) => void;
	setGameState: (state: "exploration" | "combat") => void;
	setThinkingState: (state: ThinkingState) => void;
	setActiveRollRequest: (request: RollRequest | null) => void;
	spawnMonsters: (monstersToSpawn: any[]) => void;
	clearChoices: () => void;
	setChoices: (choices: string[]) => void;
	updateCharacterInCampaign: (character: Character) => void;
	addItemsToInventory: (payload: any) => void;
	updateQuestLog: (payload: any) => void;
	logNpcInteraction: (payload: any) => void;
    setBattleState: (state: BattleState | null) => void;
    setBattleGrid: (grid: GridCell[][]) => void;
    setBattleMapImage: (url: string) => void;
    setBattleUnits: (units: Unit[]) => void;
    setActiveBattleUnit: (id: string | null) => void;
    moveUnit: (payload: { unitId: string; newPosition: { x: number; y: number }; cost: number }) => void;
    clearBattleState: () => void; 
    setFogOfWar: (fog: boolean[][]) => void; 
    advanceTime: (seconds: number) => void;
    setWeather: (weather: WorldWeather) => void;
    awardXp: (characterId: string, amount: number) => void; 
    updateNpcOpinion: (npcId: string, characterId: string, change: number) => void;
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
    damageType?: DamageType;
    isCritical?: boolean;
    isAdvantage?: boolean;
    isDisadvantage?: boolean;
}

export interface ToolCall {
    functionName: 'add_items_to_inventory' | 'update_quest_log' | 'log_npc_interaction' | 'spawn_monsters' | 'award_xp' | 'update_npc_opinion';
    args: any;
}

export interface StructuredApiResponse {
    reaction?: string;
    narration: string;
    choices?: string[];
    rollRequest?: Omit<RollRequest, 'characterId' | 'originalActionText'>;
    tool_calls?: ToolCall[];
}

// =============================
// Kondisi & Dampak Mekanis (5e)
// =============================
export interface ConditionEffects {
    attackAdvantage?: boolean;
    attackDisadvantage?: boolean;
    grantsAdvantageToAttackers?: boolean;
    grantsDisadvantageToAttackers?: boolean;
    speedZero?: boolean;
    speedMultiplier?: number; // 0.5 untuk gerak setengah, dst.
    acModifier?: number;
    attackRollModifier?: number;
    notes?: string;
}

// Standar nama kondisi sebagai key string agar kompatibel dengan existing state `conditions: string[]`
export const CONDITION_RULES: Record<string, ConditionEffects> = {
    Hidden: {
        attackAdvantage: true,
        notes: 'Keuntungan menyerang, hilang saat menyerang atau terdeteksi.'
    },
    Prone: {
        grantsAdvantageToAttackers: true,
        notes: 'Penyerang memiliki keuntungan (disederhanakan).'
    },
    Grappled: {
        speedZero: true,
        notes: 'Kecepatan menjadi 0.'
    },
    Restrained: {
        attackDisadvantage: true,
        grantsAdvantageToAttackers: true,
        speedZero: true,
        notes: 'Disadvantage serangan, serangan terhadap punya advantage, tidak bisa bergerak.'
    },
    Blinded: {
        attackDisadvantage: true,
        grantsAdvantageToAttackers: true,
        notes: 'Tidak bisa melihat; serangan memiliki disadvantage, lawan punya advantage.'
    },
    Charmed: {
        attackDisadvantage: true,
        notes: 'Tidak bisa menyerang pemberi charm (disederhanakan: disadvantage serangan).'
    },
    Frightened: {
        attackDisadvantage: true,
        notes: 'Disadvantage pada serangan dan ability checks.'
    },
    Poisoned: {
        attackDisadvantage: true,
        notes: 'Disadvantage pada serangan dan ability checks.'
    },
    Invisible: {
        attackAdvantage: true,
        grantsDisadvantageToAttackers: true,
        notes: 'Serangan sendiri advantage; musuh sulit menyerang (disadvantage untuk penyerang).'
    },
    Paralyzed: {
        grantsAdvantageToAttackers: true,
        attackDisadvantage: true,
        speedZero: true,
        notes: 'Tidak bisa bergerak; serangan terhadap advantage (disederhanakan).'
    },
    Petrified: {
        grantsAdvantageToAttackers: true,
        attackDisadvantage: true,
        speedZero: true,
        notes: 'Incapacitated; serangan terhadap advantage.'
    },
    Stunned: {
        grantsAdvantageToAttackers: true,
        attackDisadvantage: true,
        speedZero: true,
        notes: 'Tidak bisa bergerak; serangan terhadap advantage.'
    },
    Unconscious: {
        grantsAdvantageToAttackers: true,
        attackDisadvantage: true,
        speedZero: true,
        notes: 'Tidak sadar; serangan terhadap advantage.'
    },
    Exhaustion: {
        attackDisadvantage: true,
        notes: 'Disadvantage ability checks; disederhanakan berdampak pada serangan.'
    },
};