import { CampaignState } from "../hooks/useCampaign";
import { Ability, Character, ConditionEffects, CONDITION_RULES, DamageType, MonsterInstance } from "../types";

type CheckResult = { ok: boolean; reason?: string };

function baseActionChecks(character: Character, campaign: CampaignState): CheckResult {
  if (campaign.gameState !== "combat") {
    return { ok: false, reason: "Aksi ini hanya tersedia saat pertempuran." };
  }
  if (!campaign.turnId || campaign.currentPlayerId !== character.id) {
    return { ok: false, reason: "Bukan giliranmu." };
  }
  if (character.currentHp <= 0) {
    return { ok: false, reason: "Karakter tidak sadar dan tidak dapat bertindak." };
  }
  if (character.usedAction) {
    return { ok: false, reason: "Aksi utama sudah digunakan pada giliran ini." };
  }
  return { ok: true };
}

export function canDash(character: Character, campaign: CampaignState): CheckResult {
  return baseActionChecks(character, campaign);
}

export function canDisengage(character: Character, campaign: CampaignState): CheckResult {
  return baseActionChecks(character, campaign);
}

export function canDodge(character: Character, campaign: CampaignState): CheckResult {
  return baseActionChecks(character, campaign);
}

export function canHide(character: Character, campaign: CampaignState): CheckResult {
  // Saat ini gunakan pemeriksaan dasar; aturan lingkungan/visibility dapat ditambahkan kemudian
  return baseActionChecks(character, campaign);
}

// =============================================================
// Mekanik Kombat yang Diperluas (Adv/Disadv, AC, Saves, Defenses)
// =============================================================

export type AdvantageState = { isAdvantage: boolean; isDisadvantage: boolean; source?: string[] };

export function getAttackAdvantage(attacker: Character, defenderConditions: string[]): AdvantageState {
  const sources: string[] = [];
  let adv = false;
  let dis = false;

  attacker.conditions?.forEach(c => {
    const eff: ConditionEffects | undefined = CONDITION_RULES[c];
    if (!eff) return;
    if (eff.attackAdvantage) { adv = true; sources.push(`Advantage dari kondisi: ${c}`); }
    if (eff.attackDisadvantage) { dis = true; sources.push(`Disadvantage dari kondisi: ${c}`); }
  });

  defenderConditions?.forEach(c => {
    const eff: ConditionEffects | undefined = CONDITION_RULES[c];
    if (!eff) return;
    if (eff.grantsAdvantageToAttackers) { adv = true; sources.push(`Advantage terhadap target kondisi: ${c}`); }
    if (eff.grantsDisadvantageToAttackers) { dis = true; sources.push(`Disadvantage terhadap target kondisi: ${c}`); }
  });

  // Jika keduanya true, netralisasi berdasarkan aturan dasar 5e
  if (adv && dis) {
    return { isAdvantage: false, isDisadvantage: false, source: sources };
  }
  return { isAdvantage: adv, isDisadvantage: dis, source: sources };
}

export function resolveHitVsAC(d20Roll: number, attackModifier: number, targetAc: number, isAdvantage?: boolean, isDisadvantage?: boolean) {
  // Catatan: perhitungan d20Roll dengan advantage/disadvantage dilakukan di UI roll; fungsi ini hanya evaluasi total
  const total = d20Roll + (attackModifier || 0);
  const crit = d20Roll === 20;
  const autoMiss = d20Roll === 1;
  const hit = !autoMiss && (crit || total >= targetAc);
  const details = `d20 ${d20Roll} + mod ${attackModifier} = ${total} vs AC ${targetAc}${crit ? ' (CRIT)' : ''}${autoMiss ? ' (AUTOMISS)' : ''}` +
    (isAdvantage ? ' | Advantage' : '') + (isDisadvantage ? ' | Disadvantage' : '');
  return { hit, isCritical: crit, total, details };
}

export function evaluateSavingThrow(d20Roll: number, saveModifier: number, dc: number) {
  const total = d20Roll + (saveModifier || 0);
  const success = total >= dc;
  return { success, total, details: `d20 ${d20Roll} + mod ${saveModifier} = ${total} vs DC ${dc}` };
}

export function calculateDamageAfterDefenses(
  damage: number,
  type: DamageType | undefined,
  target: { resistances?: DamageType[]; immunities?: DamageType[]; vulnerabilities?: DamageType[] }
): { final: number; note?: string } {
  if (!type) return { final: damage };
  if (target.immunities && target.immunities.includes(type)) {
    return { final: 0, note: `Imun terhadap ${type}` };
  }
  if (target.resistances && target.resistances.includes(type)) {
    return { final: Math.floor(damage / 2), note: `Resisten terhadap ${type} (setengah)` };
  }
  if (target.vulnerabilities && target.vulnerabilities.includes(type)) {
    return { final: damage * 2, note: `Rentan terhadap ${type} (dua kali)` };
  }
  return { final: damage };
}

export function getMonsterDefenses(monster: MonsterInstance) {
  return {
    resistances: monster.definition.damageResistances || [],
    immunities: monster.definition.damageImmunities || [],
    vulnerabilities: monster.definition.damageVulnerabilities || [],
  };
}

export function getCharacterAc(character: Character): number {
  const base = character.armorClass || 10;
  const effectMod = (character.activeEffects || []).reduce((acc, eff) => acc + (eff.acBonus || 0), 0);
  return base + effectMod;
}