import { Monster } from '../types';

// This is a simplified "Monster Manual"
// The AI will use these as a reference but can still create its own variants.
export const DEFAULT_MONSTERS: Omit<Monster, 'id' | 'currentHp' | 'initiative' | 'conditions'>[] = [
  {
    name: "Goblin",
    dexterity: 14,
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
    ]
  },
  {
    name: "Orc",
    dexterity: 12,
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
    ]
  },
  {
    name: "Skeleton",
    dexterity: 14,
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
    ]
  },
  {
      name: "Wolf",
      dexterity: 15,
      maxHp: 11,
      armorClass: 13,
      actions: [
          {
              name: "Bite",
              toHitBonus: 4,
              damageDice: "2d4+2"
          }
      ]
  },
  {
    name: "Bandit",
    dexterity: 12,
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
    ]
  },
  {
    name: "Penduduk Desa",
    dexterity: 10,
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
    ]
  }
];