import { dataService } from '../dataService';
import { Campaign, GameEvent } from '../../types';

// FASE 3: Relational Mapper (The Adapter)
// Fungsi ini merakit kembali potongan data yang tersebar di tabel relasional
// menjadi satu objek 'Campaign' utuh yang dimengerti frontend.
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
    // Relational Fields (Fetch results)
    campaign_npcs,
    active_quests,
    world_maps,
    ...rest
  } = dbCampaign || {};

  const playerIds = (campaign_players || []).map((p: { character_id: string }) => p.character_id);

  // [ATLAS PROTOCOL] Map Active Map Data
  let activeMapId: string | null = null;
  let activeMapData: any = undefined;

  // Cari peta yang aktif (is_active = true), atau ambil yang pertama jika ada
  const activeMap = (world_maps || []).find((m: any) => m.is_active) || (world_maps || [])[0];
  
  if (activeMap) {
      activeMapId = activeMap.id;
      activeMapData = {
          id: activeMap.id,
          campaignId: activeMap.campaign_id,
          name: activeMap.name,
          gridData: activeMap.grid_data || Array.from({ length: 100 }, () => Array(100).fill(10001)),
          fogData: activeMap.fog_data || Array.from({ length: 100 }, () => Array(100).fill(true)),
          markers: activeMap.markers || [],
          isActive: true
      };
  }

  // Map NPCS
  const mappedNpcs = (campaign_npcs || []).map((n: any) => ({
      id: n.id,
      name: n.name,
      description: n.description,
      location: n.location,
      disposition: n.disposition,
      interactionHistory: n.interaction_history || [],
      image: n.image_url,
      opinion: n.opinion || {},
      secret: n.secret
  }));

  // Map Quests
  const mappedQuests = (active_quests || []).map((q: any) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      status: q.status,
      isMainQuest: false, // DB v2 belum strict, anggap false default
      reward: q.reward_summary
  }));

  return {
    ...rest,
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
    
    // Relational Mapped Data
    quests: mappedQuests,
    npcs: mappedNpcs,
    // [ATLAS PROTOCOL] Flattened grids removed. Use activeMapData.
    activeMapId,
    activeMapData,

    battleState: dbCampaign.battle_state || null,
    // Pastikan posisi grid aman
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

// DEEP SELECT QUERY (Standard for all fetches)
const CAMPAIGN_SELECT_QUERY = `
    *,
    campaign_players(character_id),
    campaign_npcs(*),
    active_quests(*),
    world_maps(*)
`;

export const campaignRepository = {
  getPublishedCampaigns: async (): Promise<Campaign[]> => {
    const supabase = dataService.getClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select(CAMPAIGN_SELECT_QUERY)
      .eq('is_published', true);

    if (error) throw error;
    return (data || []).map((db: any) => mapDbCampaign(db));
  },

  getMyCampaigns: async (characterIds: string[]): Promise<Campaign[]> => {
    if (characterIds.length === 0) return [];
    const supabase = dataService.getClient();

    // 1. Get IDs first
    const { data: playerLinks, error: linkError } = await supabase
      .from('campaign_players')
      .select('campaign_id')
      .in('character_id', characterIds);

    if (linkError) throw linkError;
    if (!playerLinks || playerLinks.length === 0) return [];

    const campaignIds = [...new Set(playerLinks.map((p: any) => p.campaign_id))];

    // 2. Fetch Full Data
    const { data: campaignsData, error: campaignError } = await supabase
      .from('campaigns')
      .select(CAMPAIGN_SELECT_QUERY)
      .in('id', campaignIds);

    if (campaignError) throw campaignError;
    return (campaignsData || []).map((db: any) => mapDbCampaign(db));
  },

  getCampaignByJoinCode: async (code: string): Promise<Campaign | null> => {
    const supabase = dataService.getClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select(CAMPAIGN_SELECT_QUERY)
      .eq('join_code', code.toUpperCase())
      .single();

    if (error) {
      if ((error as any).code === 'PGRST116') return null;
      throw error;
    }
    if (!data) return null;
    return mapDbCampaign(data as any);
  },

  // FASE FINAL: ATOMIC TRANSACTION (RPC)
  // Menggunakan Stored Procedure 'create_campaign_atomic' untuk menjamin 
  // Campaign, Map, NPC, dan Quest tersimpan SEMUA atau TIDAK SAMA SEKALI.
  createCampaign: async (
    campaignData: Partial<Campaign>,
    userId: string
  ): Promise<Campaign> => {
    const supabase = dataService.getClient();

    // 1. Prepare CORE Data (Snake Case keys to match DB columns for jsonb_populate_record)
    const corePayload: any = {
      owner_id: userId,
      title: campaignData.title,
      description: campaignData.description,
      cover_url: campaignData.cover_url || campaignData.image,
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
      initiative_order: campaignData.initiativeOrder || [],
      long_term_memory: campaignData.longTermMemory,
      current_time: campaignData.currentTime,
      current_weather: campaignData.currentWeather,
      world_event_counter: campaignData.worldEventCounter,
      map_image_url: campaignData.mapImageUrl,
      map_markers: campaignData.mapMarkers || [],
      current_player_location: campaignData.currentPlayerLocation,
      battle_state: campaignData.battleState,
      rules_config: campaignData.rulesConfig || {},
    };

    // Clean undefined
    Object.keys(corePayload).forEach(key => corePayload[key] === undefined && delete corePayload[key]);

    // 2. Prepare RELATIONAL Payloads
    const mapPayload = campaignData.explorationGrid ? {
        grid_data: campaignData.explorationGrid,
        fog_data: campaignData.fogOfWar || []
    } : null;

    const npcPayload = campaignData.npcs?.map(n => ({
        name: n.name,
        description: n.description,
        location: n.location,
        disposition: n.disposition || 'Neutral',
        interaction_history: n.interactionHistory || [],
        image_url: n.image,
        secret: n.secret
    })) || [];

    const questPayload = campaignData.quests?.map(q => ({
        title: q.title,
        description: q.description,
        status: q.status || 'active',
        reward_summary: q.reward
    })) || [];

    // 3. CALL RPC
    const { data: createdCore, error } = await supabase.rpc('create_campaign_atomic', {
        payload: {
            core: corePayload,
            world_map: mapPayload,
            npcs: npcPayload,
            quests: questPayload
        }
    });

    if (error) throw error;

    // 4. Return Optimistic Mapped Object
    // [QA FIX FASE 1] Memastikan struktur 'activeMap' terbaca jelas oleh mapDbCampaign
    // Kita harus meniru struktur JOIN hasil query 'CAMPAIGN_SELECT_QUERY'
    const optimisticMap = mapPayload ? {
        id: 'temp-optimistic-id', // ID Sementara agar tidak crash
        campaign_id: createdCore.id,
        name: 'Overworld (Default)',
        grid_data: mapPayload.grid_data,
        fog_data: mapPayload.fog_data,
        is_active: true,
        markers: []
    } : null;

    const optimisticCampaignData = {
        ...createdCore,
        // Simulasi relasi kosong/baru
        campaign_players: [], 
        world_maps: optimisticMap ? [optimisticMap] : [],
        campaign_npcs: npcPayload.map((n: any, i: number) => ({ ...n, id: `new-${i}` })),
        active_quests: questPayload.map((q: any, i: number) => ({ ...q, id: `new-${i}` }))
    };

    const mappedResult = mapDbCampaign(optimisticCampaignData);

    // [QA PARANOID CHECK] Validasi Atlas Protocol
    if (campaignData.explorationGrid && !mappedResult.activeMapData) {
         console.warn("⚠️ [Repository] Warning: Map data created but activeMapData is missing in return object. Forcing manual attachment.");
         mappedResult.activeMapData = {
             id: 'temp-optimistic-id',
             campaignId: createdCore.id,
             name: 'Overworld (Default)',
             gridData: mapPayload!.grid_data,
             fogData: mapPayload!.fog_data,
             markers: [],
             isActive: true
         };
         // Sinkronisasi properti flat (Legacy Support)
         mappedResult.explorationGrid = mapPayload!.grid_data;
         mappedResult.fogOfWar = mapPayload!.fog_data;
    }

    return mappedResult;
  },

  saveCampaign: async (campaign: Campaign): Promise<Campaign> => {
    const supabase = dataService.getClient();
    
    // Save Core Only (Update Relasional harus via method spesifik demi integritas)
    const dbCampaign: any = {
      title: campaign.title,
      description: campaign.description,
      cover_url: campaign.cover_url,
      join_code: campaign.joinCode,
      is_published: campaign.isPublished,
      dm_personality: campaign.dmPersonality,
      dm_narration_style: campaign.dmNarrationStyle,
      response_length: campaign.responseLength,
      game_state: campaign.gameState,
      current_player_id: campaign.currentPlayerId,
      initiative_order: campaign.initiativeOrder,
      long_term_memory: campaign.longTermMemory,
      current_time: campaign.currentTime,
      current_weather: campaign.currentWeather,
      world_event_counter: campaign.worldEventCounter,
      map_image_url: campaign.mapImageUrl,
      map_markers: campaign.mapMarkers,
      current_player_location: campaign.currentPlayerLocation,
      battle_state: campaign.battleState,
      // Note: Exploration Grid tidak di-save di sini lagi! Harus via updateMap endpoint (future phase)
      // Tapi untuk menjaga kompatibilitas Fase 3, kita biarkan dulu.
    };

    const { data, error } = await supabase
      .from('campaigns')
      .update(dbCampaign)
      .eq('id', campaign.id)
      .select(CAMPAIGN_SELECT_QUERY)
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