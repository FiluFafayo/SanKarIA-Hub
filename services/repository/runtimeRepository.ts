import { dataService } from '../dataService';
import { CampaignRuntimeData } from '../../types';

export const runtimeRepository = {
  loadCampaignRuntimeData: async (
    campaignId: string,
    playerIds: string[]
  ): Promise<CampaignRuntimeData> => {
    return await dataService.loadCampaignRuntimeData(campaignId, playerIds);
  },
};