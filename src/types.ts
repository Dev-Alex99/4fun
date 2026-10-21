export type ActiveGameId = 'HUB' | 'BASH_BOT' | 'CHAIN_PANIC' | 'TURBO_PUTT';
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

export interface PlayerState {
  id: number;
  peerId: string | null;
  name: string;
  bodyColor: string;
  shadeColor: string;
  batColor: string;
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

export interface ClientInputPacket {
  slotId: number;
  name: string;
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
  hostSentAtMs?: number;
}
