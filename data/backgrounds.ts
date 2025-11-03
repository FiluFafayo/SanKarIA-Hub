// data/backgrounds.ts
import { Skill } from '../types';

export interface BackgroundData {
    name: string;
    description: string;
    skillProficiencies: Skill[];
    toolProficiencies: string[];
    languages: string[] | 'any_one' | 'any_two';
    equipment: string[]; // Nama item dari data/items.ts
    feature: {
        name: string;
        description: string;
    };
}

export const BACKGROUNDS: BackgroundData[] = [
    {
        name: 'Acolyte',
        description: 'Kamu telah menghabiskan hidupmu melayani kuil.',
        skillProficiencies: [Skill.Insight, Skill.Religion],
        toolProficiencies: [],
        languages: 'any_two',
        equipment: ['Holy Symbol', "Priest's Pack"], // (Item lain akan ditambahkan)
        feature: {
            name: 'Shelter of the Faithful',
            description: 'Kamu dan kawan-kawanmu bisa menerima penyembuhan dan perawatan gratis di kuil imanmu, meski kamu harus menyediakan komponen material untuk spell.'
        }
    },
    {
        name: 'Criminal',
        description: 'Kamu memiliki sejarah melanggar hukum dan punya kontak di dunia kriminal.',
        skillProficiencies: [Skill.Deception, Skill.Stealth],
        toolProficiencies: ["Thieves' Tools", "Gaming Set (Dice)"],
        languages: [],
        equipment: ['Crowbar', "Common Clothes (Dark)"],
        feature: {
            name: 'Criminal Contact',
            description: 'Kamu punya kontak tepercaya yang bertindak sebagai penghubung ke jaringan kriminal lokal.'
        }
    },
    {
        name: 'Folk Hero',
        description: 'Kamu berasal dari rakyat biasa, namun ditakdirkan untuk hal besar.',
        skillProficiencies: [Skill.AnimalHandling, Skill.Survival],
        toolProficiencies: ["Artisan's Tools (Tinker's Tools)", "Vehicles (Land)"],
        languages: [],
        equipment: ["Artisan's Tools (Tinker's Tools)", "Shovel", "Iron Pot"],
        feature: {
            name: 'Rustic Hospitality',
            description: 'Rakyat biasa akan menerimamu dan menyembunyikanmu dari bahaya. Mereka tidak akan mempertaruhkan nyawa untukmu.'
        }
    },
    {
        name: 'Noble',
        description: 'Kamu memahami kekayaan, kekuasaan, dan privilese.',
        skillProficiencies: [Skill.History, Skill.Persuasion],
        toolProficiencies: ["Gaming Set (Chess)"],
        languages: 'any_one',
        equipment: ['Fine Clothes', 'Signet Ring', 'Scroll of Pedigree'],
        feature: {
            name: 'Position of Privilege',
            description: 'Orang menganggapmu memiliki hak untuk berada di mana saja. Kamu mudah diterima di kalangan atas dan rakyat biasa akan membantumu.'
        }
    },
    {
        name: 'Sage',
        description: 'Kamu menghabiskan tahunan belajar tentang multiverse.',
        skillProficiencies: [Skill.Arcana, Skill.History],
        toolProficiencies: [],
        languages: 'any_two',
        equipment: ['Bottle of Black Ink', 'Quill', 'Small Knife'],
        feature: {
            name: 'Researcher',
            description: 'Jika kamu tidak tahu suatu informasi, kamu sering tahu di mana atau dari siapa informasi itu bisa didapat.'
        }
    },
    {
        name: 'Soldier',
        description: 'Perang telah menjadi hidupmu sejak lama.',
        skillProficiencies: [Skill.Athletics, Skill.Intimidation],
        toolProficiencies: ["Gaming Set (Dice)", "Vehicles (Land)"],
        languages: [],
        equipment: ['Insignia of Rank', 'Trophy (Dagger)', 'Gaming Set (Dice)'],
        feature: {
            name: 'Military Rank',
            description: 'Prajurit dari organisasi militermu dulu masih menghormati pangkatmu dan akan membantumu jika risikonya rendah.'
        }
    }
];