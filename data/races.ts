// data/races.ts
import { Ability, CharacterFeature, Skill, DamageType } from '../types';

export interface RaceData {
    name: string;
    abilityScoreBonuses: Partial<Record<Ability, number>>;
    speed: number;
    traits: CharacterFeature[];
    senses?: { darkvision?: number };
    proficiencies?: { skills?: Skill[], weapons?: string[] };
    // BARU: Defenses rasial
    damageResistances?: DamageType[];
    damageImmunities?: DamageType[];
    damageVulnerabilities?: DamageType[];
    img: string;
}

export const RACES: RaceData[] = [
    {
        name: 'Human',
        abilityScoreBonuses: {
            [Ability.Strength]: 1,
            [Ability.Dexterity]: 1,
            [Ability.Constitution]: 1,
            [Ability.Intelligence]: 1,
            [Ability.Wisdom]: 1,
            [Ability.Charisma]: 1,
        },
        speed: 30,
        traits: [
            { name: 'Languages', description: 'Bisa berbicara, membaca, dan menulis bahasa Common dan satu bahasa tambahan.' }
        ],
        img: 'https://picsum.photos/seed/human-race/200'
    },
    {
        name: 'Elf',
        abilityScoreBonuses: {
            [Ability.Dexterity]: 2,
        },
        speed: 30,
        senses: { darkvision: 60 },
        traits: [
            { name: 'Fey Ancestry', description: 'Memiliki advantage pada saving throw terhadap kondisi charmed, dan sihir tidak bisa menidurkanmu.' },
            { name: 'Trance', description: 'Hanya butuh 4 jam untuk meditasi (setara 8 jam tidur).' },
            { name: 'Languages', description: 'Bisa berbicara, membaca, dan menulis bahasa Common dan Elvish.' }
        ],
        proficiencies: {
            skills: [Skill.Perception]
        },
        img: 'https://picsum.photos/seed/elf-race/200'
    },
    {
        name: 'Dwarf',
        abilityScoreBonuses: {
            [Ability.Constitution]: 2,
        },
        speed: 25, // Sesuai D&D Rules
        senses: { darkvision: 60 },
        traits: [
            { name: 'Dwarven Resilience', description: 'Memiliki advantage pada saving throw terhadap racun, dan resistansi terhadap damage racun.' },
            { name: 'Stonecunning', description: 'Menguasai (proficiency) History check terkait asal-usul batu.' },
            { name: 'Languages', description: 'Bisa berbicara, membaca, dan menulis bahasa Common dan Dwarvish.' }
        ],
        proficiencies: {
            weapons: ['Battleaxe', 'Handaxe', 'Light Hammer', 'Warhammer']
        },
        damageResistances: [DamageType.Poison],
        img: 'https://picsum.photos/seed/dwarf-race/200'
    },
    {
        name: 'Halfling',
        abilityScoreBonuses: {
            [Ability.Dexterity]: 2,
        },
        speed: 25, // Sesuai D&D Rules
        traits: [
            { name: 'Lucky', description: 'Saat melempar d20 dan mendapat angka 1, kamu bisa melempar ulang dadu dan harus menggunakan hasil baru.' },
            { name: 'Brave', description: 'Memiliki advantage pada saving throw terhadap kondisi frightened.' },
            { name: 'Halfling Nimbleness', description: 'Bisa bergerak melalui ruang makhluk yang berukuran lebih besar darimu.' },
            { name: 'Languages', description: 'Bisa berbicara, membaca, dan menulis bahasa Common dan Halfling.' }
        ],
        img: 'https://picsum.photos/seed/halfling-race/200'
    },
    // (File data/races.ts lama punya Tiefling, kita simpan)
    {
        name: 'Tiefling',
        abilityScoreBonuses: {
            [Ability.Charisma]: 2,
            [Ability.Intelligence]: 1,
        },
        speed: 30,
        senses: { darkvision: 60 },
        traits: [
            { name: 'Hellish Resistance', description: 'Memiliki resistansi terhadap damage api.' },
            { name: 'Infernal Legacy', description: 'Tahu cantrip Thaumaturgy. Di Lvl 3, bisa merapal Hellish Rebuke 1x/long rest (spell Lvl 2). Di Lvl 5, bisa merapal Darkness 1x/long rest.' },
            { name: 'Languages', description: 'Bisa berbicara, membaca, dan menulis bahasa Common dan Infernal.' }
        ],
        damageResistances: [DamageType.Fire],
        img: 'https://picsum.photos/seed/tiefling-race/200'
    }
];