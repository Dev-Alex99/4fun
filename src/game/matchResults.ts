import type { ActiveGameId, MatchStats, SessionResult } from '../types';

export function emptyMatchStats(): MatchStats {
  return { parries: 0, perfectParries: 0, streak: 0, bestStreak: 0, rescues: 0, crownSeconds: 0, deliveries: 0 };
}

export function validMatchStats(value: unknown): value is MatchStats {
  if (!value || typeof value !== 'object') return false;
  const stats = value as MatchStats;
  return Object.keys(emptyMatchStats()).every(key => typeof stats[key as keyof MatchStats] === 'number' &&
    Number.isFinite(stats[key as keyof MatchStats]) && stats[key as keyof MatchStats] >= 0 && stats[key as keyof MatchStats] <= 1e9);
}

export function makeSessionResult(result: Omit<SessionResult, 'highlights'>): SessionResult {
  const highlights: SessionResult['highlights'] = [];
  const awards: Array<[keyof MatchStats, string, string]> = [
    ['rescues', 'MANO AMIGA', 'rescates'], ['perfectParries', 'MANOS DE ACERO', 'parries perfectos'],
    ['bestStreak', 'RACHA IMPARABLE', 'devoluciones sin caer'], ['crownSeconds', 'GUARDIÁN DE LA CORONA', 'segundos de portador'],
    ['deliveries', 'CARGA EN EQUIPO', 'entregas']
  ];
  for (const [stat, title, unit] of awards) {
    if (stat === 'bestStreak' && !['BASH_BOT', 'RICOCHET_1', 'TOURNAMENT'].includes(result.gameId)) continue;
    const maximum = Math.max(0, ...result.players.map(p => p.stats[stat]));
    if (maximum < 1) continue;
    for (const player of result.players.filter(p => Math.abs(p.stats[stat] - maximum) < 0.001)) {
      highlights.push({ slot: player.slot, title, value: Math.floor(maximum), unit });
    }
  }
  return { ...result, players: result.players.map(p => ({ ...p, stats: { ...p.stats } })), highlights: highlights.slice(0, 12) };
}

export function validSessionResult(value: unknown, games: readonly string[]): value is SessionResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as SessionResult;
  const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e9;
  const slot = (n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < 4;
  return typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 180 && [...games, 'TOURNAMENT'].includes(r.gameId as ActiveGameId) &&
    typeof r.title === 'string' && r.title.length <= 100 && typeof r.cooperative === 'boolean' && num(r.durationSeconds) &&
    Array.isArray(r.winnerSlots) && r.winnerSlots.length <= 4 && r.winnerSlots.every(slot) && new Set(r.winnerSlots).size === r.winnerSlots.length &&
    Array.isArray(r.players) && r.players.length > 0 && r.players.length <= 4 && new Set(r.players.map(p => p?.slot)).size === r.players.length &&
    r.players.every(p => p && slot(p.slot) && typeof p.name === 'string' && p.name.length <= 80 && typeof p.isBot === 'boolean' && num(p.score) &&
      validMatchStats(p.stats)) &&
    r.winnerSlots.every(id => r.players.some(p => p.slot === id)) &&
    Array.isArray(r.highlights) && r.highlights.length <= 12 && r.highlights.every(h => h && slot(h.slot) &&
      r.players.some(p => p.slot === h.slot) && typeof h.title === 'string' && h.title.length <= 80 && typeof h.unit === 'string' && h.unit.length <= 80 && num(h.value));
}
