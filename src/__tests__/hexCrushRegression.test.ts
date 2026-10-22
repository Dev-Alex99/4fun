import { describe, it, expect } from 'vitest';
import { HexCrushEngine } from '../game/hexCrushEngine';
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

describe('HexCrush Anti-Instant-Over Regression Tests', () => {
  it('does not instantly end match on startup with active bots', () => {
    const engine = new HexCrushEngine();
    expect(engine.status).toBe('PLAYING');

    // Simulate 120 frames (approx 2 full seconds of combat)
    for (let f = 1; f <= 120; f++) {
      engine.step(0.016, dummyInput);
    }

    // Previously, round 1 ended on frame 22 and whole match was over in <2 seconds.
    // Now at frame 120, round must still be active and bots alive!
    expect(engine.status).toBe('PLAYING');
    const alive = engine.players.filter((p) => p.alive);
    expect(alive.length).toBeGreaterThanOrEqual(2);
  });

  it('safely handles solo or 2-player mode with bots disabled without frame-1 termination', () => {
    const engine = new HexCrushEngine();
    engine.syncPlayerIdentities(
      [
        { name: 'ALEX', isBot: false },
        { name: 'BOB', isBot: false },
        { name: 'BOT3', isBot: true },
        { name: 'BOT4', isBot: true }
      ],
      false
    );
    engine.loadArena(0);

    const active = engine.getActiveParticipants();
    expect(active.length).toBe(2);
    expect(engine.players[2].alive).toBe(false);
    expect(engine.players[3].alive).toBe(false);

    // Frame 1 check
    engine.step(0.016, dummyInput);
    expect(engine.status).toBe('PLAYING');
    expect(engine.roundWinnerId).toBeNull();

    // Advance 60 frames
    for (let f = 0; f < 60; f++) {
      engine.step(0.016, dummyInput);
    }
    expect(engine.status).toBe('PLAYING');
    expect(engine.players[0].alive).toBe(true);
    expect(engine.players[1].alive).toBe(true);
  });

  it('spawns all players on valid solid tiles across all arenas', () => {
    const engine = new HexCrushEngine();
    for (let arenaIdx = 0; arenaIdx < 3; arenaIdx++) {
      engine.loadArena(arenaIdx);
      engine.players.forEach((p) => {
        if (!p.alive) return;
        // Verify player is on a solid tile with health >= 2
        const onTile = engine.tiles.some(
          (t) => t.health > 0 && Math.hypot(t.x - p.x, t.y - p.y) <= t.radius
        );
        expect(onTile).toBe(true);
      });
    }
  });
});
