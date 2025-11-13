import { dataService } from '../dataService';
import { Campaign, GameEvent } from '../../types';

// Helper untuk memetakan record DB kampanye (snake_case) ke tipe aplikasi (camelCase)
function mapDbCampaign(dbCampaign: any): Campaign {
  const {
    campaign_players,
    owner_id,
    dm_personality,
    dm_narration_style,
    response_length,
    game_state,
    current_player_id,
    initiative_order,
    long_term_memory,
    current_time,
    current_weather,
    world_event_counter,
    map_image_url,
    map_markers,
    current_player_location,
    join_code,
    is_published,
    quests,
    npcs,
    ...rest
  } = dbCampaign || {};

  const playerIds = (campaign_players || []).map((p: { character_id: string }) => p.character_id);

  return {
    ...rest,
    // Pastikan array tidak undefined agar pemanggilan .filter aman
    quests: quests || [],
    npcs: npcs || [],
    ownerId: owner_id,
    joinCode: join_code,
    isPublished: is_published,
    dmPersonality: dm_personality,
    dmNarrationStyle: dm_narration_style,
    responseLength: response_length,
    gameState: game_state,
    currentPlayerId: current_player_id,
    initiativeOrder: initiative_order || [],
    longTermMemory: long_term_memory,
    currentTime: parseInt(current_time, 10) || 43200,
    currentWeather: current_weather,
    worldEventCounter: world_event_counter,
    mapImageUrl: map_image_url,
    mapMarkers: map_markers || [],
    currentPlayerLocation: current_player_location,
    explorationGrid: dbCampaign.exploration_grid || [],
    fogOfWar: dbCampaign.fog_of_war || [],
    battleState: dbCampaign.battle_state || null,
    playerGridPosition: dbCampaign.player_grid_position || { x: 50, y: 50 },
    rulesConfig: dbCampaign.rules_config || { 
        startingLevel: 1, 
        advancementType: 'milestone', 
        rollPrivacy: 'public', 
        allowHomebrew: false, 
        maxPartySize: 4 
    },
    playerIds,
    eventLog: [],
    monsters: [],
    players: [],
    choices: [],
    turnId: null,
  } as Campaign;
}

export const campaignRepository = {
  getPublishedCampaigns: async (): Promise<Campaign[]> => {
    const supabase = dataService.getClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, campaign_players(character_id)')
      .eq('is_published', true);

    if (error) throw error;
    return (data || []).map((db: any) => mapDbCampaign(db));
  },

  getMyCampaigns: async (characterIds: string[]): Promise<Campaign[]> => {
    if (characterIds.length === 0) return [];
    const supabase = dataService.getClient();

    const { data: playerLinks, error: linkError } = await supabase
      .from('campaign_players')
      .select('campaign_id')
      .in('character_id', characterIds);

    if (linkError) throw linkError;
    if (!playerLinks || playerLinks.length === 0) return [];

    const campaignIds = [...new Set(playerLinks.map((p: any) => p.campaign_id))];

    const { data: campaignsData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, campaign_players(character_id)')
      .in('id', campaignIds);

    if (campaignError) throw campaignError;
    return (campaignsData || []).map((db: any) => mapDbCampaign(db));
  },

  getCampaignByJoinCode: async (code: string): Promise<Campaign | null> => {
    const supabase = dataService.getClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, campaign_players(character_id)')
      .eq('join_code', code.toUpperCase())
      .single();

    if (error) {
      if ((error as any).code === 'PGRST116') return null;
      throw error;
    }
    if (!data) return null;
    return mapDbCampaign(data as any);
  },

  createCampaign: async (
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
  ): Promise<Campaign> => {
    const supabase = dataService.getClient();
    const dbCampaign: any = {
      owner_id: userId,
      title: campaignData.title,
      description: campaignData.description,
      image: campaignData.image,
      join_code: campaignData.joinCode,
      is_published: campaignData.isPublished,
      maxPlayers: campaignData.maxPlayers,
      theme: campaignData.theme,
      mainGenre: campaignData.mainGenre,
      subGenre: campaignData.subGenre,
      duration: campaignData.duration,
      isNSFW: campaignData.isNSFW,
      dm_personality: campaignData.dmPersonality,
      dm_narration_style: campaignData.dmNarrationStyle,
      response_length: campaignData.responseLength,
      game_state: campaignData.gameState,
      current_player_id: campaignData.currentPlayerId,
      initiative_order: campaignData.initiativeOrder,
      long_term_memory: campaignData.longTermMemory,
      current_time: campaignData.currentTime,
      current_weather: campaignData.currentWeather,
      world_event_counter: campaignData.worldEventCounter,
      map_image_url: campaignData.mapImageUrl,
      map_markers: campaignData.mapMarkers,
      current_player_location: campaignData.currentPlayerLocation,
      quests: campaignData.quests,
      npcs: campaignData.npcs,
      exploration_grid: campaignData.explorationGrid,
      fog_of_war: campaignData.fogOfWar,
      battle_state: campaignData.battleState,
      player_grid_position: campaignData.playerGridPosition,
      rules_config: campaignData.rulesConfig, // Mapping baru
    };

    const { data, error } = await supabase
      .from('campaigns')
      .insert(dbCampaign)
      .select()
      .single();

    if (error) throw error;
    return mapDbCampaign({ ...(data as any), campaign_players: [] });
  },

  saveCampaign: async (campaign: Campaign): Promise<Campaign> => {
    const supabase = dataService.getClient();
    const {
      id,
      title,
      description,
      image,
      joinCode,
      isPublished,
      maxPlayers,
      theme,
      mainGenre,
      subGenre,
      duration,
      isNSFW,
      dmPersonality,
      dmNarrationStyle,
      responseLength,
      gameState,
      currentPlayerId,
      initiativeOrder,
      longTermMemory,
      currentTime,
      currentWeather,
      worldEventCounter,
      mapImageUrl,
      mapMarkers,
      currentPlayerLocation,
      quests,
      npcs,
      explorationGrid,
      fogOfWar,
      battleState,
      playerGridPosition,
    } = campaign as any;

    const dbCampaign: any = {
      title,
      description,
      image,
      join_code: joinCode,
      is_published: isPublished,
      maxPlayers,
      theme,
      mainGenre,
      subGenre,
      duration,
      isNSFW,
      dm_personality: dmPersonality,
      dm_narration_style: dmNarrationStyle,
      response_length: responseLength,
      game_state: gameState,
      current_player_id: currentPlayerId,
      initiative_order: initiativeOrder,
      long_term_memory: longTermMemory,
      current_time: currentTime,
      current_weather: currentWeather,
      world_event_counter: worldEventCounter,
      map_image_url: mapImageUrl,
      map_markers: mapMarkers,
      current_player_location: currentPlayerLocation,
      quests,
      npcs,
      exploration_grid: explorationGrid,
      fog_of_war: fogOfWar,
      battle_state: battleState,
      player_grid_position: playerGridPosition,
    };

    const { data, error } = await supabase
      .from('campaigns')
      .update(dbCampaign)
      .eq('id', id)
      .select('*, campaign_players(character_id)')
      .single();

    if (error) throw error;
    return mapDbCampaign(data as any);
  },

  addPlayerToCampaign: async (
    campaignId: string,
    playerId: string
  ): Promise<void> => {
    const supabase = dataService.getClient();
    const { error } = await supabase
      .from('campaign_players')
      .insert({ campaign_id: campaignId, character_id: playerId })
      .select()
      .single();
    if (error) throw error;
  },

  logGameEvent: async (
    event: Omit<GameEvent, 'id' | 'timestamp'> & { campaignId: string }
  ): Promise<void> => {
    const supabase = dataService.getClient();
    const { campaignId, characterId, roll, reason, turnId, ...eventData } = event as any;
    const dbEvent: any = {
      ...eventData,
      campaign_id: campaignId,
      character_id: characterId || null,
      roll: roll || null,
      reason: reason || null,
      turn_id: turnId,
    };
    const { error } = await supabase.from('game_events').insert(dbEvent);
    if (error) throw error;
  },
};