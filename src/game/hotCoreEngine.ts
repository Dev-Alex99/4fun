import { reconcilePlayer, type PredictionHint } from './reconciliation';
import { ChaosPhysics } from './chaosPhysics';
import { sfx } from '../audio/mechanicalSfx';
import {
  ClientInputPacket,
  FloatingCallout,
  HotCoreBoostPad,
  HotCoreDevice,
  HotCorePillar,
  HotCorePlayer,
  HotCoreSnapshot,
  LoosePart,
  ParticleEffect,
  PinballBumper,
  PuttExplosion
} from '../types';

export interface HotCoreArenaDef {
  title: string;
  bumpers: Array<{ x: number; y: number; radius: number }>;
  pillars: HotCorePillar[];
  boostPads: HotCoreBoostPad[];
}

export const HOT_CORE_ARENAS: HotCoreArenaDef[] = [
  {
    title: 'CÁMARA 01 // REACTOR CENTRAL',
    bumpers: [
      { x: 350, y: 258, radius: 26 },
      { x: 650, y: 258, radius: 26 }
    ],
    pillars: [],
    boostPads: [
      { x: 440, y: 88, w: 120, h: 42, vx: 260, vy: 0 },
      { x: 440, y: 386, w: 120, h: 42, vx: -260, vy: 0 }
    ]
  },
  {
    title: 'CÁMARA 02 // BÓVEDA DE REBOTE',
    bumpers: [{ x: 500, y: 258, radius: 30 }],
    pillars: [
      { x: 290, y: 150, w: 32, h: 86 },
      { x: 290, y: 280, w: 32, h: 86 },
      { x: 678, y: 150, w: 32, h: 86 },
      { x: 678, y: 280, w: 32, h: 86 }
    ],
    boostPads: []
  },
  {
    title: 'CÁMARA 03 // ACELERADOR DE PLASMA',
    bumpers: [
      { x: 360, y: 165, radius: 22 },
      { x: 640, y: 165, radius: 22 },
      { x: 360, y: 350, radius: 22 },
      { x: 640, y: 350, radius: 22 }
    ],
    pillars: [{ x: 482, y: 222, w: 36, h: 72 }],
    boostPads: [
      { x: 145, y: 210, w: 46, h: 96, vx: 0, vy: -260 },
      { x: 809, y: 210, w: 46, h: 96, vx: 0, vy: 260 }
    ]
  },
  {
    title: 'CÁMARA 04 // NÚCLEO DE ALTA TENSIÓN',
    bumpers: [
      { x: 500, y: 145, radius: 25 },
      { x: 500, y: 371, radius: 25 },
      { x: 280, y: 258, radius: 24 },
      { x: 720, y: 258, radius: 24 }
    ],
    pillars: [
      { x: 385, y: 240, w: 48, h: 36 },
      { x: 567, y: 240, w: 48, h: 36 }
    ],
    boostPads: []
  }
];

const PALETTE = [
  { name: 'UNIT-01', body: '#FF4F00', shade: '#C23B00' },
  { name: 'LEO-BOT', body: '#1B4DFF', shade: '#1034B3' },
  { name: 'MAX-BOT', body: '#F59E0B', shade: '#B45309' },
  { name: 'NICO-BOT', body: '#15803D', shade: '#14532D' }
];

const EMOTES = ['¡TOMA BOMBA!', '¡CORRE!', '¡PARRY!', '¡KABOOM!'];
const ARENA_MIN_X = 96;
const ARENA_MAX_X = 904;
const ARENA_MIN_Y = 66;
const ARENA_MAX_Y = 450;
const WINNING_SCORE = 5;

HOT_CORE_ARENAS.push({ title: 'CÁMARA 05 // CRUCE DE IMPULSOS',
  bumpers: [{ x: 500, y: 160, radius: 26 }, { x: 500, y: 356, radius: 26 }],
  pillars: [{ x: 330, y: 225, w: 35, h: 65 }, { x: 635, y: 225, w: 35, h: 65 }],
  boostPads: [{ x: 420, y: 225, w: 75, h: 65, vx: 0, vy: -230 }, { x: 505, y: 225, w: 75, h: 65, vx: 0, vy: 230 }] });

export class HotCoreEngine extends ChaosPhysics {
  public arenaIndex = 0;
  public arenaTitle = HOT_CORE_ARENAS[0].title;
  public status: 'PLAYING' | 'ROUND_OVER' | 'MATCH_OVER' = 'PLAYING';
  public statusTimer = 0;
  public lastWinnerId: number | null = null;
  public botsEnabled = true;
  public screenShake = 0;

  public players: HotCorePlayer[] = [];
  public core: HotCoreDevice = {
    holderId: 0,
    lastThrowerId: null,
    x: 500,
    y: 258,
    vx: 0,
    vy: 0,
    radius: 14,
    fuseTimer: 10.0,
    maxFuse: 10.0,
    passCount: 0,
    flightTime: 0
  };

  public bumpers: PinballBumper[] = [];
  public pillars: HotCorePillar[] = [];
  public boostPads: HotCoreBoostPad[] = [];
  public explosions: PuttExplosion[] = [];
  public particles: ParticleEffect[] = [];
  public looseParts: LoosePart[] = [];
  public callouts: FloatingCallout[] = [];

  private remoteInputs = new Map<number, ClientInputPacket>();
  private lastActionSeqBySlot = new Map<number, number>();
  private beepAccum = 0;

  constructor() {
    super();
    this.initPlayers();
    this.loadArena(0);
  }

  public initPlayers(): void {
    this.players = PALETTE.map((c, idx) => ({
      id: idx,
      name: c.name,
      bodyColor: c.body,
      shadeColor: c.shade,
      isBot: idx > 0,
      alive: true,
      score: 0,
      x: idx % 2 === 0 ? 220 : 780,
      y: idx < 2 ? 155 : 360,
      vx: 0,
      vy: 0,
      radius: 18,
      aimAngle: 0,
      walkCycle: 0,
      shieldTimer: 0,
      shieldCooldown: 0,
      dashTimer: 0,
      dashCooldown: 0,
      empCooldown: 0,
      passImmunityTimer: 0,
      emoteText: null,
      emoteTimer: 0
    }));
  }

  public syncPlayerIdentities(
    roster: Array<{ name: string; isBot: boolean; cosmetics?: import('../types').RobotCosmetics }>,
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
  }

  public getActiveParticipants(): HotCorePlayer[] {
    const humans = this.players.filter((p) => !p.isBot);
    if (this.botsEnabled) {
      return this.players;
    }
    // If playing solo (1 human) with bots OFF, keep 1 practice drone active so Hot-Core works solo!
    if (humans.length <= 1) {
      return this.players.slice(0, 2);
    }
    return humans;
  }

  public resetChampionship(): void {
    this.resetMatchStats();
    this.players.forEach((p) => {
      p.score = 0;
    });
    this.lastWinnerId = null;
    this.loadArena(0);
  }

  public loadArena(index: number): void {
    this.resetChaosRound();
    this.arenaIndex = ((index % HOT_CORE_ARENAS.length) + HOT_CORE_ARENAS.length) % HOT_CORE_ARENAS.length;
    const def = HOT_CORE_ARENAS[this.arenaIndex];
    this.arenaTitle = def.title;
    this.status = 'PLAYING';
    this.statusTimer = 0;
    this.bumpers = def.bumpers.map((b) => ({ ...b, hitAnim: 0 }));
    this.pillars = def.pillars.map((p) => ({ ...p }));
    this.boostPads = def.boostPads.map((bp) => ({ ...bp }));
    this.explosions = [];
    this.looseParts = [];

    const spawnPoints = [
      { x: 185, y: 140 },
      { x: 815, y: 140 },
      { x: 185, y: 376 },
      { x: 815, y: 376 }
    ];

    const activeIds = new Set(this.getActiveParticipants().map((p) => p.id));

    this.players.forEach((p, idx) => {
      const sp = spawnPoints[idx] || spawnPoints[0];
      p.alive = activeIds.has(p.id);
      p.x = sp.x;
      p.y = sp.y;
      p.vx = 0;
      p.vy = 0;
      p.shieldTimer = 0;
      p.shieldCooldown = 0;
      p.dashTimer = 0;
      p.dashCooldown = 0;
      p.empCooldown = 0;
      p.passImmunityTimer = 0;
      p.aimAngle = Math.atan2(258 - p.y, 500 - p.x);
    });

    this.assignNewCoreToRandomSurvivor(10.0);
  }

  private assignNewCoreToRandomSurvivor(fuseSeconds: number): void {
    const alive = this.players.filter((p) => p.alive);
    const chosen =
      alive.length > 0 ? alive[Math.floor(this.random() * alive.length)] : this.players[0];

    this.core = {
      holderId: chosen.id,
      lastThrowerId: null,
      x: chosen.x,
      y: chosen.y,
      vx: 0,
      vy: 0,
      radius: 14,
      fuseTimer: fuseSeconds,
      maxFuse: fuseSeconds,
      passCount: 0,
      flightTime: 0
    };
    chosen.passImmunityTimer = 0.45;
    this.addCallout(
      chosen.x,
      chosen.y - 34,
      `💣 ¡${chosen.name} TIENE EL NÚCLEO!`,
      '#FF4F00',
      '#FFFFFF'
    );
  }

  public triggerEmote(p: HotCorePlayer, index: number): void {
    const label = EMOTES[(index - 1) % EMOTES.length] || EMOTES[0];
    p.emoteText = label;
    p.emoteTimer = 1.7;
    sfx.playHornEmote(index);
  }

  /**
   * Primary Action (`[CLIC IZQ / ESPACIO]`):
   * - If holding the Core: HURL the Core like a high-speed plasma dodgeball!
   * - If NOT holding the Core: Activate REFLECTOR SHIELD (`0.30s` parry window)!
   */
  public triggerThrowOrShield(p: HotCorePlayer, aimAngle?: number): void {
    if (!p.alive || this.status !== 'PLAYING') return;
    if (aimAngle !== undefined) {
      p.aimAngle = aimAngle;
    }

    if (this.core.holderId === p.id) {
      // Throw the unstable core!
      const throwSpeed = 660;
      this.core.holderId = null;
      this.core.lastThrowerId = p.id;
      this.core.flightTime = 0;
      this.core.x = p.x + Math.cos(p.aimAngle) * (p.radius + 14);
      this.core.y = p.y + Math.sin(p.aimAngle) * (p.radius + 14);
      this.core.vx = Math.cos(p.aimAngle) * throwSpeed;
      this.core.vy = Math.sin(p.aimAngle) * throwSpeed;
      p.passImmunityTimer = 0.32;
      // Slight recoil on thrower
      p.vx -= Math.cos(p.aimAngle) * 140;
      p.vy -= Math.sin(p.aimAngle) * 140;
      sfx.playBatParry(this.core.passCount + 1, false, false);
      this.addCallout(p.x, p.y - 30, '🚀 ¡LANZAMIENTO!', '#FF4F00');
    } else {
      // Activate Reflector Parry Shield!
      if (p.shieldCooldown > 0) return;
      p.shieldTimer = 0.32;
      p.shieldCooldown = 0.68;
      sfx.playCartridgeClick();

      // Immediate proximity reflection if the flying core is already right in front of p!
      if (this.core.holderId === null) {
        const d = Math.hypot(this.core.x - p.x, this.core.y - p.y);
        if (d <= p.radius + this.core.radius + 36) {
          this.executeParryReflection(p);
        }
      }
    }
  }

  /**
   * Secondary Action (`[E]`):
   * - Non-holders: EMP Shockwave + Reflector Shield!
   * - Holder: Overclock Surge (burst of speed at the cost of 0.35s fuse!)
   */
  public triggerEmpOrSurge(p: HotCorePlayer): void {
    if (!p.alive || this.status !== 'PLAYING' || p.empCooldown > 0) return;
    p.empCooldown = 2.6;

    if (this.core.holderId === p.id) {
      p.vx += Math.cos(p.aimAngle) * 480;
      p.vy += Math.sin(p.aimAngle) * 480;
      p.dashTimer = 0.16;
      this.core.fuseTimer = Math.max(1.2, this.core.fuseTimer - 0.35);
      sfx.playDashPiston();
      this.addCallout(p.x, p.y - 30, '⚡ ¡SOBRECARGA!', '#F59E0B', '#18181B');
      return;
    }

    p.shieldTimer = 0.32;
    this.explosions.push({
      x: p.x,
      y: p.y,
      radius: 12,
      maxRadius: 96,
      life: 1.0,
      color: '#1B4DFF'
    });
    sfx.playPinballBumper();

    if (this.core.holderId === null) {
      const cd = Math.hypot(this.core.x - p.x, this.core.y - p.y);
      if (cd <= 105) {
        this.executeParryReflection(p);
        return;
      }
    }

    this.players.forEach((other) => {
      if (other.id !== p.id && other.alive) {
        const dx = other.x - p.x;
        const dy = other.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 105) {
          other.vx += (dx / dist) * 520;
          other.vy += (dy / dist) * 520;
        }
      }
    });
    this.addCallout(p.x, p.y - 30, '🛡️ ¡PULSO EMP!', '#1B4DFF');
  }

  public triggerDash(p: HotCorePlayer, dirX: number, dirY: number): void {
    if (!p.alive || this.status !== 'PLAYING' || p.dashCooldown > 0) return;
    const len = Math.hypot(dirX, dirY) || 1;
    const dashSpd = this.core.holderId === p.id ? 670 : 610;
    p.vx = (dirX / len) * dashSpd;
    p.vy = (dirY / len) * dashSpd;
    p.dashTimer = 0.15;
    p.dashCooldown = 1.05;
    sfx.playDashPiston();
    this.spawnDust(p.x, p.y + 8, 6);
  }

  private executeParryReflection(defender: HotCorePlayer): void {
    const attackerId = this.core.lastThrowerId ?? this.core.holderId;
    const attacker = attackerId !== null ? this.players[attackerId] : null;
    this.core.passCount++;
    this.core.fuseTimer = Math.max(1.5, this.core.fuseTimer - 1.15);

    const reflectAngle = attacker
      ? Math.atan2(attacker.y - defender.y, attacker.x - defender.x)
      : defender.aimAngle;

    this.core.holderId = null;
    this.core.lastThrowerId = defender.id;
    this.core.flightTime = 0;
    this.core.x = defender.x + Math.cos(reflectAngle) * (defender.radius + 16);
    this.core.y = defender.y + Math.sin(reflectAngle) * (defender.radius + 16);
    this.core.vx = Math.cos(reflectAngle) * 820;
    this.core.vy = Math.sin(reflectAngle) * 820;
    defender.passImmunityTimer = 0.55;
    this.noteParry(defender.id, true);
    this.screenShake = 9;
    sfx.playBatParry(this.core.passCount + 2, true, false);
    this.addCallout(defender.x, defender.y - 36, '⚡ ¡CONTRA-PARRY! (-1.2s)', '#15803D', '#FFFFFF');
  }

  private transferCoreToPlayer(target: HotCorePlayer, previousHolder?: HotCorePlayer | null): void {
    if (!target.alive) return;
    if (target.shieldTimer > 0) {
      // Target had their Reflector Shield active! Bounce back!
      this.executeParryReflection(target);
      if (previousHolder) {
        const ang = Math.atan2(previousHolder.y - target.y, previousHolder.x - target.x);
        previousHolder.vx += Math.cos(ang) * 480;
        previousHolder.vy += Math.sin(ang) * 480;
      }
      return;
    }

    this.core.holderId = target.id;
    this.core.lastThrowerId = null;
    this.core.vx = 0;
    this.core.vy = 0;
    this.core.flightTime = 0;
    this.core.passCount++;
    target.passImmunityTimer = 0.45;
    target.lastTaggedAt = performance.now();

    if (previousHolder) {
      previousHolder.passImmunityTimer = 0.65;
      const ang = Math.atan2(target.y - previousHolder.y, target.x - previousHolder.x);
      target.vx += Math.cos(ang) * 340;
      target.vy += Math.sin(ang) * 340;
      previousHolder.vx -= Math.cos(ang) * 260;
      previousHolder.vy -= Math.sin(ang) * 260;
    }

    this.screenShake = 6;
    sfx.playPinballBumper();
    this.addCallout(target.x, target.y - 34, `💣 ¡PASADO A ${target.name}!`, '#FF4F00');
  }

  public clearRemoteInput(slotId: number): void {
    this.remoteInputs.delete(slotId);
    this.lastActionSeqBySlot.delete(slotId);
    const player = this.players[slotId];
    if (player) { player.vx = 0; player.vy = 0; }
  }

  public applyRemoteInput(packet: ClientInputPacket): void {
    this.remoteInputs.set(packet.slotId, { ...packet, clientX: undefined, clientY: undefined, clientZ: undefined });
    const p = this.players[packet.slotId];
    if (!p) return;
    if (packet.name) p.name = packet.name.slice(0, 10).toUpperCase();
    p.aimAngle = packet.aimAngle;



    const isDuplicateAction =
      typeof packet.actionSeq === 'number' &&
      packet.actionSeq > 0 &&
      packet.actionSeq <= (this.lastActionSeqBySlot.get(packet.slotId) ?? 0);
    if (typeof packet.actionSeq === 'number' && packet.actionSeq > 0) {
      this.lastActionSeqBySlot.set(packet.slotId, Math.max(packet.actionSeq, this.lastActionSeqBySlot.get(packet.slotId) ?? 0));
    }

    // FAVOR-THE-DEFENDER ROLLBACK RESCUE (Up to 280ms for high-latency connections!):
    // If a client pressed Shield Parry or EMP on their screen right before getting tagged, reflect the Core!
    if (
      p.alive &&
      !isDuplicateAction &&
      this.core.holderId === p.id &&
      (packet.parryPressed || packet.yankPressed) &&
      p.lastTaggedAt &&
      performance.now() - p.lastTaggedAt <= 280
    ) {
      p.lastTaggedAt = undefined;
      this.executeParryReflection(p);
      return;
    }

    if (!isDuplicateAction && p.alive && this.status === 'PLAYING') {
      if (packet.emotePressed > 0) {
        this.triggerEmote(p, packet.emotePressed);
      }
      if (packet.parryPressed) {
        this.triggerThrowOrShield(p, packet.aimAngle);
      }
      if (packet.yankPressed) {
        this.triggerEmpOrSurge(p);
      }
      if (packet.dashPressed) {
        const dx = packet.moveX || Math.cos(packet.aimAngle);
        const dy = packet.moveY || Math.sin(packet.aimAngle);
        this.triggerDash(p, dx, dy);
      }
    }
  }

  public step(dt: number, hostInput: ClientInputPacket): void {
    this.advanceChaos(dt, true, this.status === 'PLAYING', (bomb) => {
      this.applyChaosBlast(bomb, this.players, this.botsEnabled);
      this.addCallout(bomb.x, bomb.y - 26, 'BOOM', '#EF4444', '#FFFFFF');
    });
    this.remoteInputs.set(hostInput.slotId, hostInput);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 28);
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt * 2.4;
      ex.radius = ex.maxRadius * (1 - ex.life * 0.65);
      if (ex.life <= 0) this.explosions.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= pt.decay * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.looseParts.length - 1; i >= 0; i--) {
      const lp = this.looseParts[i];
      lp.x += lp.vx * dt;
      lp.y += lp.vy * dt;
      lp.vx *= Math.pow(0.92, dt * 60);
      lp.vy *= Math.pow(0.92, dt * 60);
      lp.rot += lp.vRot * dt;
      lp.life = (lp.life ?? 3.2) - dt;
      if (lp.life <= 0) {
        this.looseParts.splice(i, 1);
      }
    }
    while (this.looseParts.length > 28) this.looseParts.shift();
    while (this.particles.length > 40) this.particles.shift();
    while (this.explosions.length > 10) this.explosions.shift();
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 28 * dt;
      c.life -= dt * 1.15;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    this.bumpers.forEach((b) => {
      if (b.hitAnim > 0) b.hitAnim = Math.max(0, b.hitAnim - dt * 4);
    });

    if (this.status !== 'PLAYING') {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) {
        if (this.status === 'MATCH_OVER') {
          this.resetChampionship();
        } else {
          this.loadArena(this.arenaIndex + 1);
        }
      }
      return;
    }

    // 1. Update Core Fuse Countdown & Beep Cadence
    this.core.fuseTimer = Math.max(0, this.core.fuseTimer - dt);
    const beepInterval = Math.max(0.11, this.core.fuseTimer * 0.085);
    this.beepAccum += dt;
    if (this.beepAccum >= beepInterval) {
      this.beepAccum = 0;
      sfx.playCartridgeClick();
    }

    if (this.core.fuseTimer <= 0) {
      this.detonateCore();
      return;
    }

    const activeIds = new Set(this.getActiveParticipants().map((p) => p.id));

    // 2. Update All Players
    this.players.forEach((p) => {
      if (!activeIds.has(p.id)) {
        p.alive = false;
        return;
      }
      if (p.emoteTimer > 0) {
        p.emoteTimer = Math.max(0, p.emoteTimer - dt);
        if (p.emoteTimer <= 0) p.emoteText = null;
      }
      if (!p.alive) return;

      if (p.shieldTimer > 0) p.shieldTimer = Math.max(0, p.shieldTimer - dt);
      if (p.shieldCooldown > 0) p.shieldCooldown = Math.max(0, p.shieldCooldown - dt);
      if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - dt);
      if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
      if (p.empCooldown > 0) p.empCooldown = Math.max(0, p.empCooldown - dt);
      if (p.passImmunityTimer > 0) p.passImmunityTimer = Math.max(0, p.passImmunityTimer - dt);

      const isCarrier = this.core.holderId === p.id;
      const moveSpeed = (isCarrier ? 295 : 235) * this.speedMultiplier;

      if (!p.isBot) {
        const inp = this.remoteInputs.get(p.id);
        if (inp) {
          if (inp.moveX !== 0 || inp.moveY !== 0) {
            const len = Math.hypot(inp.moveX, inp.moveY);
            p.vx += (inp.moveX / len) * moveSpeed * 9.5 * dt;
            p.vy += (inp.moveY / len) * moveSpeed * 9.5 * dt;
          }
          p.aimAngle = inp.aimAngle;


        }
      } else {
        this.stepBotAI(p, dt, moveSpeed, isCarrier);
      }

      // Boost Pads
      for (const bp of this.boostPads) {
        if (p.x >= bp.x && p.x <= bp.x + bp.w && p.y >= bp.y && p.y <= bp.y + bp.h) {
          p.vx += bp.vx * dt * 3.5;
          p.vy += bp.vy * dt * 3.5;
        }
      }

      const damp = this.floatingDamping(p.dashTimer > 0 ? 0.93 : 0.83);
      p.vx *= Math.pow(damp, dt * 60);
      p.vy *= Math.pow(damp, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const spd = Math.hypot(p.vx, p.vy);
      p.walkCycle = spd > 14 ? p.walkCycle + spd * dt * 0.11 : 0;

      // Collide with Arena Bounds, Pillars & Bumpers
      this.constrainCircleToArena(p);
    });

    // 3. Body-Tackle Pass Check (if someone is holding the Core)
    if (this.core.holderId !== null) {
      const carrier = this.players[this.core.holderId];
      if (carrier && carrier.alive) {
        this.core.x = carrier.x;
        this.core.y = carrier.y - 18;
        if (carrier.passImmunityTimer <= 0) {
          for (const other of this.players) {
            if (other.id !== carrier.id && other.alive && other.passImmunityTimer <= 0) {
              const d = Math.hypot(other.x - carrier.x, other.y - carrier.y);
              if (d <= carrier.radius + other.radius + 6) {
                this.transferCoreToPlayer(other, carrier);
                break;
              }
            }
          }
        }
      } else {
        this.assignNewCoreToRandomSurvivor(this.core.fuseTimer);
      }
    } else {
      // 4. Update Flying Core Projectile Physics
      this.core.flightTime += dt;
      this.core.x += this.core.vx * dt * this.speedMultiplier;
      this.core.y += this.core.vy * dt * this.speedMultiplier;
      this.core.vx *= Math.pow(0.99, dt * 60);
      this.core.vy *= Math.pow(0.99, dt * 60);

      // Bounce Flying Core off Walls, Pillars & Bumpers
      this.constrainCoreProjectile();

      // Check Hit against Alive Players
      for (const p of this.players) {
        if (!p.alive) continue;
        if (p.id === this.core.lastThrowerId && this.core.flightTime < 0.22) continue;
        const d = Math.hypot(p.x - this.core.x, p.y - this.core.y);
        if (d <= p.radius + this.core.radius + 6) {
          const thrower =
            this.core.lastThrowerId !== null ? this.players[this.core.lastThrowerId] : null;
          this.transferCoreToPlayer(p, thrower);
          break;
        }
      }

      // If thrown Core missed everyone after 1.15s, magnetically return to thrower!
      if (
        this.core.holderId === null &&
        this.core.flightTime >= 1.15 &&
        this.core.lastThrowerId !== null
      ) {
        const thrower = this.players[this.core.lastThrowerId];
        if (thrower && thrower.alive) {
          this.core.holderId = thrower.id;
          this.core.lastThrowerId = null;
          this.addCallout(thrower.x, thrower.y - 34, '🧲 ¡RETORNO AL PORTADOR!', '#F59E0B', '#18181B');
        } else {
          this.assignNewCoreToRandomSurvivor(this.core.fuseTimer);
        }
      }
    }
  }

  private stepBotAI(bot: HotCorePlayer, dt: number, moveSpeed: number, isCarrier: boolean): void {
    const others = this.players.filter((o) => o.id !== bot.id && o.alive);
    if (others.length === 0) return;

    if (isCarrier) {
      // Chase closest survivor and either tackle or throw when lined up!
      others.sort(
        (a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y)
      );
      const target = others[0];
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const dist = Math.hypot(dx, dy) || 1;
      bot.aimAngle = Math.atan2(dy, dx);

      bot.vx += (dx / dist) * moveSpeed * 7.8 * dt;
      bot.vy += (dy / dist) * moveSpeed * 7.8 * dt;

      if (dist < 250 && dist > 95 && bot.passImmunityTimer <= 0 && this.random() < 0.025) {
        this.triggerThrowOrShield(bot, bot.aimAngle);
      } else if (dist < 150 && bot.dashCooldown <= 0 && this.random() < 0.04) {
        this.triggerDash(bot, dx, dy);
      }
    } else {
      // Evade the Carrier or incoming flying Core!
      const threatX = this.core.x;
      const threatY = this.core.y;
      const dx = bot.x - threatX;
      const dy = bot.y - threatY;
      const dist = Math.hypot(dx, dy) || 1;
      bot.aimAngle = Math.atan2(threatY - bot.y, threatX - bot.x);

      // Steer away from threat and toward center if near walls
      const toCenterX = (500 - bot.x) * 0.35;
      const toCenterY = (258 - bot.y) * 0.35;
      const fleeX = (dx / dist) * 180 + toCenterX;
      const fleeY = (dy / dist) * 180 + toCenterY;
      const fLen = Math.hypot(fleeX, fleeY) || 1;

      bot.vx += (fleeX / fLen) * moveSpeed * 7.2 * dt;
      bot.vy += (fleeY / fLen) * moveSpeed * 7.2 * dt;

      // Attempt shield parry if flying core or carrier gets close!
      if (dist < 85 && bot.shieldCooldown <= 0 && this.random() < 0.14) {
        this.triggerThrowOrShield(bot, bot.aimAngle);
      }
    }
  }

  private detonateCore(): void {
    const victimId =
      this.core.holderId ??
      this.core.lastThrowerId ??
      this.players.find((p) => p.alive)?.id ??
      0;
    const victim = this.players[victimId];

    const exX = victim ? victim.x : this.core.x;
    const exY = victim ? victim.y : this.core.y;

    this.explosions.push({
      x: exX,
      y: exY,
      radius: 18,
      maxRadius: 145,
      life: 1.0,
      color: '#FF4F00'
    });
    this.screenShake = 18;
    sfx.playKODisassembly();

    if (victim && victim.alive) {
      victim.alive = false;
      victim.lastKOAt = performance.now();
      this.spawnDebris(victim.x, victim.y, victim.bodyColor);
      this.addCallout(victim.x, victim.y - 32, `💥 ¡${victim.name} DETONADO!`, '#FF4F00', '#FFFFFF');
    }

    const survivors = this.players.filter((p) => p.alive);
    if (survivors.length <= 1) {
      const winner = survivors[0] || null;
      if (winner) {
        winner.score += 1;
        this.lastWinnerId = winner.id;
        this.addCallout(
          winner.x,
          winner.y - 44,
          `🏆 ¡${winner.name} SOBREVIVE (+1 PTO)!`,
          '#15803D',
          '#FFFFFF'
        );
      }
      if (winner && winner.score >= WINNING_SCORE) {
        this.status = 'MATCH_OVER';
        this.statusTimer = 3.2;
      } else {
        this.status = 'ROUND_OVER';
        this.statusTimer = 2.0;
      }
    } else {
      // More than 1 survivor remains -> spawn a fresh faster Core on one of the remaining survivors!
      this.assignNewCoreToRandomSurvivor(8.2);
    }
  }

  private constrainCircleToArena(p: { x: number; y: number; vx: number; vy: number; radius: number }): void {
    if (p.x - p.radius < ARENA_MIN_X) {
      p.x = ARENA_MIN_X + p.radius;
      p.vx = Math.abs(p.vx) * 0.6 * this.bounceMultiplier;
    } else if (p.x + p.radius > ARENA_MAX_X) {
      p.x = ARENA_MAX_X - p.radius;
      p.vx = -Math.abs(p.vx) * 0.6 * this.bounceMultiplier;
    }
    if (p.y - p.radius < ARENA_MIN_Y) {
      p.y = ARENA_MIN_Y + p.radius;
      p.vy = Math.abs(p.vy) * 0.6 * this.bounceMultiplier;
    } else if (p.y + p.radius > ARENA_MAX_Y) {
      p.y = ARENA_MAX_Y - p.radius;
      p.vy = -Math.abs(p.vy) * 0.6 * this.bounceMultiplier;
    }

    for (const bmp of this.bumpers) {
      const dx = p.x - bmp.x;
      const dy = p.y - bmp.y;
      const d = Math.hypot(dx, dy);
      const minD = p.radius + bmp.radius;
      if (d < minD && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        p.x = bmp.x + nx * minD;
        p.y = bmp.y + ny * minD;
        p.vx += nx * 280 * this.bounceMultiplier;
        p.vy += ny * 280 * this.bounceMultiplier;
        bmp.hitAnim = 1.0;
      }
    }

    for (const pil of this.pillars) {
      const cx = Math.max(pil.x, Math.min(p.x, pil.x + pil.w));
      const cy = Math.max(pil.y, Math.min(p.y, pil.y + pil.h));
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < p.radius && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        p.x = cx + nx * (p.radius + 1);
        p.y = cy + ny * (p.radius + 1);
        const dot = p.vx * nx + p.vy * ny;
        if (dot < 0) {
          p.vx -= (1 + 0.8 * this.bounceMultiplier) * dot * nx;
          p.vy -= (1 + 0.8 * this.bounceMultiplier) * dot * ny;
        }
      }
    }
  }

  private constrainCoreProjectile(): void {
    const c = this.core;
    if (c.x - c.radius < ARENA_MIN_X) {
      c.x = ARENA_MIN_X + c.radius;
      c.vx = Math.abs(c.vx) * this.bounceMultiplier;
      sfx.playCartridgeClick();
    } else if (c.x + c.radius > ARENA_MAX_X) {
      c.x = ARENA_MAX_X - c.radius;
      c.vx = -Math.abs(c.vx) * this.bounceMultiplier;
      sfx.playCartridgeClick();
    }
    if (c.y - c.radius < ARENA_MIN_Y) {
      c.y = ARENA_MIN_Y + c.radius;
      c.vy = Math.abs(c.vy) * this.bounceMultiplier;
      sfx.playCartridgeClick();
    } else if (c.y + c.radius > ARENA_MAX_Y) {
      c.y = ARENA_MAX_Y - c.radius;
      c.vy = -Math.abs(c.vy) * this.bounceMultiplier;
      sfx.playCartridgeClick();
    }

    for (const bmp of this.bumpers) {
      const dx = c.x - bmp.x;
      const dy = c.y - bmp.y;
      const d = Math.hypot(dx, dy);
      const minD = c.radius + bmp.radius;
      if (d < minD && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        c.x = bmp.x + nx * minD;
        c.y = bmp.y + ny * minD;
        const spd = Math.min(1600, Math.max(580, Math.hypot(c.vx, c.vy) * 1.08) * this.bounceMultiplier);
        c.vx = nx * spd;
        c.vy = ny * spd;
        bmp.hitAnim = 1.0;
        sfx.playPinballBumper();
      }
    }

    for (const pil of this.pillars) {
      const cx = Math.max(pil.x, Math.min(c.x, pil.x + pil.w));
      const cy = Math.max(pil.y, Math.min(c.y, pil.y + pil.h));
      const dx = c.x - cx;
      const dy = c.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < c.radius && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        c.x = cx + nx * (c.radius + 1);
        c.y = cy + ny * (c.radius + 1);
        const dot = c.vx * nx + c.vy * ny;
        if (dot < 0) {
          c.vx -= (1 + this.bounceMultiplier) * dot * nx;
          c.vy -= (1 + this.bounceMultiplier) * dot * ny;
          sfx.playCartridgeClick();
        }
      }
    }
  }

  /**
   * 60/144fps Client-Side Prediction & Dead-Reckoning for 04 // HOT-CORE
   */
  public stepClientPrediction(dt: number, localSlotId: number, input: ClientInputPacket): void {
    this.advanceChaos(dt, false, this.status === 'PLAYING', () => {});
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt * 2.4;
      ex.radius = ex.maxRadius * (1 - ex.life * 0.65);
      if (ex.life <= 0) this.explosions.splice(i, 1);
    }
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 28 * dt;
      c.life -= dt * 1.15;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    if (this.status !== 'PLAYING') return;

    this.core.fuseTimer = Math.max(0, this.core.fuseTimer - dt);

    this.players.forEach((pl) => {
      if (!pl.alive) return;
      if (pl.shieldTimer > 0) pl.shieldTimer = Math.max(0, pl.shieldTimer - dt);
      if (pl.shieldCooldown > 0) pl.shieldCooldown = Math.max(0, pl.shieldCooldown - dt);
      if (pl.dashTimer > 0) pl.dashTimer = Math.max(0, pl.dashTimer - dt);
      if (pl.dashCooldown > 0) pl.dashCooldown = Math.max(0, pl.dashCooldown - dt);

      if (pl.id === localSlotId) {
        const isCarrier = this.core.holderId === pl.id;
        const moveSpeed = (isCarrier ? 295 : 235) * this.speedMultiplier;
        if (input.moveX !== 0 || input.moveY !== 0) {
          const len = Math.hypot(input.moveX, input.moveY);
          pl.vx += (input.moveX / len) * moveSpeed * 9.5 * dt;
          pl.vy += (input.moveY / len) * moveSpeed * 9.5 * dt;
        }
        pl.aimAngle = input.aimAngle;
      }

      const damp = this.floatingDamping(pl.dashTimer > 0 ? 0.93 : 0.83);
      pl.vx *= Math.pow(damp, dt * 60);
      pl.vy *= Math.pow(damp, dt * 60);
      pl.x += pl.vx * dt;
      pl.y += pl.vy * dt;

      const spd = Math.hypot(pl.vx, pl.vy);
      pl.walkCycle = spd > 14 ? pl.walkCycle + spd * dt * 0.11 : 0;
      this.constrainCircleToArena(pl);
    });

    if (this.core.holderId !== null) {
      const holder = this.players[this.core.holderId];
      if (holder) {
        this.core.x = holder.x;
        this.core.y = holder.y - 18;
      }
    } else {
      this.core.x += this.core.vx * dt * this.speedMultiplier;
      this.core.y += this.core.vy * dt * this.speedMultiplier;
      this.constrainCoreProjectile();
    }
  }

  public getSnapshot(): HotCoreSnapshot {
    return {
      roundEpoch: this.roundEpoch,
      simulationTime: this.simulationTime,
      chaosBombs: this.chaosBombs.map((bomb) => ({ ...bomb })),
      arenaIndex: this.arenaIndex,
      arenaTitle: this.arenaTitle,
      status: this.status,
      statusTimer: this.statusTimer,
      lastWinnerId: this.lastWinnerId,
      players: this.players.map(({ lastTaggedAt: _lt, lastKOAt: _ko, ...p }) => ({ ...p })),
      core: { ...this.core },
      bumpers: this.bumpers.map((b) => ({ ...b })),
      pillars: this.pillars.map((p) => ({ ...p })),
      boostPads: this.boostPads.map((bp) => ({ ...bp })),
      explosions: this.explosions.map((e) => ({ ...e }))
    };
  }

  public applySnapshot(snap: HotCoreSnapshot, localSlotId?: number, prediction: PredictionHint = 0): void {
    const reset = this.arenaIndex !== snap.arenaIndex || this.status !== snap.status || (snap.roundEpoch !== undefined && snap.roundEpoch !== this.roundEpoch);
    if (this.arenaIndex !== snap.arenaIndex) {
      this.loadArena(snap.arenaIndex);
    }
    this.arenaTitle = snap.arenaTitle;
    this.status = snap.status;
    this.statusTimer = snap.statusTimer;
    this.lastWinnerId = snap.lastWinnerId;

    this.players = snap.players.map((sp) => {
      const previous = this.players[sp.id];
      return reconcilePlayer(previous, sp, sp.id === localSlotId,
        reset || previous?.alive !== sp.alive || snap.status !== 'PLAYING', prediction);
    });

    this.core = { ...snap.core };
    this.bumpers = snap.bumpers.map((b) => ({ ...b }));
    this.pillars = snap.pillars.map((p) => ({ ...p }));
    this.boostPads = snap.boostPads.map((bp) => ({ ...bp }));
    this.explosions = snap.explosions.map((e) => ({ ...e }));
    this.roundEpoch = snap.roundEpoch ?? this.roundEpoch;
    this.simulationTime = snap.simulationTime ?? this.simulationTime;
    this.chaosBombs = (snap.chaosBombs ?? []).map((bomb) => ({ ...bomb }));
  }

  public spawnDust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = this.random() * Math.PI * 2;
      const spd = 25 + this.random() * 80;
      this.particles.push({
        type: 'dust',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1.0,
        decay: 2.2 + this.random(),
        color: '#F4F0E8',
        size: 5 + this.random() * 4
      });
    }
  }

  public spawnDebris(x: number, y: number, bodyColor: string): void {
    this.spawnDust(x, y, 10);
    for (let i = 0; i < 5; i++) {
      const ang = this.random() * Math.PI * 2;
      const spd = 70 + this.random() * 140;
      this.looseParts.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rot: this.random() * Math.PI * 2,
        vRot: (this.random() - 0.5) * 12,
        color: i % 2 === 0 ? bodyColor : '#71717A',
        life: 3.2,
        maxLife: 3.2
      });
    }
    while (this.looseParts.length > 28) {
      this.looseParts.shift();
    }
  }

  public addCallout(
    x: number,
    y: number,
    text: string,
    bgColor: string,
    textColor = '#F4F0E8'
  ): void {
    this.callouts.push({ x, y, text, bgColor, textColor, life: 1.0 });
  }
}
