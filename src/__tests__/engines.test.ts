import { describe, expect, it } from 'vitest';
import { ArenaEngine, COURT_CENTER_X, COURT_RX } from '../game/arenaEngine';
import { CHAIN_LEVELS, ChainPanicEngine } from '../game/chainPanicEngine';
import { PUTT_HOLES, PuttWarEngine } from '../game/puttWarEngine';
import { MultiplayerRoomManager } from '../net/multiplayerRoom';
import { ClientInputPacket } from '../types';

const dummyInput: ClientInputPacket = {
  slotId: 0,
  name: 'ALEX',
  moveX: 0,
  moveY: 0,
  aimAngle: 0,
  parryPressed: false,
  chargingParry: false,
  dashPressed: false,
  emotePressed: 0,
  clientBallDist: 999
};

describe('ArenaEngine (01 // BASH-BOT)', () => {
  it('evaluates bot parry decision only ONCE per ball pass (preventing 60fps per-frame god-mode)', () => {
    const engine = new ArenaEngine();
    const bot = engine.players[1];
    const ball = engine.balls[0];

    ball.targetId = bot.id;
    ball.passId = 42;
    // Place ball within trigger distance
    ball.x = bot.x + 20;
    ball.y = bot.y;

    // Force bot to miss on this pass
    bot.botEvaluatedPassId = 42;
    bot.botWillParry = false;
    bot.botTriggerDist = 60;

    // Step 10 frames: bot must NOT re-roll botWillParry on subsequent frames of the same passId
    for (let i = 0; i < 10; i++) {
      engine.step(0.016, dummyInput);
      if (ball.passId === 42) {
        expect(bot.botWillParry).toBe(false);
      }
    }
  });

  it('disables all bots when botDifficulty is set to OFF and allows solo wall rally', () => {
    const engine = new ArenaEngine();
    engine.botDifficulty = 'OFF';
    engine.spawnRound();

    expect(engine.players[0].alive).toBe(true);
    expect(engine.players[1].alive).toBe(false);
    expect(engine.players[2].alive).toBe(false);
    expect(engine.players[3].alive).toBe(false);

    // Simulate human hitting ball and ball bouncing off outer arena wall
    const ball = engine.balls[0];
    ball.ownerId = 0;
    ball.x = COURT_CENTER_X + COURT_RX + 20;
    engine.step(0.016, dummyInput);

    // Wall bounce resets ownerId so solo player can parry again
    expect(ball.ownerId).toBe(-1);
  });

  it('executes Feint / Amago Curvo shot when feintPrimed is active', () => {
    const engine = new ArenaEngine();
    const human = engine.players[0];
    const ball = engine.balls[0];

    human.feintPrimed = true;
    human.parryTimer = 0.2;
    ball.ownerId = 1;
    ball.speed = 500;
    ball.x = human.x + 15;
    ball.y = human.y;

    engine.step(0.016, dummyInput);

    expect(ball.isFeint).toBe(true);
    expect(ball.speed).toBeLessThan(500);
    expect(Math.abs(ball.curveSpin)).toBeGreaterThan(2.0);
  });

  it('rolls back a lethal K.O. when a remote player parry packet arrives within the 280ms lag-compensation window', () => {
    const engine = new ArenaEngine();
    const remotePlayer = engine.players[1];
    remotePlayer.isBot = false;
    remotePlayer.alive = false;
    remotePlayer.lastKOAt = performance.now() - 60; // Knocked out 60ms ago on Host

    engine.applyRemoteInput({
      ...dummyInput,
      slotId: 1,
      name: 'CARLOS',
      parryPressed: true,
      clientBallDist: 38 // Ball was within parry reach on Carlos's screen!
    });

    expect(remotePlayer.alive).toBe(true);
    expect(engine.balls[0].ownerId).toBe(1);
  });
});

describe('ChainPanicEngine (02 // CHAIN-PANIC)', () => {
  it('loads all 6 industrial sectors without errors', () => {
    const engine = new ChainPanicEngine();
    expect(CHAIN_LEVELS.length).toBe(6);

    for (let i = 0; i < CHAIN_LEVELS.length; i++) {
      engine.loadLevel(i);
      expect(engine.levelIndex).toBe(i);
      expect(() => engine.step(0.016, dummyInput)).not.toThrow();
    }
  });

  it('rescues a dangling teammate when [E] Cable Yank is triggered', () => {
    const engine = new ChainPanicEngine();
    const p0 = engine.players[0];
    const p1 = engine.players[1];

    p1.isDangling = true;
    p1.x = p0.x + 60;
    p1.y = p0.y;
    p1.vz = 0;

    engine.triggerCableYank(p0);
    expect(p1.vz).toBeGreaterThan(100);
    expect(p1.vx).toBeLessThan(0);
  });

  it('removes bots and latches switches when botsEnabled is false (SIN BOTS)', () => {
    const engine = new ChainPanicEngine();
    engine.syncPlayerIdentities(
      [
        { name: 'ALEX', isBot: false },
        { name: 'LEO', isBot: true },
        { name: 'MAX', isBot: true },
        { name: 'NICO', isBot: true }
      ],
      false
    );

    const active = engine.getActivePlayers();
    expect(active.length).toBe(1);
    expect(active[0].name).toBe('ALEX');

    // Step on switch 0 then walk away -> switch 0 must stay latched for solo player!
    const sw0 = engine.switches[0];
    active[0].x = sw0.x;
    active[0].y = sw0.y;
    engine.step(0.016, dummyInput);
    expect(sw0.pressed).toBe(true);

    active[0].x = 100;
    active[0].y = 260;
    engine.step(0.016, dummyInput);
    expect(sw0.pressed).toBe(true);
  });
});

describe('PuttWarEngine (03 // TURBO-PUTT)', () => {
  it('loads all 6 combat mini-golf holes without errors', () => {
    const engine = new PuttWarEngine();
    expect(PUTT_HOLES.length).toBe(6);

    for (let i = 0; i < PUTT_HOLES.length; i++) {
      engine.loadHole(i);
      expect(engine.holeIndex).toBe(i);
      expect(() => engine.step(0.016, dummyInput)).not.toThrow();
    }
  });

  it('executes putt, lobs Worms proximity mine, and blasts rival balls on detonation', () => {
    const engine = new PuttWarEngine();
    const p0 = engine.players[0];
    const p1 = engine.players[1];

    engine.executePutt(p0, 0.75, 0);
    expect(p0.strokes).toBe(1);
    expect(p0.vx).toBeGreaterThan(200);

    // Place rival p1 near p0 and lob a bomb
    p1.x = p0.x + 28;
    p1.y = p0.y;
    p1.vx = 0;
    p1.vy = 0;

    engine.lobBombOrWeapon(p0);
    expect(engine.bombs.length).toBe(1);

    // Force bomb timer to expire and step physics
    engine.bombs[0].timer = 0.01;
    engine.step(0.02, dummyInput);

    expect(engine.bombs.length).toBe(0);
    expect(Math.hypot(p1.vx, p1.vy)).toBeGreaterThan(150);
  });

  it('awards points and starts Hurry-Up countdown when a ball sinks into the cup', () => {
    const engine = new PuttWarEngine();
    const p0 = engine.players[0];

    p0.x = engine.cupX + 2;
    p0.y = engine.cupY;
    p0.vx = 20;
    p0.vy = 0;
    p0.strokes = 2;

    engine.step(0.016, dummyInput);

    expect(p0.sunkInCup).toBe(true);
    expect(p0.totalPoints).toBeGreaterThanOrEqual(3);
    expect(engine.hurryActive).toBe(true);
  });
});

describe('MultiplayerRoomManager Anti-Freeze Watchdog & Moderation', () => {
  it('always steps locally if Host snapshots time out (>2000ms)', () => {
    const arena = new ArenaEngine();
    const chain = new ChainPanicEngine();
    const net = new MultiplayerRoomManager(arena, chain, () => {});

    expect(net.shouldStepLocally()).toBe(true);

    // Even if marked as client, if no snapshot arrived recently, shouldStepLocally returns true
    net.isHost = false;
    expect(net.shouldStepLocally()).toBe(true);
  });

  it('allows Host to kick & ban a remote player slot and reset it to a bot', () => {
    const arena = new ArenaEngine();
    const chain = new ChainPanicEngine();
    const net = new MultiplayerRoomManager(arena, chain, () => {});

    // Simulate a remote player in slot 1
    arena.players[1].isBot = false;
    arena.players[1].peerId = 'P-GRIEFER';
    arena.players[1].name = 'TROLL';

    const kicked = net.kickPlayerSlot(1);
    expect(kicked).toBe(true);
    expect(net.bannedPeerIds.has('P-GRIEFER')).toBe(true);
    expect(arena.players[1].isBot).toBe(true);
  });

  it('tracks peer join & leave cleanly and notifies all players with toasts', () => {
    const arena = new ArenaEngine();
    const chain = new ChainPanicEngine();
    const net = new MultiplayerRoomManager(arena, chain, () => {});

    // Simulate incoming JOIN_CLAIM from friend P-FRIEND1
    (net as unknown as { handleEnvelope: (env: unknown, reply: () => void) => void }).handleEnvelope(
      {
        sender: 'P-FRIEND1',
        type: 'JOIN_CLAIM',
        payload: { peerId: 'P-FRIEND1', name: 'MATEO' }
      },
      () => {}
    );

    expect(arena.players[1].isBot).toBe(false);
    expect(arena.players[1].name).toBe('MATEO');
    expect(net.toasts.some((t) => t.text.includes('MATEO SE UNIÓ'))).toBe(true);

    // Simulate P-FRIEND1 leaving the room (PEER_LEAVE)
    (net as unknown as { handleEnvelope: (env: unknown, reply: () => void) => void }).handleEnvelope(
      {
        sender: 'P-FRIEND1',
        type: 'PEER_LEAVE',
        payload: { peerId: 'P-FRIEND1' }
      },
      () => {}
    );

    expect(arena.players[1].isBot).toBe(true);
    expect(net.toasts.some((t) => t.text.includes('MATEO SALIÓ'))).toBe(true);
  });
});
