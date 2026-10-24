import { ChaosPhysics } from './chaosPhysics';
/**
 * CARTRIDGE 07 // RICOCHET-1 (Heavy Bouncing Plasma Bullet + Interactive Laser Mirrors)
 * Pure tactical ricochet duel:
 * - 1 heavy high-velocity plasma bullet bouncing off walls and reflective mirrors.
 * - Perfect parry accelerates the bullet and redirects along aim angle.
 * - Slide dodge [Dash / B] ducks under incoming high-velocity ricochets.
 * - Interactive rotating and sliding mirrors deflect trajectories at geometric angles.
 * - Host-authoritative simulation and results, with local movement prediction.
 */

import {
  ClientInputPacket,
  ReflectiveMirror,
  RicochetBullet,
  RicochetPlayer,
  RicochetSnapshot,
  RicochetSpark,
  RobotCosmetics
} from '../types';
import { reconcilePlayer, type PredictionHint } from './reconciliation';

export const RICOCHET_WIDTH = 1000;
export const RICOCHET_HEIGHT = 516;

export interface RicochetArenaDef {
  name: string;
  subtitle: string;
  mirrors: Array<{
    baseX: number;
    baseY: number;
    length: number;
    angle: number;
    rotSpeed?: number;
    moveRangeX?: number;
    moveRangeY?: number;
    moveSpeed?: number;
  }>;
}

export const RICOCHET_ARENAS: RicochetArenaDef[] = [
  {
    name: 'SECTOR 01 // PRISMA CENTRAL',
    subtitle: 'Prisma giratorio central y esquinas de refracción a 45°',
    mirrors: [
      // Central Rotating Diamond / Cross Prism
      { baseX: 500, baseY: 258, length: 70, angle: 0, rotSpeed: 0.8 },
      { baseX: 500, baseY: 258, length: 70, angle: Math.PI / 2, rotSpeed: 0.8 },
      // 4 Angled Corner Deflectors (45 degrees)
      { baseX: 160, baseY: 120, length: 65, angle: Math.PI / 4, rotSpeed: 0 },
      { baseX: 840, baseY: 120, length: 65, angle: -Math.PI / 4, rotSpeed: 0 },
      { baseX: 160, baseY: 396, length: 65, angle: -Math.PI / 4, rotSpeed: 0 },
      { baseX: 840, baseY: 396, length: 65, angle: Math.PI / 4, rotSpeed: 0 }
    ]
  },
  {
    name: 'SECTOR 02 // CORREDORES DE REFRACCIÓN',
    subtitle: '4 espejos móviles oscilantes que alteran las líneas de visión',
    mirrors: [
      // 2 Vertical Oscillating Mirrors
      { baseX: 340, baseY: 258, length: 80, angle: Math.PI / 3, moveRangeY: 100, moveSpeed: 1.2 },
      { baseX: 660, baseY: 258, length: 80, angle: -Math.PI / 3, moveRangeY: 100, moveSpeed: 1.2 },
      // 2 Horizontal Top/Bottom Deflectors
      { baseX: 500, baseY: 130, length: 90, angle: 0, moveRangeX: 80, moveSpeed: 1.5 },
      { baseX: 500, baseY: 386, length: 90, angle: 0, moveRangeX: 80, moveSpeed: 1.5 }
    ]
  },
  {
    name: 'SECTOR 03 // CÁMARA CUÁNTICA REACTIVA',
    subtitle: 'Espejos interactivos que giran 45° con cada impacto',
    mirrors: [
      { baseX: 350, baseY: 170, length: 60, angle: Math.PI / 4, rotSpeed: 0 },
      { baseX: 650, baseY: 170, length: 60, angle: -Math.PI / 4, rotSpeed: 0 },
      { baseX: 350, baseY: 346, length: 60, angle: -Math.PI / 4, rotSpeed: 0 },
      { baseX: 650, baseY: 346, length: 60, angle: Math.PI / 4, rotSpeed: 0 },
      { baseX: 500, baseY: 258, length: 75, angle: 0, rotSpeed: 0 }
    ]
  }
];

export class RicochetEngine extends ChaosPhysics {
  public arenaIndex = 0;
  public status: 'PLAYING' | 'ROUND_OVER' | 'MATCH_OVER' = 'PLAYING';
  public statusTimer = 0;
  public roundWinnerId: number | null = null;
  public matchWinnerId: number | null = null;
  public tick = 0;
  public botsEnabled = true;

  public players: RicochetPlayer[] = [];
  public bullets: RicochetBullet[] = [];
  public mirrors: ReflectiveMirror[] = [];
  public sparks: RicochetSpark[] = [];

  private remoteInputs: Map<number, ClientInputPacket> = new Map();
  private lastActionSeqBySlot = new Map<number, number>();

  constructor() {
    super();
    this.initPlayers();
    this.loadArena(0);
  }

  private initPlayers(): void {
    const palette = [
      { body: '#FF4F00', shade: '#B33600', name: 'ALEX' },
      { body: '#1B4DFF', shade: '#0D2E99', name: 'UNIT-02' },
      { body: '#F59E0B', shade: '#B45309', name: 'UNIT-03' },
      { body: '#15803D', shade: '#0F5127', name: 'UNIT-04' }
    ];

    const spawnCoords = [
      { x: 120, y: 140 },
      { x: 880, y: 140 },
      { x: 120, y: 376 },
      { x: 880, y: 376 }
    ];

    this.players = palette.map((p, idx) => ({
      id: idx,
      name: p.name,
      bodyColor: p.body,
      shadeColor: p.shade,
      isBot: idx > 0,
      x: spawnCoords[idx].x,
      y: spawnCoords[idx].y,
      vx: 0,
      vy: 0,
      radius: 17,
      alive: true,
      lives: 3,
      score: 0,
      aimAngle: idx % 2 === 0 ? 0 : Math.PI,
      parryTimer: 0,
      parryCooldown: 0,
      slideTimer: 0,
      slideCooldown: 0,
      walkCycle: 0,
      tiltX: 0,
      respawnTimer: 0,
      lastHitByPlayerId: null
    }));
  }

  public loadArena(index: number): void {
    const cleanIdx = Math.max(0, Math.min(index, RICOCHET_ARENAS.length - 1));
    this.arenaIndex = cleanIdx;
    const def = RICOCHET_ARENAS[cleanIdx];

    this.mirrors = def.mirrors.map((m, idx) => ({
      id: idx,
      baseX: m.baseX,
      baseY: m.baseY,
      x: m.baseX,
      y: m.baseY,
      length: m.length,
      angle: m.angle,
      rotSpeed: m.rotSpeed || 0,
      moveRangeX: m.moveRangeX || 0,
      moveRangeY: m.moveRangeY || 0,
      moveSpeed: m.moveSpeed || 0,
      flashTimer: 0
    }));

    this.resetRound();
  }

  public resetRound(): void {
    this.resetChaosRound();
    this.status = 'PLAYING';
    this.statusTimer = 0;
    this.roundWinnerId = null;
    this.sparks = [];

    // Respawn players in 4 corners
    const spawnCoords = [
      { x: 120, y: 140 },
      { x: 880, y: 140 },
      { x: 120, y: 376 },
      { x: 880, y: 376 }
    ];

    const activeIds = new Set(this.getActiveParticipants().map((p) => p.id));
    this.players.forEach((p, idx) => {
      p.x = spawnCoords[idx].x;
      p.y = spawnCoords[idx].y;
      p.vx = 0;
      p.vy = 0;
      p.alive = activeIds.has(p.id);
      p.lives = 3;
      p.parryTimer = 0;
      p.parryCooldown = 0;
      p.slideTimer = 0;
      p.slideCooldown = 0;
      p.respawnTimer = 0;
      p.aimAngle = idx % 2 === 0 ? 0 : Math.PI;
    });

    // Spawn 1 heavy bouncing plasma bullet in the center
    const randomAngle = (Math.PI / 4) * (Math.floor(Math.random() * 4) * 2 + 1) + 0.15;
    const initialSpeed = 380;
    this.bullets = [
      {
        id: 1,
        x: RICOCHET_WIDTH / 2,
        y: RICOCHET_HEIGHT / 2,
        vx: Math.cos(randomAngle) * initialSpeed,
        vy: Math.sin(randomAngle) * initialSpeed,
        speed: initialSpeed,
        radius: 11,
        ownerId: null,
        bounceCount: 0,
        glowColor: '#FF4F00',
        isSupercharged: false,
        trail: []
      }
    ];
  }

  public resetChampionship(): void {
    this.players.forEach((player) => { player.score = 0; });
    this.matchWinnerId = null;
    this.loadArena(0);
  }

  public syncPlayerIdentities(
    roster: Array<{ name: string; isBot: boolean; cosmetics?: RobotCosmetics }>,
    botsEnabled = true
  ): void {
    this.botsEnabled = botsEnabled;
    roster.forEach((r, idx) => {
      if (this.players[idx]) {
        this.players[idx].name = r.name;
        this.players[idx].isBot = r.isBot;
        this.players[idx].cosmetics = r.cosmetics ? { ...r.cosmetics } : undefined;
      }
    });
    const activeIds = new Set(this.getActiveParticipants().map((p) => p.id));
    this.players.forEach((p) => { if (!activeIds.has(p.id)) p.alive = false; });
  }

  public getActiveParticipants(): RicochetPlayer[] {
    if (this.botsEnabled) return this.players;
    const humans = this.players.filter((p) => !p.isBot);
    // A duel needs an opponent: retain one practice drone only for a solo human.
    const practiceDrone = humans.length === 1 ? this.players.find((p) => p.isBot) : undefined;
    return practiceDrone ? [...humans, practiceDrone] : humans;
  }

  public clearRemoteInput(slotId: number): void {
    this.remoteInputs.delete(slotId);
    this.lastActionSeqBySlot.delete(slotId);
    const player = this.players[slotId];
    if (player) { player.vx = 0; player.vy = 0; }
  }

  public applyRemoteInput(packet: ClientInputPacket): void {
    this.remoteInputs.set(packet.slotId, { ...packet, parryPressed: false, dashPressed: false });
    const p = this.players[packet.slotId];
    if (!p || !p.alive || this.status !== 'PLAYING') return;
    if (packet.actionSeq && packet.actionSeq <= (this.lastActionSeqBySlot.get(packet.slotId) ?? 0)) return;
    if (packet.actionSeq) this.lastActionSeqBySlot.set(packet.slotId, Math.max(packet.actionSeq, this.lastActionSeqBySlot.get(packet.slotId) ?? 0));

    p.aimAngle = packet.aimAngle;
    if (packet.cosmetics) p.cosmetics = packet.cosmetics;

    // Trigger Parry
    if (packet.parryPressed && p.parryCooldown <= 0) {
      p.parryTimer = 0.22;
      p.parryCooldown = 0.45;
    }

    // Trigger Slide Dodge
    if (packet.dashPressed && p.slideCooldown <= 0 && p.slideTimer <= 0) {
      p.slideTimer = 0.32;
      p.slideCooldown = 0.85;
      const angle =
        Math.hypot(packet.moveX, packet.moveY) > 0.1
          ? Math.atan2(packet.moveY, packet.moveX)
          : p.aimAngle;
      p.vx = Math.cos(angle) * 360;
      p.vy = Math.sin(angle) * 360;
    }
  }

  public step(dt: number, localInput: ClientInputPacket): void {
    this.advanceChaos(dt, true, this.status === 'PLAYING', (bomb) => {
      this.applyChaosBlast(bomb, this.getActiveParticipants());
      this.emitSparks(bomb.x, bomb.y, '#EF4444', 18);
    });
    this.tick++;
    const safeDt = Math.min(dt, 0.05);

    if (this.status !== 'PLAYING') {
      this.statusTimer -= safeDt;
      if (this.statusTimer <= 0) {
        if (this.status === 'MATCH_OVER') {
          this.players.forEach((p) => {
            p.lives = 3;
            p.score = 0;
          });
          this.matchWinnerId = null;
        }
        this.resetRound();
      }
      return;
    }

    // 1. Update Mirrors (Rotation and Oscillating movement)
    this.updateMirrors(safeDt);

    // 2. Update Players (Input, AI, Movement, Slide)
    const participants = this.getActiveParticipants();
    const activeIds = new Set(participants.map((p) => p.id));
    this.players.forEach((p) => {
      if (!activeIds.has(p.id)) {
        p.alive = false;
        return;
      }
      if (!p.alive) {
        if (p.lives > 0 && p.respawnTimer > 0) {
          p.respawnTimer -= safeDt;
          if (p.respawnTimer <= 0) {
            p.alive = true;
            p.x = 200 + Math.random() * 600;
            p.y = 150 + Math.random() * 216;
          }
        }
        return;
      }

      const input = p.id === localInput.slotId ? localInput : this.remoteInputs.get(p.id);

      if (p.isBot) {
        this.stepBotAi(p, safeDt);
      } else if (input) {
        this.stepHumanInput(p, input, safeDt);
      }

      // Physics integration
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;

      // Arena Wall Boundary Clamping
      const pad = p.radius + 14;
      p.x = Math.max(pad, Math.min(RICOCHET_WIDTH - pad, p.x));
      p.y = Math.max(pad, Math.min(RICOCHET_HEIGHT - pad, p.y));

      // Timers
      if (p.parryTimer > 0) p.parryTimer -= safeDt;
      if (p.parryCooldown > 0) p.parryCooldown -= safeDt;
      if (p.slideCooldown > 0) p.slideCooldown -= safeDt;

      if (p.slideTimer > 0) {
        p.slideTimer -= safeDt;
        // Slide friction
        p.vx *= Math.pow(0.96, safeDt * 60);
        p.vy *= Math.pow(0.96, safeDt * 60);
      } else {
        // Normal walking damping
        p.vx *= Math.pow(this.floatingDamping(0.82), safeDt * 60);
        p.vy *= Math.pow(this.floatingDamping(0.82), safeDt * 60);
      }
    });

    // 3. Update Plasma Bullets (Ricochet Physics on walls, mirrors, and players)
    const maxBulletSpeed = Math.max(380, ...this.bullets.map((b) => Math.hypot(b.vx, b.vy)));
    const substeps = Math.max(1, Math.min(8, Math.ceil(maxBulletSpeed * this.speedMultiplier * safeDt / 10)));
    for (let i = 0; i < substeps; i++) this.updateBullets(safeDt / substeps);

    // 4. Update Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx * safeDt;
      sp.y += sp.vy * safeDt;
      sp.life -= safeDt;
      if (sp.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    // 5. Check Win / KO Conditions
    const alivePlayers = participants.filter((p) => p.lives > 0);
    const scoredLeader = participants.find((p) => p.score >= 5);
    if (scoredLeader || (participants.length > 1 && alivePlayers.length === 1)) {
      // Elimination is a complete match even when neutral ricochets awarded fewer than 5 KOs.
      this.status = 'MATCH_OVER';
      this.statusTimer = 4;
      this.matchWinnerId = scoredLeader?.id ?? alivePlayers[0].id;
      this.roundWinnerId = this.matchWinnerId;
    } else if (alivePlayers.length === 0) {
      this.status = 'ROUND_OVER';
      this.statusTimer = 2.2;
      this.roundWinnerId = null;
    }
  }

  /** Cosmetic geometry prediction; the host alone resolves player hits, lives and winners. */
  public stepClientPrediction(dt: number, localSlotId: number, input: ClientInputPacket): void {
    this.advanceChaos(dt, false, this.status === 'PLAYING', () => {});
    const safeDt = Math.max(0, Math.min(dt, 0.05));
    if (this.status !== 'PLAYING') return;
    this.updateMirrors(safeDt);
    const activeIds = new Set(this.getActiveParticipants().map((p) => p.id));
    for (const p of this.players) {
      if (!p.alive || !activeIds.has(p.id)) continue;
      if (p.id === localSlotId) this.stepHumanInput(p, input, safeDt);
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      const pad = p.radius + 14;
      p.x = Math.max(pad, Math.min(RICOCHET_WIDTH - pad, p.x));
      p.y = Math.max(pad, Math.min(RICOCHET_HEIGHT - pad, p.y));
      p.parryTimer = Math.max(0, p.parryTimer - safeDt);
      p.parryCooldown = Math.max(0, p.parryCooldown - safeDt);
      p.slideCooldown = Math.max(0, p.slideCooldown - safeDt);
      p.slideTimer = Math.max(0, p.slideTimer - safeDt);
      const damping = this.floatingDamping(p.slideTimer > 0 ? 0.96 : 0.82);
      p.vx *= Math.pow(damping, safeDt * 60);
      p.vy *= Math.pow(damping, safeDt * 60);
    }
    const maxBulletSpeed = Math.max(380, ...this.bullets.map((b) => Math.hypot(b.vx, b.vy)));
    const substeps = Math.max(1, Math.min(8, Math.ceil(maxBulletSpeed * this.speedMultiplier * safeDt / 10)));
    for (let i = 0; i < substeps; i++) this.updateBullets(safeDt / substeps, false);
  }

  private updateMirrors(dt: number): void {
    const time = this.simulationTime;
    this.mirrors.forEach((m) => {
      // Rotation
      if (m.rotSpeed !== 0) {
        m.angle += m.rotSpeed * dt;
      }
      // Oscillation
      if (m.moveRangeX > 0) {
        m.x = m.baseX + Math.sin(time * m.moveSpeed) * m.moveRangeX;
      }
      if (m.moveRangeY > 0) {
        m.y = m.baseY + Math.cos(time * m.moveSpeed) * m.moveRangeY;
      }
      if (m.flashTimer > 0) m.flashTimer -= dt;
    });
  }

  private stepHumanInput(p: RicochetPlayer, input: ClientInputPacket, safeDt: number): void {
    p.aimAngle = input.aimAngle;

    if (p.slideTimer <= 0) {
      const moveSpeed = 220 * this.speedMultiplier;
      const inputLength = Math.max(1, Math.hypot(input.moveX, input.moveY));
      p.vx += input.moveX / inputLength * moveSpeed * 9.5 * safeDt;
      p.vy += input.moveY / inputLength * moveSpeed * 9.5 * safeDt;
      if (Math.hypot(p.vx, p.vy) > 10) {
        p.walkCycle += safeDt * 10;
        p.tiltX = p.vx * 0.001;
      }
    }

    if (input.parryPressed && p.parryCooldown <= 0) {
      p.parryTimer = 0.22;
      p.parryCooldown = 0.45;
    }

    if (input.dashPressed && p.slideCooldown <= 0 && p.slideTimer <= 0) {
      p.slideTimer = 0.32;
      p.slideCooldown = 0.85;
      const angle =
        Math.hypot(input.moveX, input.moveY) > 0.1
          ? Math.atan2(input.moveY, input.moveX)
          : p.aimAngle;
      p.vx = Math.cos(angle) * 360;
      p.vy = Math.sin(angle) * 360;
    }
  }

  private stepBotAi(bot: RicochetPlayer, dt: number): void {
    const bullet = this.bullets[0];
    if (!bullet) return;

    const distToBullet = Math.hypot(bullet.x - bot.x, bullet.y - bot.y);
    const toBotX = bot.x - bullet.x;
    const toBotY = bot.y - bullet.y;
    const bulletHeadingToBot = bullet.vx * toBotX + bullet.vy * toBotY > 0;

    // Aim towards closest opponent
    const opponents = this.players.filter((p) => p.id !== bot.id && p.alive);
    if (opponents.length > 0) {
      const target = opponents[0];
      bot.aimAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
    }

    // Defensive Reaction: Parry or Slide Dodge
    if (bulletHeadingToBot && distToBullet < 80) {
      if (distToBullet < 50 && bot.parryCooldown <= 0) {
        bot.parryTimer = 0.22;
        bot.parryCooldown = 0.45;
      } else if (bot.slideCooldown <= 0 && bot.slideTimer <= 0) {
        // Dodge perpendicular to bullet trajectory
        const perpAngle = Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2;
        bot.slideTimer = 0.32;
        bot.slideCooldown = 0.85;
        bot.vx = Math.cos(perpAngle) * 350;
        bot.vy = Math.sin(perpAngle) * 350;
      }
    } else {
      // Tactical Strafe around closest mirror for cover
      const mirror = this.mirrors[0];
      if (mirror) {
        const angle = this.tick * 0.04 + bot.id * 1.5;
        const targetX = mirror.x + Math.cos(angle) * 160;
        const targetY = mirror.y + Math.sin(angle) * 110;
        const dx = targetX - bot.x;
        const dy = targetY - bot.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 10) {
          bot.vx = (dx / dist) * 180 * this.speedMultiplier;
          bot.vy = (dy / dist) * 180 * this.speedMultiplier;
          bot.walkCycle += dt * 8;
        }
      }
    }
  }

  private updateBullets(dt: number, authoritative = true): void {
    const boundsPad = 12;

    this.bullets.forEach((b) => {
      // Trail
      b.trail.unshift({ x: b.x, y: b.y, alpha: 1.0 });
      if (b.trail.length > 12) b.trail.pop();
      b.trail.forEach((t) => (t.alpha -= 0.08));

      // Move
      b.x += b.vx * dt * this.speedMultiplier;
      b.y += b.vy * dt * this.speedMultiplier;

      // 1. Arena Perimeter Wall Bounces
      let bounced = false;
      if (b.x - b.radius < boundsPad) {
        b.x = boundsPad + b.radius;
        b.vx = Math.abs(b.vx) * 1.015 * this.bounceMultiplier;
        bounced = true;
      } else if (b.x + b.radius > RICOCHET_WIDTH - boundsPad) {
        b.x = RICOCHET_WIDTH - boundsPad - b.radius;
        b.vx = -Math.abs(b.vx) * 1.015 * this.bounceMultiplier;
        bounced = true;
      }

      if (b.y - b.radius < boundsPad) {
        b.y = boundsPad + b.radius;
        b.vy = Math.abs(b.vy) * 1.015 * this.bounceMultiplier;
        bounced = true;
      } else if (b.y + b.radius > RICOCHET_HEIGHT - boundsPad) {
        b.y = RICOCHET_HEIGHT - boundsPad - b.radius;
        b.vy = -Math.abs(b.vy) * 1.015 * this.bounceMultiplier;
        bounced = true;
      }

      if (bounced) {
        b.bounceCount++;
        this.emitSparks(b.x, b.y, b.glowColor, 6);
      }

      // 2. Reflective Mirrors Collision & Reflection
      this.mirrors.forEach((m) => {
        const halfLen = m.length / 2;
        const cos = Math.cos(m.angle);
        const sin = Math.sin(m.angle);
        const x1 = m.x - cos * halfLen;
        const y1 = m.y - sin * halfLen;
        const x2 = m.x + cos * halfLen;
        const y2 = m.y + sin * halfLen;

        // Line segment distance
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        const u = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.y - y1) * dy) / lenSq));
        const closeX = x1 + u * dx;
        const closeY = y1 + u * dy;
        const dist = Math.hypot(b.x - closeX, b.y - closeY);

        if (dist < b.radius + 6) {
          // Mirror Normal vector N
          const nx = -sin;
          const ny = cos;

          // V' = V - 2 * (V . N) * N
          const dot = b.vx * nx + b.vy * ny;
          const side = (b.x - closeX) * nx + (b.y - closeY) * ny >= 0 ? 1 : -1;
          if (dot * side >= 0) return;
          // Separate from the mirror so a resting overlap cannot reflect every tick.
          b.x = closeX + nx * side * (b.radius + 6.1);
          b.y = closeY + ny * side * (b.radius + 6.1);
          b.vx = (b.vx - 2 * dot * nx) * 1.04 * this.bounceMultiplier;
          b.vy = (b.vy - 2 * dot * ny) * 1.04 * this.bounceMultiplier;
          b.bounceCount++;
          m.flashTimer = 0.22;

          // If Chamber 3, rotate mirror 45 degrees upon hit!
          if (this.arenaIndex === 2) {
            m.angle += Math.PI / 4;
          }

          this.emitSparks(closeX, closeY, '#00E5FF', 10);
        }
      });

      // 3. Player Parry Bat & KO Collision
      this.players.forEach((p) => {
        if (!authoritative || !p.alive) return;

        const distToPlayer = Math.hypot(b.x - p.x, b.y - p.y);

        // A. Parry Swing
        if (p.parryTimer > 0 && distToPlayer < p.radius + 26) {
          // Redirect along player aim angle!
          const newSpeed = Math.min(850, Math.hypot(b.vx, b.vy) * 1.25);
          b.vx = Math.cos(p.aimAngle) * newSpeed;
          b.vy = Math.sin(p.aimAngle) * newSpeed;
          b.speed = newSpeed;
          b.ownerId = p.id;
          b.bounceCount = 0;
          b.isSupercharged = true;
          b.glowColor = p.bodyColor;
          p.parryTimer = 0;
          this.emitSparks(p.x, p.y, '#F59E0B', 14);
          return;
        }

        // B. Player Hit (KO)
        // If sliding, player ducks low and dodges bullet!
        if (p.slideTimer > 0) return;

        // If player is hit by bullet
        if (distToPlayer < p.radius + b.radius && (b.ownerId !== p.id || b.bounceCount > 0)) {
          p.alive = false;
          p.lives = Math.max(0, p.lives - 1);
          p.respawnTimer = 2.0;

          if (b.ownerId !== null && this.players[b.ownerId]) {
            this.players[b.ownerId].score++;
          }

          this.emitSparks(p.x, p.y, '#EF4444', 22);

          // Reverse bullet with slight dampening
          b.vx = -b.vx * 0.75;
          b.vy = -b.vy * 0.75;
          b.ownerId = null;
        }
      });
      const velocity = Math.hypot(b.vx, b.vy);
      if (velocity > 1100) {
        b.vx *= 1100 / velocity;
        b.vy *= 1100 / velocity;
      }
      b.speed = Math.hypot(b.vx, b.vy);
    });
  }

  private emitSparks(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 180;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        life: 0.18 + Math.random() * 0.22,
        maxLife: 0.4
      });
    }
    if (this.sparks.length > 96) this.sparks.splice(0, this.sparks.length - 96);
  }

  public getSnapshot(): RicochetSnapshot {
    return {
      roundEpoch: this.roundEpoch,
      simulationTime: this.simulationTime,
      chaosBombs: this.chaosBombs.map((bomb) => ({ ...bomb })),
      arenaIndex: this.arenaIndex,
      arenaTitle: RICOCHET_ARENAS[this.arenaIndex]?.name || 'RICOCHET',
      status: this.status,
      statusTimer: this.statusTimer,
      roundWinnerId: this.roundWinnerId,
      matchWinnerId: this.matchWinnerId,
      players: this.players.map((p) => ({ ...p })),
      bullets: this.bullets.map((b) => ({ ...b, trail: [...b.trail] })),
      mirrors: this.mirrors.map((m) => ({ ...m })),
      sparks: this.sparks.map((s) => ({ ...s }))
    };
  }

  public applySnapshot(snap: RicochetSnapshot, localSlotId?: number, prediction: PredictionHint = 0): void {
    const reset = this.arenaIndex !== snap.arenaIndex || this.status !== snap.status || (snap.roundEpoch !== undefined && snap.roundEpoch !== this.roundEpoch);
    if (this.arenaIndex !== snap.arenaIndex) {
      this.loadArena(snap.arenaIndex);
    }
    this.status = snap.status;
    this.statusTimer = snap.statusTimer;
    this.roundWinnerId = snap.roundWinnerId;
    this.matchWinnerId = snap.matchWinnerId;

    this.players = snap.players.map((sp) => {
      const previous = this.players[sp.id];
      return reconcilePlayer(previous, sp, sp.id === localSlotId,
        reset || previous?.alive !== sp.alive || previous?.lives !== sp.lives || snap.status !== 'PLAYING', prediction);
    });

    this.bullets = snap.bullets.map((bullet) => {
      const previous = this.bullets.find((value) => value.id === bullet.id);
      const reconciled = reconcilePlayer(previous, bullet, false,
        reset || previous?.ownerId !== bullet.ownerId || previous?.bounceCount !== bullet.bounceCount);
      return { ...reconciled, trail: bullet.trail.map((point) => ({ ...point })) };
    });
    this.mirrors = snap.mirrors.map((m) => ({ ...m }));
    this.sparks = snap.sparks.map((s) => ({ ...s }));
    this.roundEpoch = snap.roundEpoch ?? this.roundEpoch;
    this.simulationTime = snap.simulationTime ?? this.simulationTime;
    this.chaosBombs = (snap.chaosBombs ?? []).map((bomb) => ({ ...bomb }));
  }
}
