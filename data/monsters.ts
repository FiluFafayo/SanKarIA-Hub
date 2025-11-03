// data/monsters.ts
import { MonsterDefinition, Ability, Skill } from '../types';

// Ini adalah SSoT untuk Stat Block Monster, sesuai D&D Basic Rules Ch. 12
// Kita akan menggunakan 'name' sebagai ID unik sementara sebelum seeding ke DB.
export const MONSTER_DEFINITIONS: Omit<MonsterDefinition, 'id'>[] = [
  {
    name: "Goblin",
    armorClass: 15, // (leather armor, shield)
    maxHp: 7, // (2d6)
    abilityScores: {
      [Ability.Strength]: 8, [Ability.Dexterity]: 14, [Ability.Constitution]: 10,
      [Ability.Intelligence]: 10, [Ability.Wisdom]: 8, [Ability.Charisma]: 8
    },
    skills: { [Skill.Stealth]: 6 }, // (+2 DEX + 2 PROF + 2 (double?)) -> PDF bilang +6
    senses: { darkvision: 60, passivePerception: 9 },
    languages: ['Common', 'Goblin'],
    challengeRating: 0.25,
    xp: 50,
    traits: [
      {
        name: "Nimble Escape",
        description: "Goblin bisa mengambil aksi Disengage atau Hide sebagai Bonus Action di setiap gilirannya."
      }
    ],
    actions: [
      {
        name: "Scimitar",
        toHitBonus: 4, // +2 DEX + 2 PROF
        damageDice: "1d6+2",
        description: "Melee Weapon Attack."
      },
      {
        name: "Shortbow",
        toHitBonus: 4, // +2 DEX + 2 PROF
        damageDice: "1d6+2",
        description: "Ranged Weapon Attack (range 80/320)."
      }
    ]
  },
  {
    name: "Orc",
    armorClass: 13, // (hide armor)
    maxHp: 15, // (2d8 + 6)
    abilityScores: {
      [Ability.Strength]: 16, [Ability.Dexterity]: 12, [Ability.Constitution]: 16,
      [Ability.Intelligence]: 7, [Ability.Wisdom]: 11, [Ability.Charisma]: 10
    },
    skills: { [Skill.Intimidation]: 2 },
    senses: { darkvision: 60, passivePerception: 10 },
    languages: ['Common', 'Orc'],
    challengeRating: 0.5,
    xp: 100,
    traits: [
      {
        name: "Aggressive",
        description: "Sebagai Bonus Action di gilirannya, Orc bisa bergerak hingga speed-nya menuju musuh yang bisa dilihatnya."
      }
    ],
    actions: [
      {
        name: "Greataxe",
        toHitBonus: 5, // +3 STR + 2 PROF
        damageDice: "1d12+3",
        description: "Melee Weapon Attack."
      },
      {
        name: "Javelin",
        toHitBonus: 5, // +3 STR + 2 PROF
        damageDice: "1d6+3",
        description: "Melee or Ranged Weapon Attack (range 30/120)."
      }
    ]
  },
  {
    name: "Skeleton",
    armorClass: 13, // (armor scraps)
    maxHp: 13, // (2d8 + 4)
    abilityScores: {
      [Ability.Strength]: 10, [Ability.Dexterity]: 14, [Ability.Constitution]: 15,
      [Ability.Intelligence]: 6, [Ability.Wisdom]: 8, [Ability.Charisma]: 5
    },
    skills: {}, // Tidak ada skill proficiency
    senses: { darkvision: 60, passivePerception: 9 },
    languages: ['understands all languages it knew in life but can\'t speak'],
    challengeRating: 0.25,
    xp: 50,
    traits: [
      { name: 'Damage Vulnerabilities', description: 'Bludgeoning' },
      { name: 'Damage Immunities', description: 'Poison' },
      { name: 'Condition Immunities', description: 'Exhaustion, Poisoned' }
    ],
    actions: [
      {
        name: "Shortsword",
        toHitBonus: 4, // +2 DEX + 2 PROF
        damageDice: "1d6+2",
        description: "Melee Weapon Attack."
      },
      {
        name: "Shortbow",
        toHitBonus: 4, // +2 DEX + 2 PROF
        damageDice: "1d6+2",
        description: "Ranged Weapon Attack (range 80/320)."
      }
    ]
  },
  {
    name: "Wolf",
    armorClass: 13, // (natural armor)
    maxHp: 11, // (2d8 + 2)
    abilityScores: {
      [Ability.Strength]: 12, [Ability.Dexterity]: 15, [Ability.Constitution]: 12,
      [Ability.Intelligence]: 3, [Ability.Wisdom]: 12, [Ability.Charisma]: 6
    },
    skills: { [Skill.Perception]: 3, [Skill.Stealth]: 4 },
    senses: { darkvision: 0, passivePerception: 13 }, // Wolf tidak punya darkvision
    languages: [],
    challengeRating: 0.25,
    xp: 50,
    traits: [
      {
        name: 'Keen Hearing and Smell',
        description: 'Wolf punya advantage pada Wisdom (Perception) check yang mengandalkan pendengaran atau penciuman.'
      },
      {
        name: 'Pack Tactics',
        description: 'Wolf punya advantage pada attack roll terhadap target jika setidaknya satu sekutu Wolf berada dalam 5 kaki dari target dan sekutu itu tidak incapacitated.'
      }
    ],
    actions: [
      {
        name: "Bite",
        toHitBonus: 4, // +2 DEX + 2 PROF
        damageDice: "2d4+2",
        description: "Melee Weapon Attack. Jika target adalah makhluk, ia harus lolos STR save (DC 11) atau dijatuhkan (Prone)."
      }
    ]
  },
  {
    name: "Giant Rat",
    armorClass: 12,
    maxHp: 7, // (2d6)
    abilityScores: {
      [Ability.Strength]: 7, [Ability.Dexterity]: 15, [Ability.Constitution]: 11,
      [Ability.Intelligence]: 2, [Ability.Wisdom]: 10, [Ability.Charisma]: 4
    },
    skills: {},
    senses: { darkvision: 60, passivePerception: 10 },
    languages: [],
    challengeRating: 0.125,
    xp: 25,
    traits: [
      {
        name: "Keen Smell",
        description: "Tikus punya advantage pada Wisdom (Perception) check yang mengandalkan penciuman."
      },
      {
        name: "Pack Tactics",
        description: "Tikus punya advantage pada attack roll terhadap target jika setidaknya satu sekutu Tikus berada dalam 5 kaki dari target dan sekutu itu tidak incapacitated."
      }
    ],
    actions: [
      {
        name: "Bite",
        toHitBonus: 4, // +2 DEX + 2 PROF
        damageDice: "1d4+2",
        description: "Melee Weapon Attack."
      }
    ]
  }
  // (Bandit dan Penduduk Desa akan mirip, kita skip untuk keringkasan,
  // tapi idealnya mereka juga di-update penuh)
];