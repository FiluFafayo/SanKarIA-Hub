import { Monster, Ability, Skill } from '../types';

// This is a simplified "Monster Manual"
// The AI will use these as a reference but can still create its own variants.
// KITA AKAN UPDATE INI SESUAI ROADMAP FASE 1.3
// UNTUK SAAT INI, KITA HANYA TAMBAHKAN DATA MINIMAL YANG HILANG

const baseAbilityScores: Monster['abilityScores'] = {
  [Ability.Strength]: 10,
  [Ability.Dexterity]: 10,
  [Ability.Constitution]: 10,
  [Ability.Intelligence]: 10,
  [Ability.Wisdom]: 10,
  [Ability.Charisma]: 10,
};

const baseSenses: Monster['senses'] = {
  darkvision: 60,
  passivePerception: 10,
};

// Tipe Omit sekarang harus mencakup SEMUA properti non-default
type DefaultMonsterData = Omit<Monster, 'id' | 'currentHp' | 'initiative' | 'conditions'>;


export const DEFAULT_MONSTERS: DefaultMonsterData[] = [
  {
    name: "Goblin",
    dexterity: 14, // (Hanya untuk backward compatibility, akan dihapus)
    maxHp: 7,
    armorClass: 15,
    actions: [
      {
        name: "Scimitar",
        toHitBonus: 4,
        damageDice: "1d6+2"
      },
      {
        name: "Shortbow",
        toHitBonus: 4,
        damageDice: "1d6+2"
      }
    ],
    // Data BARU (sesuai roadmap)
    abilityScores: { ...baseAbilityScores, strength: 8, dexterity: 14, constitution: 10, wisdom: 8 },
    skills: { [Skill.Stealth]: 6 },
    traits: [{ name: "Nimble Escape", description: "Bisa Disengage/Hide sebagai Bonus Action." }],
    senses: { darkvision: 60, passivePerception: 9 },
    languages: ["Common", "Goblin"],
    challengeRating: 1 / 4,
    xp: 50
  },
  {
    name: "Orc",
    dexterity: 12, // (Hanya untuk backward compatibility, akan dihapus)
    maxHp: 15,
    armorClass: 13,
    actions: [
      {
        name: "Greataxe",
        toHitBonus: 5,
        damageDice: "1d12+3"
      },
      {
        name: "Javelin",
        toHitBonus: 5,
        damageDice: "1d6+3"
      }
    ],
    // Data BARU (sesuai roadmap)
    abilityScores: { ...baseAbilityScores, strength: 16, dexterity: 12, constitution: 16, wisdom: 11 },
    skills: { [Skill.Intimidation]: 2 },
    traits: [{ name: "Aggressive", description: "Bisa Dash sebagai Bonus Action ke arah musuh." }],
    senses: { darkvision: 60, passivePerception: 10 },
    languages: ["Common", "Orc"],
    challengeRating: 1 / 2,
    xp: 100
  },
  {
    name: "Skeleton",
    dexterity: 14, // (Hanya untuk backward compatibility, akan dihapus)
    maxHp: 13,
    armorClass: 13,
    actions: [
      {
        name: "Shortsword",
        toHitBonus: 4,
        damageDice: "1d6+2"
      },
      {
        name: "Shortbow",
        toHitBonus: 4,
        damageDice: "1d6+2"
      }
    ],
    // Data BARU (sesuai roadmap)
    abilityScores: { ...baseAbilityScores, strength: 10, dexterity: 14, constitution: 15, wisdom: 8 },
    skills: {},
    traits: [{ name: "Vulnerability", description: "Bludgeoning" }],
    senses: { darkvision: 60, passivePerception: 9 },
    languages: ["understands languages it knew"],
    challengeRating: 1 / 4,
    xp: 50
  },
  {
    name: "Wolf",
    dexterity: 15, // (Hanya untuk backward compatibility, akan dihapus)
    maxHp: 11,
    armorClass: 13,
    actions: [
      {
        name: "Bite",
        toHitBonus: 4,
        damageDice: "2d4+2"
      }
    ],
    // Data BARU (sesuai roadmap)
    abilityScores: { ...baseAbilityScores, strength: 12, dexterity: 15, constitution: 12, wisdom: 12 },
    skills: { [Skill.Perception]: 3, [Skill.Stealth]: 4 },
    traits: [{ name: "Pack Tactics", description: "Advantage on attack if ally is within 5ft." }, { name: "Keen Hearing and Smell", description: "Advantage on Perception (hearing/smell)." }],
    senses: { darkvision: 0, passivePerception: 13 },
    languages: [],
    challengeRating: 1 / 4,
    xp: 50
  },
  {
    name: "Bandit",
    dexterity: 12, // (Hanya untuk backward compatibility, akan dihapus)
    maxHp: 11,
    armorClass: 12,
    actions: [
      {
        name: "Scimitar",
        toHitBonus: 3,
        damageDice: "1d6+1"
      },
      {
        name: "Light Crossbow",
        toHitBonus: 3,
        damageDice: "1d8+1"
      }
    ],
    // Data BARU (sesuai roadmap)
    abilityScores: { ...baseAbilityScores, strength: 11, dexterity: 12, constitution: 12, wisdom: 10 },
    skills: {},
    traits: [],
    senses: { darkvision: 0, passivePerception: 10 },
    languages: ["Common"],
    challengeRating: 1 / 8,
    xp: 25
  },
  {
    name: "Penduduk Desa",
    dexterity: 10, // (Hanya untuk backward compatibility, akan dihapus)
    maxHp: 4,
    armorClass: 10,
    actions: [
      {
        name: "Club",
        toHitBonus: 2,
        damageDice: "1d4"
      },
      {
        name: "Sling",
        toHitBonus: 2,
        damageDice: "1d4"
      }
    ],
    // Data BARU (sesuai roadmap)
    abilityScores: { ...baseAbilityScores },
    skills: {},
    traits: [],
    senses: { darkvision: 0, passivePerception: 10 },
    languages: ["Common"],
    challengeRating: 0,
    xp: 10
  }
];