import { reconcilePlayer, type PredictionHint } from './reconciliation';
import { ChaosPhysics } from './chaosPhysics';
import { sfx } from '../audio/mechanicalSfx';
import {
  ClientInputPacket,
  FloatingCallout,
  HexCrushPlayer,
  HexCrushSnapshot,
  HexTile,
  HexTileType,
  LoosePart,
  ParticleEffect,
  PinballBumper,
  PuttExplosion,
  SeismicShockwave
} from '../types';

export const CHAMBER_LEFT = 96;
export const CHAMBER_RIGHT = 904;
export const CHAMBER_TOP = 66;
export const CHAMBER_BOTTOM = 450;
export const CHAMBER_CENTER_X = 500;
export const CHAMBER_CENTER_Y = 258;

const PALETTE = [
  { name: 'ALEX', body: '#FF4F00', shade: '#CC3F00' },
  { name: 'UNIT-02', body: '#1B4DFF', shade: '#143ABF' },
  { name: 'UNIT-03', body: '#15803D', shade: '#116631' },
  { name: 'UNIT-04', body: '#F59E0B', shade: '#D97706' }
];

export interface HexArenaDef {
  title: string;
  generateTiles: () => HexTile[];
  bumpers: PinballBumper[];
}

function hexToPixel(q: number, r: number, originX: number, originY: number, size: number): { x: number; y: number } {
  // Pointy-topped hexagon math
  const x = size * Math.sqrt(3) * (q + r / 2) + originX;
  const y = size * (3 / 2) * r + originY;
  return { x, y };
}

export const HEX_CRUSH_ARENAS: HexArenaDef[] = [
  {
    title: 'SECTOR 01 // EL PANAL SÍSMICO',
    bumpers: [
      { x: 190, y: 258, radius: 24, hitAnim: 0 },
      { x: 810, y: 258, radius: 24, hitAnim: 0 }
    ],
    generateTiles: () => {
      const tiles: HexTile[] = [];
      const hexSize = 25;
      let idCounter = 1;

      // Axial coordinate ring generation around center (q, r)
      const radius = 5;
      for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
          const { x, y } = hexToPixel(q, r, CHAMBER_CENTER_X, CHAMBER_CENTER_Y, hexSize);
          if (x < CHAMBER_LEFT + 25 || x > CHAMBER_RIGHT - 25 || y < CHAMBER_TOP + 25 || y > CHAMBER_BOTTOM - 25) {
            continue;
          }

          // Special tile types
          const distFromCenter = Math.hypot(q, r);
          let type: HexTileType = 'NORMAL';
          let health = 2;

          if (distFromCenter <= 1) {
            type = 'GLASS'; // Center crumbles fast!
            health = 1;
          } else if (distFromCenter >= 4) {
            type = 'STEEL'; // Outer perimeter is durable steel
            health = 2;
          }

          tiles.push({
            id: idCounter++,
            q,
            r,
            x,
            y,
            radius: hexSize,
            type,
            health,
            maxHealth: health,
            fallOffset: 0,
            fadeAlpha: 1,
            crumbleTimer: 0,
            shakeTimer: 0
          });
        }
      }
      return tiles;
    }
  },
  {
    title: 'SECTOR 02 // ISLAS EN EL ABISMO',
    bumpers: [
      { x: 500, y: 130, radius: 22, hitAnim: 0 },
      { x: 500, y: 385, radius: 22, hitAnim: 0 }
    ],
    generateTiles: () => {
      const tiles: HexTile[] = [];
      const hexSize = 24;
      let idCounter = 1;

      // 3 Islands: West Island, Center Island, East Island
      const islandCenters = [
        { q: -5, r: 0 },
        { q: 0, r: 0 },
        { q: 5, r: 0 }
      ];

      islandCenters.forEach((center, islandIdx) => {
        const rad = islandIdx === 1 ? 2 : 3;
        for (let dq = -rad; dq <= rad; dq++) {
          const r1 = Math.max(-rad, -dq - rad);
          const r2 = Math.min(rad, -dq + rad);
          for (let dr = r1; dr <= r2; dr++) {
            const q = center.q + dq;
            const r = center.r + dr;
            const { x, y } = hexToPixel(q, r, CHAMBER_CENTER_X, CHAMBER_CENTER_Y, hexSize);
            tiles.push({
              id: idCounter++,
              q,
              r,
              x,
              y,
              radius: hexSize,
              type: islandIdx === 1 ? 'NORMAL' : 'STEEL',
              health: 2,
              maxHealth: 2,
              fallOffset: 0,
              fadeAlpha: 1,
              crumbleTimer: 0,
              shakeTimer: 0
            });
          }
        }
      });

      // Narrow Bridges connecting islands
      const bridgeCoords = [
        { q: -2, r: 0 },
        { q: -1, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 }
      ];

      bridgeCoords.forEach((b) => {
        const { x, y } = hexToPixel(b.q, b.r, CHAMBER_CENTER_X, CHAMBER_CENTER_Y, hexSize);
        tiles.push({
          id: idCounter++,
          q: b.q,
          r: b.r,
          x,
          y,
          radius: hexSize,
          type: 'GLASS',
          health: 1,
          maxHealth: 1,
          fallOffset: 0,
          fadeAlpha: 1,
          crumbleTimer: 0,
          shakeTimer: 0
        });
      });

      return tiles;
    }
  },
  {
    title: 'SECTOR 03 // CRÁTER DESTRUCTOR',
    bumpers: [
      { x: 320, y: 160, radius: 24, hitAnim: 0 },
      { x: 680, y: 160, radius: 24, hitAnim: 0 },
      { x: 320, y: 350, radius: 24, hitAnim: 0 },
      { x: 680, y: 350, radius: 24, hitAnim: 0 }
    ],
    generateTiles: () => {
      const tiles: HexTile[] = [];
      const hexSize = 25;
      let idCounter = 1;

      // Ring with hollow abyss center
      const radius = 5;
      for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
          const dist = Math.hypot(q, r);
          // Hollow center except a lone central hex
          if (dist > 1.2 && dist < 3.2) {
            continue; // abyss hole!
          }

          const { x, y } = hexToPixel(q, r, CHAMBER_CENTER_X, CHAMBER_CENTER_Y, hexSize);
          if (x < CHAMBER_LEFT + 20 || x > CHAMBER_RIGHT - 20 || y < CHAMBER_TOP + 20 || y > CHAMBER_BOTTOM - 20) {
            continue;
          }

          const isCenter = dist <= 1.2;
          tiles.push({
            id: idCounter++,
            q,
            r,
            x,
            y,
            radius: hexSize,
            type: isCenter ? 'STEEL' : 'NORMAL',
            health: 2,
            maxHealth: 2,
            fallOffset: 0,
            fadeAlpha: 1,
            crumbleTimer: 0,
            shakeTimer: 0
          });
        }
      }
      return tiles;
    }
  }
];

export class HexCrushEngine extends ChaosPhysics {
  public arenaIndex = 0;
  public arenaTitle = '';
  public status: 'PLAYING' | 'ROUND_OVER' | 'MATCH_OVER' = 'PLAYING';
  public statusTimer = 0;
  public roundWinnerId: number | null = null;
  public matchWinnerId: number | null = null;
  public roundNumber = 1;
  public botsEnabled = true;

  public players: HexCrushPlayer[] = [];
  public tiles: HexTile[] = [];
  public shockwaves: SeismicShockwave[] = [];
  public bumpers: PinballBumper[] = [];
  public explosions: PuttExplosion[] = [];
  public looseParts: LoosePart[] = [];
  public particles: ParticleEffect[] = [];
  public callouts: FloatingCallout[] = [];
  public screenShake = 0;

  private nextShockwaveId = 1;
  private nextTileId = 9000;
  private remoteInputs = new Map<number, ClientInputPacket>();
  private nextBotThinkTime = 0;

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
      x: idx % 2 === 0 ? 300 : 700,
      y: idx < 2 ? 160 : 350,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 18,
      aimAngle: 0,
      walkCycle: 0,
      isGroundPounding: false,
      hammerCooldown: 0,
      jumpCooldown: 0,
      bridgeCooldown: 0,
      stunTimer: 0,
      fallTimer: 0,
      fallScale: 1,
      fallRotation: 0,
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
    const activeIds = new Set(this.getActiveParticipants().map((p) => p.id));
    this.players.forEach((p) => {
      if (!activeIds.has(p.id)) {
        p.alive = false;
      }
    });
  }

  public clearRemoteInput(slotId: number): void {
    this.remoteInputs.delete(slotId);
    const player = this.players[slotId];
    if (player) { player.vx = 0; player.vy = 0; }
  }

  public applyRemoteInput(packet: ClientInputPacket): void {
    this.remoteInputs.set(packet.slotId, { ...packet, clientX: undefined, clientY: undefined, clientZ: undefined });
    const p = this.players[packet.slotId];
    if (!p) return;
    if (packet.name) p.name = packet.name.slice(0, 10).toUpperCase();
    p.aimAngle = packet.aimAngle;


  }

  public resetChampionship(): void {
    this.players.forEach((p) => {
      p.score = 0;
    });
    this.roundNumber = 1;
    this.matchWinnerId = null;
    this.roundWinnerId = null;
    this.loadArena(0);
  }

  public loadArena(index: number): void {
    this.resetChaosRound();
    this.arenaIndex =
      ((index % HEX_CRUSH_ARENAS.length) + HEX_CRUSH_ARENAS.length) % HEX_CRUSH_ARENAS.length;
    const def = HEX_CRUSH_ARENAS[this.arenaIndex];
    this.arenaTitle = def.title;
    this.status = 'PLAYING';
    this.statusTimer = 0;
    this.roundWinnerId = null;

    this.tiles = def.generateTiles();
    this.bumpers = def.bumpers.map((b) => ({ ...b, hitAnim: 0 }));
    this.shockwaves = [];
    this.explosions = [];
    this.looseParts = [];
    this.particles = [];

    // Find safe intact starting tiles centered in the 4 arena quadrants
    const safeTiles = this.tiles.filter((t) => t.type !== 'GLASS' && t.health >= 2);
    const pool = safeTiles.length >= 4 ? safeTiles : this.tiles.filter((t) => t.health > 0);

    const nw = pool.filter((t) => t.x < CHAMBER_CENTER_X - 40 && t.y < CHAMBER_CENTER_Y - 20)
      .sort((a, b) => Math.hypot(a.x - 340, a.y - 190) - Math.hypot(b.x - 340, b.y - 190))[0];
    const ne = pool.filter((t) => t.x > CHAMBER_CENTER_X + 40 && t.y < CHAMBER_CENTER_Y - 20)
      .sort((a, b) => Math.hypot(a.x - 660, a.y - 190) - Math.hypot(b.x - 660, b.y - 190))[0];
    const sw = pool.filter((t) => t.x < CHAMBER_CENTER_X - 40 && t.y > CHAMBER_CENTER_Y + 20)
      .sort((a, b) => Math.hypot(a.x - 340, a.y - 330) - Math.hypot(b.x - 340, b.y - 330))[0];
    const se = pool.filter((t) => t.x > CHAMBER_CENTER_X + 40 && t.y > CHAMBER_CENTER_Y + 20)
      .sort((a, b) => Math.hypot(a.x - 660, a.y - 330) - Math.hypot(b.x - 660, b.y - 330))[0];

    const spawnPoints = [
      nw ? { x: nw.x, y: nw.y } : { x: 340, y: 190 },
      ne ? { x: ne.x, y: ne.y } : { x: 660, y: 190 },
      sw ? { x: sw.x, y: sw.y } : { x: 340, y: 330 },
      se ? { x: se.x, y: se.y } : { x: 660, y: 330 }
    ];

    const activeIds = new Set(this.getActiveParticipants().map((p) => p.id));
    this.players.forEach((p, idx) => {
      if (!activeIds.has(p.id)) {
        p.alive = false;
        return;
      }
      const sp = spawnPoints[idx % spawnPoints.length];
      p.alive = true;
      p.x = sp.x;
      p.y = sp.y;
      p.z = 0;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.isGroundPounding = false;
      p.hammerCooldown = p.isBot ? 1.0 : 0;
      p.jumpCooldown = 0;
      p.bridgeCooldown = 0;
      p.stunTimer = 0;
      p.fallTimer = 0;
      p.fallScale = 1;
      p.fallRotation = 0;
      p.emoteText = null;
      p.emoteTimer = 0;
    });

    sfx.playCartridgeClick();
  }

  public getActiveParticipants(): HexCrushPlayer[] {
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

  public triggerHammerSlam(player: HexCrushPlayer, aimAngle?: number): void {
    if (!player.alive || player.stunTimer > 0 || player.fallTimer > 0 || player.hammerCooldown > 0) return;
    if (player.z > 5) return; // Must be on or close to ground

    const angle = typeof aimAngle === 'number' ? aimAngle : player.aimAngle;
    player.aimAngle = angle;
    player.hammerCooldown = 1.15;

    // Recoil
    player.vx -= Math.cos(angle) * 140;
    player.vy -= Math.sin(angle) * 140;

    // Spawn seismic shockwave fissure
    const speed = 720;
    const shockwave: SeismicShockwave = {
      id: this.nextShockwaveId++,
      ownerId: player.id,
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 18,
      life: 0.45,
      maxLife: 0.45,
      color: player.bodyColor
    };
    this.shockwaves.push(shockwave);

    // Crack tile directly in front of hammer
    const hitX = player.x + Math.cos(angle) * 36;
    const hitY = player.y + Math.sin(angle) * 36;
    this.damageTileAt(hitX, hitY, 1);

    this.screenShake = 7;
    sfx.playHammerSlam();
    this.spawnDust(player.x, player.y, 8);
  }

  public triggerJumpOrPound(player: HexCrushPlayer): void {
    if (!player.alive || player.stunTimer > 0 || player.fallTimer > 0) return;

    if (player.z <= 4) {
      // On ground: Rocket Jump!
      if (player.jumpCooldown > 0) return;
      player.vz = 440;
      player.z = 6;
      player.jumpCooldown = 1.6;
      player.isGroundPounding = false;
      sfx.playDashPiston();
      this.spawnDust(player.x, player.y, 10);
    } else {
      // In air: Ground Pound!
      if (player.isGroundPounding) return;
      player.isGroundPounding = true;
      player.vz = -780;
      sfx.playDashPiston();
    }
  }

  public triggerEmergencyNanobridge(player: HexCrushPlayer): void {
    if (!player.alive || player.stunTimer > 0 || player.fallTimer > 0) return;
    if (player.bridgeCooldown > 0) return;

    player.bridgeCooldown = 7.5;

    // Create 2 holographic cyan nanotiles under player and slightly ahead
    const offsets = [
      { dx: 0, dy: 0 },
      { dx: Math.cos(player.aimAngle) * 36, dy: Math.sin(player.aimAngle) * 36 }
    ];

    offsets.forEach((off) => {
      const bx = player.x + off.dx;
      const by = player.y + off.dy;

      // Check if tile already exists
      const existing = this.tiles.find((t) => t.health > 0 && Math.hypot(t.x - bx, t.y - by) < t.radius);
      if (existing) {
        existing.type = 'BRIDGE';
        existing.maxHealth = 2;
        existing.health = 2;
        existing.tempTimer = 4.2;
        existing.crumbleTimer = 0;
        existing.shakeTimer = 0;
        return;
      }

      this.tiles.push({
        id: this.nextTileId++,
        q: 999,
        r: 999,
        x: bx,
        y: by,
        radius: 25,
        type: 'BRIDGE',
        health: 2,
        maxHealth: 2,
        fallOffset: 0,
        fadeAlpha: 1,
        crumbleTimer: 0,
        shakeTimer: 0,
        tempTimer: 4.2
      });
    });

    sfx.playNanotileDeploy();
    this.addCallout(player.x, player.y - 35, '💠 ¡NANOPUENTE!', '#38BDF8', '#0F172A');
  }

  public triggerEmote(player: HexCrushPlayer, emoteIndex: number): void {
    if (!player.alive) return;
    const emotes = ['💥', '💀', '🧱', '👑'];
    player.emoteText = emotes[(emoteIndex - 1) % emotes.length] || '💥';
    player.emoteTimer = 2.0;
    sfx.playHornEmote(emoteIndex);
  }

  public damageTileAt(x: number, y: number, amount = 1): void {
    for (const tile of this.tiles) {
      if (tile.health <= 0) continue;
      const dist = Math.hypot(tile.x - x, tile.y - y);
      if (dist <= tile.radius * 1.15) {
        tile.health = Math.max(0, tile.health - amount);
        tile.shakeTimer = 0.25;

        if (tile.health === 0) {
          tile.crumbleTimer = 0.2; // brief moment before dropping
          sfx.playHexCrumble();
        } else {
          sfx.playHexCrumble();
        }
      }
    }
  }

  public step(dt: number, hostInput: ClientInputPacket): void {
    this.advanceChaos(dt, true, this.status === 'PLAYING', (bomb) => {
      this.applyChaosBlast(bomb, this.players, this.botsEnabled);
      for (const tile of this.tiles) { if (Math.hypot(tile.x - bomb.x, tile.y - bomb.y) < bomb.radius * 0.55) tile.health = Math.max(0, tile.health - 1); }
    });
    this.remoteInputs.set(hostInput.slotId, hostInput);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 26);
    }

    // 1. Explosions & Particles cleanup (strict caps)
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
      if (lp.life <= 0) this.looseParts.splice(i, 1);
    }
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life -= dt;
      c.y -= dt * 14;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    while (this.looseParts.length > 28) this.looseParts.shift();
    while (this.particles.length > 40) this.particles.shift();
    while (this.explosions.length > 10) this.explosions.shift();

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
          this.roundNumber++;
          this.loadArena(this.arenaIndex + 1);
        }
      }
      return;
    }

    // 2. Update Hex Tiles (crumbling, falling, temp bridges)
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const t = this.tiles[i];
      if (t.shakeTimer > 0) t.shakeTimer = Math.max(0, t.shakeTimer - dt);

      // Temporary Nanotile expiry
      if (typeof t.tempTimer === 'number') {
        t.tempTimer -= dt;
        if (t.tempTimer <= 0 && t.health > 0) {
          t.health = 0;
          t.crumbleTimer = 0.1;
        }
      }

      // Crumbling & Falling into abyss
      if (t.health === 0) {
        if (t.crumbleTimer > 0) {
          t.crumbleTimer = Math.max(0, t.crumbleTimer - dt);
        } else {
          t.fallOffset += dt * 420;
          t.fadeAlpha = Math.max(0, t.fadeAlpha - dt * 2.2);
          if (t.fadeAlpha <= 0) {
            this.tiles.splice(i, 1);
          }
        }
      }
    }

    // 3. Update Seismic Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      sw.x += sw.vx * dt;
      sw.y += sw.vy * dt;

      // Damage tiles as shockwave passes over
      this.damageTileAt(sw.x, sw.y, 1);

      // Hit opponent players
      this.players.forEach((target) => {
        if (!target.alive || target.id === sw.ownerId || target.fallTimer > 0) return;
        // Shockwave only hits targets near the ground
        if (target.z > 14) return;

        const d = Math.hypot(target.x - sw.x, target.y - sw.y);
        if (d < target.radius + sw.radius) {
          // Push target along shockwave direction
          const swLen = Math.hypot(sw.vx, sw.vy) || 1;
          const nx = sw.vx / swLen;
          const ny = sw.vy / swLen;
          target.vx += nx * 680;
          target.vy += ny * 680;
          target.stunTimer = 0.35;
          this.spawnDebris(target.x, target.y, target.bodyColor);
          sfx.playPinballBumper();
        }
      });

      if (sw.life <= 0 || sw.x < CHAMBER_LEFT || sw.x > CHAMBER_RIGHT || sw.y < CHAMBER_TOP || sw.y > CHAMBER_BOTTOM) {
        this.shockwaves.splice(i, 1);
      }
    }

    // 4. Update Players (Physics, Inputs, Bot AI, Elevation)
    const participants = this.getActiveParticipants();
    const nowMs = performance.now();

    participants.forEach((p) => {
      if (!p.alive) return;

      if (p.hammerCooldown > 0) p.hammerCooldown = Math.max(0, p.hammerCooldown - dt);
      if (p.jumpCooldown > 0) p.jumpCooldown = Math.max(0, p.jumpCooldown - dt);
      if (p.bridgeCooldown > 0) p.bridgeCooldown = Math.max(0, p.bridgeCooldown - dt);
      if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
      if (p.emoteTimer > 0) {
        p.emoteTimer -= dt;
        if (p.emoteTimer <= 0) p.emoteText = null;
      }

      // Handle Abyss Fall
      if (p.fallTimer > 0) {
        p.fallTimer -= dt;
        p.fallScale = Math.max(0.05, p.fallScale - dt * 1.4);
        p.fallRotation += dt * 14;
        p.vx *= 0.85;
        p.vy *= 0.85;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.fallTimer <= 0) {
          p.alive = false;
          this.spawnDebris(p.x, p.y, p.bodyColor);
          sfx.playKODisassembly();
          this.addCallout(p.x, p.y - 30, '💀 ¡AL ABISMO!', '#EF4444', '#18181B');
          this.checkRoundEnd();
        }
        return;
      }

      // Vertical Z Physics (Jumps & Ground Pounds)
      if (p.z > 0 || p.vz !== 0) {
        const gravity = (p.isGroundPounding ? 1800 : 960) * this.gravityMultiplier;
        p.vz -= gravity * dt;
        p.z += p.vz * dt;

        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;

          // Impact on landing!
          if (p.isGroundPounding) {
            p.isGroundPounding = false;
            this.handleGroundPoundLanding(p);
          }
        }
      }

      // Movement & Inputs
      const moveSpeed = 245 * this.speedMultiplier;
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

          // Dead reckoning correction

        }
      } else {
        this.stepBotAI(p, dt, moveSpeed, nowMs);
      }

      // Friction & Position
      const damp = p.z > 0 ? 0.94 : 0.82;
      p.vx *= Math.pow(damp, dt * 60);
      p.vy *= Math.pow(damp, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const spd = Math.hypot(p.vx, p.vy);
      p.walkCycle = spd > 14 && p.z <= 2 ? p.walkCycle + spd * dt * 0.11 : 0;

      // Constrain inside outer chamber walls
      this.constrainPlayer(p);

      // Check footing on Hex Grid (when on ground)
      if (p.z <= 2) {
        this.checkPlayerFooting(p, dt);
      }
    });

    this.checkRoundEnd();
  }

  private handleGroundPoundLanding(player: HexCrushPlayer): void {
    this.screenShake = 12;
    sfx.playGroundPound();
    this.spawnDust(player.x, player.y, 14);

    // Crack hex tiles in radial shockwave
    for (const tile of this.tiles) {
      if (tile.health <= 0) continue;
      const d = Math.hypot(tile.x - player.x, tile.y - player.y);
      if (d <= 75) {
        this.damageTileAt(tile.x, tile.y, 1);
      }
    }

    // Blast surrounding opponents and check Footstool Stomp
    this.players.forEach((other) => {
      if (!other.alive || other.id === player.id || other.fallTimer > 0) return;
      const d = Math.hypot(other.x - player.x, other.y - player.y);

      if (d <= player.radius + other.radius + 6) {
        // Direct Footstool Meteor Slam on enemy!
        player.vz = 420;
        player.z = 10;
        other.stunTimer = 0.85;
        other.vx += (other.x - player.x) * 12;
        other.vy += (other.y - player.y) * 12;
        this.damageTileAt(other.x, other.y, 2); // Drops floor right under them!
        this.addCallout(other.x, other.y - 36, '💥 ¡PISOTÓN METEORO!', '#F59E0B', '#18181B');
        sfx.playPinballBumper();
      } else if (d <= 95) {
        // Radial blast
        const nx = (other.x - player.x) / d;
        const ny = (other.y - player.y) / d;
        other.vx += nx * 600;
        other.vy += ny * 600;
        other.stunTimer = 0.35;
      }
    });
  }

  private hasTileAt(x: number, y: number, margin = 26): boolean {
    for (const t of this.tiles) {
      if (t.health <= 0) continue;
      if (Math.hypot(t.x - x, t.y - y) <= t.radius + margin) {
        return true;
      }
    }
    return false;
  }

  private checkPlayerFooting(player: HexCrushPlayer, dt: number): void {
    let supported = false;
    let closestTile: HexTile | null = null;
    let minDist = 9999;

    for (const tile of this.tiles) {
      if (tile.health <= 0) continue;
      const d = Math.hypot(tile.x - player.x, tile.y - player.y);
      if (d < minDist) {
        minDist = d;
        closestTile = tile;
      }
      if (d <= tile.radius + player.radius * 0.85) {
        supported = true;
      }
    }

    if (supported && closestTile) {
      // Regain footing if player jumped back or deployed Nanobridge
      if (player.fallTimer > 0) {
        player.fallTimer = 0;
        player.fallScale = 1.0;
        player.fallRotation = 0;
      }

      // Step on tile causes decay if GLASS or NORMAL
      if (closestTile.type === 'GLASS') {
        closestTile.health = 0;
        closestTile.crumbleTimer = 0.25;
        closestTile.shakeTimer = 0.25;
      } else if (closestTile.type === 'NORMAL') {
        // Crumble countdown after standing on tile for 1.8s
        closestTile.crumbleTimer += dt;
        if (closestTile.crumbleTimer >= 1.8) {
          closestTile.health = Math.max(0, closestTile.health - 1);
          closestTile.crumbleTimer = 0;
          closestTile.shakeTimer = 0.25;
          sfx.playHexCrumble();
        }
      }
    } else {
      // Void abyss beneath feet! Start falling if not already falling
      if (player.fallTimer <= 0) {
        player.fallTimer = 0.75;
        player.fallScale = 1.0;
        player.fallRotation = 0;
      }
    }
  }

  private constrainPlayer(p: HexCrushPlayer): void {
    const pad = p.radius + 6;
    if (p.x < CHAMBER_LEFT + pad) {
      p.x = CHAMBER_LEFT + pad;
      p.vx = Math.abs(p.vx) * 0.5 * this.bounceMultiplier;
    } else if (p.x > CHAMBER_RIGHT - pad) {
      p.x = CHAMBER_RIGHT - pad;
      p.vx = -Math.abs(p.vx) * 0.5 * this.bounceMultiplier;
    }
    if (p.y < CHAMBER_TOP + pad) {
      p.y = CHAMBER_TOP + pad;
      p.vy = Math.abs(p.vy) * 0.5 * this.bounceMultiplier;
    } else if (p.y > CHAMBER_BOTTOM - pad) {
      p.y = CHAMBER_BOTTOM - pad;
      p.vy = -Math.abs(p.vy) * 0.5 * this.bounceMultiplier;
    }

    // Pinball Bumper collisions
    this.bumpers.forEach((b) => {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const dist = Math.hypot(dx, dy);
      const minD = b.radius + p.radius;
      if (dist < minD) {
        const nx = (dx / (dist || 1));
        const ny = (dy / (dist || 1));
        p.vx = nx * 580 * this.bounceMultiplier;
        p.vy = ny * 580 * this.bounceMultiplier;
        p.x = b.x + nx * minD;
        p.y = b.y + ny * minD;
        b.hitAnim = 1;
        sfx.playPinballBumper();
        this.screenShake = 6;
      }
    });
  }

  private stepBotAI(bot: HexCrushPlayer, dt: number, moveSpeed: number, nowMs: number): void {
    if (bot.stunTimer > 0 || bot.fallTimer > 0) return;

    // 1. Find nearest intact tile
    let targetTile: HexTile | null = null;
    let minTileDist = 9999;
    for (const t of this.tiles) {
      if (t.health <= 0) continue;
      const d = Math.hypot(t.x - bot.x, t.y - bot.y);
      if (d < minTileDist) {
        minTileDist = d;
        targetTile = t;
      }
    }

    // 2. Emergency actions if bot is losing footing or in the void
    if (minTileDist > 30 && bot.bridgeCooldown <= 0) {
      this.triggerEmergencyNanobridge(bot);
    } else if (minTileDist > 38 && bot.z <= 2 && bot.jumpCooldown <= 0) {
      // Rocket Jump towards center of arena
      bot.aimAngle = Math.atan2(CHAMBER_CENTER_Y - bot.y, CHAMBER_CENTER_X - bot.x);
      this.triggerJumpOrPound(bot);
    }

    // 3. Find nearest alive opponent
    let targetEnemy: HexCrushPlayer | null = null;
    let minEnemyDist = 9999;
    for (const other of this.players) {
      if (other.id === bot.id || !other.alive || other.fallTimer > 0) continue;
      const d = Math.hypot(other.x - bot.x, other.y - bot.y);
      if (d < minEnemyDist) {
        minEnemyDist = d;
        targetEnemy = other;
      }
    }

    // 4. Movement decision: stay on solid tiles, seek center if safe
    let targetX = bot.x;
    let targetY = bot.y;

    if (minTileDist > 20 && targetTile) {
      targetX = targetTile.x;
      targetY = targetTile.y;
    } else if (targetEnemy) {
      targetX = targetEnemy.x;
      targetY = targetEnemy.y;
    }

    const ddx = targetX - bot.x;
    const ddy = targetY - bot.y;
    const dist = Math.hypot(ddx, ddy);

    if (dist > 8) {
      const dirX = ddx / dist;
      const dirY = ddy / dist;

      // Probe ahead 28px: is there solid ground ahead?
      const probeX = bot.x + dirX * 28;
      const probeY = bot.y + dirY * 28;

      if (this.hasTileAt(probeX, probeY, 8)) {
        bot.vx += dirX * moveSpeed * 7.5 * dt;
        bot.vy += dirY * moveSpeed * 7.5 * dt;
      } else {
        // Void abyss ahead! Do NOT step into the void. Stay centered on safe tile.
        if (targetTile) {
          const toSafeX = targetTile.x - bot.x;
          const toSafeY = targetTile.y - bot.y;
          const safeDist = Math.hypot(toSafeX, toSafeY);
          if (safeDist > 4) {
            bot.vx += (toSafeX / safeDist) * moveSpeed * 5.0 * dt;
            bot.vy += (toSafeY / safeDist) * moveSpeed * 5.0 * dt;
          }
        }
      }
    }

    // 5. Attacks
    if (targetEnemy) {
      bot.aimAngle = Math.atan2(targetEnemy.y - bot.y, targetEnemy.x - bot.x);

      // Only slam hammer if close AND recoil won't blow bot off the edge
      if (minEnemyDist < 110 && bot.hammerCooldown <= 0 && bot.z <= 4) {
        const recoilX = bot.x - Math.cos(bot.aimAngle) * 32;
        const recoilY = bot.y - Math.sin(bot.aimAngle) * 32;
        if (this.hasTileAt(recoilX, recoilY, 6)) {
          this.triggerHammerSlam(bot, bot.aimAngle);
        }
      }

      // Ground pound if directly above enemy
      if (bot.z > 22 && minEnemyDist < 55 && !bot.isGroundPounding) {
        this.triggerJumpOrPound(bot);
      }
    }
  }

  private checkRoundEnd(): void {
    if (this.status !== 'PLAYING') return;

    const participants = this.getActiveParticipants();

    // In solo practice / single participant mode: round only ends if the player dies (abyss)
    if (participants.length <= 1) {
      const sole = participants[0];
      if (sole && !sole.alive) {
        this.status = 'ROUND_OVER';
        this.statusTimer = 2.5;
        this.roundWinnerId = null;
      }
      return;
    }

    // Multiplayer / Bot match (>= 2 participants): wait until players actually finish falling
    const alive = participants.filter((p) => p.alive);
    if (alive.length <= 1) {
      const winner = alive[0] || null;
      this.status = 'ROUND_OVER';
      this.statusTimer = 3.2;

      if (winner) {
        winner.score++;
        this.roundWinnerId = winner.id;
        this.addCallout(winner.x, winner.y - 42, `👑 ¡${winner.name} GANA LA RONDA!`, '#FEF08A', '#18181B');
        sfx.playPinballBumper();

        if (winner.score >= 3) {
          this.status = 'MATCH_OVER';
          this.statusTimer = 4.5;
          this.matchWinnerId = winner.id;
          sfx.playCartridgeClick();
        }
      }
    }
  }

  public stepClientPrediction(dt: number, localSlotId: number, input: ClientInputPacket): void {
    this.advanceChaos(dt, false, this.status === 'PLAYING', () => {});
    if (this.status !== 'PLAYING') return;
    for (const player of this.players) {
      player.hammerCooldown = Math.max(0, player.hammerCooldown - dt);
      player.jumpCooldown = Math.max(0, player.jumpCooldown - dt);
      player.bridgeCooldown = Math.max(0, player.bridgeCooldown - dt);
      player.stunTimer = Math.max(0, player.stunTimer - dt);
      if (player.id !== localSlotId && player.alive && player.fallTimer <= 0) {
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        this.constrainPlayer(player);
      }
    }
    const p = this.players[localSlotId];
    if (!p || !p.alive || p.stunTimer > 0 || p.fallTimer > 0) return;

    if (p.z > 0 || p.vz !== 0) {
      const gravity = (p.isGroundPounding ? 1800 : 960) * this.gravityMultiplier;
      p.vz -= gravity * dt;
      p.z += p.vz * dt;
      if (p.z <= 0) {
        p.z = 0;
        p.vz = 0;
        p.isGroundPounding = false;
      }
    }

    p.aimAngle = input.aimAngle;
    let mx = input.moveX;
    let my = input.moveY;
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    const moveSpeed = 245 * this.speedMultiplier;
    p.vx += mx * moveSpeed * 8.5 * dt;
    p.vy += my * moveSpeed * 8.5 * dt;
    const damp = p.z > 0 ? 0.94 : 0.82;
    p.vx *= Math.pow(damp, dt * 60);
    p.vy *= Math.pow(damp, dt * 60);
    p.x += p.vx * dt;
    p.y += p.vy * dt;


    this.constrainPlayer(p);
    input.clientX = p.x;
    input.clientY = p.y;
    input.clientZ = p.z;
  }

  public getSnapshot(): HexCrushSnapshot {
    return {
      roundEpoch: this.roundEpoch,
      simulationTime: this.simulationTime,
      chaosBombs: this.chaosBombs.map((bomb) => ({ ...bomb })),
      arenaIndex: this.arenaIndex,
      arenaTitle: this.arenaTitle,
      status: this.status,
      statusTimer: this.statusTimer,
      roundWinnerId: this.roundWinnerId,
      matchWinnerId: this.matchWinnerId,
      players: this.players.map((p) => ({ ...p })),
      tiles: this.tiles.map((t) => ({ ...t })),
      shockwaves: this.shockwaves.map((s) => ({ ...s })),
      bumpers: this.bumpers.map((b) => ({ ...b })),
      explosions: this.explosions.map((e) => ({ ...e }))
    };
  }

  public applySnapshot(snap: HexCrushSnapshot, localSlotId: number, prediction: PredictionHint = 0): void {
    const reset = this.arenaIndex !== snap.arenaIndex || this.status !== snap.status || (snap.roundEpoch !== undefined && snap.roundEpoch !== this.roundEpoch);
    if (this.arenaIndex !== snap.arenaIndex) {
      this.arenaIndex = snap.arenaIndex;
      this.arenaTitle = snap.arenaTitle;
    }
    this.status = snap.status;
    this.statusTimer = snap.statusTimer;
    this.roundWinnerId = snap.roundWinnerId;
    this.matchWinnerId = snap.matchWinnerId;
    this.tiles = snap.tiles.map((value) => ({ ...value }));
    this.shockwaves = snap.shockwaves.map((value) => ({ ...value }));
    this.bumpers = snap.bumpers.map((value) => ({ ...value }));
    this.explosions = snap.explosions.map((value) => ({ ...value }));

    this.players = snap.players.map((sp) => {
      const previous = this.players[sp.id];
      return reconcilePlayer(previous, sp, sp.id === localSlotId,
        reset || previous?.alive !== sp.alive || (previous?.fallTimer === 0) !== (sp.fallTimer === 0) || snap.status !== 'PLAYING', prediction);
    });
    this.roundEpoch = snap.roundEpoch ?? this.roundEpoch;
    this.simulationTime = snap.simulationTime ?? this.simulationTime;
    this.chaosBombs = (snap.chaosBombs ?? []).map((bomb) => ({ ...bomb }));
  }

  public addCallout(
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
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        life: 0.45,
        decay: 1.4,
        color: '#D4CEBF',
        size: 3.5
      });
    }
  }

  public spawnDebris(x: number, y: number, color: string): void {
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
