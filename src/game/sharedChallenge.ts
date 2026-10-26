import { PARTY_GAMES, type PlayableGame } from './partyVote';
import type { ChaosMutatorId } from '../types';
import { readStorage, writeStorage } from '../utils/browser';

export interface SharedChallenge { partySize?: number; eligible?: boolean; code: string; game: PlayableGame; seed: number; stage: number; mutator: ChaosMutatorId }
// Counts are fixed for challenge version 1; extending the catalog preserves existing links.
const stageCounts = [4, 8, 7, 5, 5, 4, 4, 3];
export const validChallengeCode = (code: unknown): code is string => typeof code === 'string' && /^1[A-H]-[A-Z0-9]{4,12}$/.test(code);
export function challengeFromCode(code: string): SharedChallenge | null {
  if (!validChallengeCode(code)) return null;
  let seed = 2166136261;
  for (const char of code) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const index = code.charCodeAt(1) - 65;
  const mutators: ChaosMutatorId[] = ['NONE', 'SUPER_SPEED', 'MOON_GRAVITY', 'BOUNCY_BUMPERS'];
  return { code, game: PARTY_GAMES[index], seed: seed || 1, stage: seed % stageCounts[index],
    mutator: [1, 7].includes(index) ? 'NONE' : mutators[(seed >>> 8) % mutators.length] };
}
export function newChallengeCode(game: PlayableGame): string {
  const random = globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 0xffffffff);
  return `1${String.fromCharCode(65 + PARTY_GAMES.indexOf(game))}-${random.toString(36).toUpperCase().padStart(7, '0')}`;
}
export function validChallenge(v: unknown): v is SharedChallenge {
  if (!v || typeof v !== 'object') return false;
  const c = v as SharedChallenge, expected = challengeFromCode(c.code);
  return (c.partySize === undefined || (Number.isInteger(c.partySize) && c.partySize >= 1 && c.partySize <= 4)) && (c.eligible === undefined || typeof c.eligible === 'boolean') && !!expected && c.game === expected.game && c.seed === expected.seed && c.stage === expected.stage && c.mutator === expected.mutator;
}
export interface ChallengeRecord { id: string; code: string; humans: number; won: boolean; seconds: number; score: number }
export function recordChallenge(record: ChallengeRecord): void {
  if (!validRecord(record)) return;
  const records = readChallengeRecords();
  if (records.some(r => r.id === record.id)) return;
  writeStorage('local', 'tp04_challenge_records', JSON.stringify([record, ...records].slice(0, 50)));
}
function validRecord(r: unknown): r is ChallengeRecord {
  if (!r || typeof r !== 'object') return false;
  const v = r as ChallengeRecord;
  return typeof v.id === 'string' && v.id.length <= 180 && validChallengeCode(v.code) && Number.isInteger(v.humans) && v.humans >= 1 && v.humans <= 4 &&
    typeof v.won === 'boolean' && [v.seconds, v.score].every(n => Number.isFinite(n) && n >= 0 && n <= 1e9);
}
export function readChallengeRecords(): ChallengeRecord[] {
  try { const r: unknown = JSON.parse(readStorage('local', 'tp04_challenge_records') ?? '[]'); return Array.isArray(r) ? r.filter(validRecord).slice(0, 50) : []; } catch { return []; }
}
