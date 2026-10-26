import type { RobotSkinId, SessionResult } from '../types';
import { readStorage, writeStorage } from '../utils/browser';

export const SKIN_ACHIEVEMENTS: Array<{ skin: RobotSkinId; label: string; requirement: string }> = [
  { skin: 'RESCUE', label: 'RESCATISTA', requirement: 'Confirma 3 rescates entre tus expediciones.' },
  { skin: 'CHAMPION', label: 'CAMPEÓN', requirement: 'Gana 3 partidas o una copa del Torneo Fiesta.' },
  { skin: 'CHROME', label: 'ACERO PULIDO', requirement: 'Consigue 10 parries perfectos.' },
  { skin: 'FREIGHT', label: 'OPERADOR', requirement: 'Completa una ruta de CARGO-CREW.' }
];

interface PlayerProgress {
  version: 1;
  played: number;
  wins: number;
  rescues: number;
  perfectParries: number;
  cargoRoutes: number;
  cupWins: number;
  bestTimes: Record<string, number>;
  seen: string[];
  recent: Array<{ title: string; won: boolean; seconds: number }>;
}

function fresh(): PlayerProgress {
  return { version: 1, played: 0, wins: 0, rescues: 0, perfectParries: 0, cargoRoutes: 0, cupWins: 0, bestTimes: {}, seen: [], recent: [] };
}

export class PlayerProgressStore {
  public data: PlayerProgress = fresh();
  constructor() {
    try {
      const stored = JSON.parse(readStorage('local', 'tp04_progress_v1') ?? 'null') as PlayerProgress | null;
      const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 1e9;
      if (stored?.version === 1 && ['played', 'wins', 'rescues', 'perfectParries', 'cargoRoutes', 'cupWins'].every(key => count(stored[key as keyof PlayerProgress])) &&
          stored.bestTimes && typeof stored.bestTimes === 'object' && Object.keys(stored.bestTimes).length <= 16 &&
          Object.entries(stored.bestTimes).every(([key, seconds]) => /^[A-Z_0-9]{1,40}$/.test(key) && typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 && seconds <= 1e9) &&
          Array.isArray(stored.seen) && stored.seen.length <= 100 && stored.seen.every(id => typeof id === 'string' && id.length <= 180) &&
          Array.isArray(stored.recent) && stored.recent.length <= 8 && stored.recent.every(r => r && typeof r.title === 'string' && r.title.length <= 100 && typeof r.won === 'boolean' && typeof r.seconds === 'number' && Number.isFinite(r.seconds) && r.seconds >= 0)) this.data = stored;
    } catch { /* Corrupt or unavailable storage starts a fresh local record book. */ }
  }

  public record(result: SessionResult, localSlot: number): RobotSkinId[] {
    const player = result.players.find(p => p.slot === localSlot && !p.isBot);
    if (!player || this.data.seen.includes(result.id)) return [];
    const before = this.unlockedSkins;
    const won = result.winnerSlots.includes(localSlot);
    this.data.played++; if (won) this.data.wins++;
    this.data.rescues += player.stats.rescues;
    this.data.perfectParries += player.stats.perfectParries;
    if (won && result.gameId === 'TOURNAMENT') this.data.cupWins++;
    if (won && result.gameId === 'CARGO_CREW') this.data.cargoRoutes++;
    if (won && result.cooperative && result.durationSeconds > 0) {
      const previous = this.data.bestTimes[result.gameId];
      this.data.bestTimes[result.gameId] = previous === undefined ? result.durationSeconds : Math.min(previous, result.durationSeconds);
    }
    this.data.seen = [...this.data.seen.slice(-99), result.id];
    this.data.recent = [{ title: result.title, won, seconds: result.durationSeconds }, ...this.data.recent].slice(0, 8);
    writeStorage('local', 'tp04_progress_v1', JSON.stringify(this.data));
    return this.unlockedSkins.filter(skin => !before.includes(skin));
  }

  public get unlockedSkins(): RobotSkinId[] {
    return [
      ...(this.data.rescues >= 3 ? ['RESCUE' as const] : []),
      ...(this.data.wins >= 3 || this.data.cupWins > 0 ? ['CHAMPION' as const] : []),
      ...(this.data.perfectParries >= 10 ? ['CHROME' as const] : []),
      ...(this.data.cargoRoutes > 0 ? ['FREIGHT' as const] : [])
    ];
  }
}

export const playerProgress = new PlayerProgressStore();
