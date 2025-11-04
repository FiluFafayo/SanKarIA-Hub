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

// (Poin 7) Helper XP
export const xpToNextLevel = (level: number): number => {
    const xpThresholds = [
        0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
        85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
    ];
    return xpThresholds[level] || 0;
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

// (Poin 7) Helper Roll HP dengan Safety Net
export const rollHitDice = (hitDice: string, conMod: number, level: number): number => {
    const match = hitDice.match(/d(\d+)/);
    if (!match) return 1 + conMod; // Fallback
    
    const dieType = parseInt(match[1], 10);
    const median = (dieType / 2) + 1; // Rata-rata roll (misal d8 = 4.5 -> 5)

    if (level === 1) {
        return dieType + conMod; // Selalu max HP di level 1
    }

    const roll = Math.floor(Math.random() * dieType) + 1;
    // Safety Net: Jika roll di bawah rata-rata, ambil rata-rata
    return (roll < median ? median : roll) + conMod;
};

export const rollInitiative = (dexScore: number): number => {
    const roll = Math.floor(Math.random() * 20) + 1;
    return roll + getAbilityModifier(dexScore);
}

// (Poin 5) Helper Waktu D&D
export const formatDndTime = (totalSeconds: number): string => {
    const secondsInDay = 86400;
    const timeOfDay = totalSeconds % secondsInDay;
    
    const hours = Math.floor(timeOfDay / 3600);
    const minutes = Math.floor((timeOfDay % 3600) / 60);
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;

    let timeCategory = "Malam";
    if (hours >= 6 && hours < 12) timeCategory = "Pagi";
    else if (hours >= 12 && hours < 17) timeCategory = "Siang";
    else if (hours >= 17 && hours < 21) timeCategory = "Sore";

    return `${timeCategory} (${displayHours}:${displayMinutes} ${ampm})`;
};

export const addDndTime = (currentSeconds: number, unit: 'round' | 'minute' | 'hour', amount: number): number => {
    let secondsToAdd = 0;
    switch(unit) {
        case 'round': secondsToAdd = 6 * amount; break;
        case 'minute': secondsToAdd = 60 * amount; break;
        case 'hour': secondsToAdd = 3600 * amount; break;
    }
    return currentSeconds + secondsToAdd;
};

// (Poin 3 / Cleanup DRY) Pindahkan parser dialog ke sini
export const parseAndLogNarration = (
    narration: string, 
    turnId: string, 
    campaignActions: any // Gunakan 'any' untuk menghindari impor circular 'CampaignActions'
) => {
    if (!narration || !narration.trim()) return;

    const dialogueRegex = /\[DIALOGUE:([^|]+)\|([^\]]+)\]/g;
    const parts = narration.split(dialogueRegex); // Perbaiki typo: dialogueRegex

    for (let i = 0; i < parts.length; i++) {
        if (i % 3 === 0) {
            // Ini adalah teks narasi biasa
            if (parts[i] && parts[i].trim()) {
                campaignActions.logEvent({ type: 'dm_narration', text: parts[i].trim() }, turnId);
            }
        } else if (i % 3 === 1) {
            // Ini adalah tag [DIALOGUE]
            const npcName = parts[i];
            const text = parts[i + 1];
            if (npcName && text) {
                campaignActions.logEvent({ type: 'dm_dialogue', npcName: npcName.trim(), text: text.trim() }, turnId);
            }
            i++; // Loncat bagian text
        }
    }
};
