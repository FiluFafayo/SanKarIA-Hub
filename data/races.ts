import { Ability } from '../types';

export interface RaceData {
    name: string;
    abilityScoreBonuses: Partial<Record<Ability, number>>;
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
        img: 'https://picsum.photos/seed/human-race/200'
    },
    {
        name: 'Elf',
        abilityScoreBonuses: {
            [Ability.Dexterity]: 2,
        },
        img: 'https://picsum.photos/seed/elf-race/200'
    },
    {
        name: 'Dwarf',
        abilityScoreBonuses: {
            [Ability.Constitution]: 2,
        },
        img: 'https://picsum.photos/seed/dwarf-race/200'
    },
     {
        name: 'Halfling',
        abilityScoreBonuses: {
            [Ability.Dexterity]: 2,
        },
        img: 'https://picsum.photos/seed/halfling-race/200'
    },
    {
        name: 'Tiefling',
        abilityScoreBonuses: {
            [Ability.Charisma]: 2,
            [Ability.Intelligence]: 1,
        },
        img: 'https://picsum.photos/seed/tiefling-race/200'
    }
];
