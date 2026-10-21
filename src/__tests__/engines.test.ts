import { describe, expect, it } from 'vitest';
import { ArenaEngine, COURT_CENTER_X, COURT_RX } from '../game/arenaEngine';
import { CHAIN_LEVELS, ChainPanicEngine } from '../game/chainPanicEngine';
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

describe('MultiplayerRoomManager Anti-Freeze Watchdog', () => {
  it('always steps locally if Host snapshots time out (>2000ms)', () => {
    const arena = new ArenaEngine();
    const chain = new ChainPanicEngine();
    const net = new MultiplayerRoomManager(arena, chain, () => {});

    expect(net.shouldStepLocally()).toBe(true);

    // Even if marked as client, if no snapshot arrived recently, shouldStepLocally returns true
    net.isHost = false;
    expect(net.shouldStepLocally()).toBe(true);
  });
});
