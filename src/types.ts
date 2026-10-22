export type ActiveGameId =
  | 'HUB'
  | 'BASH_BOT'
  | 'CHAIN_PANIC'
  | 'TURBO_PUTT'
  | 'HOT_CORE'
  | 'VOLT_CROWN'
  | 'HEX_CRUSH'
  | 'RICOCHET_1';

export type ChaosMutatorId =
  | 'NONE'
  | 'MOON_GRAVITY'
  | 'SUPER_SPEED'
  | 'BOUNCY_BUMPERS'
  | 'BOMB_RAIN'
  | 'GHOST_PULSE';

export interface ChaosMutatorDef {
  id: ChaosMutatorId;
  name: string;
  tag: string;
  desc: string;
  icon: string;
  color: string;
}

export const CHAOS_MUTATORS: Record<ChaosMutatorId, ChaosMutatorDef> = {
  NONE: {
    id: 'NONE',
    name: 'CAOS ESTÁNDAR',
    tag: 'NORMAL',
    desc: 'Física pura estándar de competición sin mutadores.',
    icon: '🛡️',
    color: '#71717A'
  },
  MOON_GRAVITY: {
    id: 'MOON_GRAVITY',
    name: 'GRAVEDAD LUNAR',
    tag: 'FLOTANTE',
    desc: 'Gravedad al 50%. Saltos altos y flotación prolongada.',
    icon: '🌀',
    color: '#818CF8'
  },
  SUPER_SPEED: {
    id: 'SUPER_SPEED',
    name: 'TURBO OVERCLOCK',
    tag: 'VELOCIDAD',
    desc: 'Motores y bolas a 145% de velocidad. Reflejos al límite.',
    icon: '⚡',
    color: '#F59E0B'
  },
  BOUNCY_BUMPERS: {
    id: 'BOUNCY_BUMPERS',
    name: 'HIPER-REBOTE',
    tag: 'CINÉTICA',
    desc: 'Todos los rebotes y choques tienen 2.5x de fuerza expulsiva.',
    icon: '🧲',
    color: '#EC4899'
  },
  BOMB_RAIN: {
    id: 'BOMB_RAIN',
    name: 'LLUVIA DE DINAMITA',
    tag: 'PELIGRO',
    desc: 'Micro-bombas caen periódicamente en la pista cada 4 segundos.',
    icon: '💣',
    color: '#EF4444'
  },
  GHOST_PULSE: {
    id: 'GHOST_PULSE',
    name: 'PULSO FANTASMA',
    tag: 'SIGILO',
    desc: 'Camuflaje óptico: todos los robots se vuelven invisibles cada 5s.',
    icon: '👻',
    color: '#14B8A6'
  }
};

export interface TournamentMatchState {
  active: boolean;
  roundIndex: number; // 0..4
  totalRounds: number;
  gameSequence: ActiveGameId[];
  mutators: ChaosMutatorId[];
  currentMutator: ChaosMutatorId;
  scores: number[]; // [p0, p1, p2, p3]
  rouletteSpinning: boolean;
  rouletteDisplayId: ChaosMutatorId;
  rouletteTimer: number;
  isFinished: boolean;
  champId: number | null;
}
export type RoundPhase = 'PLAYING' | 'CARD_DRAFT' | 'MATCH_OVER';
export type BotDifficulty = 'CHILL' | 'NORMAL' | 'PRO' | 'OFF';
export type CourtLayout = 'CLASSIC' | 'PINBALL' | 'CORE';

export interface HardwareMod {
  id: string;
  code: string;
  title: string;
  desc: string;
  tag: string;
  color: string;
}

export interface PinballBumper {
  x: number;
  y: number;
  radius: number;
  hitAnim: number;
}

export type RobotHatId = 'NONE' | 'CROWN' | 'CONE' | 'RADAR' | 'PROP' | 'VIKING' | 'HEADPHONES';
export type RobotVisorId = 'CYAN' | 'AMBER' | 'EMERALD' | 'MAGENTA' | 'RED' | 'WHITE';
export type RobotSkinId = 'STOCK' | 'STEALTH' | 'WARNING' | 'VAPOR';

export interface RobotCosmetics {
  hat: RobotHatId;
  visor: RobotVisorId;
  skin: RobotSkinId;
}

export interface PlayerState {
  id: number;
  peerId: string | null;
  name: string;
  bodyColor: string;
  shadeColor: string;
  batColor: string;
  cosmetics?: RobotCosmetics;
  isBot: boolean;
  score: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  walkCycle: number;
  tiltX: number;
  parryTimer: number;
  parryCooldown: number;
  chargeTime: number;
  feintPrimed: boolean;
  batSwingDir: number;
  dashTimer: number;
  dashCooldown: number;
  aimAngle: number;
  emoteText: string | null;
  emoteTimer: number;
  botEvaluatedPassId: number;
  botWillParry: boolean;
  botTriggerDist: number;
  parryRadiusMult: number;
  parryWindowBonus: number;
  curvePower: number;
  dashCooldownMult: number;
  speedMult: number;
  smashPower: number;
  dashShockwave: boolean;
  magnetPull: boolean;
  installedModCodes: string[];
  lastKOAt?: number;
}

export interface GyroBallState {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  speed: number;
  baseSpeed: number;
  radius: number;
  rotation: number;
  targetId: number;
  ownerId: number;
  passId: number;
  isFeint: boolean;
  accentColor: string;
  curveSpin: number;
  trail: Array<{ x: number; y: number; z: number }>;
}

export interface LoosePart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  color: string;
  life?: number;
  maxLife?: number;
}

export interface ParticleEffect {
  type: 'ring' | 'dust' | 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
}

export interface FloatingCallout {
  x: number;
  y: number;
  text: string;
  bgColor: string;
  textColor: string;
  life: number;
}

// ==========================================
// GAME 02: CHAIN-PANIC EXPANDED TYPES
// ==========================================

export type ChainGameMode = 'COOP' | 'SABOTAGE';

export interface ChainPlayerState {
  id: number;
  name: string;
  bodyColor: string;
  shadeColor: string;
  cosmetics?: RobotCosmetics;
  isBot: boolean;
  isSaboteur: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  onGround: boolean;
  isDangling: boolean;
  dangleTime: number;
  isAnchored: boolean;
  yankCooldown: number;
  walkCycle: number;
  emoteText: string | null;
  emoteTimer: number;
}

export interface PlatformRect {
  x: number;
  y: number;
  w: number;
  h: number;
  conveyorVx?: number;
  conveyorVy?: number;
}

export interface FragileTile {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  state: 'SOLID' | 'CRACKING' | 'FALLEN';
  timer: number;
}

export interface HeavyBattery {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  delivered: boolean;
}

export interface RotaryLaser {
  cx: number;
  cy: number;
  length: number;
  angle: number;
  speed: number;
  zHeight: number;
}

export interface PressureSwitch {
  id: number;
  x: number;
  y: number;
  radius: number;
  pressed: boolean;
}

export interface HazardLaser {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  zHeight: number;
  baseY: number;
  sweepRange: number;
  sweepSpeed: number;
  phase: number;
}

export interface ChainPanicSnapshot {
  levelIndex: number;
  levelTitle: string;
  mode: ChainGameMode;
  status: 'PLAYING' | 'LEVEL_CLEAR' | 'TEAM_WIPE';
  statusTimer: number;
  doorOpen: boolean;
  windWarning: boolean;
  windActive: boolean;
  windForceY: number;
  completions: number;
  wipes: number;
  players: ChainPlayerState[];
  switches: PressureSwitch[];
  lasers: HazardLaser[];
  rotaryLasers: RotaryLaser[];
  fragileTiles: FragileTile[];
  battery: HeavyBattery | null;
}

export interface PuttBallPlayer {
  id: number;
  name: string;
  bodyColor: string;
  shadeColor: string;
  cosmetics?: RobotCosmetics;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lastSafeX: number;
  lastSafeY: number;
  radius: number;
  aimAngle: number;
  chargePower: number; // 0..1 while holding
  isCharging: boolean;
  puttCooldown: number;
  bombCooldown: number;
  shockwaveCooldown: number;
  heldPowerup: 'NONE' | 'BAZOOKA' | 'NITRO' | 'ANVIL';
  anvilTimer: number;
  strokes: number;
  totalPoints: number;
  sunkInCup: boolean;
  sunkOrder: number; // 1st, 2nd, 3rd, 4th
  emoteText: string | null;
  emoteTimer: number;
  botShotTimer: number;
}

export interface PuttWallRect {
  x: number;
  y: number;
  w: number;
  h: number;
  bouncy?: boolean;
}

export interface PuttHazardRect {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'ACID' | 'SAND' | 'BOOST';
  boostVx?: number;
  boostVy?: number;
}

export interface PuttBumper {
  x: number;
  y: number;
  radius: number;
  hitAnim: number;
}

export interface PuttWindmill {
  cx: number;
  cy: number;
  length: number;
  angle: number;
  speed: number;
}

export interface PuttBomb {
  id: number;
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
  maxTimer: number;
  isRocket: boolean;
  targetId: number | null;
}

export interface PuttWeaponCrate {
  id: number;
  x: number;
  y: number;
  active: boolean;
  respawnTimer: number;
  type: 'BAZOOKA' | 'NITRO' | 'ANVIL';
}

export interface PuttExplosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  color: string;
}

export interface PuttWarSnapshot {
  holeIndex: number;
  holeTitle: string;
  par: number;
  status: 'PLAYING' | 'HOLE_COMPLETE';
  hurryTimer: number;
  hurryActive: boolean;
  statusTimer: number;
  cupX: number;
  cupY: number;
  cupRadius: number;
  players: PuttBallPlayer[];
  bombs: PuttBomb[];
  crates: PuttWeaponCrate[];
  bumpers: PuttBumper[];
  windmills: PuttWindmill[];
  explosions: PuttExplosion[];
}

// ==========================================
// GAME 04: HOT-CORE (NUCLEAR HOT POTATO PVP)
// ==========================================

export interface HotCorePlayer {
  id: number;
  name: string;
  bodyColor: string;
  shadeColor: string;
  cosmetics?: RobotCosmetics;
  isBot: boolean;
  alive: boolean;
  score: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  aimAngle: number;
  walkCycle: number;
  shieldTimer: number; // Active reflector parry shield (>0)
  shieldCooldown: number;
  dashTimer: number;
  dashCooldown: number;
  empCooldown: number;
  passImmunityTimer: number;
  emoteText: string | null;
  emoteTimer: number;
  lastTaggedAt?: number;
  lastKOAt?: number;
}

export interface HotCoreDevice {
  holderId: number | null; // Player currently carrying the unstable core (null if flying/loose)
  lastThrowerId: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  fuseTimer: number; // Countdown to detonation (e.g. 10.0 -> 0.0)
  maxFuse: number;
  passCount: number;
  flightTime: number;
}

export interface HotCorePillar {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HotCoreBoostPad {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

export interface HotCoreSnapshot {
  arenaIndex: number;
  arenaTitle: string;
  status: 'PLAYING' | 'ROUND_OVER' | 'MATCH_OVER';
  statusTimer: number;
  lastWinnerId: number | null;
  players: HotCorePlayer[];
  core: HotCoreDevice;
  bumpers: PinballBumper[];
  pillars: HotCorePillar[];
  boostPads: HotCoreBoostPad[];
  explosions: PuttExplosion[];
}

export interface VoltCrownPlayer {
  id: number;
  name: string;
  bodyColor: string;
  shadeColor: string;
  cosmetics?: RobotCosmetics;
  isBot: boolean;
  alive: boolean;
  score: number; // percentage (0..100)
  holdStreak: number; // seconds holding current crown without interruption
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  aimAngle: number;
  walkCycle: number;
  shieldTimer: number; // 0.35s magnetic deflect window
  shieldCooldown: number;
  dashTimer: number;
  dashCooldown: number;
  taserCooldown: number;
  stunTimer: number;
  immunityTimer: number; // after dropping crown or getting hit
  trapImmunityTimer?: number; // grace period after being hit by a hazard so player doesn't get re-hit every frame
  lastStunnedAt?: number;
  emoteText: string | null;
  emoteTimer: number;
}

export interface VoltCrownDevice {
  holderId: number | null; // null if bouncing freely on the floor
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bounceCount: number;
  idleTimer: number;
  overchargeReady: boolean;
}

export interface VoltProjectile {
  id: number;
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  isReflected: boolean;
}

export interface VoltTrap {
  id: string;
  type: 'CRUSHER' | 'LASER_GATE' | 'CONVEYOR' | 'PLASMA_GRATE';
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
  timer: number;
  period: number;
  dirX?: number;
  dirY?: number;
  flashAnim?: number;
}

export interface VoltPressurePlate {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pressed: boolean;
  targetTrapId: string;
}

export interface VoltCrownSnapshot {
  arenaIndex: number;
  arenaTitle: string;
  status: 'PLAYING' | 'ROUND_OVER' | 'MATCH_OVER';
  statusTimer: number;
  lastWinnerId: number | null;
  players: VoltCrownPlayer[];
  crown: VoltCrownDevice;
  projectiles: VoltProjectile[];
  traps: VoltTrap[];
  plates: VoltPressurePlate[];
  bumpers: PinballBumper[];
  explosions: PuttExplosion[];
}

// ==========================================
// GAME 06: HEX-CRUSH EXPANDED TYPES
// ==========================================

export type HexTileType = 'NORMAL' | 'BUMPER' | 'GLASS' | 'STEEL' | 'BRIDGE';

export interface HexTile {
  id: number;
  q: number;
  r: number;
  x: number;
  y: number;
  radius: number;
  type: HexTileType;
  health: number; // 2 = intact, 1 = cracked, 0 = crumbling/falling
  maxHealth: number;
  fallOffset: number; // visual drop offset when crumbling
  fadeAlpha: number; // 1 -> 0 while falling
  crumbleTimer: number; // countdown after contact before falling
  shakeTimer: number; // vibration anim when cracked
  tempTimer?: number; // for temporary nanobridge tiles
}

export interface HexCrushPlayer {
  id: number;
  name: string;
  bodyColor: string;
  shadeColor: string;
  cosmetics?: RobotCosmetics;
  isBot: boolean;
  alive: boolean;
  score: number; // rounds won (first to 3)
  x: number;
  y: number;
  z: number; // vertical elevation for jump/slam (0 = ground, >0 = air)
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  aimAngle: number;
  walkCycle: number;
  isGroundPounding: boolean;
  hammerCooldown: number;
  jumpCooldown: number;
  bridgeCooldown: number;
  stunTimer: number;
  fallTimer: number; // >0 while falling into abyss before KO
  fallScale: number; // shrinking as robot drops
  fallRotation: number;
  emoteText: string | null;
  emoteTimer: number;
}

export interface SeismicShockwave {
  id: number;
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface HexCrushSnapshot {
  arenaIndex: number;
  arenaTitle: string;
  status: 'PLAYING' | 'ROUND_OVER' | 'MATCH_OVER';
  statusTimer: number;
  roundWinnerId: number | null;
  matchWinnerId: number | null;
  players: HexCrushPlayer[];
  tiles: HexTile[];
  shockwaves: SeismicShockwave[];
  bumpers: PinballBumper[];
  explosions: PuttExplosion[];
}

// ========================================================
// 07 // RICOCHET-1 TYPES
// ========================================================
export interface RicochetPlayer {
  id: number;
  name: string;
  bodyColor: string;
  shadeColor: string;
  cosmetics?: RobotCosmetics;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  lives: number;
  score: number;
  aimAngle: number;
  parryTimer: number;
  parryCooldown: number;
  slideTimer: number;
  slideCooldown: number;
  walkCycle: number;
  tiltX: number;
  respawnTimer: number;
  lastHitByPlayerId: number | null;
  feintPrimed?: boolean;
}

export interface RicochetBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  radius: number;
  ownerId: number | null;
  bounceCount: number;
  glowColor: string;
  isSupercharged: boolean;
  trail: Array<{ x: number; y: number; alpha: number }>;
}

export interface ReflectiveMirror {
  id: number;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  length: number;
  angle: number; // Current angle radians
  rotSpeed: number; // Radians per sec (0 for fixed)
  moveRangeX: number;
  moveRangeY: number;
  moveSpeed: number;
  flashTimer: number;
}

export interface RicochetSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface RicochetSnapshot {
  arenaIndex: number;
  arenaTitle: string;
  status: 'PLAYING' | 'ROUND_OVER' | 'MATCH_OVER';
  statusTimer: number;
  roundWinnerId: number | null;
  matchWinnerId: number | null;
  players: RicochetPlayer[];
  bullets: RicochetBullet[];
  mirrors: ReflectiveMirror[];
  sparks: RicochetSpark[];
}

export interface ClientInputPacket {
  slotId: number;
  name: string;
  cosmetics?: RobotCosmetics;
  actionSeq?: number; // Monotonic action ID for 3-packet redundant burst deduplication
  moveX: number;
  moveY: number;
  aimAngle: number;
  parryPressed: boolean; // Jump in Chain-Panic / Start charge in Turbo-Putt
  chargingParry: boolean; // Charging putt in Turbo-Putt
  feintPrimed?: boolean; // [E] Curve Feint primed on client
  shotReleasedPower?: number; // Released putt power (0..1) in Turbo-Putt
  dashPressed: boolean; // Shockwave/Powerup in Turbo-Putt
  yankPressed?: boolean; // [E] Cable Yank in Chain-Panic / Drop Bomb in Turbo-Putt
  anchorHeld?: boolean; // [Shift / Right-Click] Anchor in Chain-Panic
  emotePressed: number;
  clientBallDist: number;
  clientX?: number; // Client-side predicted X
  clientY?: number; // Client-side predicted Y
  clientZ?: number; // Client-side predicted Z (Jump height in Chain-Panic)
  sentAtMs?: number;
}

export interface WorldSnapshotPacket {
  stateSeq?: number;
  hostName?: string;
  activeGame: ActiveGameId;
  botDifficulty?: BotDifficulty;
  tick: number;
  phase: RoundPhase;
  courtLayout: CourtLayout;
  roundTimer: number;
  multiballActive: boolean;
  comboCount: number;
  lastRoundWinnerId: number | null;
  draftOptions: string[];
  players: PlayerState[];
  balls: GyroBallState[];
  bumpers: PinballBumper[];
  chainState?: ChainPanicSnapshot;
  puttState?: PuttWarSnapshot;
  hotCoreState?: HotCoreSnapshot;
  voltCrownState?: VoltCrownSnapshot;
  hexCrushState?: HexCrushSnapshot;
  ricochetState?: RicochetSnapshot;
  tournamentState?: TournamentMatchState;
  hostSentAtMs?: number;
}
