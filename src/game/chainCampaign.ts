import type { ChainCampaignSave, ChainCampaignState } from '../types';

export function newChainCampaign(active = false): ChainCampaignState {
  return { active, completed: false, runId: globalThis.crypto?.randomUUID?.() ?? `chain-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    checkpointUnlocked: false, elapsedSeconds: 0, sectorSeconds: 0,
    sectorTimes: [], sectorWipes: [0, 0, 0, 0, 0, 0], rescues: [0, 0, 0, 0] };
}

export function copyCampaign(state: ChainCampaignState): ChainCampaignState {
  return { ...state, sectorTimes: [...state.sectorTimes], sectorWipes: [...state.sectorWipes], rescues: [...state.rescues] };
}

export function campaignMedal(seconds: number, wipes: number): 'ORO' | 'PLATA' | 'BRONCE' {
  return wipes === 0 && seconds <= 150 ? 'ORO' : wipes <= 2 && seconds <= 240 ? 'PLATA' : 'BRONCE';
}

export function validCampaignState(value: unknown): value is ChainCampaignState {
  if (!value || typeof value !== 'object') return false;
  const c = value as ChainCampaignState;
  const count = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 100000;
  const time = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e9;
  return typeof c.active === 'boolean' && typeof c.completed === 'boolean' && typeof c.checkpointUnlocked === 'boolean' &&
    typeof c.runId === 'string' && /^[a-zA-Z0-9-]{1,96}$/.test(c.runId) && time(c.elapsedSeconds) && time(c.sectorSeconds) &&
    Array.isArray(c.sectorTimes) && c.sectorTimes.length <= 6 && c.sectorTimes.every(time) &&
    Array.isArray(c.sectorWipes) && c.sectorWipes.length === 6 && c.sectorWipes.every(count) &&
    Array.isArray(c.rescues) && c.rescues.length === 4 && c.rescues.every(count) && (!c.completed || c.sectorTimes.length === 6);
}

export function validCampaignSave(value: unknown): value is ChainCampaignSave {
  if (!value || typeof value !== 'object') return false;
  const save = value as ChainCampaignSave;
  return save.version === 1 && Number.isInteger(save.levelIndex) && save.levelIndex >= 0 && save.levelIndex < 6 &&
    validCampaignState(save.campaign) && save.campaign.active && !save.campaign.completed &&
    save.campaign.sectorTimes.length === save.levelIndex;
}
