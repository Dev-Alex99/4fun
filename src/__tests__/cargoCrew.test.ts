import { describe, expect, it } from 'vitest';
import { CargoCrewEngine } from '../game/cargoCrewEngine';
import { ArenaEngine } from '../game/arenaEngine';
import { validSnapshot } from '../net/protocol';
import type { ClientInputPacket } from '../types';
const idle: ClientInputPacket = { slotId: 0, name: 'ALEX', moveX: 0, moveY: 0, aimAngle: 0, parryPressed: false,
  chargingParry: false, dashPressed: false, emotePressed: 0, clientBallDist: 999 };

describe('CARGO-CREW cooperative route', () => {
  it('finishes the entire route through normal movement, grips, automatic helpers and reactor locks', () => {
    const engine = new CargoCrewEngine();
    for (let tick = 0; tick < 12000 && engine.status !== 'ROUTE_COMPLETE'; tick++) {
      const dy = 260 - engine.battery.y;
      const p = engine.players[0];
      if (engine.status === 'PLAYING' && !p.gripping && Math.hypot(p.x - engine.battery.x, p.y - engine.battery.y) < 86) engine.triggerGrip(p);
      engine.step(1 / 60, { ...idle, moveX: Math.abs(dy) > 35 ? 0 : 1,
        moveY: Math.abs(dy) > 8 ? Math.max(-1, Math.min(1, dy / 30)) : 0 });
    }
    expect(engine.status).toBe('ROUTE_COMPLETE');
    expect(engine.stageTimes).toHaveLength(3);
    expect(engine.switches.every(sw => sw.pressed)).toBe(true);
    expect(engine.elapsedSeconds).toBeGreaterThan(15);
  });
  it('hauls a heavy battery with real inputs and bot assistance across the first conveyor stage', () => {
    const engine = new CargoCrewEngine();
    engine.triggerGrip(engine.players[0]);
    for (let tick = 0; tick < 2400 && engine.status === 'PLAYING'; tick++) {
      const targetY = 260;
      const dy = targetY - engine.battery.y;
      // Lead the load through the central corridor instead of dragging it into the conveyor-side pits.
      const moveY = Math.abs(dy) > 8 ? Math.max(-1, Math.min(1, dy / 30)) : 0;
      const moveX = Math.abs(dy) > 35 ? 0 : 1;
      const p = engine.players[0];
      if (!p.gripping && Math.hypot(p.x - engine.battery.x, p.y - engine.battery.y) < 86) engine.triggerGrip(p);
      engine.step(1 / 60, { ...idle, moveX, moveY });
    }
    expect(engine.status).toBe('STAGE_CLEAR');
    expect(engine.battery.delivered).toBe(true);
    expect(engine.matchStats[0].deliveries).toBe(1);
    expect(engine.stageTimes[0]).toBeGreaterThan(4);
  });

  it('requires both reactor locks, completes exactly three deliveries and freezes the final result', () => {
    const engine = new CargoCrewEngine();
    engine.botsEnabled = false;
    for (let stage = 0; stage < 3; stage++) {
      expect(engine.stageIndex).toBe(stage);
      engine.battery.x = 860; engine.battery.y = 260;
      engine.players[0].x = 820; engine.players[0].y = 260;
      if (stage === 2) {
        engine.step(0.01, idle);
        expect(engine.status).toBe('PLAYING');
        expect(engine.battery.delivered).toBe(false);
        expect(engine.gateOpen).toBe(false);
        engine.switches.forEach(sw => { sw.pressed = true; });
        engine.battery.x = 860;
      }
      engine.step(0.01, idle);
      expect(engine.stageTimes).toHaveLength(stage + 1);
      if (stage < 2) engine.step(2.1, idle);
    }
    expect(engine.status).toBe('ROUTE_COMPLETE');
    const elapsed = engine.elapsedSeconds;
    engine.step(100, idle);
    expect(engine.elapsedSeconds).toBe(elapsed);
    expect(engine.matchStats[0].deliveries).toBe(3);
  });

  it('repairs only nearby with a cooldown and restores a damaged load at its checkpoint', () => {
    const engine = new CargoCrewEngine(); engine.botsEnabled = false;
    const p = engine.players[0];
    engine.integrity = 30; p.x = 800; p.y = 400;
    engine.triggerRepair(p); expect(engine.integrity).toBe(30);
    p.x = engine.battery.x - 40; p.y = engine.battery.y;
    engine.triggerRepair(p); expect(engine.integrity).toBe(42);
    engine.triggerRepair(p); expect(engine.integrity).toBe(42);
    engine.loadStage(1, true); engine.integrity = 20; engine.stageSeconds = 5.1;
    engine.battery.x = 600; engine.battery.y = 260;
    engine.step(1.01, idle); // damage immunity expires while crane is still descending
    expect(engine.status).toBe('RECOVERING');
    engine.step(2.1, idle);
    expect(engine.integrity).toBe(100);
    expect(engine.checkpoint).toBe(true);
    expect(engine.battery.x).toBe(530);
    expect(engine.retries).toBe(1);
  });

  it('deduplicates remote grip actions and never delivers or damages cargo during prediction', () => {
    const engine = new CargoCrewEngine(); engine.players[1].isBot = false;
    const input = { ...idle, slotId: 1, actionSeq: 1, parryPressed: true };
    engine.applyRemoteInput(input); expect(engine.players[1].gripping).toBe(true);
    engine.applyRemoteInput(input); expect(engine.players[1].gripping).toBe(true);
    const client = new CargoCrewEngine(); client.applySnapshot(engine.getSnapshot(), 1);
    client.battery.x = 860;
    client.stepClientPrediction(0.1, 1, idle);
    expect(client.status).toBe('PLAYING');
    expect(client.stageTimes).toEqual([]);
    expect(client.integrity).toBe(100);
    engine.clearRemoteInput(1); expect(engine.players[1].gripping).toBe(false);
  });

  it('validates cargo snapshots and rejects invalid stage indices and input fields', () => {
    const engine = new CargoCrewEngine();
    const snapshot = { ...new ArenaEngine().getSnapshot(), activeGame: 'CARGO_CREW', stateSeq: 1, snapshotSeq: 1,
      hostEpoch: 'host', cargoState: engine.getSnapshot() };
    expect(validSnapshot(snapshot)).toBe(true);
    for (const patch of [{ stageIndex: 3 }, { integrity: -1 }, { checkpoint: 'yes' }, { battery: null }, { stageTimes: [NaN] }]) {
      expect(validSnapshot({ ...snapshot, cargoState: { ...snapshot.cargoState, ...patch } })).toBe(false);
    }
  });
});
