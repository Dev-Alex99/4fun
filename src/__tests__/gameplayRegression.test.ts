import { describe, expect, it, vi } from 'vitest';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { PuttWarEngine } from '../game/puttWarEngine';
import { HotCoreEngine } from '../game/hotCoreEngine';
import { VoltCrownEngine } from '../game/voltCrownEngine';
import { HexCrushEngine } from '../game/hexCrushEngine';
import { RicochetEngine } from '../game/ricochetEngine';
import { TournamentManager } from '../game/tournamentManager';
import { ClientInputPacket } from '../types';
import { reconcilePlayer } from '../game/reconciliation';
import { readyTournamentRound } from './tournamentTestUtils';

const idle: ClientInputPacket = {
  slotId: 0, name: 'ALEX', moveX: 0, moveY: 0, aimAngle: 0,
  parryPressed: false, chargingParry: false, dashPressed: false,
  emotePressed: 0, clientBallDist: 999
};

describe('Tournament and Ricochet progress', () => {
  it('ends Ricochet by elimination when neutral bullets awarded no KOs', () => {
    const game = new RicochetEngine();
    game.bullets = [];
    game.players.forEach((p, i) => { p.lives = i === 2 ? 1 : 0; p.alive = i === 2; });
    game.step(1 / 60, idle);
    expect(game.status).toBe('MATCH_OVER');
    expect(game.matchWinnerId).toBe(2);
  });

  it('ends Ricochet immediately at five KOs with several surviving opponents', () => {
    const game = new RicochetEngine();
    game.players[3].score = 5;
    game.step(1 / 60, idle);
    expect(game.status).toBe('MATCH_OVER');
    expect(game.matchWinnerId).toBe(3);
  });

  it('restores lives after a simultaneous wipe instead of looping ROUND_OVER', () => {
    const game = new RicochetEngine();
    game.bullets = [];
    game.players.forEach((p) => { p.lives = 0; p.alive = false; });
    game.step(0.05, idle);
    expect(game.status).toBe('ROUND_OVER');
    for (let i = 0; i < 45; i++) game.step(0.05, idle);
    expect(game.status).toBe('PLAYING');
    expect(game.players.every((p) => p.lives === 3)).toBe(true);
  });

  it('does not resolve kills, scores, respawns or winners in client prediction', () => {
    const game = new RicochetEngine();
    const victim = game.players[1];
    Object.assign(game.bullets[0], { x: victim.x, y: victim.y, vx: 0, vy: 0, ownerId: 0 });
    for (let i = 0; i < 30; i++) game.stepClientPrediction(1 / 60, 0, idle);
    expect(victim.lives).toBe(3);
    expect(victim.alive).toBe(true);
    expect(game.players[0].score).toBe(0);
    expect(game.status).toBe('PLAYING');
  });

  it('excludes disabled Ricochet bots from survival and collisions', () => {
    const game = new RicochetEngine();
    game.syncPlayerIdentities(game.players.map((p) => ({ name: p.name, isBot: p.id > 1 })), false);
    game.resetRound();
    game.bullets = [];
    expect(game.players.slice(2).every((p) => !p.alive)).toBe(true);
    game.players[1].lives = 0;
    game.players[1].alive = false;
    game.step(1 / 60, idle);
    expect(game.matchWinnerId).toBe(0);
  });

  it('retains a moving solo practice opponent with bots OFF and completes the tournament round', () => {
    const game = new RicochetEngine();
    game.syncPlayerIdentities(game.players.map((p) => ({ name: p.name, isBot: p.id !== 0 })), false);
    game.resetRound();
    const participants = game.getActiveParticipants();
    expect(participants.map((p) => p.id)).toEqual([0, 1]);
    expect(game.players.slice(2).every((p) => !p.alive)).toBe(true);
    const drone = participants[1];
    const initial = { x: drone.x, y: drone.y };
    game.step(1 / 60, idle);
    expect(Math.hypot(drone.x - initial.x, drone.y - initial.y)).toBeGreaterThan(0);
    expect(game.status).toBe('PLAYING');

    // Resolve a real host collision against the drone's last life.
    Object.assign(drone, { lives: 1, slideTimer: 0, slideCooldown: 1, parryTimer: 0, parryCooldown: 1 });
    Object.assign(game.bullets[0], { x: drone.x, y: drone.y, vx: 0, vy: 0, ownerId: 0 });
    game.step(1 / 60, idle);
    expect(drone.alive).toBe(false);
    expect(drone.lives).toBe(0);
    expect(game.status).toBe('MATCH_OVER');
    expect(game.matchWinnerId).toBe(0);
    const tournament = new TournamentManager();
    tournament.startTournament(() => {});
    readyTournamentRound(tournament);
    tournament.recordRoundWinner(game.matchWinnerId);
    tournament.step(3.21, () => {});
    expect(tournament.state.roundIndex).toBe(1);
  });

  it('consumes repeated remote Ricochet actions once and releases stored inputs', () => {
    const game = new RicochetEngine();
    game.players[1].isBot = false;
    game.applyRemoteInput({ ...idle, slotId: 1, actionSeq: 7, parryPressed: true });
    game.players[1].parryCooldown = 0;
    game.players[1].parryTimer = 0;
    game.applyRemoteInput({ ...idle, slotId: 1, actionSeq: 7, parryPressed: true });
    game.applyRemoteInput({ ...idle, slotId: 1, actionSeq: 6, parryPressed: true });
    game.step(1 / 60, idle);
    expect(game.players[1].parryTimer).toBe(0);
    game.clearRemoteInput(1);
    game.applyRemoteInput({ ...idle, slotId: 1, actionSeq: 1, parryPressed: true });
    expect(game.players[1].parryTimer).toBeGreaterThan(0);
  });

  it('returns the current Putt hole winner and advances the tournament once', () => {
    const game = new PuttWarEngine();
    const tournament = new TournamentManager();
    tournament.startTournament(() => {});
    readyTournamentRound(tournament);
    game.status = 'HOLE_COMPLETE';
    Object.assign(game.players[3], { sunkInCup: true, sunkOrder: 1, totalPoints: 1 });
    game.players[0].totalPoints = 100;
    const winner = game.getRoundWinnerId();
    expect(winner).toBe(3);
    tournament.recordRoundWinner(winner);
    tournament.recordRoundWinner(winner);
    expect(tournament.state.scores[3]).toBe(3);
    expect(tournament.isIntermission).toBe(true);
    tournament.step(3.21, () => {});
    expect(tournament.state.roundIndex).toBe(1);
    expect(tournament.isIntermission).toBe(false);
  });

  it('finishes an idle Putt hole at its time limit and permits a tied result', () => {
    const game = new PuttWarEngine();
    game.botsEnabled = false;
    game.players.forEach((p) => { p.isBot = false; p.x = 150; p.y = 100; });
    game.holeTimeRemaining = 0.01;
    game.step(0.02, idle);
    expect(game.status).toBe('HOLE_COMPLETE');
    expect(game.getRoundWinnerId()).toBeNull();
  });

  it('breaks tied tournament scores by the latest win, independent of slot order', () => {
    const tournament = new TournamentManager();
    tournament.startTournament(() => {});
    for (const id of [3, 1, 3, 1, null]) {
      readyTournamentRound(tournament);
      tournament.recordRoundWinner(id);
      if (!tournament.state.isFinished) tournament.step(3.21, () => {});
    }
    expect(tournament.state.scores).toEqual([0, 6, 0, 6]);
    expect(tournament.state.champId).toBe(1);
    expect(tournament.state.isFinished).toBe(true);
  });

  it('awards no champion if every tournament round is tied and snapshots intermission', () => {
    const tournament = new TournamentManager();
    tournament.startTournament(() => {});
    for (let i = 0; i < 5; i++) {
      readyTournamentRound(tournament);
      tournament.recordRoundWinner(null);
      if (i < 4) tournament.step(3.21, () => {});
    }
    expect(tournament.state.champId).toBeNull();
    const fresh = new TournamentManager();
    tournament.startTournament(() => {});
    readyTournamentRound(tournament);
    tournament.recordRoundWinner(2);
    fresh.applySnapshot(tournament.getSnapshot());
    expect(fresh.isIntermission).toBe(true);
  });

  it('finishes solo BASH OFF tournament survival at 30 seconds and advances once', () => {
    const tournament = new TournamentManager();
    tournament.startTournament(() => {});
    tournament.step(2.3, () => {});
    readyTournamentRound(tournament);
    const players = [{ id: 0, isBot: false, alive: true }];
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', players, 29.99)).toBe(false);
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', players, 30)).toBe(true);
    expect(tournament.state.scores).toEqual([3, 0, 0, 0]);
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', players, 31)).toBe(false);
    tournament.step(3.21, () => {});
    expect(tournament.state.roundIndex).toBe(1);
  });

  it('finishes solo BASH OFF on the first real host KO even when practice immediately respawns', () => {
    const tournament = new TournamentManager();
    tournament.startTournament(() => {});
    tournament.step(2.3, () => {});
    readyTournamentRound(tournament);
    const game = new ArenaEngine();
    game.botDifficulty = 'OFF';
    game.spawnRound();
    Object.assign(game.balls[0], { x: game.players[0].x, y: game.players[0].y, vx: 0, vy: 0, targetId: 0 });
    game.step(0.001, idle);
    expect(game.players[0].alive).toBe(true);
    expect(game.roundTimer).toBe(0);
    expect(game.players[0].lastKOAt).toBeDefined();
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', game.players, game.roundTimer)).toBe(true);
    expect(tournament.state.scores).toEqual([0, 0, 0, 0]);
    expect(tournament.isIntermission).toBe(true);
    tournament.step(3.21, () => {});
    expect(tournament.state.roundIndex).toBe(1);
  });

  it('keeps solo survival restricted to an active BASH OFF tournament outside all pauses', () => {
    const tournament = new TournamentManager();
    const solo = [{ id: 0, isBot: false, alive: true }];
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', solo, 60)).toBe(false);
    tournament.startTournament(() => {});
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', solo, 60)).toBe(false);
    tournament.step(2.3, () => {});
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', solo, 60)).toBe(false);
    readyTournamentRound(tournament);
    expect(tournament.evaluateSoloBashRound('RICOCHET_1', 'OFF', solo, 60)).toBe(false);
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'NORMAL', solo, 60)).toBe(false);
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', [...solo, { id: 1, isBot: false, alive: true }], 60)).toBe(false);
    tournament.recordRoundWinner(2);
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', solo, 60)).toBe(false);
    expect(tournament.state.scores).toEqual([0, 0, 3, 0]);
    tournament.step(3.21, () => {});
    tournament.state.rouletteSpinning = false;
    tournament.state.isFinished = true;
    expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', solo, 60)).toBe(false);
  });

  it('ignores a host KO from before the tournament round instead of treating a reset as defeat', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    try {
      const tournament = new TournamentManager();
      tournament.startTournament(() => {});
      tournament.step(2.3, () => {});
      readyTournamentRound(tournament);
      expect(tournament.evaluateSoloBashRound('BASH_BOT', 'OFF', [{ id: 0, isBot: false, alive: true, lastKOAt: 900 }], 1)).toBe(false);
      expect(tournament.state.scores).toEqual([0, 0, 0, 0]);
    } finally { clock.mockRestore(); }
  });
});

describe('Host authority and snapshot lifecycle', () => {
  const engines = [ArenaEngine, ChainPanicEngine, PuttWarEngine, HotCoreEngine, VoltCrownEngine, HexCrushEngine, RicochetEngine];

  it('leads a moving local target by measured half-RTT without pulling it into the past', () => {
    const host = { x: 100, y: 100, vx: 200, vy: 0, alive: true, stunTimer: 0, fallTimer: 0 };
    const predicted = { ...host, x: 120 };
    const reconciled = reconcilePlayer(predicted, host, true, false, 0.1);
    expect(reconciled.x).toBe(120);
    expect(reconcilePlayer(predicted, host, true, true, 0.1).x).toBe(100);
    expect(reconcilePlayer(predicted, { ...host, stunTimer: 1 }, true, false, 0.1).x).toBeLessThan(120);
    expect(reconcilePlayer(predicted, { ...host, fallTimer: 1 }, true, false, 0.1).x).toBeLessThan(120);
  });

  for (const Engine of engines) {
    it(`${Engine.name} ignores arbitrary client coordinate claims`, () => {
      const game = new Engine();
      const p = game.players[1];
      p.isBot = false;
      const { x, y } = p;
      game.applyRemoteInput({ ...idle, slotId: 1, clientX: 950, clientY: 440, clientZ: 999 });
      expect(p.x).toBe(x);
      expect(p.y).toBe(y);
      if ('z' in p) expect(p.z).toBe(0);
    });

    it(`${Engine.name} accepts host resets even with a small local position error`, () => {
      const game = new Engine();
      const snapshot = game.getSnapshot();
      const oldX = snapshot.players[0].x;
      snapshot.players[0].x += 20;
      snapshot.players[0].vx = 0;
      snapshot.roundEpoch = (snapshot.roundEpoch ?? 0) + 1;
      // Each snapshot belongs to the same engine; union types cannot express this correlation.
      (game.applySnapshot as (snap: typeof snapshot, localSlotId: number) => void)(snapshot, 0);
      expect(game.players[0].x).toBe(oldX + 20);
      expect(game.roundEpoch).toBe(snapshot.roundEpoch);
    });

    it(`${Engine.name} converges small local errors while moving`, () => {
      const game = new Engine();
      const snapshot = game.getSnapshot();
      const oldX = snapshot.players[0].x;
      game.players[0].vx = 150;
      snapshot.players[0].x += 30;
      for (let i = 0; i < 20; i++) {
        (game.applySnapshot as (snap: typeof snapshot, localSlotId: number) => void)(snapshot, 0);
      }
      expect(game.players[0].x).toBeGreaterThan(oldX + 29);
      expect(game.players[0].x).toBeLessThanOrEqual(oldX + 30);
    });
  }

  it('rejects a forged distant BASH parry despite a claimed zero ball distance', () => {
    const game = new ArenaEngine();
    const player = game.players[1];
    player.isBot = false;
    Object.assign(game.balls[0], { x: player.x - 250, y: player.y, ownerId: 0, speed: 1000 });
    game.applyRemoteInput({ ...idle, slotId: 1, parryPressed: true, clientBallDist: 0, lagCompensationMs: 180 });
    expect(game.balls[0].ownerId).toBe(0);
  });

  it('rewinds only host-recorded BASH contacts on the same targeted pass', () => {
    const game = new ArenaEngine();
    const player = game.players[1];
    player.isBot = false;
    const ball = game.balls[0];
    Object.assign(ball, { x: player.x - 55, y: player.y, targetId: 1, ownerId: 0, vx: 200, vy: 0, speed: 200 });
    game.step(0.001, idle);
    ball.x = player.x - 250;
    game.applyRemoteInput({ ...idle, slotId: 1, parryPressed: true, clientBallDist: 999, lagCompensationMs: 180 });
    expect(ball.ownerId).toBe(1);
  });

  it('cannot reuse a BASH contact after the ball changed pass', () => {
    const game = new ArenaEngine();
    const player = game.players[1];
    player.isBot = false;
    const ball = game.balls[0];
    Object.assign(ball, { x: player.x - 55, y: player.y, targetId: 1, ownerId: 0, vx: 200, vy: 0, speed: 200 });
    game.step(0.001, idle);
    ball.x = player.x - 250;
    ball.passId += 1;
    game.applyRemoteInput({ ...idle, slotId: 1, parryPressed: true, clientBallDist: 0, lagCompensationMs: 180 });
    expect(ball.ownerId).toBe(0);
  });

  it('does not extrapolate BASH reach from ball speed or untrusted long rewind values', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    try {
      const game = new ArenaEngine();
      const player = game.players[1];
      player.isBot = false;
      const ball = game.balls[0];
      Object.assign(ball, { x: player.x - 55, y: player.y, targetId: 1, ownerId: 0, vx: 200, vy: 0, speed: 200 });
      game.step(0.001, idle);
      Object.assign(ball, { x: player.x - 250, speed: 1400 });
      clock.mockReturnValue(1200);
      game.applyRemoteInput({ ...idle, slotId: 1, parryPressed: true, clientBallDist: 0, lagCompensationMs: 99999 });
      expect(ball.ownerId).toBe(0);
    } finally { clock.mockRestore(); }
  });

  it('cannot forge KO proof by reporting a dead player and near ball', () => {
    const game = new ArenaEngine();
    const player = game.players[1];
    player.isBot = false;
    player.alive = false;
    player.lastKOAt = performance.now();
    Object.assign(game.balls[0], { x: player.x, y: player.y, ownerId: 0 });
    game.applyRemoteInput({ ...idle, slotId: 1, parryPressed: true, clientBallDist: 0, lagCompensationMs: 180 });
    expect(player.alive).toBe(false);
  });

  it('rejects invalid and unoffered draft mods without ending the draft', () => {
    const game = new ArenaEngine();
    game.phase = 'CARD_DRAFT';
    game.draftOptions = ['heavy_paddle'];
    game.selectDraftMod(0, 'overdrive_spring');
    expect(game.phase).toBe('CARD_DRAFT');
    game.selectDraftMod(1, 'heavy_paddle');
    expect(game.phase).toBe('CARD_DRAFT');
    game.selectDraftMod(0, 'heavy_paddle');
    expect(game.phase).toBe('PLAYING');
    expect(game.players[0].parryRadiusMult).toBeGreaterThan(1);
  });

  it('copies Volt identity, cooldowns, visuals and host respawns to the local slot', () => {
    const game = new VoltCrownEngine();
    const snapshot = game.getSnapshot();
    Object.assign(snapshot.players[1], { name: 'REMOTE', taserCooldown: 2.2, shieldCooldown: 4, alive: false });
    game.applySnapshot(snapshot, 1);
    expect(game.players[1].name).toBe('REMOTE');
    expect(game.players[1].taserCooldown).toBe(2.2);
    expect(game.players[1].shieldCooldown).toBe(4);
    snapshot.players[1].alive = true;
    snapshot.players[1].x += 18;
    game.applySnapshot(snapshot, 1);
    expect(game.players[1].x).toBe(snapshot.players[1].x);
  });

  it('preserves cosmetics when resetting BASH and clears recycled identities in every other game', () => {
    const cosmetics = { hat: 'CROWN', skin: 'STEALTH', visor: 'MAGENTA' } as const;
    const arena = new ArenaEngine();
    arena.players[1].cosmetics = cosmetics;
    arena.players[1].isBot = false;
    arena.resetChampionship();
    expect(arena.players[1].cosmetics).toEqual(cosmetics);
    for (const Engine of [ChainPanicEngine, PuttWarEngine, HotCoreEngine, VoltCrownEngine, HexCrushEngine, RicochetEngine]) {
      const game = new Engine();
      game.players[1].cosmetics = cosmetics;
      game.syncPlayerIdentities(game.players.map((p) => ({ name: p.name, isBot: p.isBot })), false);
      expect(game.players[1].cosmetics).toBeUndefined();
    }
  });

  it('cancels a disconnected Putt charge without generating an automatic shot', () => {
    const game = new PuttWarEngine();
    game.players[1].isBot = false;
    game.players[1].isCharging = true;
    game.players[1].chargePower = 0.8;
    game.clearRemoteInput(1);
    game.step(1 / 60, idle);
    expect(game.players[1].strokes).toBe(0);
    expect(game.players[1].isCharging).toBe(false);
  });

  it('keeps BASH ball homing integration equal on host and client between snapshots', () => {
    const host = new ArenaEngine();
    host.botDifficulty = 'OFF';
    host.spawnRound();
    host.bumpers = [];
    Object.assign(host.balls[0], { x: 500, y: 140, vx: 0, vy: 300, speed: 300, curveSpin: 2 });
    const client = new ArenaEngine();
    client.applySnapshot(host.getSnapshot(), 0);
    host.step(1 / 60, idle);
    client.stepClientPrediction(1 / 60, 0, idle);
    expect(client.balls[0].x).toBeCloseTo(host.balls[0].x);
    expect(client.balls[0].y).toBeCloseTo(host.balls[0].y);
  });

  it('replicates BASH hit-stop so prediction does not keep moving during the host pause', () => {
    const host = new ArenaEngine();
    host.hitStopTimer = 0.06;
    const client = new ArenaEngine();
    client.applySnapshot(host.getSnapshot(), 0);
    const { x, y } = client.balls[0];
    client.stepClientPrediction(1 / 60, 0, { ...idle, moveX: 1 });
    expect(client.balls[0].x).toBe(x);
    expect(client.balls[0].y).toBe(y);
    expect(client.hitStopTimer).toBeCloseTo(0.06 - 1 / 60);
  });
});

describe('Chaos physics', () => {
  it('SUPER_SPEED changes both host and predicted movement after input normalization', () => {
    const normal = new HexCrushEngine();
    const turbo = new HexCrushEngine();
    turbo.setChaosMutator('SUPER_SPEED');
    normal.stepClientPrediction(1 / 60, 0, { ...idle, moveX: 1 });
    turbo.stepClientPrediction(1 / 60, 0, { ...idle, moveX: 1 });
    expect(turbo.players[0].vx / normal.players[0].vx).toBeCloseTo(1.45);
    const host = new HexCrushEngine();
    host.setChaosMutator('SUPER_SPEED');
    host.step(1 / 60, { ...idle, moveX: 1 });
    expect(host.players[0].vx).toBeCloseTo(turbo.players[0].vx);
  });

  it('MOON_GRAVITY gives identical half-gravity jumps on host and client', () => {
    const normal = new HexCrushEngine();
    const host = new HexCrushEngine();
    const client = new HexCrushEngine();
    host.setChaosMutator('MOON_GRAVITY');
    client.setChaosMutator('MOON_GRAVITY');
    for (const game of [normal, host, client]) game.triggerJumpOrPound(game.players[0]);
    normal.step(1 / 60, idle);
    host.step(1 / 60, idle);
    client.stepClientPrediction(1 / 60, 0, { ...idle });
    expect(host.players[0].vz).toBeGreaterThan(normal.players[0].vz);
    expect(host.players[0].z).toBeCloseTo(client.players[0].z);
    expect(host.players[0].vz).toBeCloseTo(client.players[0].vz);
  });

  it('BOMB_RAIN emits a replicated warning every four seconds independent of frame count', () => {
    const run = (dt: number) => {
      const game = new RicochetEngine();
      game.bullets = [];
      game.setChaosMutator('BOMB_RAIN');
      for (let i = 0; i < Math.round(4.1 / dt); i++) game.step(dt, idle);
      return game;
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const a = run(0.01);
      const b = run(0.05);
      expect(a.chaosBombs.length).toBe(1);
      expect(b.chaosBombs.length).toBe(1);
      expect(a.chaosBombs[0].fuse).toBeCloseTo(b.chaosBombs[0].fuse, 1);
      const clone = new RicochetEngine();
      clone.applySnapshot(a.getSnapshot(), 0);
      expect(clone.chaosBombs).toEqual(a.chaosBombs);
      expect(clone.simulationTime).toBe(a.simulationTime);
    } finally { random.mockRestore(); }
  });

  it('BOMB_RAIN changes host velocity after warning and clients never apply that damage', () => {
    const host = new PuttWarEngine();
    const client = new PuttWarEngine();
    for (const game of [host, client]) {
      game.setChaosMutator('BOMB_RAIN');
      game.chaosBombs = [{ x: 140, y: 150, fuse: 0.01, radius: 145 }];
      game.players[0].x = 160; game.players[0].y = 150;
    }
    host.step(0.02, idle);
    client.stepClientPrediction(0.02, 0, idle);
    expect(Math.abs(host.players[0].vx)).toBeGreaterThan(200);
    expect(client.players[0].vx).toBe(0);
  });

  it('BOUNCY_BUMPERS increases force without unbounded Ricochet speed', () => {
    const game = new RicochetEngine();
    game.setChaosMutator('BOUNCY_BUMPERS');
    game.mirrors = [];
    const bullet = game.bullets[0];
    Object.assign(bullet, { x: 23, y: 258, vx: -350, vy: 0 });
    game.step(0.02, idle);
    expect(bullet.vx).toBeGreaterThan(700);
    Object.assign(bullet, { x: 23, vx: -1050 });
    game.step(0.02, idle);
    expect(Math.hypot(bullet.vx, bullet.vy)).toBeLessThanOrEqual(1100.001);
  });
});
