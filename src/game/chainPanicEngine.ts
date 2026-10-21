import {
  ChainGameMode,
  ChainPanicSnapshot,
  ChainPlayerState,
  ClientInputPacket,
  FloatingCallout,
  FragileTile,
  HazardLaser,
  HeavyBattery,
  ParticleEffect,
  PlatformRect,
  PressureSwitch,
  RotaryLaser
} from '../types';
import { sfx } from '../audio/mechanicalSfx';

export interface LevelDefinition {
  title: string;
  subtitle: string;
  spawnX: number;
  spawnY: number;
  goalRect: { x: number; y: number; w: number; h: number };
  platforms: PlatformRect[];
  fragileDefs?: Array<{ x: number; y: number; w: number; h: number }>;
  bridgeRect: PlatformRect;
  switches: Array<{ x: number; y: number }>;
  lasers: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    sweepRange: number;
    sweepSpeed: number;
  }>;
  rotaryDefs?: Array<{ cx: number; cy: number; length: number; speed: number }>;
  batterySpawn?: { x: number; y: number };
  hasWindTurbine?: boolean;
}

export const CHAIN_LEVELS: LevelDefinition[] = [
  {
    title: 'SECTOR 01 // PUENTE SÍNCRONO & LÁSER',
    subtitle: 'Salta el láser con [ESPACIO] y pisen los 2 botones a la vez',
    spawnX: 115,
    spawnY: 260,
    platforms: [
      { x: 45, y: 150, w: 170, h: 220 },
      { x: 205, y: 205, w: 230, h: 110 },
      { x: 425, y: 125, w: 230, h: 270 }
    ],
    bridgeRect: { x: 645, y: 200, w: 150, h: 120 },
    goalRect: { x: 785, y: 155, w: 165, h: 210 },
    switches: [
      { x: 520, y: 175 },
      { x: 520, y: 345 }
    ],
    lasers: [{ x1: 315, y1: 205, x2: 315, y2: 315, sweepRange: 65, sweepSpeed: 1.7 }]
  },
  {
    title: 'SECTOR 02 // PASARELA QUE SE DERRUMBA',
    subtitle: '¡No se detengan en los bloques naranjas! Usa [E] para jalar amigos',
    spawnX: 105,
    spawnY: 260,
    platforms: [
      { x: 45, y: 150, w: 160, h: 220 },
      { x: 445, y: 130, w: 215, h: 260 }
    ],
    fragileDefs: [
      { x: 200, y: 195, w: 62, h: 130 },
      { x: 262, y: 195, w: 62, h: 130 },
      { x: 324, y: 195, w: 62, h: 130 },
      { x: 386, y: 195, w: 62, h: 130 }
    ],
    bridgeRect: { x: 650, y: 200, w: 145, h: 120 },
    goalRect: { x: 785, y: 155, w: 165, h: 210 },
    switches: [
      { x: 515, y: 175 },
      { x: 585, y: 260 },
      { x: 515, y: 345 }
    ],
    lasers: []
  },
  {
    title: 'SECTOR 03 // CARGA NUCLEAR (CORE-99)',
    subtitle: 'Empujen o enganchen con el cable la Batería CORE-99 hasta la meta',
    spawnX: 105,
    spawnY: 260,
    platforms: [
      { x: 45, y: 140, w: 200, h: 240 },
      { x: 235, y: 185, w: 210, h: 150 },
      { x: 435, y: 120, w: 225, h: 280 }
    ],
    bridgeRect: { x: 650, y: 195, w: 145, h: 130 },
    goalRect: { x: 785, y: 155, w: 165, h: 210 },
    switches: [
      { x: 515, y: 165 },
      { x: 515, y: 355 }
    ],
    lasers: [{ x1: 335, y1: 185, x2: 335, y2: 335, sweepRange: 55, sweepSpeed: 1.9 }],
    batterySpawn: { x: 185, y: 260 }
  },
  {
    title: 'SECTOR 04 // TURBINA DE VIENTO & ANCLAJE',
    subtitle: 'Cuando suene la alerta de VIENTO, mantén [SHIFT / CLIC DER] para anclarte',
    spawnX: 110,
    spawnY: 260,
    platforms: [
      { x: 45, y: 155, w: 160, h: 210 },
      { x: 195, y: 195, w: 250, h: 130 },
      { x: 435, y: 125, w: 225, h: 270 }
    ],
    bridgeRect: { x: 650, y: 200, w: 145, h: 120 },
    goalRect: { x: 785, y: 155, w: 165, h: 210 },
    switches: [
      { x: 495, y: 170 },
      { x: 595, y: 260 },
      { x: 495, y: 350 }
    ],
    lasers: [],
    hasWindTurbine: true
  },
  {
    title: 'SECTOR 05 // LA GUADAÑA LÁSER 360°',
    subtitle: 'Salta el brazo láser giratorio mientras activan los 4 interruptores',
    spawnX: 110,
    spawnY: 260,
    platforms: [
      { x: 45, y: 150, w: 160, h: 220 },
      { x: 195, y: 200, w: 185, h: 120 },
      { x: 370, y: 95, w: 290, h: 330 }
    ],
    bridgeRect: { x: 650, y: 200, w: 145, h: 120 },
    goalRect: { x: 785, y: 155, w: 165, h: 210 },
    switches: [
      { x: 430, y: 150 },
      { x: 595, y: 150 },
      { x: 430, y: 370 },
      { x: 595, y: 370 }
    ],
    lasers: [],
    rotaryDefs: [{ cx: 512, cy: 260, length: 145, speed: 1.95 }]
  },
  {
    title: 'SECTOR 06 // BÓVEDA FINAL OVERDRIVE',
    subtitle: 'Puente frágil + Batería CORE-99 + Guadaña 360° + 4 Botones',
    spawnX: 105,
    spawnY: 260,
    platforms: [
      { x: 45, y: 145, w: 165, h: 230 },
      { x: 380, y: 95, w: 280, h: 330 }
    ],
    fragileDefs: [
      { x: 205, y: 195, w: 60, h: 130 },
      { x: 265, y: 195, w: 60, h: 130 },
      { x: 325, y: 195, w: 60, h: 130 }
    ],
    bridgeRect: { x: 650, y: 195, w: 145, h: 130 },
    goalRect: { x: 785, y: 155, w: 165, h: 210 },
    switches: [
      { x: 435, y: 150 },
      { x: 595, y: 150 },
      { x: 435, y: 370 },
      { x: 595, y: 370 }
    ],
    lasers: [],
    rotaryDefs: [{ cx: 515, cy: 260, length: 135, speed: 1.75 }],
    batterySpawn: { x: 165, y: 260 }
  }
];

const SLOT_COLORS = [
  { name: 'UNIT-01', bodyColor: '#FF4F00', shadeColor: '#C83A00' },
  { name: 'LEO-BOT', bodyColor: '#1B4DFF', shadeColor: '#1034B8' },
  { name: 'MAX-BOT', bodyColor: '#F59E0B', shadeColor: '#C27803' },
  { name: 'NICO-BOT', bodyColor: '#15803D', shadeColor: '#0E5829' }
];

const CHAIN_EMOTES = ['¡SALTA!', '¡ANCLA!', '¡JALA CON [E]!', '¡CORRE!'];

export class ChainPanicEngine {
  public levelIndex = 0;
  public mode: ChainGameMode = 'COOP';
  public botsEnabled = true;
  public status: 'PLAYING' | 'LEVEL_CLEAR' | 'TEAM_WIPE' = 'PLAYING';
  public statusTimer = 0;
  public doorOpen = false;
  public windWarning = false;
  public windActive = false;
  public windForceY = 0;
  public completions = 0;
  public wipes = 0;
  public screenShake = 0;

  public players: ChainPlayerState[] = [];
  public switches: PressureSwitch[] = [];
  public lasers: HazardLaser[] = [];
  public rotaryLasers: RotaryLaser[] = [];
  public fragileTiles: FragileTile[] = [];
  public battery: HeavyBattery | null = null;
  public particles: ParticleEffect[] = [];
  public callouts: FloatingCallout[] = [];

  private remoteInputs = new Map<number, ClientInputPacket>();
  private time = 0;
  private windCycleTimer = 0;

  constructor() {
    this.initPlayers();
    this.loadLevel(0);
  }

  public initPlayers(): void {
    this.players = SLOT_COLORS.map((c, idx) => ({
      id: idx,
      name: c.name,
      bodyColor: c.bodyColor,
      shadeColor: c.shadeColor,
      isBot: idx !== 0,
      isSaboteur: false,
      x: 115,
      y: 200 + idx * 38,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 16,
      onGround: true,
      isDangling: false,
      dangleTime: 0,
      isAnchored: false,
      yankCooldown: 0,
      walkCycle: 0,
      emoteText: null,
      emoteTimer: 0
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

  public getActivePlayers(): ChainPlayerState[] {
    return this.players.filter((p) => !p.isBot || this.botsEnabled);
  }

  public toggleMode(): void {
    this.mode = this.mode === 'COOP' ? 'SABOTAGE' : 'COOP';
    this.loadLevel(this.levelIndex);
  }

  public getCurrentLevelDef(): LevelDefinition {
    return CHAIN_LEVELS[this.levelIndex % CHAIN_LEVELS.length];
  }

  public loadLevel(idx: number): void {
    this.levelIndex = (idx + CHAIN_LEVELS.length) % CHAIN_LEVELS.length;
    const def = this.getCurrentLevelDef();
    this.status = 'PLAYING';
    this.statusTimer = 0;
    this.doorOpen = false;
    this.windWarning = false;
    this.windActive = false;
    this.windForceY = 0;
    this.windCycleTimer = 0;

    // Pick random saboteur if in SABOTAGE mode
    const saboteurIdx =
      this.mode === 'SABOTAGE' ? Math.floor(Math.random() * this.players.length) : -1;

    this.players.forEach((p, i) => {
      p.isSaboteur = i === saboteurIdx;
      p.x = def.spawnX + (i % 2) * 28;
      p.y = def.spawnY - 48 + i * 32;
      p.z = 0;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.onGround = true;
      p.isDangling = false;
      p.dangleTime = 0;
      p.isAnchored = false;
      p.yankCooldown = 0;
    });

    this.switches = def.switches.map((s, i) => ({
      id: i,
      x: s.x,
      y: s.y,
      radius: 20,
      pressed: false
    }));

    this.lasers = def.lasers.map((l, i) => ({
      x1: l.x1,
      y1: l.y1,
      x2: l.x2,
      y2: l.y2,
      zHeight: 16,
      baseY: l.x1,
      sweepRange: l.sweepRange,
      sweepSpeed: l.sweepSpeed,
      phase: i * 1.4
    }));

    this.rotaryLasers = (def.rotaryDefs || []).map((r) => ({
      cx: r.cx,
      cy: r.cy,
      length: r.length,
      angle: 0,
      speed: r.speed,
      zHeight: 16
    }));

    this.fragileTiles = (def.fragileDefs || []).map((f, i) => ({
      id: i,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      state: 'SOLID',
      timer: 0.95
    }));

    this.battery = def.batterySpawn
      ? {
          x: def.batterySpawn.x,
          y: def.batterySpawn.y,
          vx: 0,
          vy: 0,
          radius: 20,
          delivered: false
        }
      : null;
  }

  public applyRemoteInput(packet: ClientInputPacket): void {
    this.remoteInputs.set(packet.slotId, packet);
    const p = this.players[packet.slotId];
    if (!p) return;

    if (packet.emotePressed > 0) {
      this.triggerEmote(p, packet.emotePressed);
    }
    if (packet.parryPressed) {
      this.triggerJump(p);
    }
    if (packet.yankPressed) {
      this.triggerCableYank(p);
    }
  }

  public triggerJump(p: ChainPlayerState): void {
    if (this.status !== 'PLAYING') return;
    if (p.onGround && !p.isDangling && p.z <= 1) {
      p.vz = 240;
      p.onGround = false;
      sfx.playDashPiston();
      this.spawnDust(p.x, p.y + 10, 5);
    }
  }

  // NEW MECHANIC: [E] Cable Yank (pulls neighbors strongly toward you!)
  public triggerCableYank(p: ChainPlayerState): void {
    if (this.status !== 'PLAYING' || p.yankCooldown > 0) return;
    p.yankCooldown = 1.1;
    sfx.playPinballBumper();
    this.particles.push({
      type: 'ring',
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      life: 1.0,
      decay: 4.2,
      color: '#1B4DFF',
      size: 10
    });

    // Pull immediate chain neighbors (id - 1 and id + 1) toward p
    this.players.forEach((other) => {
      if (Math.abs(other.id - p.id) === 1) {
        const dx = p.x - other.x;
        const dy = p.y - other.y;
        const d = Math.hypot(dx, dy) || 1;
        const pullPower = other.isDangling ? 560 : 410;
        other.vx += (dx / d) * pullPower;
        other.vy += (dy / d) * pullPower;
        if (other.isDangling) {
          other.vz = 150; // Pop dangling friend up onto ledge!
        }
      }
    });

    this.addCallout(p.x, p.y - 32, '⛓️ ¡TIRÓN!', '#1B4DFF');
  }

  public triggerEmote(p: ChainPlayerState, idx: number): void {
    const label = CHAIN_EMOTES[(idx - 1) % CHAIN_EMOTES.length];
    if (!label) return;
    p.emoteText = label;
    p.emoteTimer = 1.7;
    sfx.playHornEmote(idx);
  }

  private isPointSupported(x: number, y: number): PlatformRect | null {
    const def = this.getCurrentLevelDef();
    for (const plat of def.platforms) {
      if (x >= plat.x && x <= plat.x + plat.w && y >= plat.y && y <= plat.y + plat.h) {
        return plat;
      }
    }
    for (const ft of this.fragileTiles) {
      if (
        ft.state !== 'FALLEN' &&
        x >= ft.x &&
        x <= ft.x + ft.w &&
        y >= ft.y &&
        y <= ft.y + ft.h
      ) {
        return { x: ft.x, y: ft.y, w: ft.w, h: ft.h };
      }
    }
    if (this.doorOpen) {
      const b = def.bridgeRect;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return b;
      }
    }
    const g = def.goalRect;
    if (x >= g.x && x <= g.x + g.w && y >= g.y && y >= g.y && y <= g.y + g.h) {
      return g;
    }
    return null;
  }

  private triggerTeamWipe(reason: string, x: number, y: number): void {
    if (this.status !== 'PLAYING') return;
    this.status = 'TEAM_WIPE';
    this.statusTimer = 1.35;
    this.wipes++;
    this.screenShake = 14;
    sfx.playKODisassembly();
    this.addCallout(x, y - 24, reason, '#FF4F00');
  }

  public step(dt: number, localInput: ClientInputPacket): void {
    this.time += dt;
    this.remoteInputs.set(localInput.slotId, localInput);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 28);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= pt.decay * dt;
      if (pt.type === 'ring') pt.size += 180 * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 34 * dt;
      c.life -= 1.2 * dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    if (this.status !== 'PLAYING') {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) {
        if (this.status === 'LEVEL_CLEAR') {
          this.loadLevel(this.levelIndex + 1);
        } else {
          this.loadLevel(this.levelIndex);
        }
      }
      return;
    }

    const def = this.getCurrentLevelDef();

    // 1. Update Wind Turbine Hazard (Sector 04)
    if (def.hasWindTurbine) {
      this.windCycleTimer += dt;
      const cycle = this.windCycleTimer % 7.5;
      const prevWarn = this.windWarning;
      this.windWarning = cycle >= 3.5 && cycle < 5.0;
      this.windActive = cycle >= 5.0;
      this.windForceY = this.windActive ? 290 : 0;

      if (this.windWarning && !prevWarn) {
        sfx.playMultiballSiren();
        this.addCallout(500, 95, '💨 ¡TURBINA EN 1.5s: MANTÉN [SHIFT] ANCLA!', '#F59E0B', '#18181B');
      }
    }

    // 2. Update Fragile Crumbling Tiles
    this.fragileTiles.forEach((ft) => {
      if (ft.state === 'SOLID') {
        const steppedOn = this.players.some(
          (p) =>
            p.z <= 2 &&
            p.x >= ft.x &&
            p.x <= ft.x + ft.w &&
            p.y >= ft.y &&
            p.y <= ft.y + ft.h
        );
        if (steppedOn) {
          ft.state = 'CRACKING';
        }
      } else if (ft.state === 'CRACKING') {
        ft.timer -= dt;
        if (ft.timer <= 0) {
          ft.state = 'FALLEN';
          sfx.playKODisassembly();
        }
      }
    });

    // 3. Update Sweeping & 360° Rotary Lasers
    this.lasers.forEach((l) => {
      const offset = Math.sin(this.time * l.sweepSpeed + l.phase) * l.sweepRange;
      l.x1 = l.baseY + offset;
      l.x2 = l.baseY + offset;
    });

    this.rotaryLasers.forEach((rl) => {
      rl.angle = (rl.angle + rl.speed * dt) % (Math.PI * 2);
    });

    const activePlayers = this.getActivePlayers();

    // 4. Update Players & Cooperative Bot AI
    activePlayers.forEach((p, idx) => {
      if (p.yankCooldown > 0) p.yankCooldown = Math.max(0, p.yankCooldown - dt);
      if (p.emoteTimer > 0) {
        p.emoteTimer = Math.max(0, p.emoteTimer - dt);
        if (p.emoteTimer <= 0) p.emoteText = null;
      }

      const moveAccel = p.isAnchored ? 40 : 215;

      if (!p.isBot) {
        const inp = this.remoteInputs.get(p.id);
        if (inp) {
          p.isAnchored = Boolean(inp.anchorHeld) && p.onGround && !p.isDangling;
          if (!p.isDangling && (inp.moveX !== 0 || inp.moveY !== 0)) {
            const len = Math.hypot(inp.moveX, inp.moveY);
            p.vx += (inp.moveX / len) * moveAccel * 9 * dt;
            p.vy += (inp.moveY / len) * moveAccel * 9 * dt;
          }
        }
      } else {
        // Cooperative Bot AI
        const neighborDangling = this.players.find(
          (other) => Math.abs(other.id - p.id) === 1 && other.isDangling
        );

        if (this.windWarning || this.windActive) {
          p.isAnchored = p.onGround && !p.isDangling;
        } else if (neighborDangling && p.onGround && !p.isDangling) {
          p.isAnchored = true;
          if (p.yankCooldown <= 0) {
            this.triggerCableYank(p);
          }
        } else {
          p.isAnchored = false;
          let targetX = this.players[0].x;
          let targetY = this.players[0].y;

          if (this.battery && !this.battery.delivered && idx === 1) {
            // Bot 1 helps push battery from behind
            targetX = this.battery.x - 18;
            targetY = this.battery.y;
          } else if (this.doorOpen && (!this.battery || this.battery.delivered)) {
            targetX = def.goalRect.x + def.goalRect.w * 0.5;
            targetY = def.goalRect.y + 45 + idx * 35;
          } else {
            const assignedSwitch = this.switches[idx % this.switches.length];
            if (this.players[0].x > 340 && assignedSwitch) {
              targetX = assignedSwitch.x;
              targetY = assignedSwitch.y;
            } else {
              targetX = this.players[0].x - 22 * idx;
              targetY = this.players[0].y + (idx % 2 === 0 ? -16 : 16);
            }
          }

          if (!p.isDangling) {
            const dx = targetX - p.x;
            const dy = targetY - p.y;
            const d = Math.hypot(dx, dy);
            if (d > 10) {
              p.vx += (dx / d) * moveAccel * 7.4 * dt;
              p.vy += (dy / d) * moveAccel * 7.4 * dt;
            }

            // Auto-jump over linear lasers
            for (const laser of this.lasers) {
              if (
                Math.abs(laser.x1 - p.x) < 28 &&
                p.y >= laser.y1 - 10 &&
                p.y <= laser.y2 + 10 &&
                p.onGround
              ) {
                this.triggerJump(p);
              }
            }

            // Auto-jump over rotary lasers
            for (const rl of this.rotaryLasers) {
              const distToHub = Math.hypot(p.x - rl.cx, p.y - rl.cy);
              if (distToHub < rl.length + 12 && p.onGround) {
                const angToBot = Math.atan2(p.y - rl.cy, p.x - rl.cx);
                const diff = Math.abs(
                  Math.atan2(Math.sin(angToBot - rl.angle), Math.cos(angToBot - rl.angle))
                );
                if (diff < 0.32) {
                  this.triggerJump(p);
                }
              }
            }
          }
        }
      }

      // Apply Wind Force if not Anchored
      if (this.windActive && !p.isAnchored) {
        p.vy += this.windForceY * dt;
      }

      const support = this.isPointSupported(p.x, p.y);
      if (support && p.z <= 0) {
        if (support.conveyorVx) p.vx += support.conveyorVx * 5 * dt;
        if (support.conveyorVy) p.vy += support.conveyorVy * 5 * dt;
      }

      // Jump Z physics
      if (p.z > 0 || p.vz > 0) {
        p.z += p.vz * dt;
        p.vz -= 620 * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
          p.onGround = true;
        }
      }

      // Check Abyss Dangling
      const nowSupported = this.isPointSupported(p.x, p.y);
      if (!nowSupported && p.z <= 0) {
        if (!p.isDangling) {
          p.isDangling = true;
          p.dangleTime = 0;
          p.emoteText = '¡JALA CON [E]!';
          p.emoteTimer = 1.6;
        }
        p.dangleTime += dt;
        p.vy += (p.y < 260 ? -220 : 220) * dt;
        if (p.dangleTime > 3.6) {
          this.triggerTeamWipe(`¡${p.name} CAYÓ AL ABISMO!`, p.x, p.y);
        }
      } else if (nowSupported && p.isDangling) {
        p.isDangling = false;
        p.dangleTime = 0;
        this.addCallout(p.x, p.y - 25, '¡RESCATADO!', '#15803D');
      }

      const damping = p.isAnchored ? 0.62 : 0.82;
      p.vx *= Math.pow(damping, dt * 60);
      p.vy *= Math.pow(damping, dt * 60);

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const spd = Math.hypot(p.vx, p.vy);
      p.walkCycle = spd > 12 && !p.isDangling ? p.walkCycle + spd * dt * 0.11 : 0;
    });

    // 5. Heavy Battery CORE-99 Physics (Pushed by Bots & Snagged by Cable!)
    if (this.battery) {
      const bat = this.battery;
      this.players.forEach((p) => {
        if (p.isDangling) return;
        const d = Math.hypot(bat.x - p.x, bat.y - p.y);
        const minDist = bat.radius + p.radius;
        if (d < minDist && d > 0.001) {
          const nx = (bat.x - p.x) / d;
          const ny = (bat.y - p.y) / d;
          const overlap = minDist - d;
          bat.x += nx * overlap * 0.6;
          bat.y += ny * overlap * 0.6;
          bat.vx += nx * 150 * dt + p.vx * 0.35;
          bat.vy += ny * 150 * dt + p.vy * 0.35;
        }
      });

      // Also allow the steel cable between players to pull the battery!
      for (let i = 0; i < this.players.length - 1; i++) {
        const a = this.players[i];
        const b = this.players[i + 1];
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const dMid = Math.hypot(bat.x - midX, bat.y - midY);
        if (dMid < bat.radius + 12) {
          bat.vx += ((a.vx + b.vx) * 0.5 - bat.vx) * 4 * dt;
          bat.vy += ((a.vy + b.vy) * 0.5 - bat.vy) * 4 * dt;
        }
      }

      bat.vx *= Math.pow(0.84, dt * 60);
      bat.vy *= Math.pow(0.84, dt * 60);
      bat.x += bat.vx * dt;
      bat.y += bat.vy * dt;

      if (!this.isPointSupported(bat.x, bat.y)) {
        this.triggerTeamWipe('💥 ¡LA BATERÍA CORE-99 CAYÓ AL VACÍO!', bat.x, bat.y);
        return;
      }

      const g = def.goalRect;
      bat.delivered =
        bat.x >= g.x + 12 &&
        bat.x <= g.x + g.w - 12 &&
        bat.y >= g.y + 12 &&
        bat.y <= g.y + g.h - 12;
    }

    // 6. Elastic Steel Chain Constraints
    const SLACK_LEN = 75;
    const MAX_LEN = 112;

    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < activePlayers.length - 1; i++) {
        const a = activePlayers[i];
        const b = activePlayers[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;

        if (dist > SLACK_LEN) {
          const nx = dx / dist;
          const ny = dy / dist;
          const weightA = a.isAnchored ? 0.1 : a.isDangling ? 0.72 : 0.5;
          const weightB = b.isAnchored ? 0.1 : b.isDangling ? 0.72 : 0.5;
          const totalW = weightA + weightB;
          const shareA = weightA / totalW;
          const shareB = weightB / totalW;

          const stretch = dist - SLACK_LEN;
          const pullForce = stretch * 14 * dt;
          a.vx += nx * pullForce * shareA;
          a.vy += ny * pullForce * shareA;
          b.vx -= nx * pullForce * shareB;
          b.vy -= ny * pullForce * shareB;

          if (dist > MAX_LEN) {
            const excess = dist - MAX_LEN;
            a.x += nx * excess * shareA;
            a.y += ny * excess * shareA;
            b.x -= nx * excess * shareB;
            b.y -= ny * excess * shareB;
          }
        }
      }
    }

    if (activePlayers.length > 0 && activePlayers.every((p) => p.isDangling)) {
      this.triggerTeamWipe('¡CAÍDA AL VACÍO!', 500, 260);
      return;
    }

    // 7. Linear & Rotary Laser Collisions
    for (const laser of this.lasers) {
      for (const p of activePlayers) {
        const distX = Math.abs(p.x - laser.x1);
        if (
          distX < p.radius * 0.75 &&
          p.y >= laser.y1 &&
          p.y <= laser.y2 &&
          p.z < laser.zHeight
        ) {
          this.triggerTeamWipe(`⚡ ¡${p.name} CORTÓ EL LÁSER!`, p.x, p.y);
          return;
        }
      }
    }

    for (const rl of this.rotaryLasers) {
      const lx = rl.cx + Math.cos(rl.angle) * rl.length;
      const ly = rl.cy + Math.sin(rl.angle) * rl.length;

      for (const p of activePlayers) {
        if (p.z >= rl.zHeight) continue;
        // Point-to-segment distance from (cx,cy)->(lx,ly)
        const vx = lx - rl.cx;
        const vy = ly - rl.cy;
        const wx = p.x - rl.cx;
        const wy = p.y - rl.cy;
        const c1 = wx * vx + wy * vy;
        const c2 = vx * vx + vy * vy;
        const bRatio = c1 <= 0 ? 0 : c2 <= c1 ? 1 : c1 / c2;
        const projX = rl.cx + bRatio * vx;
        const projY = rl.cy + bRatio * vy;
        if (Math.hypot(p.x - projX, p.y - projY) < p.radius * 0.75) {
          this.triggerTeamWipe(`⚡ ¡${p.name} GOLPEADO POR LA GUADAÑA!`, p.x, p.y);
          return;
        }
      }
    }

    // 8. Pressure Switches & Bridge Unlock (Latch switches if fewer players than switches!)
    const latchMode = activePlayers.length < this.switches.length;
    this.switches.forEach((sw) => {
      const steppedNow = activePlayers.some(
        (p) => Math.hypot(p.x - sw.x, p.y - sw.y) <= sw.radius + p.radius * 0.65 && p.z < 8
      );
      sw.pressed = latchMode ? sw.pressed || steppedNow : steppedNow;
    });

    if (!this.doorOpen && this.switches.every((sw) => sw.pressed)) {
      this.doorOpen = true;
      sfx.playCartridgeClick();
      this.screenShake = 6;
      this.addCallout(
        def.bridgeRect.x + def.bridgeRect.w / 2,
        def.bridgeRect.y + 40,
        '🔓 ¡PUENTE DESBLOQUEADO!',
        '#15803D'
      );
    }

    // 9. Check Goal Extraction (All Active Players + Battery if present!)
    const g = def.goalRect;
    const allInGoal =
      activePlayers.length > 0 &&
      activePlayers.every(
        (p) =>
          !p.isDangling &&
          p.x >= g.x + 10 &&
          p.x <= g.x + g.w - 10 &&
          p.y >= g.y + 10 &&
          p.y <= g.y + g.h - 10
      );

    const batteryOk = !this.battery || this.battery.delivered;

    if (allInGoal && batteryOk) {
      this.status = 'LEVEL_CLEAR';
      this.statusTimer = 1.65;
      this.completions++;
      sfx.playBatParry(14, true);
      this.addCallout(g.x + g.w / 2, g.y + g.h / 2, '🏆 ¡SECTOR COMPLETADO!', '#15803D');
    }
  }

  public getSnapshot(): ChainPanicSnapshot {
    return {
      levelIndex: this.levelIndex,
      levelTitle: this.getCurrentLevelDef().title,
      mode: this.mode,
      status: this.status,
      statusTimer: this.statusTimer,
      doorOpen: this.doorOpen,
      windWarning: this.windWarning,
      windActive: this.windActive,
      windForceY: this.windForceY,
      completions: this.completions,
      wipes: this.wipes,
      players: this.players,
      switches: this.switches,
      lasers: this.lasers,
      rotaryLasers: this.rotaryLasers,
      fragileTiles: this.fragileTiles,
      battery: this.battery
    };
  }

  public applySnapshot(snap: ChainPanicSnapshot): void {
    this.levelIndex = snap.levelIndex;
    this.mode = snap.mode;
    this.status = snap.status;
    this.statusTimer = snap.statusTimer;
    this.doorOpen = snap.doorOpen;
    this.windWarning = snap.windWarning;
    this.windActive = snap.windActive;
    this.windForceY = snap.windForceY;
    this.completions = snap.completions;
    this.wipes = snap.wipes;
    this.players = snap.players;
    this.switches = snap.switches;
    this.lasers = snap.lasers;
    this.rotaryLasers = snap.rotaryLasers || [];
    this.fragileTiles = snap.fragileTiles || [];
    this.battery = snap.battery || null;
  }

  public spawnDust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 80;
      this.particles.push({
        type: 'dust',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1.0,
        decay: 2.2 + Math.random(),
        color: '#F4F0E8',
        size: 5 + Math.random() * 4
      });
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
