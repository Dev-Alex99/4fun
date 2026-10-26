import type { ActiveGameId } from '../types';
export type PlayableGame = Exclude<ActiveGameId, 'HUB'>;
export const PARTY_GAMES: PlayableGame[] = ['BASH_BOT', 'CHAIN_PANIC', 'TURBO_PUTT', 'HOT_CORE', 'VOLT_CROWN', 'HEX_CRUSH', 'RICOCHET_1', 'CARGO_CREW'];
export interface PartyVote { id: number; open: boolean; ballots: (PlayableGame | null)[]; winner: PlayableGame | null }
export const newVote = (id = 0): PartyVote => ({ id, open: false, ballots: [null, null, null, null], winner: null });
export function validVote(v: unknown): v is PartyVote {
  if (!v || typeof v !== 'object') return false;
  const p = v as PartyVote;
  return Number.isSafeInteger(p.id) && p.id >= 0 && typeof p.open === 'boolean' &&
    Array.isArray(p.ballots) && p.ballots.length === 4 && p.ballots.every(g => g === null || PARTY_GAMES.includes(g)) &&
    (p.winner === null || PARTY_GAMES.includes(p.winner)) && (!p.open || p.winner === null);
}
/** Ties rotate by vote id, so repeated tied ballots do not always favor the same game. */
export function resolveVote(vote: PartyVote, humans: readonly number[]): PlayableGame | null {
  const counts = PARTY_GAMES.map(game => humans.filter(slot => vote.ballots[slot] === game).length);
  const maximum = Math.max(...counts);
  if (!maximum) return null;
  for (let offset = 0; offset < PARTY_GAMES.length; offset++) {
    const i = (vote.id - 1 + offset) % PARTY_GAMES.length;
    if (counts[i] === maximum) return PARTY_GAMES[i];
  }
  return null;
}
