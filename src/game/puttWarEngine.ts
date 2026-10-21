import { sfx } from '../audio/mechanicalSfx';
import {
  ClientInputPacket,
  FloatingCallout,
  PuttBallPlayer,
  PuttBomb,
  PuttBumper,
  PuttExplosion,
  PuttHazardRect,
  PuttWallRect,
  PuttWarSnapshot,
  PuttWeaponCrate,
  PuttWindmill
} from '../types';

export interface PuttHoleConfig {
  title: string;
  par: number;
  teeX: number;
  teeY: number;
  cupX: number;
  cupY: number;
  walls: PuttWallRect[];
  hazards: PuttHazardRect[];
  bumpers: Array<{ x: number; y: number; radius: number }>;
  windmills: Array<{ cx: number; cy: number; length: number; speed: number }>;
  crates: Array<{ x: number; y: number; type: 'BAZOOKA' | 'NITRO' | 'ANVIL' }>;
}

// Outer table bounds: x in [70..930], y in [55..465]
const OUTER_WALLS: PuttWallRect[] = [
  { x: 60, y: 45, w: 880, h: 16 }, // Top border
  { x: 60, y: 459, w: 880, h: 16 }, // Bottom border
  { x: 60, y: 45, w: 16, h: 430 }, // Left border
  { x: 924, y: 45, w: 16, h: 430 } // Right border
];

export const PUTT_HOLES: PuttHoleConfig[] = [
  // HOYO 01: Curva de Calibración (Par 3)
  {
    title: 'HOYO 01 // CURVA DE CALIBRACIÓN',
    par: 3,
    teeX: 145,
    teeY: 375,
    cupX: 825,
    cupY: 135,
    walls: [
      ...OUTER_WALLS,
      { x: 320, y: 215, w: 22, h: 245 }, // Vertical divider forcing top-around or bank shot
      { x: 580, y: 61, w: 22, h: 210 }, // Second chicane wall
      { x: 740, y: 270, w: 184, h: 20 } // Cup protector shelf
    ],
    hazards: [
      { x: 350, y: 70, w: 210, h: 55, type: 'BOOST', boostVx: 240, boostVy: 0 },
      { x: 620, y: 345, w: 150, h: 95, type: 'SAND' }
    ],
    bumpers: [
      { x: 250, y: 135, radius: 22 },
      { x: 485, y: 345, radius: 24 },
      { x: 710, y: 175, radius: 20 }
    ],
    windmills: [],
    crates: [
      { x: 245, y: 245, type: 'BAZOOKA' },
      { x: 465, y: 155, type: 'NITRO' },
      { x: 690, y: 315, type: 'ANVIL' }
    ]
  },

  // HOYO 02: Molino Rotatorio (Par 3)
  {
    title: 'HOYO 02 // MOLINO ROTATORIO',
    par: 3,
    teeX: 140,
    teeY: 258,
    cupX: 845,
    cupY: 258,
    walls: [
      ...OUTER_WALLS,
      { x: 370, y: 61, w: 24, h: 125 },
      { x: 370, y: 330, w: 24, h: 130 },
      { x: 635, y: 175, w: 22, h: 166 }
    ],
    hazards: [
      { x: 430, y: 75, w: 165, h: 65, type: 'SAND' },
      { x: 430, y: 375, w: 165, h: 65, type: 'SAND' },
      { x: 665, y: 75, w: 130, h: 52, type: 'BOOST', boostVx: 260, boostVy: 90 },
      { x: 665, y: 388, w: 130, h: 52, type: 'BOOST', boostVx: 260, boostVy: -90 }
    ],
    bumpers: [
      { x: 525, y: 200, radius: 20 },
      { x: 525, y: 316, radius: 20 }
    ],
    windmills: [
      { cx: 382, cy: 258, length: 82, speed: 2.3 },
      { cx: 745, cy: 258, length: 68, speed: -2.7 }
    ],
    crates: [
      { x: 265, y: 155, type: 'BAZOOKA' },
      { x: 265, y: 360, type: 'NITRO' },
      { x: 585, y: 258, type: 'ANVIL' }
    ]
  },

  // HOYO 03: Puente Sobre Ácido (Par 4)
  {
    title: 'HOYO 03 // PUENTE SOBRE ÁCIDO',
    par: 4,
    teeX: 135,
    teeY: 258,
    cupX: 850,
    cupY: 258,
    walls: [
      ...OUTER_WALLS,
      { x: 690, y: 170, w: 20, h: 75 },
      { x: 690, y: 275, w: 20, h: 75 }
    ],
    hazards: [
      { x: 290, y: 61, w: 340, h: 142, type: 'ACID' },
      { x: 290, y: 312, w: 340, h: 147, type: 'ACID' },
      { x: 335, y: 225, w: 250, h: 66, type: 'BOOST', boostVx: 230, boostVy: 0 }
    ],
    bumpers: [
      { x: 240, y: 155, radius: 20 },
      { x: 240, y: 360, radius: 20 },
      { x: 775, y: 155, radius: 22 },
      { x: 775, y: 360, radius: 22 }
    ],
    windmills: [{ cx: 590, cy: 258, length: 65, speed: 2.5 }],
    crates: [
      { x: 350, y: 258, type: 'BAZOOKA' },
      { x: 510, y: 258, type: 'NITRO' },
      { x: 740, y: 258, type: 'ANVIL' }
    ]
  },

  // HOYO 04: Pinball de Alto Voltaje (Par 4)
  {
    title: 'HOYO 04 // PINBALL DE ALTO VOLTAJE',
    par: 4,
    teeX: 135,
    teeY: 130,
    cupX: 845,
    cupY: 385,
    walls: [
      ...OUTER_WALLS,
      { x: 280, y: 61, w: 20, h: 230 },
      { x: 660, y: 220, w: 20, h: 239 }
    ],
    hazards: [
      { x: 110, y: 340, w: 155, h: 85, type: 'BOOST', boostVx: 280, boostVy: -60 },
      { x: 710, y: 80, w: 185, h: 85, type: 'SAND' }
    ],
    bumpers: [
      { x: 410, y: 145, radius: 24 },
      { x: 530, y: 145, radius: 24 },
      { x: 470, y: 255, radius: 28 },
      { x: 410, y: 365, radius: 24 },
      { x: 530, y: 365, radius: 24 },
      { x: 775, y: 265, radius: 22 }
    ],
    windmills: [{ cx: 470, cy: 255, length: 92, speed: -2.2 }],
    crates: [
      { x: 195, y: 280, type: 'NITRO' },
      { x: 470, y: 195, type: 'BAZOOKA' },
      { x: 470, y: 320, type: 'ANVIL' }
    ]
  },

  // HOYO 05: Bóveda de Compuertas (Par 4)
  {
    title: 'HOYO 05 // BÓVEDA DE COMPUERTAS',
    par: 4,
    teeX: 135,
    teeY: 390,
    cupX: 845,
    cupY: 130,
    walls: [
      ...OUTER_WALLS,
      { x: 275, y: 185, w: 20, h: 274 },
      { x: 485, y: 61, w: 20, h: 274 },
      { x: 695, y: 185, w: 20, h: 274 }
    ],
    hazards: [
      { x: 305, y: 365, w: 170, h: 85, type: 'ACID' },
      { x: 515, y: 68, w: 170, h: 85, type: 'ACID' },
      { x: 100, y: 95, w: 155, h: 65, type: 'BOOST', boostVx: 240, boostVy: 0 },
      { x: 525, y: 365, w: 150, h: 70, type: 'BOOST', boostVx: 230, boostVy: -150 }
    ],
    bumpers: [
      { x: 385, y: 125, radius: 22 },
      { x: 595, y: 265, radius: 22 },
      { x: 805, y: 285, radius: 22 }
    ],
    windmills: [
      { cx: 385, cy: 250, length: 68, speed: 2.6 },
      { cx: 795, cy: 195, length: 65, speed: -2.8 }
    ],
    crates: [
      { x: 200, y: 230, type: 'BAZOOKA' },
      { x: 390, y: 200, type: 'NITRO' },
      { x: 600, y: 385, type: 'BAZOOKA' }
    ]
  },

  // HOYO 06: Caos Final Worm-Golf (Par 5)
  {
    title: 'HOYO 06 // CAOS FINAL WORM-GOLF',
    par: 5,
    teeX: 130,
    teeY: 258,
    cupX: 855,
    cupY: 258,
    walls: [
      ...OUTER_WALLS,
      { x: 310, y: 185, w: 20, h: 146 },
      { x: 560, y: 61, w: 20, h: 130 },
      { x: 560, y: 325, w: 20, h: 134 },
      { x: 750, y: 175, w: 20, h: 166 }
    ],
    hazards: [
      { x: 335, y: 195, w: 195, h: 126, type: 'ACID' },
      { x: 615, y: 215, w: 115, h: 86, type: 'ACID' },
      { x: 335, y: 78, w: 200, h: 64, type: 'BOOST', boostVx: 260, boostVy: 0 },
      { x: 335, y: 374, w: 200, h: 64, type: 'BOOST', boostVx: 260, boostVy: 0 }
    ],
    bumpers: [
      { x: 235, y: 140, radius: 21 },
      { x: 235, y: 376, radius: 21 },
      { x: 570, y: 258, radius: 25 },
      { x: 810, y: 120, radius: 22 },
      { x: 810, y: 395, radius: 22 }
    ],
    windmills: [
      { cx: 235, cy: 258, length: 68, speed: 2.5 },
      { cx: 570, cy: 258, length: 78, speed: -3.0 },
      { cx: 760, cy: 258, length: 75, speed: 2.8 }
    ],
    crates: [
      { x: 190, y: 200, type: 'BAZOOKA' },
      { x: 190, y: 315, type: 'NITRO' },
      { x: 455, y: 110, type: 'BAZOOKA' },
      { x: 455, y: 405, type: 'ANVIL' }
    ]
  }
];

const PALETTE = [
  { name: 'ALEX', body: '#FF4F00', shade: '#C23B00' },
  { name: 'UNIT-02', body: '#1B4DFF', shade: '#1034B3' },
  { name: 'UNIT-03', body: '#F59E0B', shade: '#B45309' },
  { name: 'UNIT-04', body: '#15803D', shade: '#14532D' }
];

const EMOTES = ['¡HOYO EN 1!', '¡COME MINA!', '¡FORE!', '¡JAJAJA!'];

export class PuttWarEngine {
  public holeIndex = 0;
  public holeTitle = PUTT_HOLES[0].title;
  public par = PUTT_HOLES[0].par;
  public status: 'PLAYING' | 'HOLE_COMPLETE' = 'PLAYING';
  public statusTimer = 0;
  public hurryTimer = 14;
  public hurryActive = false;

  public cupX = PUTT_HOLES[0].cupX;
  public cupY = PUTT_HOLES[0].cupY;
  public cupRadius = 21;

  public players: PuttBallPlayer[] = [];
  public walls: PuttWallRect[] = [];
  public hazards: PuttHazardRect[] = [];
  public bumpers: PuttBumper[] = [];
  public windmills: PuttWindmill[] = [];
  public crates: PuttWeaponCrate[] = [];
  public bombs: PuttBomb[] = [];
  public explosions: PuttExplosion[] = [];
  public callouts: FloatingCallout[] = [];

  public botsEnabled = true;
  private remoteInputs = new Map<number, ClientInputPacket>();
  private lastActionSeqBySlot = new Map<number, number>();
  private nextBombId = 1;
  private sunkCount = 0;

  constructor() {
    this.initPlayers();
    this.loadHole(0);
  }

  private initPlayers(): void {
    this.players = PALETTE.map((c, idx) => ({
      id: idx,
      name: c.name,
      bodyColor: c.body,
      shadeColor: c.shade,
      isBot: idx > 0,
      x: 140,
      y: 220 + idx * 28,
      vx: 0,
      vy: 0,
      lastSafeX: 140,
      lastSafeY: 220 + idx * 28,
      radius: 14,
      aimAngle: 0,
      chargePower: 0,
      isCharging: false,
      puttCooldown: 0,
      bombCooldown: 0,
      shockwaveCooldown: 0,
      heldPowerup: 'NONE',
      anvilTimer: 0,
      strokes: 0,
      totalPoints: 0,
      sunkInCup: false,
      sunkOrder: 0,
      emoteText: null,
      emoteTimer: 0,
      botShotTimer: 0.7 + idx * 0.35
    }));
  }

  public syncPlayerIdentities(
    roster: Array<{ name: string; isBot: boolean }>,
    botsEnabled = true
  ): void {
    this.botsEnabled = botsEnabled;
    roster.forEach((r, idx) => {
      if (this.players[idx]) {
        this.players[idx].name = r.name;
        this.players[idx].isBot = r.isBot;
      }
    });
  }

  public getActivePlayers(): PuttBallPlayer[] {
    return this.players.filter((p) => !p.isBot || this.botsEnabled);
  }

  public loadHole(index: number): void {
    this.holeIndex = ((index % PUTT_HOLES.length) + PUTT_HOLES.length) % PUTT_HOLES.length;
    const cfg = PUTT_HOLES[this.holeIndex];
    this.holeTitle = cfg.title;
    this.par = cfg.par;
    this.cupX = cfg.cupX;
    this.cupY = cfg.cupY;
    this.status = 'PLAYING';
    this.statusTimer = 0;
    this.hurryActive = false;
    this.hurryTimer = 14;
    this.sunkCount = 0;

    this.walls = cfg.walls.map((w) => ({ ...w }));
    this.hazards = cfg.hazards.map((h) => ({ ...h }));
    this.bumpers = cfg.bumpers.map((b) => ({ ...b, hitAnim: 0 }));
    this.windmills = cfg.windmills.map((wm) => ({ ...wm, angle: 0 }));
    this.crates = cfg.crates.map((cr, idx) => ({
      id: idx,
      x: cr.x,
      y: cr.y,
      type: cr.type,
      active: true,
      respawnTimer: 0
    }));
    this.bombs = [];
    this.explosions = [];

    const offsets = [
      { dx: 0, dy: -36 },
      { dx: 0, dy: -12 },
      { dx: 0, dy: 12 },
      { dx: 0, dy: 36 }
    ];

    this.players.forEach((p, idx) => {
      const off = offsets[idx] || { dx: 0, dy: 0 };
      p.x = cfg.teeX + off.dx;
      p.y = Math.max(85, Math.min(430, cfg.teeY + off.dy));
      p.lastSafeX = p.x;
      p.lastSafeY = p.y;
      p.vx = 0;
      p.vy = 0;
      p.chargePower = 0;
      p.isCharging = false;
      p.puttCooldown = 0;
      p.bombCooldown = 0;
      p.shockwaveCooldown = 0;
      p.anvilTimer = 0;
      p.strokes = 0;
      p.sunkInCup = false;
      p.sunkOrder = 0;
      p.botShotTimer = 0.6 + idx * 0.35;
      p.aimAngle = Math.atan2(this.cupY - p.y, this.cupX - p.x);
    });

    this.addCallout(500, 120, `${this.holeTitle} (PAR ${this.par})`, '#18181B', '#F4F0E8');
  }

  public executePutt(p: PuttBallPlayer, power01: number, angle?: number): void {
    if (p.sunkInCup || p.puttCooldown > 0 || this.status !== 'PLAYING') return;
    if (angle !== undefined) {
      p.aimAngle = angle;
    }

    const clampedPower = Math.max(0.18, Math.min(1.0, power01));
    const maxShotSpeed = p.anvilTimer > 0 ? 310 : 690;
    const shotSpeed = 160 + clampedPower * maxShotSpeed;

    // Record safe spot if currently slow
    if (Math.hypot(p.vx, p.vy) < 60) {
      p.lastSafeX = p.x;
      p.lastSafeY = p.y;
    }

    p.vx += Math.cos(p.aimAngle) * shotSpeed;
    p.vy += Math.sin(p.aimAngle) * shotSpeed;
    p.strokes += 1;
    p.puttCooldown = 0.65;
    p.isCharging = false;
    p.chargePower = 0;

    sfx.playBatParry(Math.round(clampedPower * 10), clampedPower > 0.85, false);
  }

  public lobBombOrWeapon(p: PuttBallPlayer): void {
    if (p.sunkInCup || this.status !== 'PLAYING') return;

    // If holding BAZOOKA powerup, fire a homing rocket at the leader!
    if (p.heldPowerup === 'BAZOOKA') {
      p.heldPowerup = 'NONE';
      const target = this.findLeaderTarget(p.id);
      const launchAngle = target
        ? Math.atan2(target.y - p.y, target.x - p.x)
        : p.aimAngle;

      this.bombs.push({
        id: this.nextBombId++,
        ownerId: p.id,
        x: p.x + Math.cos(launchAngle) * 20,
        y: p.y + Math.sin(launchAngle) * 20,
        vx: Math.cos(launchAngle) * 380,
        vy: Math.sin(launchAngle) * 380,
        timer: 2.4,
        maxTimer: 2.4,
        isRocket: true,
        targetId: target ? target.id : null
      });
      sfx.playMultiballSiren();
      this.addCallout(p.x, p.y - 34, '🚀 ¡MISIL WORMS!', '#FF4F00', '#FFFFFF');
      return;
    }

    if (p.bombCooldown > 0) return;
    p.bombCooldown = 3.8;

    const throwSpeed = 260;
    this.bombs.push({
      id: this.nextBombId++,
      ownerId: p.id,
      x: p.x + Math.cos(p.aimAngle) * 18,
      y: p.y + Math.sin(p.aimAngle) * 18,
      vx: p.vx * 0.35 + Math.cos(p.aimAngle) * throwSpeed,
      vy: p.vy * 0.35 + Math.sin(p.aimAngle) * throwSpeed,
      timer: 1.85,
      maxTimer: 1.85,
      isRocket: false,
      targetId: null
    });

    sfx.playDashPiston();
    this.addCallout(p.x, p.y - 30, '💣 ¡MINA LANZADA!', '#18181B', '#F59E0B');
  }

  public triggerShockwaveOrPowerup(p: PuttBallPlayer): void {
    if (p.sunkInCup || this.status !== 'PLAYING') return;

    if (p.heldPowerup === 'NITRO') {
      p.heldPowerup = 'NONE';
      p.vx += Math.cos(p.aimAngle) * 580;
      p.vy += Math.sin(p.aimAngle) * 580;
      sfx.playDashPiston();
      this.addCallout(p.x, p.y - 32, '⚡ ¡TURBO NITRO!', '#F59E0B', '#18181B');
      return;
    }

    if (p.heldPowerup === 'ANVIL') {
      p.heldPowerup = 'NONE';
      const target = this.findLeaderTarget(p.id);
      if (target) {
        target.anvilTimer = 4.5;
        target.vx *= 0.2;
        target.vy *= 0.2;
        sfx.playKODisassembly();
        this.addCallout(target.x, target.y - 34, '⚓ ¡YUNQUE PESADO!', '#18181B', '#FFFFFF');
      }
      return;
    }

    if (p.shockwaveCooldown > 0) return;
    p.shockwaveCooldown = 4.2;

    this.explosions.push({
      x: p.x,
      y: p.y,
      radius: 14,
      maxRadius: 105,
      life: 1,
      color: '#1B4DFF'
    });

    const active = this.getActivePlayers();
    let hitCount = 0;
    for (const other of active) {
      if (other.id === p.id || other.sunkInCup) continue;
      const dx = other.x - p.x;
      const dy = other.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 110) {
        const force = (1 - dist / 110) * 520 + 180;
        other.vx += (dx / dist) * force;
        other.vy += (dy / dist) * force;
        hitCount++;
      }
    }

    sfx.playPinballBumper();
    this.addCallout(
      p.x,
      p.y - 30,
      hitCount > 0 ? '🧲 ¡EMP EMPUJÓN!' : '🧲 PULSO MAGNÉTICO',
      '#1B4DFF',
      '#FFFFFF'
    );
  }

  public triggerEmote(p: PuttBallPlayer, index: number): void {
    const label = EMOTES[(index - 1) % EMOTES.length] || EMOTES[0];
    p.emoteText = label;
    p.emoteTimer = 1.8;
    sfx.playHornEmote(index);
  }

  public applyRemoteInput(input: ClientInputPacket): void {
    const p = this.players[input.slotId];
    if (!p) return;
    p.name = input.name.slice(0, 10).toUpperCase();
    p.aimAngle = input.aimAngle;

    const isDuplicateAction =
      typeof input.actionSeq === 'number' &&
      input.actionSeq > 0 &&
      this.lastActionSeqBySlot.get(input.slotId) === input.actionSeq;
    if (typeof input.actionSeq === 'number' && input.actionSeq > 0) {
      this.lastActionSeqBySlot.set(input.slotId, input.actionSeq);
    }

    if (!isDuplicateAction) {
      if (input.emotePressed > 0) this.triggerEmote(p, input.emotePressed);
      if (input.yankPressed) this.lobBombOrWeapon(p);
      if (input.dashPressed) this.triggerShockwaveOrPowerup(p);
      if (input.shotReleasedPower && input.shotReleasedPower > 0.05) {
        this.executePutt(p, input.shotReleasedPower, input.aimAngle);
      }
    }
    this.remoteInputs.set(input.slotId, input);
  }

  private findLeaderTarget(excludeId: number): PuttBallPlayer | null {
    const candidates = this.getActivePlayers().filter(
      (o) => o.id !== excludeId && !o.sunkInCup
    );
    if (candidates.length === 0) return null;
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - this.cupX, a.y - this.cupY) -
        Math.hypot(b.x - this.cupX, b.y - this.cupY)
    );
    return candidates[0];
  }

  public step(dt: number, hostInput: ClientInputPacket): void {
    // Update Floating Callouts & Explosions
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      this.callouts[i].y -= 24 * dt;
      this.callouts[i].life -= dt * 1.1;
      if (this.callouts[i].life <= 0) this.callouts.splice(i, 1);
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt * 2.6;
      ex.radius = ex.maxRadius * (1 - ex.life * 0.65);
      if (ex.life <= 0) this.explosions.splice(i, 1);
    }

    if (this.status !== 'PLAYING') {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) {
        this.loadHole(this.holeIndex + 1);
      }
      return;
    }

    // Rotate Windmills
    for (const wm of this.windmills) {
      wm.angle += wm.speed * dt;
    }

    // Update Crates Respawn
    for (const cr of this.crates) {
      if (!cr.active) {
        cr.respawnTimer -= dt;
        if (cr.respawnTimer <= 0) cr.active = true;
      }
    }

    // Hurry-Up Timer once someone sinks their ball
    if (this.hurryActive) {
      this.hurryTimer -= dt;
      if (this.hurryTimer <= 0) {
        this.finishHole();
        return;
      }
    }

    const activePlayers = this.getActivePlayers();

    // 1. Update Player Inputs, Bots & Physics
    for (const p of activePlayers) {
      if (p.puttCooldown > 0) p.puttCooldown = Math.max(0, p.puttCooldown - dt);
      if (p.bombCooldown > 0) p.bombCooldown = Math.max(0, p.bombCooldown - dt);
      if (p.shockwaveCooldown > 0) p.shockwaveCooldown = Math.max(0, p.shockwaveCooldown - dt);
      if (p.anvilTimer > 0) p.anvilTimer = Math.max(0, p.anvilTimer - dt);
      if (p.emoteTimer > 0) {
        p.emoteTimer -= dt;
        if (p.emoteTimer <= 0) p.emoteText = null;
      }

      if (p.sunkInCup) continue;

      const inp = p.id === hostInput.slotId ? hostInput : this.remoteInputs.get(p.id);

      if (!p.isBot && inp) {
        p.aimAngle = inp.aimAngle;
        if (inp.chargingParry && p.puttCooldown <= 0) {
          p.isCharging = true;
          p.chargePower = Math.min(1.0, p.chargePower + dt * 1.15);
        } else if (p.isCharging && !inp.chargingParry) {
          const releasePwr = Math.max(0.32, p.chargePower);
          this.executePutt(p, releasePwr, p.aimAngle);
        }

        // Subtle mid-roll English / nudge with WASD
        if (Math.hypot(p.vx, p.vy) > 25) {
          p.vx += inp.moveX * 52 * dt;
          p.vy += inp.moveY * 52 * dt;
        }
      } else if (p.isBot) {
        this.stepBotGolfAI(p, dt, activePlayers);
      }

      // Apply Surface Friction & Hazard Zones
      let friction = p.anvilTimer > 0 ? 0.94 : 0.983;

      for (const hz of this.hazards) {
        if (
          p.x >= hz.x &&
          p.x <= hz.x + hz.w &&
          p.y >= hz.y &&
          p.y <= hz.y + hz.h
        ) {
          if (hz.type === 'SAND') {
            friction = 0.91;
          } else if (hz.type === 'BOOST') {
            p.vx += (hz.boostVx || 0) * dt * 3.2;
            p.vy += (hz.boostVy || 0) * dt * 3.2;
          } else if (hz.type === 'ACID') {
            // Acid hazard penalty: respawn at last safe position + 1 stroke!
            sfx.playKODisassembly();
            this.addCallout(p.x, p.y - 20, '☣️ ¡ÁCIDO! (+1 GOLPE)', '#15803D', '#FFFFFF');
            p.x = p.lastSafeX;
            p.y = p.lastSafeY;
            p.vx = 0;
            p.vy = 0;
            p.strokes += 1;
          }
        }
      }

      // Record safe position when nearly stopped outside hazards
      if (Math.hypot(p.vx, p.vy) < 22) {
        p.lastSafeX = p.x;
        p.lastSafeY = p.y;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(friction, dt * 60);
      p.vy *= Math.pow(friction, dt * 60);

      if (Math.hypot(p.vx, p.vy) < 8) {
        p.vx = 0;
        p.vy = 0;
      }

      // Collide with Rectangular Walls
      for (const w of this.walls) {
        this.resolveCircleRectBounce(p, w);
      }

      // Collide with Pinball Bumpers
      for (const b of this.bumpers) {
        if (b.hitAnim > 0) b.hitAnim = Math.max(0, b.hitAnim - dt * 4);
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = p.radius + b.radius;
        if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          p.x = b.x + nx * (minDist + 2);
          p.y = b.y + ny * (minDist + 2);
          const speed = Math.max(320, Math.hypot(p.vx, p.vy) * 1.15);
          p.vx = nx * speed;
          p.vy = ny * speed;
          b.hitAnim = 1;
          sfx.playPinballBumper();
        }
      }

      // Collide with Rotating Windmill Blades
      for (const wm of this.windmills) {
        const x1 = wm.cx - Math.cos(wm.angle) * wm.length;
        const y1 = wm.cy - Math.sin(wm.angle) * wm.length;
        const x2 = wm.cx + Math.cos(wm.angle) * wm.length;
        const y2 = wm.cy + Math.sin(wm.angle) * wm.length;
        const d = this.pointToSegmentDist(p.x, p.y, x1, y1, x2, y2);
        if (d < p.radius + 7) {
          const nx = -Math.sin(wm.angle) * Math.sign(wm.speed);
          const ny = Math.cos(wm.angle) * Math.sign(wm.speed);
          p.vx = nx * 360 + (p.x - wm.cx) * 2;
          p.vy = ny * 360 + (p.y - wm.cy) * 2;
          sfx.playCartridgeClick();
        }
      }

      // Collect Weapon Crates
      for (const cr of this.crates) {
        if (!cr.active) continue;
        if (Math.hypot(p.x - cr.x, p.y - cr.y) < p.radius + 16) {
          cr.active = false;
          cr.respawnTimer = 7.5;
          p.heldPowerup = cr.type;
          sfx.playCartridgeClick();
          const label =
            cr.type === 'BAZOOKA'
              ? '📦 [E] ¡COHETE WORMS!'
              : cr.type === 'NITRO'
                ? '📦 [SHIFT] ¡TURBO NITRO!'
                : '📦 [SHIFT] ¡YUNQUE PESADO!';
          this.addCallout(p.x, p.y - 28, label, '#F59E0B', '#18181B');
        }
      }

      // Check Cup Gravity & Sinking in the Hole!
      const cupDx = this.cupX - p.x;
      const cupDy = this.cupY - p.y;
      const cupDist = Math.hypot(cupDx, cupDy);
      const speed = Math.hypot(p.vx, p.vy);

      if (cupDist < this.cupRadius + 14) {
        // Rim gravity pull
        p.vx += (cupDx / (cupDist || 1)) * 420 * dt;
        p.vy += (cupDy / (cupDist || 1)) * 420 * dt;
      }

      if (cupDist < this.cupRadius - 2 && speed < 440) {
        p.sunkInCup = true;
        this.sunkCount++;
        p.sunkOrder = this.sunkCount;
        p.x = this.cupX;
        p.y = this.cupY;
        p.vx = 0;
        p.vy = 0;

        // Points: 1st = +3, 2nd = +2, 3rd = +1, plus +1 under/at Par bonus
        const orderBonus = Math.max(1, 4 - p.sunkOrder);
        const parBonus = p.strokes <= this.par ? 1 : 0;
        const pts = orderBonus + parBonus;
        p.totalPoints += pts;

        sfx.playMultiballSiren();
        this.addCallout(
          this.cupX,
          this.cupY - 36,
          `⛳ ¡${p.name} EMBOCA! (+${pts} PTS)`,
          p.bodyColor,
          '#FFFFFF'
        );

        if (!this.hurryActive) {
          this.hurryActive = true;
          this.hurryTimer = 12;
        }
      }
    }

    // 2. Ball-to-Ball Heavy Knockback Collisions
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const a = activePlayers[i];
        const b = activePlayers[j];
        if (a.sunkInCup || b.sunkInCup) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = a.radius + b.radius;
        if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.55;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          const kx = a.vx - b.vx;
          const ky = a.vy - b.vy;
          const pImpulse = 1.25 * (nx * kx + ny * ky);
          a.vx -= pImpulse * nx;
          a.vy -= pImpulse * ny;
          b.vx += pImpulse * nx;
          b.vy += pImpulse * ny;

          if (Math.abs(pImpulse) > 95) {
            sfx.playBatParry(4, false, false);
          }
        }
      }
    }

    // 3. Step Bombs & Homing Rockets
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.timer -= dt;

      if (b.isRocket && b.targetId !== null) {
        const target = this.players[b.targetId];
        if (target && !target.sunkInCup) {
          const desired = Math.atan2(target.y - b.y, target.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const nextAngle = cur + diff * Math.min(1, dt * 6.5);
          const spd = 410;
          b.vx = Math.cos(nextAngle) * spd;
          b.vy = Math.sin(nextAngle) * spd;
        }
      } else {
        b.vx *= Math.pow(0.95, dt * 60);
        b.vy *= Math.pow(0.95, dt * 60);
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Bounce bombs off walls
      for (const w of this.walls) {
        if (b.x >= w.x && b.x <= w.x + w.w && b.y >= w.y && b.y <= w.y + w.h) {
          b.vx *= -0.75;
          b.vy *= -0.75;
        }
      }

      // Proximity detonation if a rival ball gets close after arming!
      let proximityTriggered = false;
      if (b.maxTimer - b.timer > 0.35) {
        for (const p of activePlayers) {
          if (p.id === b.ownerId || p.sunkInCup) continue;
          if (Math.hypot(p.x - b.x, p.y - b.y) < 34) {
            proximityTriggered = true;
            break;
          }
        }
      }

      if (b.timer <= 0 || proximityTriggered) {
        this.detonateBomb(b, activePlayers);
        this.bombs.splice(i, 1);
      }
    }

    // 4. Check if all active players sunk in the cup
    if (activePlayers.length > 0 && activePlayers.every((p) => p.sunkInCup)) {
      this.finishHole();
    }
  }

  private detonateBomb(b: PuttBomb, activePlayers: PuttBallPlayer[]): void {
    const blastRadius = b.isRocket ? 135 : 115;
    this.explosions.push({
      x: b.x,
      y: b.y,
      radius: 18,
      maxRadius: blastRadius,
      life: 1,
      color: '#FF4F00'
    });
    sfx.playKODisassembly();

    let hitRival = false;
    for (const p of activePlayers) {
      if (p.sunkInCup) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < blastRadius) {
        const ratio = 1 - dist / blastRadius;
        const blastForce = 340 + ratio * 540;
        p.vx += (dx / dist) * blastForce;
        p.vy += (dy / dist) * blastForce;
        if (p.id !== b.ownerId) hitRival = true;
      }
    }

    if (hitRival) {
      const owner = this.players[b.ownerId];
      if (owner) {
        this.addCallout(b.x, b.y - 26, `💥 ¡BOOM DE ${owner.name}!`, '#FF4F00', '#FFFFFF');
      }
    }
  }

  private finishHole(): void {
    this.status = 'HOLE_COMPLETE';
    this.statusTimer = 2.6;
    this.addCallout(500, 210, '🏁 ¡HOYO COMPLETADO! SIGUIENTE PISTA...', '#15803D', '#FFFFFF');
  }

  private stepBotGolfAI(
    p: PuttBallPlayer,
    dt: number,
    activePlayers: PuttBallPlayer[]
  ): void {
    // Wait until ball slows down and shot timer expires
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 45) return;

    p.botShotTimer -= dt;
    if (p.botShotTimer > 0) return;

    // Reset timer for next shot (humanized cadence: 1.3s to 2.2s)
    p.botShotTimer = 1.35 + Math.random() * 0.85;

    // Occasionally use held powerups or lob a bomb at a nearby rival
    if (p.heldPowerup !== 'NONE' && Math.random() < 0.65) {
      if (p.heldPowerup === 'BAZOOKA') {
        this.lobBombOrWeapon(p);
      } else {
        this.triggerShockwaveOrPowerup(p);
      }
    } else if (p.bombCooldown <= 0 && Math.random() < 0.25) {
      const rival = activePlayers.find(
        (o) => o.id !== p.id && !o.sunkInCup && Math.hypot(o.x - p.x, o.y - p.y) < 220
      );
      if (rival) {
        p.aimAngle = Math.atan2(rival.y - p.y, rival.x - p.x);
        this.lobBombOrWeapon(p);
      }
    }

    // Compute aim toward cup (with bank/waypoint assist if direct line is blocked by a wall)
    let targetX = this.cupX;
    let targetY = this.cupY;

    // If direct path to cup intersects an internal wall, aim around top or bottom corridor
    if (this.segmentHitsWall(p.x, p.y, targetX, targetY)) {
      const topClear = !this.segmentHitsWall(p.x, p.y, p.x + 180, 115);
      targetX = Math.min(840, p.x + 240);
      targetY = topClear ? 115 : 395;
    }

    const baseAngle = Math.atan2(targetY - p.y, targetX - p.x);
    const jitter = (Math.random() - 0.5) * 0.22;
    const dist = Math.hypot(targetX - p.x, targetY - p.y);
    const desiredPower = Math.min(0.92, Math.max(0.28, dist / 460));

    this.executePutt(p, desiredPower, baseAngle + jitter);
  }

  private segmentHitsWall(x1: number, y1: number, x2: number, y2: number): boolean {
    // Check internal walls (skip first 4 outer walls)
    for (let i = 4; i < this.walls.length; i++) {
      const w = this.walls[i];
      const midX = (x1 + x2) * 0.5;
      const midY = (y1 + y2) * 0.5;
      if (midX >= w.x - 10 && midX <= w.x + w.w + 10 && midY >= w.y - 10 && midY <= w.y + w.h + 10) {
        return true;
      }
    }
    return false;
  }

  private resolveCircleRectBounce(p: PuttBallPlayer, w: PuttWallRect): void {
    const closestX = Math.max(w.x, Math.min(p.x, w.x + w.w));
    const closestY = Math.max(w.y, Math.min(p.y, w.y + w.h));
    const dx = p.x - closestX;
    const dy = p.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < p.radius * p.radius) {
      const dist = Math.sqrt(distSq) || 0.001;
      let nx = dx / dist;
      let ny = dy / dist;

      // If center is inside rect, push out along shortest axis
      if (distSq === 0) {
        const leftPen = Math.abs(p.x - w.x);
        const rightPen = Math.abs(w.x + w.w - p.x);
        const topPen = Math.abs(p.y - w.y);
        const botPen = Math.abs(w.y + w.h - p.y);
        const minPen = Math.min(leftPen, rightPen, topPen, botPen);
        if (minPen === leftPen) {
          nx = -1;
          ny = 0;
        } else if (minPen === rightPen) {
          nx = 1;
          ny = 0;
        } else if (minPen === topPen) {
          nx = 0;
          ny = -1;
        } else {
          nx = 0;
          ny = 1;
        }
      }

      p.x = closestX + nx * (p.radius + 1.5);
      p.y = closestY + ny * (p.radius + 1.5);

      const dot = p.vx * nx + p.vy * ny;
      if (dot < 0) {
        const restitution = 0.84;
        p.vx = (p.vx - 2 * dot * nx) * restitution;
        p.vy = (p.vy - 2 * dot * ny) * restitution;
        if (Math.hypot(p.vx, p.vy) > 90) {
          sfx.playCartridgeClick();
        }
      }
    }
  }

  private pointToSegmentDist(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  public addCallout(
    x: number,
    y: number,
    text: string,
    bgColor: string,
    textColor: string
  ): void {
    this.callouts.push({ x, y, text, bgColor, textColor, life: 1 });
  }

  public getSnapshot(): PuttWarSnapshot {
    return {
      holeIndex: this.holeIndex,
      holeTitle: this.holeTitle,
      par: this.par,
      status: this.status,
      hurryTimer: this.hurryTimer,
      hurryActive: this.hurryActive,
      statusTimer: this.statusTimer,
      cupX: this.cupX,
      cupY: this.cupY,
      cupRadius: this.cupRadius,
      players: this.players.map((p) => ({ ...p })),
      bombs: this.bombs.map((b) => ({ ...b })),
      crates: this.crates.map((c) => ({ ...c })),
      bumpers: this.bumpers.map((b) => ({ ...b })),
      windmills: this.windmills.map((w) => ({ ...w })),
      explosions: this.explosions.map((e) => ({ ...e }))
    };
  }

  /**
   * Client-side prediction & dead-reckoning for 03 // TURBO-PUTT:
   * Predicts local shot charging/putt release and dead-reckons rolling balls, bombs, and windmills at 60fps!
   */
  public stepClientPrediction(
    dt: number,
    localSlotId: number,
    input: ClientInputPacket
  ): number | undefined {
    let releasedPower: number | undefined;

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      this.callouts[i].y -= 24 * dt;
      this.callouts[i].life -= dt * 1.1;
      if (this.callouts[i].life <= 0) this.callouts.splice(i, 1);
    }
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt * 2.6;
      ex.radius = ex.maxRadius * (1 - ex.life * 0.65);
      if (ex.life <= 0) this.explosions.splice(i, 1);
    }

    if (this.status !== 'PLAYING') return undefined;

    for (const wm of this.windmills) {
      wm.angle += wm.speed * dt;
    }

    for (const b of this.bombs) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.timer = Math.max(0, b.timer - dt);
    }

    const myP = this.players[localSlotId];
    if (myP && !myP.sunkInCup) {
      if (myP.puttCooldown > 0) myP.puttCooldown = Math.max(0, myP.puttCooldown - dt);
      myP.aimAngle = input.aimAngle;
      if (input.chargingParry && myP.puttCooldown <= 0) {
        myP.isCharging = true;
        myP.chargePower = Math.min(1.0, myP.chargePower + dt * 1.15);
      } else if (myP.isCharging && !input.chargingParry) {
        releasedPower = Math.max(0.32, myP.chargePower);
        this.executePutt(myP, releasedPower, myP.aimAngle);
      } else if (input.shotReleasedPower && input.shotReleasedPower > 0.05) {
        releasedPower = input.shotReleasedPower;
        this.executePutt(myP, releasedPower, myP.aimAngle);
      }
    }

    // Dead-reckon all rolling golf balls with surface friction and wall bounces
    for (const p of this.getActivePlayers()) {
      if (p.sunkInCup) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.983, dt * 60);
      p.vy *= Math.pow(0.983, dt * 60);
      for (const w of this.walls) {
        this.resolveCircleRectBounce(p, w);
      }
    }

    return releasedPower;
  }

  public applySnapshot(snap: PuttWarSnapshot, localSlotId?: number): void {
    if (this.holeIndex !== snap.holeIndex) {
      this.loadHole(snap.holeIndex);
    }
    this.holeTitle = snap.holeTitle;
    this.par = snap.par;
    this.status = snap.status;
    this.hurryTimer = snap.hurryTimer;
    this.hurryActive = snap.hurryActive;
    this.statusTimer = snap.statusTimer;
    this.cupX = snap.cupX;
    this.cupY = snap.cupY;

    this.players = snap.players.map((sp) => {
      const prev = this.players[sp.id];
      if (!prev || this.status !== 'PLAYING' || sp.sunkInCup) return { ...sp };

      if (localSlotId !== undefined && sp.id === localSlotId) {
        const dist = Math.hypot(sp.x - prev.x, sp.y - prev.y);
        // If local player just shot and Host snapshot hasn't caught up yet, keep 100% local ball trajectory!
        const shotInFlight = prev.puttCooldown > 0.2 && Math.hypot(sp.vx, sp.vy) < 25;
        const posPull = shotInFlight ? 0.0 : dist < 160 ? 0.16 : 1.0;
        return {
          ...sp,
          x: prev.x + (sp.x - prev.x) * posPull,
          y: prev.y + (sp.y - prev.y) * posPull,
          vx: shotInFlight ? prev.vx : sp.vx,
          vy: shotInFlight ? prev.vy : sp.vy,
          strokes: Math.max(prev.strokes, sp.strokes),
          puttCooldown: Math.max(prev.puttCooldown, sp.puttCooldown),
          aimAngle: prev.aimAngle,
          isCharging: prev.isCharging,
          chargePower: prev.isCharging ? prev.chargePower : sp.chargePower
        };
      }

      const rDist = Math.hypot(sp.x - prev.x, sp.y - prev.y);
      if (rDist < 150) {
        return {
          ...sp,
          x: prev.x + (sp.x - prev.x) * 0.35,
          y: prev.y + (sp.y - prev.y) * 0.35
        };
      }
      return { ...sp };
    });

    this.bombs = snap.bombs.map((b) => ({ ...b }));
    this.crates = snap.crates.map((c) => ({ ...c }));
    this.bumpers = snap.bumpers.map((b) => ({ ...b }));
    this.windmills = snap.windmills.map((w) => ({ ...w }));
    this.explosions = snap.explosions.map((e) => ({ ...e }));
  }
}
