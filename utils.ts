export const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const generateJoinCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// D&D 5e Utilities
export const getAbilityModifier = (score: number): number => {
  return Math.floor((score - 10) / 2);
};

export const getProficiencyBonus = (level: number): number => {
  return Math.floor((level - 1) / 4) + 2;
};

// Function to roll dice based on notation like "1d20+5" or "2d6-1"
export const rollDice = (notation: string): { total: number; rolls: number[]; modifier: number } => {
    const diceRegex = /(\d+)d(\d+)([+-]\d+)?/;
    const match = notation.match(diceRegex);

    if (!match) {
        // Handle cases without dice, just a modifier e.g., for damage
        const singleNumber = parseInt(notation, 10);
        if (!isNaN(singleNumber)) {
            return { total: singleNumber, rolls: [singleNumber], modifier: 0 };
        }
        throw new Error(`Invalid dice notation: ${notation}`);
    }

    const numDice = parseInt(match[1], 10);
    const numSides = parseInt(match[2], 10);
    const modifier = match[3] ? parseInt(match[3], 10) : 0;

    let rolls: number[] = [];
    let total = 0;

    for (let i = 0; i < numDice; i++) {
        const roll = Math.floor(Math.random() * numSides) + 1;
        rolls.push(roll);
        total += roll;
    }

    total += modifier;

    return { total, rolls, modifier };
};


// Function to roll 4d6 and drop the lowest for a single ability score
export const rollOneAbilityScore = (): number => {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => a - b);
    rolls.shift(); // remove the lowest
    return rolls.reduce((sum, roll) => sum + roll, 0);
};

export const rollInitiative = (dexScore: number): number => {
    const roll = Math.floor(Math.random() * 20) + 1;
    return roll + getAbilityModifier(dexScore);
}
