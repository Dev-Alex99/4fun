import { validVote } from '../game/partyVote';
import { validChallenge, validChallengeCode } from '../game/sharedChallenge';
import type { ClientInputPacket, RobotCosmetics } from '../types';
import { validTournamentOptions } from '../game/tournamentRules';
import { validCampaignSave, validCampaignState } from '../game/chainCampaign';
import { validMatchStats, validSessionResult } from '../game/matchResults';

export const PROTOCOL_VERSION = 5;
export const MAX_MESSAGE_CHARS = 256 * 1024;
export const GAME_IDS = ['HUB', 'BASH_BOT', 'CHAIN_PANIC', 'TURBO_PUTT', 'HOT_CORE', 'VOLT_CROWN', 'HEX_CRUSH', 'RICOCHET_1', 'CARGO_CREW'];
export const BOT_LEVELS = ['CHILL', 'NORMAL', 'PRO', 'OFF'];
export const MESSAGE_TYPES = ['JOIN_CLAIM', 'SLOT_ASSIGN', 'GAME_SWITCH', 'ROOM_ACTION', 'CLIENT_INPUT', 'WORLD_SNAP', 'DRAFT_PICK', 'TOURNAMENT_READY', 'GAME_VOTE', 'KICK_PEER', 'PEER_LEAVE', 'ROOM_EVENT', 'PING_REQ', 'PING_ACK'];
export const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const finite = (v: unknown, min = -1e7, max = 1e7): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => finite(v, min, max) && Number.isSafeInteger(v);
export const text = (v: unknown, max = 256): v is string => typeof v === 'string' && v.length <= max;
export const peerId = (v: unknown): v is string => text(v, 96) && /^[A-Za-z0-9_-]{1,96}$/.test(v);
export const cleanText = (v: string, max = 180): string => v.replace(/[<>\u0000-\u001f\u007f]/g, '').slice(0, max);
export const cleanName = (v: string): string => cleanText(v, 10).trim().toUpperCase() || 'PILOTO';

export function validCosmetics(v: unknown): v is RobotCosmetics {
  return record(v) && ['NONE', 'CROWN', 'CONE', 'RADAR', 'PROP', 'VIKING', 'HEADPHONES'].includes(String(v.hat)) &&
    ['CYAN', 'AMBER', 'EMERALD', 'MAGENTA', 'RED', 'WHITE'].includes(String(v.visor)) &&
    ['STOCK', 'STEALTH', 'WARNING', 'VAPOR', 'RESCUE', 'CHAMPION', 'CHROME', 'FREIGHT'].includes(String(v.skin));
}

/** Bounded JSON only: reject cycles, nonfinite numbers and prototype-bearing keys before dispatch. */
export function boundedJson(value: unknown): boolean {
  let budget = 30000;
  const ancestors = new Set<object>();
  const visit = (v: unknown, depth: number): boolean => {
    if (--budget < 0 || depth > 12) return false;
    if (v === null || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= 1e15;
    if (typeof v === 'string') return v.length <= 1024;
    if (!v || typeof v !== 'object' || ancestors.has(v)) return false;
    ancestors.add(v);
    const entries = Array.isArray(v) ? v.map((x, i) => [String(i), x] as const) : Object.entries(v);
    const ok = entries.length <= 2048 && entries.every(([k, x]) => !['__proto__', 'constructor', 'prototype'].includes(k) && visit(x, depth + 1));
    ancestors.delete(v);
    return ok;
  };
  return visit(value, 0);
}

export function validInput(v: unknown): v is ClientInputPacket {
  if (!record(v) || !integer(v.slotId, 0, 3) || !text(v.name, 80) ||
      !finite(v.moveX, -1, 1) || !finite(v.moveY, -1, 1) || !finite(v.aimAngle, -Math.PI * 2, Math.PI * 2) ||
      typeof v.parryPressed !== 'boolean' || typeof v.chargingParry !== 'boolean' || typeof v.dashPressed !== 'boolean' ||
      !integer(v.emotePressed, 0, 4) || !finite(v.clientBallDist, 0, 100000)) return false;
  for (const key of ['inputSeq', 'actionSeq', 'stateSeq', 'lastSeenSnapshotSeq', 'roundEpoch']) if (v[key] !== undefined && !integer(v[key], 0)) return false;
  for (const key of ['yankPressed', 'anchorHeld', 'feintPrimed', 'cancelHeldActions']) if (v[key] !== undefined && typeof v[key] !== 'boolean') return false;
  for (const key of ['clientX', 'clientY', 'clientZ']) if (v[key] !== undefined && !finite(v[key], -10000, 10000)) return false;
  if (v.shotReleasedPower !== undefined && !finite(v.shotReleasedPower, 0, 1)) return false;
  if (v.sentAtMs !== undefined && !finite(v.sentAtMs, 0, 1e15)) return false;
  return v.cosmetics === undefined || validCosmetics(v.cosmetics);
}

export function validAction(v: unknown): boolean {
  if (!record(v)) return false;
  switch (v.kind) {
    case 'CARGO_ROUTE': return integer(v.cargoRoute, 0, 2);
    case 'START_CHALLENGE': return validChallengeCode(v.challengeCode);
    case 'BOT_DIFF': return BOT_LEVELS.includes(String(v.botDifficulty));
    case 'CHAIN_MODE': return v.chainMode === 'COOP' || v.chainMode === 'SABOTAGE';
    case 'VOLT_MODE': return v.voltMode === 'FFA' || v.voltMode === 'TEAMS';
    case 'START_CAMPAIGN': return v.campaignSave === undefined || validCampaignSave(v.campaignSave);
    case 'LOAD_STAGE': return ['levelIndex', 'holeIndex', 'arenaIndex'].some(k => v[k] !== undefined) &&
      ['levelIndex', 'holeIndex', 'arenaIndex'].every(k => v[k] === undefined || integer(v[k], 0, 50));
    case 'START_TOURNAMENT': return (v.tournamentOptions === undefined || validTournamentOptions(v.tournamentOptions)) &&
      (v.replaySame === undefined || typeof v.replaySame === 'boolean');
    case 'RESET_MATCH': case 'STOP_TOURNAMENT': return true;
    default: return false;
  }
}

/** Check the fixed player roster and required structure before an engine can consume a snapshot. */
export function validSnapshot(v: unknown): boolean {
  if (record(v) && ((v.gameVote !== undefined && !validVote(v.gameVote)) || (v.challenge !== undefined && v.challenge !== null && !validChallenge(v.challenge)))) return false;
  if (record(v) && v.sessionResult !== undefined && v.sessionResult !== null && !validSessionResult(v.sessionResult, GAME_IDS)) return false;
  if (!record(v) || !GAME_IDS.includes(String(v.activeGame)) || !integer(v.stateSeq, 1) ||
      !integer(v.snapshotSeq, 1) || !peerId(v.hostEpoch) || !integer(v.tick) ||
      (v.hostName !== undefined && !text(v.hostName, 80)) || !BOT_LEVELS.includes(String(v.botDifficulty)) ||
      !['PLAYING', 'CARD_DRAFT', 'MATCH_OVER'].includes(String(v.phase)) ||
      !['CLASSIC', 'PINBALL', 'CORE', 'CROSS'].includes(String(v.courtLayout)) ||
      !finite(v.roundTimer) || typeof v.multiballActive !== 'boolean' || !finite(v.comboCount, 0) ||
      !Array.isArray(v.draftOptions) || !v.draftOptions.every(x => text(x, 96)) ||
      !entityArray(v.balls, 'id x y z vx vy speed baseSpeed radius rotation targetId ownerId passId curveSpin') ||
      !entityArray(v.bumpers, 'x y radius hitAnim') || !validPlayers(v.players, 'base') ||
      !(v.lastRoundWinnerId === null || integer(v.lastRoundWinnerId, 0, 3))) return false;
  if (v.inputAcks !== undefined && !(Array.isArray(v.inputAcks) && v.inputAcks.length === 4 && v.inputAcks.every(ack => ack === null ||
      (Array.isArray(ack) && ack.length === 2 && integer(ack[0], 1) && integer(ack[1], 0, 600000))))) return false;
  for (const k of ['chainState', 'puttState', 'hotCoreState', 'voltCrownState', 'hexCrushState', 'ricochetState', 'cargoState']) {
    if (v[k] !== undefined && (!record(v[k]) || !validPlayers(v[k].players, k))) return false;
  }
  const states: Record<string, [string, string[]]> = {
    CHAIN_PANIC: ['chainState', ['switches', 'lasers', 'rotaryLasers', 'fragileTiles']],
    CARGO_CREW: ['cargoState', ['switches']],
    TURBO_PUTT: ['puttState', ['bombs', 'crates', 'bumpers', 'windmills', 'explosions']],
    HOT_CORE: ['hotCoreState', ['bumpers', 'pillars', 'boostPads', 'explosions']],
    VOLT_CROWN: ['voltCrownState', ['projectiles', 'traps', 'plates', 'bumpers', 'explosions']],
    HEX_CRUSH: ['hexCrushState', ['tiles', 'shockwaves', 'bumpers', 'explosions']],
    RICOCHET_1: ['ricochetState', ['bullets', 'mirrors', 'sparks']]
  };
  const required = states[String(v.activeGame)];
  if (required) {
    const state = v[required[0]];
    if (!record(state) || !text(state.status, 20) || !finite(state.statusTimer) || required[1].some(k => !Array.isArray(state[k]))) return false;
    const scalarFields: Record<string, string> = {
      CHAIN_PANIC: 'levelIndex statusTimer windForceY completions wipes',
      CARGO_CREW: 'stageIndex statusTimer elapsedSeconds stageSeconds integrity damageTaken retries',
      TURBO_PUTT: 'holeIndex par hurryTimer statusTimer cupX cupY cupRadius',
      HOT_CORE: 'arenaIndex statusTimer', VOLT_CROWN: 'arenaIndex statusTimer', HEX_CRUSH: 'arenaIndex statusTimer', RICOCHET_1: 'arenaIndex statusTimer'
    };
    if (!numbers(state, scalarFields[String(v.activeGame)])) return false;
    const statuses = v.activeGame === 'CARGO_CREW' ? ['PLAYING', 'STAGE_CLEAR', 'RECOVERING', 'ROUTE_COMPLETE'] : v.activeGame === 'CHAIN_PANIC' ? ['PLAYING', 'LEVEL_CLEAR', 'TEAM_WIPE', 'CAMPAIGN_COMPLETE'] :
      v.activeGame === 'TURBO_PUTT' ? ['PLAYING', 'HOLE_COMPLETE'] : ['PLAYING', 'ROUND_OVER', 'MATCH_OVER'];
    if (!statuses.includes(state.status)) return false;
    if (state.campaign !== undefined && !validCampaignState(state.campaign)) return false;
    if (v.activeGame === 'CARGO_CREW' && (!integer(state.stageIndex, 0, 2) || !finite(state.integrity, 0, 100) || typeof state.checkpoint !== 'boolean' ||
      !record(state.battery) || !Array.isArray(state.stageTimes) || state.stageTimes.length > 3 || !state.stageTimes.every(t => finite(t, 0)))) return false;
    if (v.activeGame === 'CARGO_CREW' && ['stageDamage', 'stageRepairs'].some(k => state[k] !== undefined && (!Array.isArray(state[k]) || state[k].length > 3 || !state[k].every(n => finite(n, 0, 1e9))))) return false;
    if (v.activeGame === 'CARGO_CREW' && state.routeIndex !== undefined && !integer(state.routeIndex, 0, 2)) return false;
    if (v.activeGame === 'CARGO_CREW' && state.feedback !== undefined && state.feedback !== null &&
      (!record(state.feedback) || !integer(state.feedback.seq, 1) || !['PIT', 'FALL', 'CRANE', 'REPAIR', 'CHECKPOINT', 'DELIVERY', 'RECOVER'].includes(String(state.feedback.kind)) ||
        !text(state.feedback.text, 180) || !finite(state.feedback.atSeconds, 0))) return false;
    if (v.activeGame === 'VOLT_CROWN' && ((state.mode !== undefined && !['FFA', 'TEAMS'].includes(String(state.mode))) ||
      (state.teamScores !== undefined && (!Array.isArray(state.teamScores) || state.teamScores.length !== 2 || !state.teamScores.every(score => finite(score, 0, 100)))))) return false;
    if (v.activeGame === 'HOT_CORE' && !record(state.core)) return false;
    if (v.activeGame === 'VOLT_CROWN' && !record(state.crown)) return false;
    const numericArrays: Record<string, string> = {
      switches: 'id x y radius', lasers: 'x1 y1 x2 y2 zHeight baseY sweepRange sweepSpeed phase',
      rotaryLasers: 'cx cy length angle speed zHeight', fragileTiles: 'id x y w h timer',
      bombs: 'id ownerId x y vx vy timer maxTimer', crates: 'id x y respawnTimer', bumpers: 'x y radius hitAnim',
      windmills: 'cx cy length angle speed', explosions: 'x y radius maxRadius life', pillars: 'x y w h', boostPads: 'x y w h vx vy',
      projectiles: 'id ownerId x y vx vy life', traps: 'x y w h timer period', plates: 'x y w h',
      tiles: 'id q r x y radius health maxHealth fallOffset fadeAlpha crumbleTimer shakeTimer',
      shockwaves: 'id ownerId x y vx vy radius life maxLife', bullets: 'id x y vx vy speed radius bounceCount',
      mirrors: 'id x y baseX baseY length angle rotSpeed moveRangeX moveRangeY moveSpeed flashTimer', sparks: 'x y vx vy life maxLife'
    };
    if (required[1].some(k => !entityArray(state[k], numericArrays[k]))) return false;
    if (record(state.core) && !numbers(state.core, 'x y vx vy radius fuseTimer maxFuse passCount flightTime')) return false;
    if (record(state.crown) && !numbers(state.crown, 'x y vx vy radius bounceCount idleTimer')) return false;
    if (state.battery !== undefined && state.battery !== null && (!record(state.battery) || !numbers(state.battery, 'x y vx vy radius'))) return false;
  }
  if (v.tournamentState !== undefined) {
    const t = v.tournamentState;
    if (!record(t) || typeof t.active !== 'boolean' || typeof t.rouletteSpinning !== 'boolean' || typeof t.isFinished !== 'boolean' ||
        !integer(t.roundIndex, 0, 20) || !integer(t.totalRounds, 1, 20) || !finite(t.rouletteTimer) ||
        !Array.isArray(t.scores) || t.scores.length !== 4 || !t.scores.every(s => finite(s, 0)) ||
        !Array.isArray(t.gameSequence) || !t.gameSequence.every(g => GAME_IDS.includes(String(g))) ||
        !Array.isArray(t.mutators) || !t.mutators.every(m => text(m, 40)) || !text(t.currentMutator, 40) || !text(t.rouletteDisplayId, 40) ||
        !(t.champId === null || integer(t.champId, 0, 3)) || !validTournamentOptions(t.options) ||
        typeof t.preparing !== 'boolean' || !integer(t.preparationId) || !finite(t.countdown, 0, 3) ||
        !slotList(t.requiredSlots) || !slotList(t.readySlots) || !Array.isArray(t.matchStats) || t.matchStats.length !== 4 || !t.matchStats.every(validMatchStats)) return false;
    const requiredSlots = t.requiredSlots;
    if (!t.readySlots.every(id => requiredSlots.includes(id))) return false;
  }
  return true;
}

function slotList(value: unknown): value is number[] {
  return Array.isArray(value) && value.length <= 4 && new Set(value).size === value.length && value.every(id => integer(id, 0, 3));
}

function numbers(v: Record<string, unknown>, fields: string): boolean {
  return fields.split(' ').every(k => finite(v[k]));
}

function entityArray(v: unknown, fields: string): boolean {
  return Array.isArray(v) && v.every(entity => record(entity) && numbers(entity, fields));
}

function validPlayers(v: unknown, kind: string): boolean {
  const numeric: Record<string, string> = {
    base: 'score walkCycle tiltX parryTimer parryCooldown chargeTime batSwingDir dashTimer dashCooldown aimAngle emoteTimer botEvaluatedPassId botTriggerDist parryRadiusMult parryWindowBonus curvePower dashCooldownMult speedMult smashPower',
    chainState: 'z vz dangleTime yankCooldown walkCycle emoteTimer',
    cargoState: 'z vz dangleTime yankCooldown walkCycle emoteTimer toolCooldown',
    puttState: 'lastSafeX lastSafeY aimAngle chargePower puttCooldown bombCooldown shockwaveCooldown anvilTimer strokes totalPoints sunkOrder emoteTimer botShotTimer',
    hotCoreState: 'score aimAngle walkCycle shieldTimer shieldCooldown dashTimer dashCooldown empCooldown passImmunityTimer emoteTimer',
    voltCrownState: 'score holdStreak aimAngle walkCycle shieldTimer shieldCooldown dashTimer dashCooldown taserCooldown stunTimer immunityTimer emoteTimer',
    hexCrushState: 'score z vz aimAngle walkCycle hammerCooldown jumpCooldown bridgeCooldown stunTimer fallTimer fallScale fallRotation emoteTimer',
    ricochetState: 'lives score aimAngle parryTimer parryCooldown slideTimer slideCooldown walkCycle tiltX respawnTimer'
  };
  const booleans: Record<string, string> = {
    base: 'alive feintPrimed botWillParry dashShockwave magnetPull', chainState: 'isSaboteur onGround isDangling isAnchored',
    cargoState: 'isSaboteur onGround isDangling isAnchored gripping',
    puttState: 'isCharging sunkInCup', hotCoreState: 'alive', voltCrownState: 'alive', hexCrushState: 'alive isGroundPounding', ricochetState: 'alive'
  };
  return Array.isArray(v) && v.length === 4 && v.every((p, i) => {
    if (!record(p) || p.id !== i || !text(p.name, 80) || !text(p.bodyColor, 40) || !text(p.shadeColor, 40) || typeof p.isBot !== 'boolean' ||
        !numbers(p, 'x y vx vy radius') || !numbers(p, numeric[kind]) || booleans[kind].split(' ').some(k => typeof p[k] !== 'boolean') ||
        (p.cosmetics !== undefined && !validCosmetics(p.cosmetics))) return false;
    if (kind === 'base' && (!(p.peerId === null || peerId(p.peerId)) || !text(p.batColor, 40) ||
        !Array.isArray(p.installedModCodes) || !p.installedModCodes.every(c => text(c, 80)))) return false;
    if (kind === 'puttState' && !['NONE', 'BAZOOKA', 'NITRO', 'ANVIL'].includes(String(p.heldPowerup))) return false;
    if (kind !== 'ricochetState' && !(p.emoteText === null || text(p.emoteText, 80))) return false;
    return true;
  });
}
