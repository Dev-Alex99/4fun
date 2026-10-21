export type ActiveGameId = 'HUB' | 'BASH_BOT' | 'CHAIN_PANIC';
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

export interface ClientInputPacket {
  slotId: number;
  name: string;
  moveX: number;
  moveY: number;
  aimAngle: number;
  parryPressed: boolean; // Jump in Chain-Panic
  chargingParry: boolean;
  dashPressed: boolean;
  yankPressed?: boolean; // [E] Cable Yank in Chain-Panic
  anchorHeld?: boolean; // [Shift / Right-Click] Anchor in Chain-Panic
  emotePressed: number;
  clientBallDist: number;
}

export interface WorldSnapshotPacket {
  activeGame: ActiveGameId;
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
}
