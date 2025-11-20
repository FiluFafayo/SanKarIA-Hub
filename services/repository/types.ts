import { Campaign, Character, GameEvent } from '../../types';

export interface AuthRepository {
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export interface CampaignRepository {
  getPublishedCampaigns(): Promise<Campaign[]>;
  getMyCampaigns(characterIds: string[]): Promise<Campaign[]>;
  getCampaignByJoinCode(code: string): Promise<Campaign | null>;
  createCampaign(
    campaignData: Omit<
      Campaign,
      | 'id'
      | 'ownerId'
      | 'eventLog'
      | 'monsters'
      | 'players'
      | 'playerIds'
      | 'choices'
      | 'turnId'
      | 'initiativeOrder'
    >,
    userId: string
  ): Promise<Campaign>;
  saveCampaign(campaign: Campaign): Promise<Campaign>;
  addPlayerToCampaign(campaignId: string, playerId: string): Promise<void>;
  logGameEvent(event: Omit<GameEvent, 'id' | 'timestamp'> & { campaignId: string }): Promise<void>;
}

export interface CharacterRepository {
  getMyCharacters(userId: string): Promise<Character[]>;
  saveCharacter(character: Character): Promise<Character>;
  saveNewCharacter(
    charData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'>,
    inventoryData: { item: any; quantity: number; isEquipped: boolean }[],
    spellData: any[]
    // ownerId removed
  ): Promise<Character>;
}

export interface GlobalDataRepository {
  cacheGlobalData(): Promise<void>;
}

export interface RuntimeRepository {
  loadCampaignRuntimeData(
    campaignId: string,
    playerIds: string[]
  ): Promise<{ eventLog: GameEvent[]; monsters: any[]; players: Character[] }>;
}