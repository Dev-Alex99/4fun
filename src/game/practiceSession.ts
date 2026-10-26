import type { ClientInputPacket } from '../types';
import type { PlayableGame } from './partyVote';
import { ArenaEngine } from './arenaEngine';
import { ChainPanicEngine } from './chainPanicEngine';
import { CargoCrewEngine } from './cargoCrewEngine';
import { PuttWarEngine } from './puttWarEngine';
import { HotCoreEngine } from './hotCoreEngine';
import { VoltCrownEngine } from './voltCrownEngine';
import { HexCrushEngine } from './hexCrushEngine';
import { RicochetEngine } from './ricochetEngine';

export const PRACTICE_TASKS: Record<PlayableGame, string[]> = {
  BASH_BOT: ['Muévete hasta la bola', 'Devuelve una bola con A / Espacio', 'Esquiva con B / Shift'],
  CHAIN_PANIC: ['Camina por la plataforma', 'Salta con A / Espacio', 'Mantén B / Shift y pulsa E para rescatar al compañero'],
  CARGO_CREW: ['Acércate a la batería', 'Engancha con A / Espacio', 'Transporta la batería un tramo', 'Repara con E cerca de la batería'],
  TURBO_PUTT: ['Mantén A / Espacio para cargar', 'Suelta para golpear la bola', 'Activa el pulso con B / Shift'],
  HOT_CORE: ['Muévete por la cámara', 'Lanza el núcleo con A / Espacio', 'Esquiva con B / Shift'],
  VOLT_CROWN: ['Muévete por la arena', 'Dispara un táser con A / Espacio', 'Esquiva con B / Shift'],
  HEX_CRUSH: ['Muévete sobre las losetas', 'Golpea con A / Espacio', 'Salta con B / Shift', 'Crea un puente con E'],
  RICOCHET_1: ['Muévete hacia la trayectoria', 'Devuelve la bala con A / Espacio', 'Haz una barrida con B / Shift']
};

/** Separate instances: practice cannot publish scores, change a room or grant match rewards. */
export class PracticeSession {
  readonly arena = new ArenaEngine(); readonly chain = new ChainPanicEngine(); readonly cargo = new CargoCrewEngine();
  readonly putt = new PuttWarEngine(); readonly hot = new HotCoreEngine(); readonly volt = new VoltCrownEngine();
  readonly hex = new HexCrushEngine(); readonly ricochet = new RicochetEngine();
  public task = 0; public seconds = 0; private nextBall = 0;
  private rescueStarted = false;
  private start = { x: 0, y: 0 }; private batteryStart = 0;
  private readonly ballTemplate = { ...this.arena.balls[0] };
  constructor(public readonly game: PlayableGame) {
    this.arena.botDifficulty = 'OFF'; this.arena.spawnRound();
    for (const engine of [this.chain, this.cargo, this.putt, this.hot, this.volt, this.hex, this.ricochet]) engine.botsEnabled = false;
    this.arena.balls = []; this.ricochet.bullets = []; this.ricochet.mirrors = [];
    this.hot.core.holderId = 0; this.hot.core.fuseTimer = 120;
    this.chain.lasers = []; this.chain.rotaryLasers = [];
    this.putt.hazards = []; this.putt.bumpers = []; this.putt.windmills = [];
    this.putt.walls = this.putt.walls.slice(0, 4); this.putt.crates = [];
    this.cargo.integrity = 70;
    // Stationary dummies and a stable floor leave time to read the lesson.
    this.hex.players.forEach(p => { p.isBot = false; });
    this.start = { x: this.engine.players[0].x, y: this.engine.players[0].y };
    this.batteryStart = this.cargo.battery.x;
  }
  public get engine() {
    switch (this.game) {
      case 'CHAIN_PANIC': return this.chain; case 'CARGO_CREW': return this.cargo; case 'TURBO_PUTT': return this.putt;
      case 'HOT_CORE': return this.hot; case 'VOLT_CROWN': return this.volt; case 'HEX_CRUSH': return this.hex;
      case 'RICOCHET_1': return this.ricochet; default: return this.arena;
    }
  }
  public get complete(): boolean { return this.task >= PRACTICE_TASKS[this.game].length; }
  public step(dt: number, input: ClientInputPacket): void {
    if (this.complete) return;
    this.seconds += dt;
    const engine = this.engine, p = engine.players[0];
    // Gentle, repeatable incoming shots; failure never removes the player from practice.
    if (this.game === 'BASH_BOT') {
      const p = this.arena.players[0]; p.alive = true; this.arena.phase = 'PLAYING';
      if (this.task === 1 && this.seconds >= this.nextBall) {
        this.nextBall = this.seconds + 2;
        this.arena.balls = [{ ...this.ballTemplate, trail: [], x: p.x + 130, y: p.y, vx: -120, vy: 0,
          speed: 140, baseSpeed: 140, targetId: 0, ownerId: -1, passId: Math.floor(this.seconds) + 100 }];
      }
    }
    if (this.game === 'RICOCHET_1') {
      const p = this.ricochet.players[0]; p.alive = true; p.lives = 99; this.ricochet.status = 'PLAYING';
      if (this.task === 1 && this.seconds >= this.nextBall) {
        this.nextBall = this.seconds + 2;
        this.ricochet.bullets = [{ id: 1, x: p.x + 130, y: p.y, vx: -140, vy: 0, speed: 140,
          radius: 11, ownerId: null, bounceCount: 0, glowColor: '#FF4F00', isSupercharged: false, trail: [] }];
      }
    }
    if (this.game === 'HOT_CORE') this.hot.core.fuseTimer = 120;
    if (this.game === 'TURBO_PUTT') {
      this.putt.holeTimeRemaining = 90;
      if (this.task === 2) { this.putt.players[0].sunkInCup = false; this.putt.status = 'PLAYING'; }
    }
    if (this.game === 'CHAIN_PANIC' && this.task === 2 && !this.rescueStarted) {
      Object.assign(this.chain.players[0], { x: 195, y: 260, z: 0, vz: 0, onGround: true });
      Object.assign(this.chain.players[1], { x: 255, y: 345, z: -20, vz: 0, vx: 0, vy: 0, isDangling: true, dangleTime: 0 });
      this.rescueStarted = Boolean(input.yankPressed && input.anchorHeld);
    }
    if (this.game === 'HEX_CRUSH') {
      this.hex.tiles.forEach(tile => { tile.health = tile.maxHealth; tile.crumbleTimer = 0; tile.fallOffset = 0; tile.fadeAlpha = 1; });
      const p = this.hex.players[0];
      if (input.parryPressed) this.hex.triggerHammerSlam(p, input.aimAngle);
      if (input.dashPressed) this.hex.triggerJumpOrPound(p);
      if (input.yankPressed) this.hex.triggerEmergencyNanobridge(p);
    }
    engine.applyRemoteInput(input);
    engine.step(dt, { ...input, parryPressed: false, dashPressed: false, yankPressed: false, emotePressed: 0 });
    const moved = Math.hypot(p.x - this.start.x, p.y - this.start.y) >= 32;
    let confirmed = false;
    switch (this.game) {
      case 'BASH_BOT': confirmed = [moved, this.arena.matchStats[0].parries > 0, this.arena.players[0].dashCooldown > 0][this.task]; break;
      case 'CHAIN_PANIC': confirmed = [moved, this.chain.players[0].z > 5, this.chain.matchStats[0].rescues > 0][this.task]; break;
      case 'CARGO_CREW': confirmed = [Math.hypot(p.x - this.cargo.battery.x, p.y - this.cargo.battery.y) <= 86,
        this.cargo.players[0].gripping, Math.abs(this.cargo.battery.x - this.batteryStart) >= 30, this.cargo.integrity >= 82][this.task]; break;
      case 'TURBO_PUTT': confirmed = [this.putt.players[0].chargePower > 0.15, this.putt.players[0].strokes > 0, this.putt.players[0].shockwaveCooldown > 0][this.task]; break;
      case 'HOT_CORE': confirmed = [moved, this.hot.core.holderId !== 0 && this.hot.core.lastThrowerId === 0, this.hot.players[0].dashCooldown > 0][this.task]; break;
      case 'VOLT_CROWN': confirmed = [moved, this.volt.players[0].taserCooldown > 0, this.volt.players[0].dashCooldown > 0][this.task]; break;
      case 'HEX_CRUSH': confirmed = [moved, this.hex.players[0].hammerCooldown > 0, this.hex.players[0].z > 5, this.hex.players[0].bridgeCooldown > 0][this.task]; break;
      case 'RICOCHET_1': confirmed = [moved, this.ricochet.matchStats[0].parries > 0, this.ricochet.players[0].slideCooldown > 0][this.task]; break;
    }
    if (confirmed) {
      this.task++;
      if (this.game === 'CHAIN_PANIC' && this.task === 2) {
        const friend = this.chain.players[1];
        Object.assign(friend, { isBot: false, x: p.x + 40, y: p.y, z: -20, vz: 0, isDangling: true, dangleTime: 0 });
      }
    }
  }
  public dispose(): void { this.arena.dispose(); }
}
