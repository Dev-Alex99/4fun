import { beforeEach, describe, expect, it } from 'vitest';
import { PlayerProgressStore } from '../game/playerProgress';
import { emptyMatchStats, makeSessionResult, validSessionResult } from '../game/matchResults';
import { ArenaEngine } from '../game/arenaEngine';
import { RicochetEngine } from '../game/ricochetEngine';
import type { ClientInputPacket } from '../types';

const result = (id: string) => makeSessionResult({ id, gameId: 'CHAIN_PANIC', title: 'EXPEDICIÓN', cooperative: true,
  durationSeconds: 120, winnerSlots: [0], players: [{ slot: 0, name: 'ALEX', isBot: false, score: 6,
    stats: { ...emptyMatchStats(), rescues: 3, perfectParries: 10 } }] });
beforeEach(() => localStorage.clear());

describe('Confirmed feats and local progression', () => {
  it('persists records and unlocks without counting repeated snapshots or bot results twice', () => {
    const store = new PlayerProgressStore();
    expect(store.record(result('one'), 0)).toEqual(['RESCUE', 'CHROME']);
    expect(store.record(result('one'), 0)).toEqual([]);
    expect(store.data.played).toBe(1);
    const reload = new PlayerProgressStore();
    expect(reload.data.bestTimes.CHAIN_PANIC).toBe(120);
    reload.record({ ...result('two'), durationSeconds: 150 }, 0);
    reload.record({ ...result('three'), durationSeconds: 100 }, 0);
    expect(reload.data.bestTimes.CHAIN_PANIC).toBe(100);
    expect(reload.unlockedSkins).toContain('CHAMPION');
    expect(reload.data.played).toBe(3);
    reload.record({ ...result('bot'), players: [{ ...result('bot').players[0], isBot: true }] }, 0);
    expect(reload.data.played).toBe(3);
  });

  it('shows tied feats fairly, validates network results and recovers from corrupt local data', () => {
    const shared = result('shared');
    shared.players.push({ ...shared.players[0], slot: 1, name: 'MATEO', stats: { ...shared.players[0].stats } });
    const awards = makeSessionResult(shared);
    expect(awards.highlights.filter(h => h.title === 'MANO AMIGA').map(h => h.slot)).toEqual([0, 1]);
    expect(validSessionResult(awards, ['CHAIN_PANIC'])).toBe(true);
    expect(validSessionResult({ ...awards, winnerSlots: [3] }, ['CHAIN_PANIC'])).toBe(false);
    localStorage.setItem('tp04_progress_v1', '{"version":1,"wins":-1}');
    expect(new PlayerProgressStore().data.played).toBe(0);
  });

  it('counts actual host parries while client prediction cannot earn result statistics', () => {
    const host = new ArenaEngine();
    const player = host.players[0], ball = host.balls[0];
    player.parryTimer = 0.24;
    Object.assign(ball, { x: player.x, y: player.y, vx: 0, vy: 0, targetId: 0 });
    const idle: ClientInputPacket = { slotId: 0, name: 'ALEX', moveX: 0, moveY: 0, aimAngle: 0,
      parryPressed: false, chargingParry: false, dashPressed: false, emotePressed: 0, clientBallDist: 999 };
    host.step(0.001, idle);
    expect(host.matchStats[0].perfectParries).toBe(1);
    const client = new RicochetEngine(); client.players[0].parryTimer = 1;
    Object.assign(client.bullets[0], { x: client.players[0].x, y: client.players[0].y, vx: 0, vy: 0 });
    client.stepClientPrediction(0.01, 0, idle);
    expect(client.matchStats[0].perfectParries).toBe(0);
  });
});
