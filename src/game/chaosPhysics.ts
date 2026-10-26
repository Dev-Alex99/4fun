import { ChaosMutatorId } from '../types';
import { emptyMatchStats } from './matchResults';

export interface ChaosBomb {
  x: number;
  y: number;
  fuse: number;
  radius: number;
}

/** Shared host clock and physical coefficients; scoring stays in each game engine. */
export class ChaosPhysics {
  private randomSeed: number | null = null;
  public setRandomSeed(seed: number | null): void { this.randomSeed = seed === null ? null : seed >>> 0; }
  protected random(): number {
    if (this.randomSeed === null) return Math.random();
    this.randomSeed = (Math.imul(1664525, this.randomSeed) + 1013904223) >>> 0;
    return this.randomSeed / 4294967296;
  }
  public matchStats = Array.from({ length: 4 }, emptyMatchStats);
  public matchSeconds = 0;
  public resetMatchStats(): void {
    this.matchStats = Array.from({ length: 4 }, emptyMatchStats);
    this.matchSeconds = 0;
  }
  protected noteParry(slot: number, perfect: boolean): void {
    const stats = this.matchStats[slot];
    stats.parries++; if (perfect) stats.perfectParries++;
    stats.streak++; stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  }
  public chaosMutator: ChaosMutatorId = 'NONE';
  public simulationTime = 0;
  public roundEpoch = 0;
  public chaosBombs: ChaosBomb[] = [];
  private nextRainIn = 4;

  public setChaosMutator(mutator: ChaosMutatorId): void {
    if (this.chaosMutator === mutator) return;
    this.chaosMutator = mutator;
    this.nextRainIn = 4;
    this.chaosBombs = [];
  }

  protected get speedMultiplier(): number { return this.chaosMutator === 'SUPER_SPEED' ? 1.45 : 1; }
  protected get gravityMultiplier(): number { return this.chaosMutator === 'MOON_GRAVITY' ? 0.5 : 1; }
  protected get bounceMultiplier(): number { return this.chaosMutator === 'BOUNCY_BUMPERS' ? 2.5 : 1; }
  protected floatingDamping(normal: number): number {
    return this.chaosMutator === 'MOON_GRAVITY' ? Math.sqrt(normal) : normal;
  }

  protected resetChaosRound(): void {
    this.roundEpoch++;
    this.chaosBombs = [];
    this.nextRainIn = 4;
  }

  protected advanceChaos(dt: number, authoritative: boolean, playing: boolean, explode: (bomb: ChaosBomb) => void): void {
    if (authoritative && playing) this.matchSeconds += dt;
    this.simulationTime += dt;
    if (!playing || this.chaosMutator !== 'BOMB_RAIN') return;
    for (let i = this.chaosBombs.length - 1; i >= 0; i--) {
      const bomb = this.chaosBombs[i];
      bomb.fuse = Math.max(0, bomb.fuse - dt);
      if (bomb.fuse === 0 && authoritative) {
        explode(bomb);
        this.chaosBombs.splice(i, 1);
      }
    }
    if (!authoritative) return;
    this.nextRainIn -= dt;
    if (this.nextRainIn <= 0) {
      this.nextRainIn += 4;
      this.chaosBombs.push({ x: 170 + this.random() * 660, y: 120 + this.random() * 275, fuse: 0.8, radius: 145 });
    }
  }

  protected applyChaosBlast(bomb: ChaosBomb, players: Array<{ x: number; y: number; vx: number; vy: number; alive?: boolean; isBot: boolean; sunkInCup?: boolean }>, botsEnabled = true): void {
    for (const player of players) {
      if (player.alive === false || player.sunkInCup || (player.isBot && !botsEnabled)) continue;
      const dx = player.x - bomb.x;
      const dy = player.y - bomb.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= bomb.radius) continue;
      const force = (1 - distance / bomb.radius) * 620 + 100;
      player.vx += (distance > 0 ? dx / distance : 1) * force;
      player.vy += (distance > 0 ? dy / distance : 0) * force;
    }
  }
}
