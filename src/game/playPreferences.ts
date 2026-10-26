import { readStorage, writeStorage } from '../utils/browser';

export interface PlayPreferences {
  effectsVolume: number; musicVolume: number; reducedMotion: boolean; reducedFlashes: boolean; controlScale: number;
}
const defaults = (): PlayPreferences => ({ effectsVolume: 100, musicVolume: 50,
  reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  reducedFlashes: false, controlScale: 1 });
export function validPreferences(value: unknown): value is PlayPreferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as PlayPreferences;
  return [p.effectsVolume, p.musicVolume].every(v => Number.isFinite(v) && v >= 0 && v <= 100) &&
    typeof p.reducedMotion === 'boolean' && typeof p.reducedFlashes === 'boolean' &&
    [0.9, 1, 1.15].includes(p.controlScale);
}
function read(): PlayPreferences {
  try { const p: unknown = JSON.parse(readStorage('local', 'tp04_play_preferences') ?? 'null'); if (validPreferences(p)) return p; } catch {}
  return defaults();
}
export const playPreferences = read();
export function savePreferences(p: PlayPreferences): void {
  if (!validPreferences(p)) return;
  Object.assign(playPreferences, p);
  writeStorage('local', 'tp04_play_preferences', JSON.stringify(p));
}
