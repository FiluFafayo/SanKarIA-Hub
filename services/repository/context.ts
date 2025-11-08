import { authRepository } from './authRepository';
import { campaignRepository } from './campaignRepository';
import { characterRepository } from './characterRepository';
import { globalDataRepository } from './globalDataRepository';
import { runtimeRepository } from './runtimeRepository';
import type {
  AuthRepository,
  CampaignRepository,
  CharacterRepository,
  GlobalDataRepository,
  RuntimeRepository,
} from './types';

export type RepositoryContext = {
  auth: AuthRepository;
  campaign: CampaignRepository;
  character: CharacterRepository;
  globalData: GlobalDataRepository;
  runtime: RuntimeRepository;
};

let currentRepositories: RepositoryContext = {
  auth: authRepository,
  campaign: campaignRepository,
  character: characterRepository,
  globalData: globalDataRepository,
  runtime: runtimeRepository,
};

export function getRepositories(): RepositoryContext {
  return currentRepositories;
}

export function setRepositories(next: Partial<RepositoryContext>) {
  currentRepositories = { ...currentRepositories, ...next } as RepositoryContext;
}