export enum Location {
    StorytellersSpire = "Puncak Pencerita",
    HallOfEchoes = "Aula Gema",
    WanderersTavern = "Kedai Pengembara",
    MarketOfAThousandTales = "Pasar Seribu Kisah",
    MirrorOfSouls = "Cermin Jiwa",
    TinkerersWorkshop = "Bengkel Juru Cipta",
}

export type ThinkingState = 'idle' | 'thinking' | 'retrying';

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

export interface SystemMessageEvent extends BaseEvent {
    type: 'system';
    text: string;
}

export interface RollResultEvent extends BaseEvent {
    type: 'roll_result';
    characterId: string;
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
    id: string;
    name: string;
    maxHp: number;
    currentHp: number;
    armorClass: number;
    dexterity: number;
    actions: MonsterAction[];
    initiative: number;
    conditions: string[];
}

export type QuestStatus = 'active' | 'completed' | 'failed' | 'proposed';

export interface Quest {
    id: string;
    title: string;
    description: string;
    status: QuestStatus;
    isMainQuest?: boolean;
    reward?: string; // NEW: Added reward property
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

export type WorldTime = 'Pagi' | 'Siang' | 'Sore' | 'Malam';
export type WorldWeather = 'Cerah' | 'Berawan' | 'Hujan' | 'Badai';


export interface Campaign {
    id: string;
    title: string;
    description: string;
    mainGenre: string;
    subGenre: string;
    duration: string;
    isNSFW: boolean;
    maxPlayers: number;
    theme: string;
    dmPersonality: string;
    dmNarrationStyle: 'Deskriptif' | 'Langsung & Percakapan';
    responseLength: 'Singkat' | 'Standar' | 'Rinci';
    eventLog: GameEvent[];
    turnId: string | null;
    longTermMemory: string;
    image: string;
    playerIds: string[];
    currentPlayerId: string | null;
    joinCode: string;
    gameState: 'exploration' | 'combat';
    monsters: Monster[];
    initiativeOrder: string[]; // array of character/monster ids
    isPublished?: boolean;
    choices: string[];
    quests: Quest[];
    npcs: NPC[];
    // Dynamic World State
    currentTime: WorldTime;
    currentWeather: WorldWeather;
    worldEventCounter: number; // Tracks turns until next world event check
    // Interactive Map State
    mapImageUrl?: string;
    mapMarkers: MapMarker[];
    currentPlayerLocation?: string; // ID of the marker where players are
}

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


export type ItemType = 'weapon' | 'armor' | 'consumable' | 'tool' | 'other';
export interface ItemEffect {
    type: 'heal' | 'damage';
    dice: string;
}

export interface InventoryItem {
    name: string;
    quantity: number;
    description?: string;
    type: ItemType;
    isEquipped?: boolean;
    toHitBonus?: number; // For weapons
    damageDice?: string; // For weapons
    effect?: ItemEffect; // For consumables
}

export interface SpellSlot {
    level: number;
    max: number;
    used: number;
}

export type SpellTarget = 'self' | 'creature' | 'point';
export interface Spell {
    name: string;
    level: number;
    description: string;
    target: SpellTarget;
    effect: ItemEffect; // Can re-use ItemEffect for healing/damage spells
}


export interface Character {
    id: string;
    ownerId: string;
    name: string;
    class: string;
    race: string;
    level: number;
    image: string;
    background: string;
    personalityTrait: string;
    ideal: string;
    bond: string;
    flaw: string;
    abilityScores: AbilityScores;
    maxHp: number;
    currentHp: number;
    armorClass: number;
    speed: number;
    hitDice: string; // e.g., '1d10'
    hitDiceSpent: number;
    deathSaves: { successes: number; failures: number };
    conditions: string[]; // e.g., 'poisoned', 'prone'
    proficientSkills: Skill[];
    proficientSavingThrows: Ability[];
    inventory: InventoryItem[];
    spellSlots: SpellSlot[];
    knownSpells: Spell[];
}

export interface RollRequest {
    type: 'skill' | 'savingThrow' | 'attack' | 'damage' | 'deathSave';
    characterId: string;
    reason: string;
    skill?: Skill;
    ability?: Ability;
    dc?: number;
    target?: { id: string; name: string; ac: number }; // For attack rolls
    item?: InventoryItem; // For attack rolls with items
    originalActionText?: string;
    stage?: 'attack' | 'damage'; // Added for two-step combat rolls
    damageDice?: string; // Added for damage roll stage
}

export interface ToolCall {
    functionName: 'add_items_to_inventory' | 'update_quest_log' | 'log_npc_interaction' | 'spawn_monsters';
    args: any;
}

// The new structured response format expected from the AI.
export interface StructuredApiResponse {
    reaction?: string;
    narration: string;
    choices?: string[];
    rollRequest?: Omit<RollRequest, 'characterId' | 'originalActionText'>;
    tool_calls?: ToolCall[];
}
