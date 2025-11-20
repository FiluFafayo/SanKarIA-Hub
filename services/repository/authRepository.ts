import { dataService } from '../dataService';
import { DbProfile } from '../types';

export const authRepository = {
  signInWithGoogle: async (): Promise<void> => {
    await dataService.signInWithGoogle();
  },
  signOut: async (): Promise<void> => {
    await dataService.signOut();
  },
  getCurrentUser: async (): Promise<any> => {
    return await dataService.getCurrentUser();
  },
  getOrCreateProfile: async (): Promise<DbProfile | null> => {
    return await dataService.getOrCreateProfile();
  },
};