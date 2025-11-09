import { CampaignState } from "../hooks/useCampaign";
import { Character } from "../types";

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