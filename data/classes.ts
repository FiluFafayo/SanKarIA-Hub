// data/classes.ts
import { Ability, Skill, CharacterFeature, CharacterSpellSlot } from '../types';
// REFAKTOR FASE 0: Impor ItemDefinition dan SpellDefinition DIHAPUS
// untuk memutus circular dependency.
// Definisi kelas sekarang HANYA akan menyimpan string (nama) item/spell.

// (Helper item() dan spell() DIHAPUS)

// Tipe untuk Pilihan
// REFAKTOR FASE 0: 'items' sekarang 'itemNames' dan bertipe string[]
type EquipmentChoice = {
    description: string; // "Pilih (a) atau (b)"
    options: { name: string, itemNames: string[], quantity?: number }[];
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
        // REFAKTOR FASE 0: 'item' sekarang 'itemName' dan bertipe string
        fixed: { itemName: string, quantity: number }[];
        choices: EquipmentChoice[];
    };
    
    features: CharacterFeature[];
    
    // Untuk Spellcaster
    spellcasting?: {
        ability: Ability;
        // REFAKTOR FASE 0: Ini sekarang string[], bukan SpellDefinition[]
        knownCantrips: string[];
        knownSpells: string[];
        spellSlots: CharacterSpellSlot[];
    };
}

export const CLASSES: Record<string, ClassData> = {
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
                        // REFAKTOR FASE 0: items -> itemNames, item() -> string
                        { name: 'Chain Mail', itemNames: ['Chain Mail'] },
                        { name: 'Leather Armor & Longbow', itemNames: ['Leather Armor', 'Longbow', 'Arrows'] }
                    ]
                },
                {
                    description: 'Pilih Senjata:',
                    options: [
                        { name: 'Longsword & Shield', itemNames: ['Longsword', 'Shield'] },
                        { name: 'Dua Longsword', itemNames: ['Longsword'], quantity: 2 }
                    ]
                },
                {
                    description: 'Pilih Paket:',
                    options: [
                        { name: "Explorer's Pack", itemNames: ["Explorer's Pack"] },
                        // { name: "Dungeoneer's Pack", itemNames: ["Dungeoneer's Pack"] } 
                    ]
                }
            ]
        },
        features: [
            {
                name: 'Fighting Style',
                description: 'Pilih satu gaya bertarung (cth: Defense: +1 AC saat memakai armor).'
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
                // REFAKTOR FASE 0: item -> itemName, item() -> string
                { itemName: 'Leather Armor', quantity: 1 },
                { itemName: 'Dagger', quantity: 2 },
                { itemName: "Thieves' Tools", quantity: 1 }
            ],
            choices: [
                {
                    description: 'Pilih Senjata:',
                    options: [
                        { name: 'Rapier', itemNames: ['Rapier'] },
                        { name: 'Shortsword', itemNames: ['Shortsword'] }
                    ]
                },
                {
                    description: 'Pilih Busur:',
                    options: [
                        { name: 'Shortbow & Arrows', itemNames: ['Shortbow', 'Arrows'] },
                        { name: 'Shortsword (lagi)', itemNames: ['Shortsword'] }
                    ]
                },
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
                { itemName: 'Shield', quantity: 1 },
                { itemName: 'Holy Symbol', quantity: 1 }
            ],
            choices: [
                {
                    description: 'Pilih Senjata:',
                    options: [
                        { name: 'Mace', itemNames: ['Mace'] },
                        { name: 'Warhammer (jika proficient)', itemNames: ['Warhammer'] }
                    ]
                },
                {
                    description: 'Pilih Armor:',
                    options: [
                        { name: 'Scale Mail', itemNames: ['Scale Mail'] },
                        { name: 'Leather Armor', itemNames: ['Leather Armor'] }
                    ]
                },
                {
                    description: 'Pilih Paket:',
                    options: [
                        { name: "Priest's Pack", itemNames: ["Priest's Pack"] },
                        { name: "Explorer's Pack", itemNames: ["Explorer's Pack"] }
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
            // REFAKTOR FASE 0: spell() -> string
            knownCantrips: ['Light', 'Sacred Flame', 'Guidance'],
            knownSpells: ['Cure Wounds', 'Healing Word', 'Guiding Bolt', 'Bless', 'Shield of Faith'],
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
                // { itemName: 'Spellbook', quantity: 1 }
            ],
            choices: [
                {
                    description: 'Pilih Senjata:',
                    options: [
                        { name: 'Quarterstaff', itemNames: ['Quarterstaff'] },
                        { name: 'Dagger', itemNames: ['Dagger'] }
                    ]
                },
                {
                    description: 'Pilih Fokus:',
                    options: [
                        { name: 'Arcane Focus', itemNames: ['Arcane Focus'] },
                        // { name: "Component Pouch", itemNames: ["Component Pouch"] }
                    ]
                },
                {
                    description: 'Pilih Paket:',
                    options: [
                        { name: "Scholar's Pack", itemNames: ["Scholar's Pack"] },
                        { name: "Explorer's Pack", itemNames: ["Explorer's Pack"] }
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
            // REFAKTOR FASE 0: spell() -> string
            knownCantrips: ['Fire Bolt', 'Mage Hand', 'Ray of Frost'],
            knownSpells: ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep'],
            spellSlots: [{ level: 1, max: 2, spent: 0 }]
        }
    },
};