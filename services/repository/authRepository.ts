import { dataService } from '../dataService';

export const authRepository = {
  signInWithGoogle: async (): Promise<void> => {
    await dataService.signInWithGoogle();
  },
  signOut: async (): Promise<void> => {
    await dataService.signOut();
  },
  // Helper tambahan
  getCurrentUser: async (): Promise<any> => {
    return await dataService.getCurrentUser();
  }
};