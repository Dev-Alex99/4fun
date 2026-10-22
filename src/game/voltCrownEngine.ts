import { reconcilePlayer } from './reconciliation';
import { ChaosPhysics } from './chaosPhysics';
import { sfx } from '../audio/mechanicalSfx';
import {
  ClientInputPacket,
  FloatingCallout,
  LoosePart,
  ParticleEffect,
  PinballBumper,
  PuttExplosion,
  VoltCrownDevice,
  VoltCrownPlayer,
  VoltCrownSnapshot,
  VoltPressurePlate,
  VoltProjectile,
  VoltTrap
} from '../types';

export interface VoltCrownArenaDef {
  title: string;
  bumpers: Array<{ x: number; y: number; radius: number }>;
  traps: VoltTrap[];
  plates: VoltPressurePlate[];
}

export const VOLT_CROWN_ARENAS: VoltCrownArenaDef[] = [
  {
    title: 'SECTOR 01 // PISTONES TRITURADORES',
    bumpers: [
      { x: 310, y: 258, radius: 26 },
      { x: 690, y: 258, radius: 26 }
    ],
    traps: [
      {
        id: 'crush-west',
        type: 'CRUSHER',
        x: 210,
        y: 220,
        w: 75,
        h: 76,
        active: false,
        timer: 0,
        period: 3.2,
        flashAnim: 0
      },
      {
        id: 'crush-east',
        type: 'CRUSHER',
        x: 715,
        y: 220,
        w: 75,
        h: 76,
        active: false,
        timer: 1.6,
        period: 3.2,
        flashAnim: 0
      },
      {
        id: 'crush-north',
        type: 'CRUSHER',
        x: 450,
        y: 85,
        w: 100,
        h: 55,
        active: false,
        timer: 0.8,
        period: 3.6,
        flashAnim: 0
      },
      {
        id: 'crush-south',
        type: 'CRUSHER',
        x: 450,
        y: 375,
        w: 100,
        h: 55,
        active: false,
        timer: 2.2,
        period: 3.6,
        flashAnim: 0
      }
    ],
    plates: [
      { id: 'plate-1', x: 480, y: 155, w: 40, h: 40, pressed: false, targetTrapId: 'crush-north' },
      { id: 'plate-2', x: 480, y: 320, w: 40, h: 40, pressed: false, targetTrapId: 'crush-south' }
    ]
  },
  {
    title: 'SECTOR 02 // PUERTAS LÁSER CRUZADAS',
    bumpers: [{ x: 500, y: 258, radius: 28 }],
    traps: [
      {
        id: 'laser-vert-1',
        type: 'LASER_GATE',
        x: 310,
        y: 75,
        w: 16,
        h: 155,
        active: true,
        timer: 0,
        period: 2.8,
        flashAnim: 0
      },
      {
        id: 'laser-vert-2',
        type: 'LASER_GATE',
        x: 690,
        y: 285,
        w: 16,
        h: 155,
        active: true,
        timer: 1.4,
        period: 2.8,
        flashAnim: 0
      },
      {
        id: 'laser-horiz-1',
        type: 'LASER_GATE',
        x: 375,
        y: 165,
        w: 250,
        h: 16,
        active: false,
        timer: 0.6,
        period: 3.2,
        flashAnim: 0
      },
      {
        id: 'laser-horiz-2',
        type: 'LASER_GATE',
        x: 375,
        y: 350,
        w: 250,
        h: 16,
        active: false,
        timer: 2.0,
        period: 3.2,
        flashAnim: 0
      }
    ],
    plates: [
      { id: 'plate-l1', x: 260, y: 240, w: 36, h: 36, pressed: false, targetTrapId: 'laser-vert-1' },
      { id: 'plate-l2', x: 740, y: 240, w: 36, h: 36, pressed: false, targetTrapId: 'laser-vert-2' }
    ]
  },
  {
    title: 'SECTOR 03 // CINTAS TRANSPORTADORAS DE VOLTAJE',
    bumpers: [
      { x: 500, y: 155, radius: 24 },
      { x: 500, y: 360, radius: 24 }
    ],
    traps: [
      {
        id: 'conveyor-top',
        type: 'CONVEYOR',
        x: 280,
        y: 110,
        w: 440,
        h: 55,
        active: true,
        timer: 0,
        period: 999,
        dirX: 190,
        dirY: 0,
        flashAnim: 0
      },
      {
        id: 'conveyor-bottom',
        type: 'CONVEYOR',
        x: 280,
        y: 350,
        w: 440,
        h: 55,
        active: true,
        timer: 0,
        period: 999,
        dirX: -190,
        dirY: 0,
        flashAnim: 0
      },
      {
        id: 'crush-west-c',
        type: 'CRUSHER',
        x: 190,
        y: 220,
        w: 75,
        h: 76,
        active: false,
        timer: 0,
        period: 3.5,
        flashAnim: 0
      },
      {
        id: 'crush-east-c',
        type: 'CRUSHER',
        x: 735,
        y: 220,
        w: 75,
        h: 76,
        active: false,
        timer: 1.7,
        period: 3.5,
        flashAnim: 0
      }
    ],
    plates: [
      { id: 'plate-c1', x: 300, y: 240, w: 40, h: 40, pressed: false, targetTrapId: 'crush-west-c' },
      { id: 'plate-c2', x: 700, y: 240, w: 40, h: 40, pressed: false, targetTrapId: 'crush-east-c' }
    ]
  },
  {
    title: 'SECTOR 04 // REJILLAS DE ALTA TENSIÓN',
    bumpers: [
      { x: 260, y: 160, radius: 25 },
      { x: 740, y: 160, radius: 25 },
      { x: 260, y: 356, radius: 25 },
      { x: 740, y: 356, radius: 25 }
    ],
    traps: [
      {
        id: 'grate-west',
        type: 'PLASMA_GRATE',
        x: 340,
        y: 140,
        w: 110,
        h: 236,
        active: false,
        timer: 0,
        period: 3.4,
        flashAnim: 0
      },
      {
        id: 'grate-east',
        type: 'PLASMA_GRATE',
        x: 550,
        y: 140,
        w: 110,
        h: 236,
        active: false,
        timer: 1.7,
        period: 3.4,
        flashAnim: 0
      }
    ],
    plates: [
      { id: 'plate-g1', x: 480, y: 140, w: 40, h: 40, pressed: false, targetTrapId: 'grate-west' },
      { id: 'plate-g2', x: 480, y: 336, w: 40, h: 40, pressed: false, targetTrapId: 'grate-east' }
    ]
  }
];

const PALETTE = [
  { name: 'UNIT-01', body: '#FF4F00', shade: '#C23B00' },
  { name: 'LEO-BOT', body: '#1B4DFF', shade: '#1034B3' },
  { name: 'MAX-BOT', body: '#F59E0B', shade: '#B45309' },
  { name: 'NICO-BOT', body: '#15803D', shade: '#14532D' }
];

const EMOTES = ['👑 ¡SOY EL REY!', '¡ATRAPADLO!', '⚡ ¡PARRY!', '¡MI CORONA!'];
const ARENA_MIN_X = 96;
const ARENA_MAX_X = 904;
const ARENA_MIN_Y = 66;
const ARENA_MAX_Y = 450;
const WINNING_BATTERY = 100;

export class VoltCrownEngine extends ChaosPhysics {
  public arenaIndex = 0;
  public arenaTitle = VOLT_CROWN_ARENAS[0].title;
  public status: 'PLAYING' | 'ROUND_OVER' | 'MATCH_OVER' = 'PLAYING';
  public statusTimer = 0;
  public lastWinnerId: number | null = null;
  public botsEnabled = true;
  public screenShake = 0;

  public players: VoltCrownPlayer[] = [];
  public crown: VoltCrownDevice = {
    holderId: null,
    x: 500,
    y: 258,
    vx: 0,
    vy: 0,
    radius: 16,
    bounceCount: 0,
    idleTimer: 0,
    overchargeReady: false
  };

  public projectiles: VoltProjectile[] = [];
  public traps: VoltTrap[] = [];
  public plates: VoltPressurePlate[] = [];
  public bumpers: PinballBumper[] = [];
  public explosions: PuttExplosion[] = [];
  public particles: ParticleEffect[] = [];
  public looseParts: LoosePart[] = [];
  public callouts: FloatingCallout[] = [];

  private nextProjId = 1;
  private remoteInputs = new Map<number, ClientInputPacket>();
  private lastActionSeqBySlot = new Map<number, number>();

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
      holdStreak: 0,
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
      taserCooldown: 0,
      stunTimer: 0,
      immunityTimer: 0,
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

  public getActiveParticipants(): VoltCrownPlayer[] {
    const humans = this.players.filter((p) => !p.isBot);
    if (this.botsEnabled) {
      return this.players;
    }
    // Solo practice fallback: if 1 human and bots OFF, retain 1 practice bot
    if (humans.length <= 1) {
      return this.players.slice(0, 2);
    }
    return humans;
  }

  public resetChampionship(): void {
    this.players.forEach((p) => {
      p.score = 0;
      p.holdStreak = 0;
    });
    this.lastWinnerId = null;
    this.loadArena(0);
  }

  public loadArena(index: number): void {
    this.resetChaosRound();
    this.arenaIndex =
      ((index % VOLT_CROWN_ARENAS.length) + VOLT_CROWN_ARENAS.length) %
      VOLT_CROWN_ARENAS.length;
    const def = VOLT_CROWN_ARENAS[this.arenaIndex];
    this.arenaTitle = def.title;
    this.status = 'PLAYING';
    this.statusTimer = 0;

    this.bumpers = def.bumpers.map((b) => ({ ...b, hitAnim: 0 }));
    this.traps = def.traps.map((t) => ({ ...t, flashAnim: 0 }));
    this.plates = def.plates.map((p) => ({ ...p, pressed: false }));
    this.projectiles = [];
    this.explosions = [];
    this.looseParts = [];
    this.particles = [];

    const spawnPoints = [
      { x: 190, y: 145 },
      { x: 810, y: 145 },
      { x: 190, y: 370 },
      { x: 810, y: 370 }
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
      p.taserCooldown = 0;
      p.stunTimer = 0;
      p.immunityTimer = 0;
      p.aimAngle = Math.atan2(258 - p.y, 500 - p.x);
    });

    // Spawn the Crown at the center pedestal
    this.crown = {
      holderId: null,
      x: 500,
      y: 258,
      vx: 0,
      vy: 0,
      radius: 16,
      bounceCount: 0,
      idleTimer: 0,
      overchargeReady: false
    };

    this.addCallout(500, 220, '👑 ¡LA CORONA VOLTAICA ESTÁ EN JUEGO!', '#F59E0B', '#18181B');
  }

  public triggerEmote(p: VoltCrownPlayer, index: number): void {
    const label = EMOTES[(index - 1) % EMOTES.length] || EMOTES[0];
    p.emoteText = label;
    p.emoteTimer = 1.7;
    sfx.playHornEmote(index);
  }

  /**
   * Primary Action (`[CLIC IZQ / ESPACIO]`):
   * - If King: Activate Magnetic Deflect Shield (`0.35s` parry window against tasers and tackles)!
   * - If Hunter: Shoot Shock Taser Bolt in `aimAngle` direction!
   */
  public triggerTaserOrDefend(p: VoltCrownPlayer, aimAngle?: number): void {
    if (!p.alive || this.status !== 'PLAYING' || p.stunTimer > 0) return;
    if (aimAngle !== undefined) {
      p.aimAngle = aimAngle;
    }

    if (this.crown.holderId === p.id) {
      // King action: Deflect Shield Parry!
      if (p.shieldCooldown > 0) return;
      p.shieldTimer = 0.35;
      p.shieldCooldown = 0.75;
      sfx.playCartridgeClick();
      this.addCallout(p.x, p.y - 32, '🛡️ ¡ESCUDO DEFLECTOR!', '#F59E0B');

      // Check proximity taser bolts to reflect immediately
      for (const proj of this.projectiles) {
        if (proj.ownerId !== p.id) {
          const d = Math.hypot(proj.x - p.x, proj.y - p.y);
          if (d <= p.radius + 38) {
            this.reflectProjectile(proj, p);
          }
        }
      }
    } else {
      // Hunter action: Shock Taser Bolt!
      if (p.taserCooldown > 0) return;
      p.taserCooldown = 1.15;

      const spd = 740;
      const vx = Math.cos(p.aimAngle) * spd;
      const vy = Math.sin(p.aimAngle) * spd;
      const px = p.x + Math.cos(p.aimAngle) * (p.radius + 14);
      const py = p.y + Math.sin(p.aimAngle) * (p.radius + 14);

      this.projectiles.push({
        id: this.nextProjId++,
        ownerId: p.id,
        x: px,
        y: py,
        vx,
        vy,
        life: 1.1,
        isReflected: false
      });

      // Recoil
      p.vx -= Math.cos(p.aimAngle) * 90;
      p.vy -= Math.sin(p.aimAngle) * 90;
      sfx.playPinballBumper();
    }
  }

  /**
   * Secondary Action (`[E]`):
   * - If King: Static Shockwave (knock back pursuers)!
   * - If Hunter: Remote Trigger nearest trap!
   */
  public triggerTrapOrPulse(p: VoltCrownPlayer): void {
    if (!p.alive || this.status !== 'PLAYING' || p.stunTimer > 0) return;

    if (this.crown.holderId === p.id) {
      // Static Shockwave
      if (p.dashCooldown > 0) return;
      p.dashCooldown = 2.8;

      this.explosions.push({
        x: p.x,
        y: p.y,
        radius: 16,
        maxRadius: 120,
        life: 1.0,
        color: '#F59E0B'
      });
      this.screenShake = 8;
      sfx.playBatParry(2, true, false);

      this.players.forEach((other) => {
        if (other.id !== p.id && other.alive) {
          const dx = other.x - p.x;
          const dy = other.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 125) {
            other.vx += (dx / dist) * 580;
            other.vy += (dy / dist) * 580;
            other.stunTimer = Math.max(other.stunTimer, 0.45);
          }
        }
      });
      this.addCallout(p.x, p.y - 32, '⚡ ¡PULSO ESTÁTICO!', '#F59E0B', '#18181B');
    } else {
      // Hunter Trap Trigger: Trip the closest pressure plate / trap!
      let closestPlate: VoltPressurePlate | null = null;
      let minDist = 180;
      for (const plate of this.plates) {
        const d = Math.hypot(plate.x + plate.w * 0.5 - p.x, plate.y + plate.h * 0.5 - p.y);
        if (d < minDist) {
          minDist = d;
          closestPlate = plate;
        }
      }

      if (closestPlate) {
        this.activatePlate(closestPlate, p);
        this.addCallout(p.x, p.y - 30, '🚨 ¡TRAMPA ACTIVADA!', '#FF4F00');
      } else {
        // Quick burst tackle
        this.triggerDash(p, Math.cos(p.aimAngle), Math.sin(p.aimAngle));
      }
    }
  }

  /**
   * Dash (`[SHIFT / CLIC DER]`): Pneumatic surge
   */
  public triggerDash(p: VoltCrownPlayer, dirX: number, dirY: number): void {
    if (!p.alive || this.status !== 'PLAYING' || p.dashCooldown > 0 || p.stunTimer > 0) return;
    const len = Math.hypot(dirX, dirY) || 1;
    const isKing = this.crown.holderId === p.id;
    const dashSpd = isKing ? 580 : 660;

    p.vx = (dirX / len) * dashSpd;
    p.vy = (dirY / len) * dashSpd;
    p.dashTimer = 0.16;
    p.dashCooldown = 1.05;
    sfx.playDashPiston();
    this.spawnDust(p.x, p.y + 8, 5);
  }

  private reflectProjectile(proj: VoltProjectile, defender: VoltCrownPlayer): void {
    proj.isReflected = true;
    const attacker = this.players[proj.ownerId];
    proj.ownerId = defender.id;

    const angle = attacker
      ? Math.atan2(attacker.y - defender.y, attacker.x - defender.x)
      : defender.aimAngle;

    proj.vx = Math.cos(angle) * 880;
    proj.vy = Math.sin(angle) * 880;
    proj.life = 1.2;
    this.screenShake = 6;
    sfx.playBatParry(3, true, false);
    this.addCallout(defender.x, defender.y - 34, '⚡ ¡REFLEJADO!', '#15803D', '#FFFFFF');
  }

  private dropCrown(victim: VoltCrownPlayer, impulseX = 0, impulseY = 0): void {
    if (this.crown.holderId !== victim.id) return;

    this.crown.holderId = null;
    this.crown.bounceCount = 0;
    this.crown.idleTimer = 0;
    this.crown.x = victim.x;
    this.crown.y = victim.y;

    const angle = Math.atan2(impulseY, impulseX) || Math.random() * Math.PI * 2;
    const pwr = Math.max(340, Math.hypot(impulseX, impulseY));
    this.crown.vx = Math.cos(angle) * pwr;
    this.crown.vy = Math.sin(angle) * pwr;

    victim.holdStreak = 0;
    victim.immunityTimer = 0.65; // Cannot instantly suck up the crown back
    this.screenShake = 10;
    sfx.playPinballBumper();
    this.addCallout(victim.x, victim.y - 34, `👑 ¡${victim.name} PERDIÓ LA CORONA!`, '#FF4F00');
  }

  private claimCrown(p: VoltCrownPlayer): void {
    if (!p.alive || p.stunTimer > 0 || p.immunityTimer > 0) return;
    this.crown.holderId = p.id;
    this.crown.vx = 0;
    this.crown.vy = 0;
    this.crown.idleTimer = 0;
    p.holdStreak = 0;
    p.shieldCooldown = 0;

    this.explosions.push({
      x: p.x,
      y: p.y,
      radius: 12,
      maxRadius: 80,
      life: 0.8,
      color: '#F59E0B'
    });
    sfx.playBatParry(1, false, false);
    this.addCallout(p.x, p.y - 36, `👑 ¡${p.name} ES EL NUEVO REY!`, '#F59E0B', '#18181B');
  }

  private triggerVoltOvercharge(king: VoltCrownPlayer): void {
    king.score = Math.min(WINNING_BATTERY, king.score + 15);
    king.holdStreak = 0;
    this.screenShake = 18;

    this.explosions.push({
      x: king.x,
      y: king.y,
      radius: 20,
      maxRadius: 220,
      life: 1.2,
      color: '#FEF08A'
    });
    sfx.playKODisassembly();

    this.players.forEach((other) => {
      if (other.id !== king.id && other.alive) {
        const dx = other.x - king.x;
        const dy = other.y - king.y;
        const d = Math.hypot(dx, dy) || 1;
        other.vx += (dx / d) * 720;
        other.vy += (dy / d) * 720;
        other.stunTimer = 1.35;
        this.spawnDebris(other.x, other.y, other.bodyColor);
      }
    });

    this.addCallout(
      king.x,
      king.y - 42,
      '⚡ ¡SOBRECARGA VOLTAICA! (+15% BATERÍA)',
      '#FEF08A',
      '#18181B'
    );

    if (king.score >= WINNING_BATTERY) {
      this.status = 'MATCH_OVER';
      this.statusTimer = 4.2;
      this.lastWinnerId = king.id;
    }
  }

  private activatePlate(plate: VoltPressurePlate, activator?: VoltCrownPlayer): void {
    plate.pressed = true;
    sfx.playCartridgeClick();
    const trap = this.traps.find((t) => t.id === plate.targetTrapId);
    if (trap) {
      trap.active = true;
      trap.timer = 0;
      trap.flashAnim = 1.0;
    }
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

    // FAVOR-THE-DEFENDER ROLLBACK RESCUE (280ms):
    // If the King pressed Defend/Shield or Pulse locally right as a taser arrived, reflect it!
    if (
      p.alive &&
      !isDuplicateAction &&
      this.crown.holderId === p.id &&
      (packet.parryPressed || packet.yankPressed) &&
      p.lastStunnedAt &&
      performance.now() - p.lastStunnedAt <= 280
    ) {
      p.lastStunnedAt = undefined;
      p.stunTimer = 0;
      p.shieldTimer = 0.35;
      this.addCallout(p.x, p.y - 34, '⚡ ¡CONTRA-DEFENSA!', '#15803D', '#FFFFFF');
      return;
    }

    if (!isDuplicateAction && p.alive && this.status === 'PLAYING') {
      if (packet.emotePressed > 0) {
        this.triggerEmote(p, packet.emotePressed);
      }
      if (packet.parryPressed) {
        this.triggerTaserOrDefend(p, packet.aimAngle);
      }
      if (packet.yankPressed) {
        this.triggerTrapOrPulse(p);
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

    // Explosions & Particles
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt * 2.5;
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
    // Hard capacity caps to prevent any memory or particle leaks over time
    while (this.looseParts.length > 28) this.looseParts.shift();
    while (this.particles.length > 40) this.particles.shift();
    while (this.explosions.length > 10) this.explosions.shift();
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life -= dt;
      c.y -= dt * 14;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    // Bumpers hit flash decay
    this.bumpers.forEach((b) => {
      if (b.hitAnim > 0) b.hitAnim = Math.max(0, b.hitAnim - dt * 5);
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

    // 1. Update Traps & Pressure Plates
    for (const trap of this.traps) {
      if (trap.flashAnim && trap.flashAnim > 0) {
        trap.flashAnim = Math.max(0, trap.flashAnim - dt * 3.5);
      }
      if (trap.type === 'LASER_GATE' || trap.type === 'PLASMA_GRATE') {
        trap.timer += dt;
        if (trap.timer >= trap.period) {
          trap.timer = 0;
          trap.active = !trap.active;
          if (trap.active) sfx.playPinballBumper();
        }
      } else if (trap.type === 'CRUSHER') {
        trap.timer += dt;
        if (trap.timer >= trap.period) {
          trap.timer = 0;
          trap.active = true;
          this.screenShake = 12;
          sfx.playDashPiston();
          // Crusher stays down for 0.6s
          setTimeout(() => {
            trap.active = false;
          }, 600);
        }
      }
    }

    // 2. Update Players (Physics, Inputs, Bot AI)
    const participants = this.getActiveParticipants();

    participants.forEach((p) => {
      if (!p.alive) return;

      if (p.shieldTimer > 0) p.shieldTimer = Math.max(0, p.shieldTimer - dt);
      if (p.shieldCooldown > 0) p.shieldCooldown = Math.max(0, p.shieldCooldown - dt);
      if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - dt);
      if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
      if (p.taserCooldown > 0) p.taserCooldown = Math.max(0, p.taserCooldown - dt);
      if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
      if (p.immunityTimer > 0) p.immunityTimer = Math.max(0, p.immunityTimer - dt);
      if (p.trapImmunityTimer && p.trapImmunityTimer > 0) {
        p.trapImmunityTimer = Math.max(0, p.trapImmunityTimer - dt);
      }
      if (p.emoteTimer > 0) {
        p.emoteTimer -= dt;
        if (p.emoteTimer <= 0) p.emoteText = null;
      }

      const isKing = this.crown.holderId === p.id;

      // King charges battery score per second
      if (isKing) {
        p.score = Math.min(WINNING_BATTERY, p.score + dt * 3.6);
        p.holdStreak += dt;

        // Visual King Overdrive trail when holding crown at high charge
        if (p.score >= 50 && Math.random() < 0.35) {
          this.particles.push({
            type: 'spark',
            x: p.x + (Math.random() - 0.5) * 14,
            y: p.y + (Math.random() - 0.5) * 14,
            vx: -p.vx * 0.25 + (Math.random() - 0.5) * 60,
            vy: -p.vy * 0.25 + (Math.random() - 0.5) * 60,
            life: 0.35,
            decay: 1.0,
            color: '#FACC15',
            size: 3.2
          });
        }

        // Check 15s Volt Overcharge Nova!
        if (p.holdStreak >= 15.0) {
          this.triggerVoltOvercharge(p);
        }

        if (p.score >= WINNING_BATTERY) {
          this.status = 'MATCH_OVER';
          this.statusTimer = 4.2;
          this.lastWinnerId = p.id;
          sfx.playCartridgeClick();
          return;
        }
      }

      const baseMoveSpeed = isKing ? 230 : 255;
      const moveSpeed = (p.dashTimer > 0 ? (isKing ? 580 : 660) : baseMoveSpeed) * this.speedMultiplier;

      if (!p.isBot) {
        const inp = this.remoteInputs.get(p.id);
        if (inp && p.stunTimer <= 0) {
          p.aimAngle = inp.aimAngle;
          let mx = inp.moveX;
          let my = inp.moveY;
          const mag = Math.hypot(mx, my);
          if (mag > 1) {
            mx /= mag;
            my /= mag;
          }
          p.vx += mx * moveSpeed * 8.5 * dt;
          p.vy += my * moveSpeed * 8.5 * dt;

          // Dead reckoning smooth correction

        }
      } else {
        this.stepBotAI(p, dt, moveSpeed, isKing);
      }

      // Check Conveyor Belt push
      for (const trap of this.traps) {
        if (trap.type === 'CONVEYOR' && trap.active && trap.dirX && trap.dirY) {
          if (
            p.x >= trap.x &&
            p.x <= trap.x + trap.w &&
            p.y >= trap.y &&
            p.y <= trap.y + trap.h
          ) {
            p.vx += trap.dirX * dt * 2.8;
            p.vy += trap.dirY * dt * 2.8;
          }
        }
      }

      // Check Pressure Plate triggers
      for (const plate of this.plates) {
        if (
          p.x >= plate.x &&
          p.x <= plate.x + plate.w &&
          p.y >= plate.y &&
          p.y <= plate.y + plate.h
        ) {
          if (!plate.pressed) {
            this.activatePlate(plate, p);
          }
        }
      }

      const damp = this.floatingDamping(p.dashTimer > 0 ? 0.93 : 0.82);
      p.vx *= Math.pow(damp, dt * 60);
      p.vy *= Math.pow(damp, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const spd = Math.hypot(p.vx, p.vy);
      p.walkCycle = spd > 14 ? p.walkCycle + spd * dt * 0.11 : 0;

      // Collide with Arena Bounds & Bumpers
      this.constrainPlayer(p);

      // Check Active Hazards (Laser Gates, Crushers, Plasma Grates)
      for (const trap of this.traps) {
        if (!trap.active) continue;
        if (p.trapImmunityTimer && p.trapImmunityTimer > 0) continue;
        if (
          p.x >= trap.x - p.radius &&
          p.x <= trap.x + trap.w + p.radius &&
          p.y >= trap.y - p.radius &&
          p.y <= trap.y + trap.h + p.radius
        ) {
          // Trap hit player!
          p.stunTimer = 0.45;
          p.trapImmunityTimer = 1.1; // 1.1s grace period so player is never locked
          p.lastStunnedAt = performance.now();

          // Outward ejection impulse away from trap center so player escapes instantly
          const trapCenterX = trap.x + trap.w * 0.5;
          const trapCenterY = trap.y + trap.h * 0.5;
          let edx = p.x - trapCenterX;
          let edy = p.y - trapCenterY;
          let elen = Math.hypot(edx, edy);
          if (elen < 0.001) {
            edx = 0;
            edy = -1;
            elen = 1;
          }
          edx /= elen;
          edy /= elen;
          p.vx = edx * 620 * this.bounceMultiplier;
          p.vy = edy * 620 * this.bounceMultiplier;
          p.x += edx * (p.radius + 8);
          p.y += edy * (p.radius + 8);

          if (isKing) {
            this.dropCrown(p, -edx * 380, -edy * 380);
          }
          this.spawnDebris(p.x, p.y, p.bodyColor);
          this.screenShake = 10;
          sfx.playPinballBumper();
        }
      }
    });

    // 3. Projectile Updates (Shock Taser Bolts)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life -= dt;
      proj.x += proj.vx * dt * this.speedMultiplier;
      proj.y += proj.vy * dt * this.speedMultiplier;

      // Bounce off walls
      if (proj.x <= ARENA_MIN_X + 10 || proj.x >= ARENA_MAX_X - 10) {
        proj.vx = -proj.vx;
      }
      if (proj.y <= ARENA_MIN_Y + 10 || proj.y >= ARENA_MAX_Y - 10) {
        proj.vy = -proj.vy;
      }

      // Check Player Hits
      let hit = false;
      for (const p of participants) {
        if (!p.alive || p.id === proj.ownerId) continue;
        const d = Math.hypot(p.x - proj.x, p.y - proj.y);
        if (d <= p.radius + 12) {
          hit = true;
          if (p.shieldTimer > 0) {
            // Deflected!
            this.reflectProjectile(proj, p);
            hit = false;
            break;
          } else {
            // Taser Shock!
            p.stunTimer = 0.80;
            p.lastStunnedAt = performance.now();
            p.vx += (proj.vx / Math.hypot(proj.vx, proj.vy)) * 320;
            p.vy += (proj.vy / Math.hypot(proj.vx, proj.vy)) * 320;

            if (this.crown.holderId === p.id) {
              this.dropCrown(p, proj.vx * 0.6, proj.vy * 0.6);
            }
            this.screenShake = 7;
            sfx.playPinballBumper();
            this.addCallout(p.x, p.y - 30, '⚡ ¡ELECTROCUTADO!', '#38BDF8');
            break;
          }
        }
      }

      if (hit || proj.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Tackles Between Players
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const p1 = participants[i];
        const p2 = participants[j];
        if (!p1.alive || !p2.alive) continue;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = p1.radius + p2.radius + 4;

        if (dist < minDist) {
          // Collision overlap separation
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          p1.x -= nx * overlap;
          p1.y -= ny * overlap;
          p2.x += nx * overlap;
          p2.y += ny * overlap;

          // Tackle recoil
          p1.vx -= nx * 240;
          p1.vy -= ny * 240;
          p2.vx += nx * 240;
          p2.vy += ny * 240;

          // If one is King and the other tackled them
          if (this.crown.holderId === p1.id && p1.shieldTimer <= 0) {
            this.dropCrown(p1, nx * 380, ny * 380);
          } else if (this.crown.holderId === p2.id && p2.shieldTimer <= 0) {
            this.dropCrown(p2, -nx * 380, -ny * 380);
          } else if (this.crown.holderId === p1.id && p1.shieldTimer > 0) {
            // King parried the tackle!
            p2.stunTimer = 0.65;
            this.addCallout(p1.x, p1.y - 32, '🛡️ ¡PLACADO BLOQUEADO!', '#15803D');
          } else if (this.crown.holderId === p2.id && p2.shieldTimer > 0) {
            p1.stunTimer = 0.65;
            this.addCallout(p2.x, p2.y - 32, '🛡️ ¡PLACADO BLOQUEADO!', '#15803D');
          }
        }
      }
    }

    // 5. Crown Physics & Floor Pickup Check
    if (this.crown.holderId !== null) {
      const king = this.players[this.crown.holderId];
      if (king && king.alive) {
        this.crown.x = king.x;
        this.crown.y = king.y - 28;
      } else {
        this.crown.holderId = null;
      }
    } else {
      // Free bouncing crown
      this.crown.idleTimer += dt;
      this.crown.x += this.crown.vx * dt * this.speedMultiplier;
      this.crown.y += this.crown.vy * dt * this.speedMultiplier;
      this.crown.vx *= Math.pow(0.96, dt * 60);
      this.crown.vy *= Math.pow(0.96, dt * 60);

      // Bounce Crown off chamber walls
      if (this.crown.x <= ARENA_MIN_X + this.crown.radius) {
        this.crown.x = ARENA_MIN_X + this.crown.radius;
        this.crown.vx = Math.abs(this.crown.vx) * 0.85 * this.bounceMultiplier;
      } else if (this.crown.x >= ARENA_MAX_X - this.crown.radius) {
        this.crown.x = ARENA_MAX_X - this.crown.radius;
        this.crown.vx = -Math.abs(this.crown.vx) * 0.85 * this.bounceMultiplier;
      }
      if (this.crown.y <= ARENA_MIN_Y + this.crown.radius) {
        this.crown.y = ARENA_MIN_Y + this.crown.radius;
        this.crown.vy = Math.abs(this.crown.vy) * 0.85 * this.bounceMultiplier;
      } else if (this.crown.y >= ARENA_MAX_Y - this.crown.radius) {
        this.crown.y = ARENA_MAX_Y - this.crown.radius;
        this.crown.vy = -Math.abs(this.crown.vy) * 0.85 * this.bounceMultiplier;
      }

      // If Crown stays idle for >10s, drift back to center
      if (this.crown.idleTimer > 10.0) {
        const toCX = 500 - this.crown.x;
        const toCY = 258 - this.crown.y;
        this.crown.vx += toCX * dt * 1.5;
        this.crown.vy += toCY * dt * 1.5;
      }

      // Pickup detection
      for (const p of participants) {
        if (!p.alive || p.stunTimer > 0 || p.immunityTimer > 0) continue;
        const d = Math.hypot(p.x - this.crown.x, p.y - this.crown.y);
        if (d <= p.radius + this.crown.radius + 6) {
          this.claimCrown(p);
          break;
        }
      }
    }
  }

  private stepBotAI(bot: VoltCrownPlayer, dt: number, moveSpeed: number, isKing: boolean): void {
    if (bot.stunTimer > 0) return;

    if (isKing) {
      // King bot: Flee from hunters and avoid active hazards
      const hunters = this.players.filter((o) => o.id !== bot.id && o.alive);
      hunters.sort(
        (a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y)
      );
      const closest = hunters[0];
      if (!closest) return;

      const dx = bot.x - closest.x;
      const dy = bot.y - closest.y;
      const dist = Math.hypot(dx, dy) || 1;
      bot.aimAngle = Math.atan2(closest.y - bot.y, closest.x - bot.x);

      // Evade toward center/opposite wall
      const toCenterX = (500 - bot.x) * 0.35;
      const toCenterY = (258 - bot.y) * 0.35;
      const fleeX = (dx / dist) * 200 + toCenterX;
      const fleeY = (dy / dist) * 200 + toCenterY;
      const flen = Math.hypot(fleeX, fleeY) || 1;

      bot.vx += (fleeX / flen) * moveSpeed * 8.2 * dt;
      bot.vy += (fleeY / flen) * moveSpeed * 8.2 * dt;

      // Defend if hunter is charging or projectile approaching
      if (dist < 95 && bot.shieldCooldown <= 0 && Math.random() < 0.16) {
        this.triggerTaserOrDefend(bot);
      }
    } else {
      // Hunter bot: Chase King or Free Crown
      let targetX = 500;
      let targetY = 258;

      if (this.crown.holderId !== null) {
        const king = this.players[this.crown.holderId];
        if (king) {
          targetX = king.x;
          targetY = king.y;
        }
      } else {
        targetX = this.crown.x;
        targetY = this.crown.y;
      }

      const dx = targetX - bot.x;
      const dy = targetY - bot.y;
      const dist = Math.hypot(dx, dy) || 1;
      bot.aimAngle = Math.atan2(dy, dx);

      bot.vx += (dx / dist) * moveSpeed * 8.0 * dt;
      bot.vy += (dy / dist) * moveSpeed * 8.0 * dt;

      // Shoot Shock Taser if lined up with King!
      if (
        this.crown.holderId !== null &&
        dist < 280 &&
        dist > 80 &&
        bot.taserCooldown <= 0 &&
        Math.random() < 0.04
      ) {
        this.triggerTaserOrDefend(bot, bot.aimAngle);
      } else if (dist < 130 && bot.dashCooldown <= 0 && Math.random() < 0.05) {
        this.triggerDash(bot, dx, dy);
      }
    }
  }

  private constrainPlayer(p: VoltCrownPlayer): void {
    if (p.x <= ARENA_MIN_X + p.radius) {
      p.x = ARENA_MIN_X + p.radius;
      p.vx = 0;
    } else if (p.x >= ARENA_MAX_X - p.radius) {
      p.x = ARENA_MAX_X - p.radius;
      p.vx = 0;
    }
    if (p.y <= ARENA_MIN_Y + p.radius) {
      p.y = ARENA_MIN_Y + p.radius;
      p.vy = 0;
    } else if (p.y >= ARENA_MAX_Y - p.radius) {
      p.y = ARENA_MAX_Y - p.radius;
      p.vy = 0;
    }

    // Bumpers
    for (const b of this.bumpers) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      const minDist = p.radius + b.radius;
      if (dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        p.x = b.x + nx * minDist;
        p.y = b.y + ny * minDist;
        p.vx = nx * 560 * this.bounceMultiplier;
        p.vy = ny * 560 * this.bounceMultiplier;
        b.hitAnim = 1.0;
        sfx.playPinballBumper();
      }
    }
  }

  public stepClientPrediction(
    dt: number,
    localSlotId: number,
    input: ClientInputPacket
  ): void {
    this.advanceChaos(dt, false, this.status === 'PLAYING', () => {});
    if (this.status !== 'PLAYING') return;
    for (const player of this.players) {
      player.shieldTimer = Math.max(0, player.shieldTimer - dt);
      player.shieldCooldown = Math.max(0, player.shieldCooldown - dt);
      player.dashTimer = Math.max(0, player.dashTimer - dt);
      player.dashCooldown = Math.max(0, player.dashCooldown - dt);
      player.taserCooldown = Math.max(0, player.taserCooldown - dt);
      player.stunTimer = Math.max(0, player.stunTimer - dt);
      player.immunityTimer = Math.max(0, player.immunityTimer - dt);
      if (player.id !== localSlotId && player.alive) {
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        this.constrainPlayer(player);
      }
    }
    const p = this.players[localSlotId];
    if (!p || !p.alive) return;

    p.aimAngle = input.aimAngle;
    const isKing = this.crown.holderId === p.id;
    const baseSpeed = isKing ? 230 : 255;
    const moveSpeed = (p.dashTimer > 0 ? (isKing ? 580 : 660) : baseSpeed) * this.speedMultiplier;

    let mx = input.moveX;
    let my = input.moveY;
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }

    if (p.stunTimer <= 0) {
      p.vx += mx * moveSpeed * 8.5 * dt;
      p.vy += my * moveSpeed * 8.5 * dt;
    }
    const damp = this.floatingDamping(p.dashTimer > 0 ? 0.93 : 0.82);
    p.vx *= Math.pow(damp, dt * 60);
    p.vy *= Math.pow(damp, dt * 60);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    this.constrainPlayer(p);

    // Extrapolate projectiles & free crown locally
    for (const proj of this.projectiles) {
      proj.x += proj.vx * dt * this.speedMultiplier;
      proj.y += proj.vy * dt * this.speedMultiplier;
    }
    if (this.crown.holderId === null) {
      this.crown.x += this.crown.vx * dt * this.speedMultiplier;
      this.crown.y += this.crown.vy * dt * this.speedMultiplier;
    } else if (this.crown.holderId === p.id) {
      this.crown.x = p.x;
      this.crown.y = p.y - 28;
    }
  }

  public getSnapshot(): VoltCrownSnapshot {
    return {
      roundEpoch: this.roundEpoch,
      simulationTime: this.simulationTime,
      chaosBombs: this.chaosBombs.map((bomb) => ({ ...bomb })),
      arenaIndex: this.arenaIndex,
      arenaTitle: this.arenaTitle,
      status: this.status,
      statusTimer: this.statusTimer,
      lastWinnerId: this.lastWinnerId,
      players: this.players.map((p) => ({ ...p })),
      crown: { ...this.crown },
      projectiles: this.projectiles.map((pr) => ({ ...pr })),
      traps: this.traps.map((t) => ({ ...t })),
      plates: this.plates.map((pl) => ({ ...pl })),
      bumpers: this.bumpers.map((b) => ({ ...b })),
      explosions: this.explosions.map((ex) => ({ ...ex }))
    };
  }

  public applySnapshot(snap: VoltCrownSnapshot, localSlotId: number, predictionLeadSeconds = 0): void {
    const reset = this.arenaIndex !== snap.arenaIndex || this.status !== snap.status || (snap.roundEpoch !== undefined && snap.roundEpoch !== this.roundEpoch);
    this.arenaIndex = snap.arenaIndex;
    this.arenaTitle = snap.arenaTitle;
    this.status = snap.status;
    this.statusTimer = snap.statusTimer;
    this.lastWinnerId = snap.lastWinnerId;

    this.players = snap.players.map((sp) => {
      const previous = this.players[sp.id];
      return reconcilePlayer(previous, sp, sp.id === localSlotId,
        reset || previous?.alive !== sp.alive || snap.status !== 'PLAYING', predictionLeadSeconds);
    });

    this.explosions = snap.explosions.map((ex) => ({ ...ex }));
    this.crown = { ...snap.crown };
    this.traps = snap.traps.map((t) => ({ ...t }));
    this.plates = snap.plates.map((pl) => ({ ...pl }));
    this.bumpers = snap.bumpers.map((b) => ({ ...b }));
    this.projectiles = snap.projectiles.map((pr) => ({ ...pr }));
    this.roundEpoch = snap.roundEpoch ?? this.roundEpoch;
    this.simulationTime = snap.simulationTime ?? this.simulationTime;
    this.chaosBombs = (snap.chaosBombs ?? []).map((bomb) => ({ ...bomb }));
  }

  private addCallout(
    x: number,
    y: number,
    text: string,
    textColor = '#F4F0E8',
    bgColor = '#18181B'
  ): void {
    this.callouts.push({
      x,
      y,
      text,
      textColor,
      bgColor,
      life: 1.4
    });
  }

  private spawnDust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'dust',
        x,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        life: 0.45,
        decay: 1.4,
        color: '#D4CEBF',
        size: 3.5
      });
    }
  }

  private spawnDebris(x: number, y: number, color: string): void {
    for (let i = 0; i < 4; i++) {
      this.looseParts.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 260,
        vy: (Math.random() - 0.5) * 260,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
        color,
        life: 3.2,
        maxLife: 3.2
      });
    }
    while (this.looseParts.length > 28) {
      this.looseParts.shift();
    }
  }
}
