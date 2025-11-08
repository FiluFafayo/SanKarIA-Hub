import { dataService } from '../dataService';

export const globalDataRepository = {
  cacheGlobalData: async (): Promise<void> => {
    await dataService.cacheGlobalData();
  },
};