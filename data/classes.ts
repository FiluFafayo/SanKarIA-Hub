// data/classes.ts
import { Ability, Skill, CharacterFeature, ItemDefinition, SpellDefinition, CharacterSpellSlot } from '../types';
import { ITEM_DEFINITIONS } from './items';
import { SPELL_DEFINITIONS } from './spells';

// Helper untuk mengambil definisi item berdasarkan nama
const item = (name: string): ItemDefinition => {
    const definition = ITEM_DEFINITIONS.find(i => i.name === name);
    if (!definition) throw new Error(`ItemDefinition not found: ${name}`);
    return { ...definition, id: name }; // Gunakan nama sebagai ID sementara
};

// Helper untuk mengambil definisi spell berdasarkan nama
const spell = (name: string): SpellDefinition => {
    const definition = SPELL_DEFINITIONS.find(s => s.name === name);
    if (!definition) throw new Error(`SpellDefinition not found: ${name}`);
    return { ...definition, id: name }; // Gunakan nama sebagai ID sementara
};

// Tipe untuk Pilihan
type EquipmentChoice = {
    description: string; // "Pilih (a) atau (b)"
    options: { name: string, items: ItemDefinition[], quantity?: number }[];
};

export interface ClassData {
    name: string;
    description: string;
    hitDice: string; // "1d10"
    hpAtLevel1: (conMod: number) => number;
    
    proficiencies: {
        savingThrows: Ability[];
        skills: { choices: number; options: Skill[] };
        armor: ('light' | 'medium' | 'heavy' | 'shields')[];
        weapons: ('simple' | 'martial')[];
    };
    
    startingEquipment: {
        fixed: { item: ItemDefinition, quantity: number }[];
        choices: EquipmentChoice[];
    };
    
    features: CharacterFeature[];
    
    // Untuk Spellcaster
    spellcasting?: {
        ability: Ability;
        knownCantrips: SpellDefinition[];
        knownSpells: SpellDefinition[];
        spellSlots: CharacterSpellSlot[];
    };
}

export const CLASS_DEFINITIONS: Record<string, ClassData> = {
    "Fighter": {
        name: 'Fighter',
        description: 'Ahli bela diri, terampil dengan beragam senjata dan armor.',
        hitDice: '1d10',
        hpAtLevel1: (conMod) => 10 + conMod,
        proficiencies: {
            savingThrows: [Ability.Strength, Ability.Constitution],
            skills: {
                choices: 2,
                options: [Skill.Acrobatics, Skill.AnimalHandling, Skill.Athletics, Skill.History, Skill.Insight, Skill.Intimidation, Skill.Perception, Skill.Survival]
            },
            armor: ['light', 'medium', 'heavy', 'shields'],
            weapons: ['simple', 'martial']
        },
        startingEquipment: {
            fixed: [],
            choices: [
                {
                    description: 'Pilih Armor:',
                    options: [
                        { name: 'Chain Mail', items: [item('Chain Mail')] },
                        { name: 'Leather Armor & Longbow', items: [item('Leather Armor'), item('Longbow'), item('Arrows')] }
                    ]
                },
                {
                    description: 'Pilih Senjata:',
                    options: [
                        { name: 'Longsword & Shield', items: [item('Longsword'), item('Shield')] },
                        { name: 'Dua Longsword', items: [item('Longsword')], quantity: 2 }
                    ]
                },
                {
                    description: 'Pilih Paket:',
                    options: [
                        { name: "Explorer's Pack", items: [item("Explorer's Pack")] },
                        // (Kita asumsikan Dungeoneer's Pack ada di items.ts)
                        // { name: "Dungeoneer's Pack", items: [item("Dungeoneer's Pack")] } 
                    ]
                }
            ]
        },
        features: [
            {
                name: 'Fighting Style',
                description: 'Pilih satu gaya bertarung (cth: Defense: +1 AC saat memakai armor).'
                // Di Fase 1.B, UI akan meminta player memilih salah satu.
            },
            {
                name: 'Second Wind',
                description: 'Sebagai Bonus Action, kamu bisa memulihkan HP sebesar 1d10 + level Fighter-mu. (1x per short/long rest)'
            }
        ]
    },
    "Rogue": {
        name: 'Rogue',
        description: 'Penjahat yang mengandalkan stealth dan tipu daya.',
        hitDice: '1d8',
        hpAtLevel1: (conMod) => 8 + conMod,
        proficiencies: {
            savingThrows: [Ability.Dexterity, Ability.Intelligence],
            skills: {
                choices: 4,
                options: [Skill.Acrobatics, Skill.Athletics, Skill.Deception, Skill.Insight, Skill.Intimidation, Skill.Investigation, Skill.Perception, Skill.Performance, Skill.Persuasion, Skill.SleightOfHand, Skill.Stealth]
            },
            armor: ['light'],
            weapons: ['simple', 'hand_crossbows', 'longswords', 'rapiers', 'shortswords']
        },
        startingEquipment: {
            fixed: [
                { item: item('Leather Armor'), quantity: 1 },
                { item: item('Dagger'), quantity: 2 },
                { item: item("Thieves' Tools"), quantity: 1 }
            ],
            choices: [
                {
                    description: 'Pilih Senjata:',
                    options: [
                        { name: 'Rapier', items: [item('Rapier')] },
                        { name: 'Shortsword', items: [item('Shortsword')] }
                    ]
                },
                {
                    description: 'Pilih Busur:',
                    options: [
                        { name: 'Shortbow & Arrows', items: [item('Shortbow'), item('Arrows')] },
                        { name: 'Shortsword (lagi)', items: [item('Shortsword')] }
                    ]
                },
                // (Tambahkan pilihan pack nanti)
            ]
        },
        features: [
            {
                name: 'Expertise',
                description: 'Pilih 2 skill proficiency (atau 1 skill dan Thieves\' Tools). Bonus proficiency-mu digandakan untuk skill tersebut.'
            },
            {
                name: 'Sneak Attack',
                description: '1x per giliran, kamu bisa menambahkan 1d6 extra damage pada seranganmu jika kamu punya advantage ATAU ada sekutumu dalam 5 kaki dari target.'
            },
            {
                name: "Thieves' Cant",
                description: 'Kamu mengerti bahasa rahasia para pencuri.'
            }
        ]
    },
    "Cleric": {
        name: 'Cleric',
        description: 'Seorang juara imamat yang menggunakan sihir ilahi.',
        hitDice: '1d8',
        hpAtLevel1: (conMod) => 8 + conMod,
        proficiencies: {
            savingThrows: [Ability.Wisdom, Ability.Charisma],
            skills: {
                choices: 2,
                options: [Skill.History, Skill.Insight, Skill.Medicine, Skill.Persuasion, Skill.Religion]
            },
            armor: ['light', 'medium', 'shields'],
            weapons: ['simple']
        },
        startingEquipment: {
            fixed: [
                { item: item('Shield'), quantity: 1 },
                { item: item('Holy Symbol'), quantity: 1 }
            ],
            choices: [
                {
                    description: 'Pilih Senjata:',
                    options: [
                        { name: 'Mace', items: [item('Mace')] },
                        { name: 'Warhammer (jika proficient)', items: [item('Warhammer')] }
                    ]
                },
                {
                    description: 'Pilih Armor:',
                    options: [
                        { name: 'Scale Mail', items: [item('Scale Mail')] },
                        { name: 'Leather Armor', items: [item('Leather Armor')] }
                    ]
                },
                {
                    description: 'Pilih Paket:',
                    options: [
                        { name: "Priest's Pack", items: [item("Priest's Pack")] },
                        { name: "Explorer's Pack", items: [item("Explorer's Pack")] }
                    ]
                }
            ]
        },
        features: [
            {
                name: 'Divine Domain (Life)',
                description: 'Kamu adalah Cleric Domain Kehidupan.'
            },
            {
                name: 'Bonus Proficiency (Life)',
                description: 'Kamu mendapat proficiency dengan Heavy Armor.'
            },
            {
                name: 'Disciple of Life',
                description: 'Spell healing level 1+ yang kamu rapalkan memulihkan HP tambahan sebesar 2 + level spell.'
            }
        ],
        spellcasting: {
            ability: Ability.Wisdom,
            knownCantrips: [spell('Light'), spell('Sacred Flame'), spell('Guidance')],
            knownSpells: [spell('Cure Wounds'), spell('Healing Word'), spell('Guiding Bolt'), spell('Bless'), spell('Shield of Faith')],
            spellSlots: [{ level: 1, max: 2, spent: 0 }]
        }
    },
    "Wizard": {
        name: 'Wizard',
        description: 'Pengguna sihir terpelajar yang memanipulasi realitas.',
        hitDice: '1d6',
        hpAtLevel1: (conMod) => 6 + conMod,
        proficiencies: {
            savingThrows: [Ability.Intelligence, Ability.Wisdom],
            skills: {
                choices: 2,
                options: [Skill.Arcana, Skill.History, Skill.Insight, Skill.Investigation, Skill.Medicine, Skill.Religion]
            },
            armor: [],
            weapons: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light_crossbows']
        },
        startingEquipment: {
            fixed: [
                // (Tambahkan Spellbook ke items.ts nanti)
                // { item: item('Spellbook'), quantity: 1 }
            ],
            choices: [
                {
                    description: 'Pilih Senjata:',
                    options: [
                        { name: 'Quarterstaff', items: [item('Quarterstaff')] },
                        { name: 'Dagger', items: [item('Dagger')] }
                    ]
                },
                {
                    description: 'Pilih Fokus:',
                    options: [
                        { name: 'Arcane Focus', items: [item('Arcane Focus')] },
                        // { name: "Component Pouch", items: [item("Component Pouch")] }
                    ]
                },
                {
                    description: 'Pilih Paket:',
                    options: [
                        { name: "Scholar's Pack", items: [item("Scholar's Pack")] },
                        { name: "Explorer's Pack", items: [item("Explorer's Pack")] }
                    ]
                }
            ]
        },
        features: [
            {
                name: 'Arcane Recovery',
                description: '1x per hari saat short rest, kamu bisa memulihkan spell slot yang terpakai (total level = setengah level Wiz-mu, dibulatkan ke atas).'
            }
        ],
        spellcasting: {
            ability: Ability.Intelligence,
            knownCantrips: [spell('Fire Bolt'), spell('Mage Hand'), spell('Ray of Frost')],
            knownSpells: [spell('Magic Missile'), spell('Shield'), spell('Mage Armor'), spell('Sleep')], // (Wizard 'mempersiapkan' dari 'spellbook', tapi ini SSoT spell yang dia *tahu*)
            spellSlots: [{ level: 1, max: 2, spent: 0 }]
        }
    },
    // (Tambahkan Ranger & Barbarian di sini jika diinginkan)
};