import type { TournamentGameId, TournamentOptions } from '../types';

export const TOURNAMENT_GAMES: TournamentGameId[] = [
  'BASH_BOT', 'HEX_CRUSH', 'HOT_CORE', 'VOLT_CROWN', 'TURBO_PUTT', 'RICOCHET_1'
];

export function defaultTournamentOptions(): TournamentOptions {
  return { totalRounds: 5, games: [...TOURNAMENT_GAMES], mutatorsEnabled: true };
}

export function validTournamentOptions(value: unknown): value is TournamentOptions {
  if (!value || typeof value !== 'object') return false;
  const options = value as TournamentOptions;
  return [3, 5, 7].includes(options.totalRounds) && typeof options.mutatorsEnabled === 'boolean' &&
    Array.isArray(options.games) && options.games.length > 0 && options.games.length <= TOURNAMENT_GAMES.length &&
    new Set(options.games).size === options.games.length && options.games.every(game => TOURNAMENT_GAMES.includes(game));
}
