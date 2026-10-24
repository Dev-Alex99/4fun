import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { PuttWarEngine } from '../game/puttWarEngine';
import { HotCoreEngine } from '../game/hotCoreEngine';
import { VoltCrownEngine } from '../game/voltCrownEngine';
import { HexCrushEngine } from '../game/hexCrushEngine';
import { RicochetEngine } from '../game/ricochetEngine';
import { TournamentManager } from '../game/tournamentManager';
import { MultiplayerRoomManager } from '../net/multiplayerRoom';
import type { ActiveGameId, ClientInputPacket } from '../types';

/**
 * This simulator intentionally drops complete application messages and injects duplicates/reordering.
 * Real production WebRTC uses a reliable channel: these are adversarial protocol tests, not SCTP,
 * TURN throughput measurements, browser benchmarks, or evidence of zero visual stutter.
 */
const wire = vi.hoisted(() => {
  type Profile = { rtt: number; jitter: number; loss: number };
  class Events {
    listeners = new Map<string, ((...args: any[]) => void)[]>();
    on(event: string, callback: (...args: any[]) => void) { this.listeners.set(event, [...(this.listeners.get(event) || []), callback]); return this; }
    emit(event: string, ...args: any[]) { for (const callback of this.listeners.get(event) || []) callback(...args); }
  }
  let profile: Profile = { rtt: 0, jitter: 0, loss: 0 };
  let rngState = 1;
  let order = 0;
  const random = () => { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296; };
  const peers = new Map<string, Peer>();
  const queue: { at: number; order: number; destination: Connection; raw: string }[] = [];
  const blocked = new Set<string>();
  const stats = { sent: 0, lost: 0, duplicated: 0, delivered: 0, reordered: 0 };
  let lastDeliveredOrder = 0;
  let observer: ((owner: string, raw: string, deliver: () => void) => void) | undefined;
  class Connection extends Events {
    open = false;
    other?: Connection;
    dataChannel = { bufferedAmount: 0 };
    bufferSize = 0;
    constructor(public owner: string, public peer: string) { super(); }
    send(raw: string) {
      if (!this.open || !this.other) return;
      stats.sent++;
      if (random() < profile.loss) { stats.lost++; return; }
      const delay = Math.max(0, profile.rtt / 2 + (random() * 2 - 1) * profile.jitter);
      queue.push({ at: performance.now() + delay, order: ++order, destination: this.other, raw });
      if (profile.rtt && random() < 0.08) {
        stats.duplicated++;
        queue.push({ at: performance.now() + delay + 5 + random() * profile.jitter, order: ++order, destination: this.other, raw });
      }
    }
    close() {
      if (!this.open) return;
      this.open = false; this.emit('close');
      if (this.other?.open) { this.other.open = false; this.other.emit('close'); }
    }
  }
  class Peer extends Events {
    destroyed = false;
    disconnected = false;
    connections: Connection[] = [];
    constructor(public id: string, public options: unknown) {
      super(); peers.set(id, this); setTimeout(() => { if (!this.destroyed) this.emit('open'); }, 0);
    }
    connect(id: string) {
      const client = new Connection(this.id, id), server = new Connection(id, this.id);
      this.connections.push(client);
      const host = peers.get(id);
      if (!host) { setTimeout(() => client.emit('error'), 0); return client; }
      host.connections.push(server);
      client.other = server; server.other = client;
      host.emit('connection', server);
      setTimeout(() => {
        if (this.destroyed || host.destroyed) return;
        server.open = true; server.emit('open'); client.open = true; client.emit('open');
      }, 0);
      return client;
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      if (peers.get(this.id) === this) peers.delete(this.id);
      for (const connection of this.connections) connection.close();
    }
    reconnect() { this.disconnected = false; }
  }
  function pump() {
    queue.sort((a, b) => a.at - b.at || a.order - b.order);
    let budget = 10000;
    while (queue[0] && queue[0].at <= performance.now() && budget-- > 0) {
      const packet = queue.shift()!;
      if (blocked.has(packet.destination.owner) || blocked.has(packet.destination.peer)) {
        packet.at = performance.now() + 10; queue.push(packet); queue.sort((a, b) => a.at - b.at || a.order - b.order); continue;
      }
      if (!packet.destination.open) continue;
      stats.delivered++;
      if (packet.order < lastDeliveredOrder) stats.reordered++;
      lastDeliveredOrder = Math.max(lastDeliveredOrder, packet.order);
      const deliver = () => packet.destination.emit('data', packet.raw);
      if (observer) observer(packet.destination.owner, packet.raw, deliver); else deliver();
      queue.sort((a, b) => a.at - b.at || a.order - b.order);
    }
  }
  function stall(id: string, value: boolean) {
    if (value) blocked.add(id); else blocked.delete(id);
    for (const peer of peers.values()) for (const c of peer.connections) {
      if (c.owner === id || c.peer === id) c.dataChannel.bufferedAmount = value ? 16384 : 0;
    }
  }
  function reset(seed = 1) {
    peers.clear(); queue.length = 0; blocked.clear(); rngState = seed; order = 0; lastDeliveredOrder = 0; observer = undefined;
    profile = { rtt: 0, jitter: 0, loss: 0 };
    for (const key of Object.keys(stats) as (keyof typeof stats)[]) stats[key] = 0;
  }
  return { Peer, peers, queue, stats, pump, stall, reset, observe: (value: typeof observer) => { observer = value; }, setProfile: (value: Profile) => { profile = value; } };
});

vi.mock('peerjs', () => ({ default: wire.Peer }));

const GAMES: Exclude<ActiveGameId, 'HUB'>[] = ['BASH_BOT', 'CHAIN_PANIC', 'TURBO_PUTT', 'HOT_CORE', 'VOLT_CROWN', 'HEX_CRUSH', 'RICOCHET_1'];
const PROFILES = [{ rtt: 100, jitter: 20, loss: 0.01 }, { rtt: 200, jitter: 60, loss: 0.05 }, { rtt: 350, jitter: 100, loss: 0.1 }];
const SEEDS = [17, 91];
const DT = 1 / 60;
const all: MultiplayerRoomManager[] = [];
function instance() {
  const arena = new ArenaEngine(), chain = new ChainPanicEngine(), putt = new PuttWarEngine(), hot = new HotCoreEngine();
  const volt = new VoltCrownEngine(), hex = new HexCrushEngine(), rico = new RicochetEngine(), tournament = new TournamentManager();
  const net = new MultiplayerRoomManager(arena, chain, () => {}, putt, hot, volt, hex, tournament, rico);
  all.push(net);
  return { net, arena, chain, putt, hot, volt, hex, rico, tournament };
}
type Room = ReturnType<typeof instance>;
function engine(room: Room) {
  switch (room.net.activeGame) {
    case 'CHAIN_PANIC': return room.chain;
    case 'TURBO_PUTT': return room.putt;
    case 'HOT_CORE': return room.hot;
    case 'VOLT_CROWN': return room.volt;
    case 'HEX_CRUSH': return room.hex;
    case 'RICOCHET_1': return room.rico;
    default: return room.arena;
  }
}
function packet(room: Room, moveX = 0): ClientInputPacket {
  return { slotId: room.net.localSlotId, name: `UNIT${room.net.localSlotId}`, moveX, moveY: 0, aimAngle: 0, parryPressed: false,
    chargingParry: false, dashPressed: false, emotePressed: 0, clientBallDist: 999, roundEpoch: room.net.activeRoundEpoch };
}
function advance(milliseconds: number) {
  const target = performance.now() + Math.ceil(milliseconds);
  while (performance.now() < target) { vi.advanceTimersByTime(Math.min(10, target - performance.now())); wire.pump(); }
}
function room() {
  const host = instance(); host.net.hostRoom('LOAD', 'HOST');
  const clients = [instance(), instance(), instance()];
  clients.forEach((c, i) => c.net.joinRoomAsClient('LOAD', `UNIT${i + 1}`));
  advance(100);
  expect(clients.map(c => c.net.localSlotId)).toEqual([1, 2, 3]);
  expect(clients.every(c => c.net.isSynchronized)).toBe(true);
  return { host, clients };
}
function critical(room: Room) {
  return engine(room).players.map(p => Object.fromEntries(Object.entries(p).filter(([key]) =>
    ['alive', 'lives', 'score', 'strokes', 'totalPoints', 'sunkInCup'].includes(key))));
}
function error(host: Room, client: Room) {
  const id = client.net.localSlotId, a = engine(host).players[id], b = engine(client).players[id];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function finitePlayers(room: Room) {
  return engine(room).players.every(p => [p.x, p.y, p.vx, p.vy].every(Number.isFinite));
}
function tick(host: Room, clients: Room[], movement: number, simulateHost = true) {
  for (const c of clients) {
    const input = packet(c, movement);
    if (c.net.isSynchronized) {
      const before = critical(c);
      engine(c).stepClientPrediction(DT, c.net.localSlotId, input);
      expect(critical(c), `${c.net.activeGame}: prediction changed authoritative results`).toEqual(before);
    }
    c.net.sendClientInput(input);
  }
  if (simulateHost) engine(host).step(DT, packet(host));
  host.net.broadcastHostSnapshot();
  advance(1000 / 60);
}
function quiesce(host: Room) {
  for (const p of engine(host).players) { p.vx = 0; p.vy = 0; if ('vz' in p) p.vz = 0; }
}
function disposeAll() { for (const net of all.splice(0)) net.dispose(); wire.reset(); vi.clearAllTimers(); }
type Metrics = { seed: number; game: string; rtt: number; jitter: number; loss: number; p95: number; maximum: number; recovered: number;
  correctionP95: number; correctionMax: number; remoteCorrectionP95: number; remoteCorrectionMax: number };
const metrics: Metrics[] = [];
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.95)] ?? 0;
const rounded = (value: number) => +value.toFixed(2);

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] }); wire.reset(); });
afterEach(() => { disposeAll(); vi.restoreAllMocks(); vi.useRealTimers(); });
afterAll(() => {
  const report = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env.NET_STRESS_REPORT;
  if (!report || !metrics.length) return;
  const summary = PROFILES.map(profile => {
    const rows = metrics.filter(row => row.rtt === profile.rtt);
    return { ...profile, scenarios: rows.length, worstMovingP95Px: rounded(Math.max(...rows.map(row => row.p95))),
      worstMovingMaxPx: rounded(Math.max(...rows.map(row => row.maximum))), recoveredAfter2sPx: rounded(Math.max(...rows.map(row => row.recovered))),
      localSnapshotJumpP95Px: rounded(Math.max(...rows.map(row => row.correctionP95))), localSnapshotJumpMaxPx: rounded(Math.max(...rows.map(row => row.correctionMax))),
      remoteSnapshotJumpP95Px: rounded(Math.max(...rows.map(row => row.remoteCorrectionP95))), remoteSnapshotJumpMaxPx: rounded(Math.max(...rows.map(row => row.remoteCorrectionMax))) };
  });
  console.info('NETWORK_STRESS_SUMMARY', JSON.stringify(summary));
  if (report === '2') console.info('NETWORK_STRESS_DETAILS', JSON.stringify(metrics));
});

describe('four-player deterministic network stress', () => {
  for (const profile of PROFILES) it(`recovers all seven games at RTT ${profile.rtt}, jitter ±${profile.jitter}, loss ${profile.loss * 100}% for two seeds`, () => {
    for (const seed of SEEDS) for (const game of GAMES) {
      wire.reset(seed);
      let physicsSeed = seed;
      const random = vi.spyOn(Math, 'random').mockImplementation(() => { physicsSeed = (Math.imul(physicsSeed, 1664525) + 1013904223) >>> 0; return physicsSeed / 4294967296; });
      const { host, clients } = room();
      host.net.switchGame(game); advance(30);
      const received = vi.spyOn(engine(host), 'applyRemoteInput');
      const snapshots = clients.map(c => vi.spyOn(engine(c), 'applySnapshot'));
      const corrections: number[] = [], remoteCorrections: number[] = [];
      wire.observe((owner, raw, deliver) => {
        const c = clients.find(client => client.net.localPeerId === owner);
        if (!c || JSON.parse(raw).type !== 'WORLD_SNAP') { deliver(); return; }
        const before = engine(c).players.map(p => ({ x: p.x, y: p.y }));
        const sequenceBefore = (c.net as unknown as { lastSnapshotSeq: number }).lastSnapshotSeq;
        deliver();
        if ((c.net as unknown as { lastSnapshotSeq: number }).lastSnapshotSeq === sequenceBefore) return;
        engine(c).players.forEach((p, id) => {
          const correction = Math.hypot(p.x - before[id].x, p.y - before[id].y);
          (id === c.net.localSlotId ? corrections : remoteCorrections).push(correction);
        });
      });
      wire.setProfile(profile);
      const errors: number[] = [];
      for (let frame = 0; frame < 90; frame++) {
        tick(host, clients, frame < 45 ? 0.25 : 0);
        for (const c of clients) if (c.net.activeGame === game) errors.push(error(host, c));
        expect(finitePlayers(host), game).toBe(true);
        expect(clients.every(finitePlayers), game).toBe(true);
      }
      expect(received.mock.calls.length, `${game}: inputs never reached host`).toBeGreaterThan(8);
      for (const snapshot of snapshots) expect(snapshot.mock.calls.length, `${game}: snapshots never applied`).toBeGreaterThan(8);
      quiesce(host);
      for (let frame = 0; frame < 120; frame++) tick(host, clients, 0, false);
      const recovered = Math.max(...clients.map(c => error(host, c)));
      expect(recovered, `${game}, seed ${seed}, RTT ${profile.rtt}: did not converge after stopping`).toBeLessThan(32);
      for (const c of clients) {
        expect(critical(c), `${game}: host results diverged`).toEqual(critical(host));
        expect(c.net.localSlotId).toBeGreaterThan(0); expect(c.net.isSynchronized).toBe(true);
      }
      errors.sort((a, b) => a - b);
      metrics.push({ seed, game, ...profile, p95: rounded(p95(errors)), maximum: rounded(Math.max(...errors)), recovered: rounded(recovered),
        correctionP95: rounded(p95(corrections)), correctionMax: rounded(Math.max(...corrections)),
        remoteCorrectionP95: rounded(p95(remoteCorrections)), remoteCorrectionMax: rounded(Math.max(...remoteCorrections)) });
      expect(wire.stats.lost).toBeGreaterThan(0); expect(wire.stats.duplicated).toBeGreaterThan(0); expect(wire.stats.reordered).toBeGreaterThan(0);
      random.mockRestore(); disposeAll();
    }
  }, 30000);

  it('keeps full-speed local movement responsive at 350 and 600 ms: no RTT-sized lag, slide or pull-back', () => {
    const report: Record<string, { travel30: number; slide: number; correctionP95: number }> = {};
    for (const rtt of [350, 600]) for (const game of ['BASH_BOT', 'HOT_CORE', 'VOLT_CROWN', 'RICOCHET_1'] as const) {
      wire.reset(29);
      let physicsSeed = 29;
      const random = vi.spyOn(Math, 'random').mockImplementation(() => { physicsSeed = (Math.imul(physicsSeed, 1664525) + 1013904223) >>> 0; return physicsSeed / 4294967296; });
      const { host, clients } = room();
      host.net.sendOrApplyRoomAction({ kind: 'BOT_DIFF', botDifficulty: 'OFF' });
      host.net.switchGame(game); advance(30);
      if (game === 'BASH_BOT') host.arena.balls = [];
      // Separate lanes so the guests never collide with each other while running.
      engine(host).players.forEach((p, id) => { p.x = 300; p.y = 160 + id * 70; p.vx = 0; p.vy = 0; });
      host.net.broadcastHostSnapshot(true);
      wire.setProfile({ rtt, jitter: Math.round(rtt * 0.15), loss: 0.01 });
      // Idle long enough for both sides to measure the link, as in a real lobby.
      for (let frame = 0; frame < 240; frame++) tick(host, clients, 0);
      const corrections: number[] = [];
      wire.observe((owner, raw, deliver) => {
        const c = clients.find(client => client.net.localPeerId === owner);
        if (!c || JSON.parse(raw).type !== 'WORLD_SNAP') { deliver(); return; }
        const me = () => engine(c).players[c.net.localSlotId];
        const before = { x: me().x, y: me().y }, sequenceBefore = (c.net as unknown as { lastSnapshotSeq: number }).lastSnapshotSeq;
        deliver();
        if ((c.net as unknown as { lastSnapshotSeq: number }).lastSnapshotSeq !== sequenceBefore) corrections.push(Math.hypot(me().x - before.x, me().y - before.y));
      });
      const xs: number[][] = clients.map(() => []);
      for (let frame = 0; frame < 160; frame++) {
        tick(host, clients, frame < 70 ? 1 : 0);
        clients.forEach((c, i) => xs[i].push(engine(c).players[c.net.localSlotId].x));
      }
      corrections.sort((a, b) => a - b);
      const row = {
        // Distance covered in the first half second of holding the stick: equal to a zero-latency player.
        travel30: rounded(Math.min(...xs.map(x => x[29] - x[0]))),
        // Extra glide after releasing: the old velocity lead kept dragging the robot ~60 px at 350 ms.
        slide: rounded(Math.max(...xs.map(x => Math.max(...x.slice(70).map(v => v - x[69]))))),
        correctionP95: rounded(p95(corrections))
      };
      report[`${game}@${rtt}`] = row;
      expect(row.travel30, `${game}@${rtt}: local input lagged`).toBeGreaterThan(45);
      expect(row.slide, `${game}@${rtt}: robot kept sliding after release`).toBeLessThan(36);
      expect(row.correctionP95, `${game}@${rtt}: snapshot corrections`).toBeLessThan(6);
      expect(clients.every(c => c.net.isSynchronized), game).toBe(true);
      quiesce(host);
      for (let frame = 0; frame < 120; frame++) tick(host, clients, 0, false);
      expect(Math.max(...clients.map(c => error(host, c))), `${game}@${rtt}: did not converge`).toBeLessThan(32);
      random.mockRestore(); disposeAll();
    }
    if ((globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env.NET_STRESS_REPORT) {
      console.info('NETWORK_LOCAL_FEEL', JSON.stringify(report));
    }
  }, 30000);

  it('recovers from 500 ms and 3 s stalls, keeps three identities and preserves authoritative KO/lives/scores', () => {
    const { host, clients } = room();
    host.net.switchGame('RICOCHET_1'); advance(30);
    wire.setProfile(PROFILES[1]);
    for (const duration of [500, 3000]) {
      const target = clients[1];
      wire.stall(target.net.localPeerId, true);
      host.rico.players[2].score = 3; host.rico.players[2].lives = 1; host.rico.players[1].alive = false;
      for (let ms = 0; ms < duration; ms += 1000 / 60) tick(host, clients, 0, false);
      expect(target.net.isSynchronized).toBe(false);
      wire.stall(target.net.localPeerId, false);
      for (let frame = 0; frame < 90; frame++) tick(host, clients, 0, false);
      expect(target.net.localSlotId).toBe(2); expect(target.net.isSynchronized).toBe(true);
      for (const c of clients) expect(critical(c)).toEqual(critical(host));
      expect(host.net.connectedPeersCount).toBe(3);
    }
    const id = clients[1].net.localPeerId;
    const endpoint = wire.peers.get(id)!.connections.find(c => c.open)!; endpoint.close();
    expect(host.arena.players[2].peerId).toBe(id);
    for (let frame = 0; frame < 150; frame++) tick(host, clients, 0, false);
    expect(clients[1].net.localSlotId).toBe(2); expect(clients[1].net.isSynchronized).toBe(true);
    expect(host.rico.players[2].score).toBe(3); expect(host.rico.players[2].lives).toBe(1);
  });

  it('does not carry a congested action into another cartridge or another round', () => {
    const { host, clients } = room(); const c = clients[1];
    host.net.switchGame('TURBO_PUTT'); advance(30); wire.stall(c.net.localPeerId, true);
    c.net.sendClientInput({ ...packet(c), parryPressed: true, shotReleasedPower: 0.9 });
    wire.setProfile(PROFILES[2]); host.net.switchGame('HOT_CORE');
    for (let frame = 0; frame < 45; frame++) tick(host, clients, 0, false);
    wire.stall(c.net.localPeerId, false);
    const receive = vi.spyOn(host.hot, 'applyRemoteInput');
    for (let frame = 0; frame < 75; frame++) tick(host, clients, 0, false);
    expect(c.net.activeGame).toBe('HOT_CORE');
    expect(receive.mock.calls.every(([input]) => !input.parryPressed && !input.shotReleasedPower)).toBe(true);
    wire.stall(c.net.localPeerId, true); c.net.sendClientInput({ ...packet(c), dashPressed: true });
    host.hot.loadArena(host.hot.arenaIndex); host.net.broadcastHostSnapshot(true);
    for (let frame = 0; frame < 45; frame++) tick(host, clients, 0, false);
    wire.stall(c.net.localPeerId, false); receive.mockClear();
    for (let frame = 0; frame < 75; frame++) tick(host, clients, 0, false);
    expect(receive.mock.calls.every(([input]) => !input.dashPressed)).toBe(true);
    expect(clients.map(c => c.net.localSlotId)).toEqual([1, 2, 3]);
  });

});
