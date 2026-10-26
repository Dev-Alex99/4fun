import { describe, expect, it } from 'vitest';
import { VoltCrownEngine } from '../game/voltCrownEngine';
import type { ClientInputPacket } from '../types';
const idle: ClientInputPacket = { slotId: 0, name: 'ALEX', moveX: 0, moveY: 0, aimAngle: 0, parryPressed: false,
  chargingParry: false, dashPressed: false, emotePressed: 0, clientBallDist: 999 };

function game() {
  const engine = new VoltCrownEngine(); engine.mode = 'TEAMS';
  engine.players.forEach((p, i) => { p.isBot = false; p.x = 200 + i * 160; p.y = 160; });
  engine.traps = []; engine.bumpers = []; engine.plates = [];
  return engine;
}

describe('VOLT-CROWN shared batteries', () => {
  it('keeps charge when the crown changes between teammates and awards the whole team', () => {
    const engine = game(); engine.crown.holderId = 0;
    engine.step(1, idle);
    expect(engine.teamScores[0]).toBeCloseTo(3.6);
    expect(engine.players[2].score).toBeCloseTo(3.6);
    engine.crown.holderId = 2;
    engine.step(1, idle);
    expect(engine.teamScores[0]).toBeCloseTo(7.2);
    engine.teamScores[0] = 99;
    engine.step(0.3, idle);
    expect(engine.winningTeam).toBe(0);
    expect(engine.status).toBe('MATCH_OVER');
    expect(engine.players[0].score).toBe(100);
    const client = new VoltCrownEngine(); client.applySnapshot(engine.getSnapshot(), 1);
    expect(client.teamScores).toEqual([100, 0]);
    expect(client.winningTeam).toBe(0);
    engine.resetChampionship();
    expect(engine.teamScores).toEqual([0, 0]);
    expect(engine.mode).toBe('TEAMS');
  });

  it('does not stun, disarm or shove allies with projectiles, tackles or the king pulse', () => {
    const engine = game();
    const king = engine.players[0], ally = engine.players[2];
    king.x = 300; king.y = 220; ally.x = 305; ally.y = 220;
    engine.crown.holderId = 0;
    engine.projectiles.push({ id: 99, ownerId: 2, x: king.x, y: king.y, vx: 1, vy: 0, life: 1, isReflected: false });
    engine.step(0.01, idle);
    expect(engine.crown.holderId).toBe(0);
    expect(king.stunTimer).toBe(0);
    engine.triggerTrapOrPulse(king);
    expect(ally.stunTimer).toBe(0);
    expect(ally.vx).toBe(0);
  });

  it('keeps enemy tasers effective and preserves individual rules when teams are disabled', () => {
    const engine = game(), king = engine.players[0];
    engine.crown.holderId = 0;
    engine.projectiles.push({ id: 1, ownerId: 1, x: king.x, y: king.y, vx: 1, vy: 0, life: 1, isReflected: false });
    engine.step(0.01, idle);
    expect(engine.crown.holderId).toBeNull();
    expect(king.stunTimer).toBeGreaterThan(0);
    engine.mode = 'FFA'; engine.resetChampionship();
    expect(engine.areAllies(0, 2)).toBe(false);
    engine.crown.holderId = 0;
    engine.step(0.1, idle);
    expect(engine.players[0].score).toBeGreaterThan(0);
    expect(engine.players[2].score).toBe(0);
  });
});
