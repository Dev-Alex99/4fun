import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { PuttWarEngine } from '../game/puttWarEngine';
import { HotCoreEngine } from '../game/hotCoreEngine';
import { VoltCrownEngine } from '../game/voltCrownEngine';
import { HexCrushEngine } from '../game/hexCrushEngine';
import { RicochetEngine } from '../game/ricochetEngine';
import { TournamentManager } from '../game/tournamentManager';
import { MultiplayerRoomManager, type NetEnvelope } from '../net/multiplayerRoom';
import type { ClientInputPacket } from '../types';

const rtc = vi.hoisted(() => {
  class Events {
    handlers = new Map<string, ((...args: any[]) => void)[]>();
    on(event: string, callback: (...args: any[]) => void) { this.handlers.set(event, [...(this.handlers.get(event) || []), callback]); return this; }
    emit(event: string, ...args: any[]) { for (const callback of this.handlers.get(event) || []) callback(...args); }
  }
  const peers = new Map<string, FakePeer>();
  const pending: { target: Connection; raw: string }[] = [];
  let hold = false;
  class Connection extends Events {
    open = false;
    other?: Connection;
    sent: string[] = [];
    dataChannel = { bufferedAmount: 0 };
    bufferSize = 0;
    constructor(public peer: string) { super(); }
    send(raw: string) {
      this.sent.push(raw);
      if (this.other) {
        if (hold) pending.push({ target: this.other, raw });
        else this.other.emit('data', raw);
      }
    }
    close() {
      if (!this.open) return;
      this.open = false; this.emit('close');
      if (this.other?.open) { this.other.open = false; this.other.emit('close'); }
    }
  }
  class FakePeer extends Events {
    destroyed = false;
    disconnected = false;
    pairs: [Connection, Connection][] = [];
    constructor(public id: string, public options: unknown) { super(); peers.set(id, this); }
    connect(id: string) {
      const client = new Connection(id), server = new Connection(this.id);
      client.other = server; server.other = client;
      this.pairs.push([client, server]);
      peers.get(id)?.emit('connection', server);
      return client;
    }
    destroy() {
      this.destroyed = true;
      if (peers.get(this.id) === this) peers.delete(this.id);
      for (const [a, b] of this.pairs) { a.close(); b.close(); }
    }
    reconnect() { this.disconnected = false; }
  }
  return { peers, pending, FakePeer, Connection, setHold: (v: boolean) => { hold = v; } };
});

vi.mock('peerjs', () => ({ default: rtc.FakePeer }));

const all: MultiplayerRoomManager[] = [];
function manager() {
  const arena = new ArenaEngine(), chain = new ChainPanicEngine(), putt = new PuttWarEngine();
  const hot = new HotCoreEngine(), volt = new VoltCrownEngine(), hex = new HexCrushEngine(), rico = new RicochetEngine(), tournament = new TournamentManager();
  const net = new MultiplayerRoomManager(arena, chain, () => {}, putt, hot, volt, hex, tournament, rico);
  all.push(net);
  return { net, arena, chain, putt, hot, volt, hex, rico, tournament };
}
function host() { const h = manager(); h.net.hostRoom('TEST', 'ALEX'); return h; }
function join(name = 'MATEO') {
  const c = manager(); c.net.joinRoomAsClient('TEST', name);
  open(c.net);
  return c;
}
function open(net: MultiplayerRoomManager) {
  const peer = rtc.peers.get(net.localPeerId)!;
  peer.emit('open');
  const [client, server] = peer.pairs.at(-1)!;
  server.open = true; server.emit('open'); client.open = true; client.emit('open');
  return { peer, client, server };
}
function transport(net: MultiplayerRoomManager) {
  const peer = rtc.peers.get(net.localPeerId)!;
  const [client, server] = peer.pairs.at(-1)!;
  return { peer, client, server };
}
function sendRaw(net: MultiplayerRoomManager, type: NetEnvelope['type'], payload: unknown, extras: object = {}) {
  const { client } = transport(net);

  client.send(JSON.stringify({ protocolVersion: 1, sender: net.localPeerId, hostEpoch: (net as unknown as { hostEpoch: string }).hostEpoch, type, payload, ...extras }));
}
function input(net: MultiplayerRoomManager, values: Partial<ClientInputPacket> = {}): ClientInputPacket {
  return { slotId: net.localSlotId, name: 'MATEO', moveX: 0, moveY: 0, aimAngle: 0, parryPressed: false,
    chargingParry: false, dashPressed: false, emotePressed: 0, clientBallDist: 999,
    inputSeq: 1, roundEpoch: net.activeRoundEpoch, stateSeq: net.clientStateSeq, activeGame: net.activeGame, lastSeenSnapshotSeq: (net as unknown as { lastSnapshotSeq: number }).lastSnapshotSeq, ...values };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] }); rtc.peers.clear(); rtc.pending.length = 0; rtc.setHold(false); });
afterEach(() => { for (const n of all.splice(0)) n.dispose(); vi.clearAllTimers(); vi.useRealTimers(); });

describe('authenticated room transport and runtime validation', () => {
  it('joins four players via real connection callbacks and rejects overflow without replacing anyone', () => {
    const h = host(), a = join('ALFA'), b = join('BETA'), c = join('GAMA');
    expect([a.net.localSlotId, b.net.localSlotId, c.net.localSlotId]).toEqual([1, 2, 3]);
    const roster = h.arena.players.map(p => p.peerId);
    const overflow = join('EXTRA');
    expect(overflow.net.kickedNotice).toContain('llena');
    expect(h.arena.players.map(p => p.peerId)).toEqual(roster);
    expect(h.net.connectedPeersCount).toBe(3);
    expect(a.arena.players.map(p => p.name)).toEqual(h.arena.players.map(p => p.name));
    b.net.disconnectCleanly();
    expect(h.arena.players[2].isBot).toBe(true);
    expect(h.net.connectedPeersCount).toBe(2);
  });

  it('rejects host takeover, moderation, admin actions, leaving another identity and sender/slot spoofing', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const sequence = h.net.stateSeq;
    const original = h.arena.players[0].name;
    const apply = vi.spyOn(h.arena, 'applyRemoteInput');
    sendRaw(c.net, 'SLOT_ASSIGN', { peerId: h.net.localPeerId, slotId: 1 });
    sendRaw(c.net, 'KICK_PEER', { targetPeerId: h.net.localPeerId, reason: 'x' });
    sendRaw(c.net, 'GAME_SWITCH', { activeGame: 'HUB' });
    for (const kind of ['BOT_DIFF', 'LOAD_STAGE', 'CHAIN_MODE', 'RESET_MATCH', 'START_TOURNAMENT', 'STOP_TOURNAMENT']) sendRaw(c.net, 'ROOM_ACTION', { kind, botDifficulty: 'OFF', holeIndex: 2, chainMode: 'SABOTAGE' });
    sendRaw(c.net, 'PEER_LEAVE', { peerId: h.net.localPeerId });
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { slotId: 0, name: 'STOLEN' }));
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net), { sender: h.net.localPeerId });
    expect(h.net.isHost).toBe(true); expect(h.net.stateSeq).toBe(sequence);
    expect(h.arena.players[0].name).toBe(original); expect(apply).not.toHaveBeenCalled();
  });

  it('binds JOIN_CLAIM to PeerJS identity and rejects unknown or missing protocol', () => {
    const h = host(), c = join();
    const count = h.net.connectedPeersCount;
    sendRaw(c.net, 'JOIN_CLAIM', { peerId: 'P-OTHER', name: 'OTHER' });
    sendRaw(c.net, 'JOIN_CLAIM', { peerId: c.net.localPeerId, name: 'OTHER' }, { protocolVersion: 99 });
    expect(h.net.connectedPeersCount).toBe(count);
    expect(h.arena.players[1].name).toBe('MATEO');
    // The public dispatch function cannot bypass transport ownership.
    h.net.handleEnvelope({ protocolVersion: 1, sender: 'P-NO-CONNECTION', type: 'JOIN_CLAIM', payload: { peerId: 'P-NO-CONNECTION', name: 'OTHER' } }, () => {});
    expect(h.net.connectedPeersCount).toBe(count);
  });

  it('sanitizes names and validates cosmetics before updating any engine', () => {
    const h = host(), c = join('<markup>'); h.net.switchGame('BASH_BOT');
    expect(h.arena.players[1].name).toBe('MARKUP');
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { cosmetics: { hat: 'CROWN', visor: 'RED', skin: 'VAPOR' } }));
    expect(h.arena.players[1].cosmetics?.hat).toBe('CROWN');
    sendRaw(c.net, 'CLIENT_INPUT', { ...input(c.net, { inputSeq: 2 }), cosmetics: { hat: '<script>', visor: 'RED', skin: 'VAPOR' } });
    expect(h.arena.players[1].cosmetics?.hat).toBe('CROWN');
    expect(h.net.toasts.every(t => !/[<>]/.test(t.text))).toBe(true);
  });

  it('drops malformed, huge, nonfinite, invalid flags, invalid slots and deeply nested messages without exceptions', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const apply = vi.spyOn(h.arena, 'applyRemoteInput');
    const { client } = transport(c.net);
    for (const payload of [null, [], 1, { name: {} }, { ...input(c.net), moveX: 2 }, { ...input(c.net), slotId: 99 },
      { ...input(c.net), clientX: 1e100 }, { ...input(c.net), moveY: null }, { ...input(c.net), parryPressed: 'true' },
      { ...input(c.net), cosmetics: { hat: 'NONE' } }]) expect(() => sendRaw(c.net, 'CLIENT_INPUT', payload)).not.toThrow();
    for (const raw of ['null', '{', 'x'.repeat(300000), '{"__proto__": {"bad": true}}']) expect(() => client.send(raw)).not.toThrow();
    expect(apply).not.toHaveBeenCalled();
  });

  it('keeps moderation effective against an existing connection changing its sender after being banned', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const conn = transport(c.net).server;
    expect(h.net.kickPlayerSlot(1)).toBe(true);
    expect(c.net.kickedNotice).toContain('vetado');
    conn.emit('data', JSON.stringify({ protocolVersion: 1, sender: 'P-NEW-SENDER', type: 'JOIN_CLAIM', payload: { peerId: 'P-NEW-SENDER', name: 'BACK' } }));
    expect(h.arena.players[1].isBot).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(c.net.kickedNotice).toContain('vetado');
  });

  it('rate limits floods before parsing and permits a subsequent normal window', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const apply = vi.spyOn(h.arena, 'applyRemoteInput');
    for (let seq = 1; seq < 220; seq++) sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { inputSeq: seq }));
    expect(apply.mock.calls.length).toBeLessThanOrEqual(160);
    vi.advanceTimersByTime(1100); h.net.broadcastHostSnapshot(true);
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { inputSeq: 500 }));
    expect(apply.mock.calls.at(-1)?.[0].inputSeq).toBe(500);
  });
});

describe('ordering, reconnection and bounded latency', () => {
  it('retries a negotiation whose Peer opens but data connection never opens, ignoring obsolete callbacks', () => {
    const h = host(), c = manager(); c.net.joinRoomAsClient('TEST', 'SOFIA');
    const abandoned = rtc.peers.get(c.net.localPeerId)!;
    abandoned.emit('open');
    const [oldClient, oldServer] = abandoned.pairs[0];
    expect(oldClient.open).toBe(false);
    vi.advanceTimersByTime(11999); expect(c.net.connectionState).toBe('CONNECTING');
    vi.advanceTimersByTime(1); expect(c.net.connectionState).toBe('RECONNECTING');
    vi.advanceTimersByTime(900);
    expect(rtc.peers.get(c.net.localPeerId)).not.toBe(abandoned);
    expect(abandoned.destroyed).toBe(true);
    open(c.net); expect(c.net.isSynchronized).toBe(true); expect(c.net.localSlotId).toBe(1);
    const active = rtc.peers.get(c.net.localPeerId)!;
    abandoned.emit('open'); oldClient.emit('open'); oldClient.emit('close'); oldServer.emit('close');
    oldClient.emit('data', JSON.stringify({ protocolVersion: 1, sender: h.net.localPeerId,
      hostEpoch: (h.net as unknown as { hostEpoch: string }).hostEpoch, type: 'SLOT_ASSIGN',
      payload: { peerId: c.net.localPeerId, slotId: 3, hostName: 'OBSOLETE', stateSeq: 999, activeGame: 'HOT_CORE', botDifficulty: 'NORMAL' } }));
    expect(c.net.localSlotId).toBe(1); expect(c.net.activeGame).toBe('HUB');
    vi.advanceTimersByTime(900);
    expect(rtc.peers.get(c.net.localPeerId)).toBe(active); expect(c.net.connectionState).toBe('CONNECTED_CLIENT');
  });

  it('retries stalled signaling when the client Peer never emits open', () => {
    host(); const c = manager(); c.net.joinRoomAsClient('TEST', 'SOFIA');
    const abandoned = rtc.peers.get(c.net.localPeerId)!;
    expect(abandoned.pairs).toHaveLength(0);
    vi.advanceTimersByTime(12000); expect(c.net.connectionState).toBe('RECONNECTING');
    vi.advanceTimersByTime(900);
    expect(abandoned.destroyed).toBe(true); expect(rtc.peers.get(c.net.localPeerId)).not.toBe(abandoned);
    open(c.net); expect(c.net.connectionState).toBe('CONNECTED_CLIENT'); expect(c.net.isSynchronized).toBe(true);
  });

  it('retries an open data channel that never receives slot assignment', () => {
    host(); const c = manager(); rtc.setHold(true);
    c.net.joinRoomAsClient('TEST', 'SOFIA'); open(c.net);
    const abandoned = rtc.peers.get(c.net.localPeerId)!;
    expect(c.net.connectionState).toBe('CONNECTING');
    vi.advanceTimersByTime(12000); expect(c.net.connectionState).toBe('RECONNECTING');
    rtc.setHold(false); rtc.pending.length = 0; vi.advanceTimersByTime(900);
    expect(abandoned.destroyed).toBe(true);
    open(c.net); expect(c.net.isSynchronized).toBe(true); expect(c.net.localSlotId).toBe(1);
  });

  it('reports synchronization only after a valid world snapshot and pauses when it becomes stale', () => {
    const h = host(), c = manager(); rtc.setHold(true);
    c.net.joinRoomAsClient('TEST', 'SOFIA'); open(c.net);
    const claim = rtc.pending.find(p => JSON.parse(p.raw).type === 'JOIN_CLAIM')!;
    claim.target.emit('data', claim.raw);
    const assign = rtc.pending.find(p => JSON.parse(p.raw).type === 'SLOT_ASSIGN')!;
    assign.target.emit('data', assign.raw);
    expect(c.net.connectionState).toBe('CONNECTED_CLIENT'); expect(c.net.isSynchronized).toBe(false);
    const world = rtc.pending.find(p => JSON.parse(p.raw).type === 'WORLD_SNAP')!;
    world.target.emit('data', world.raw); expect(c.net.isSynchronized).toBe(true);
    vi.advanceTimersByTime(501); expect(c.net.isSynchronized).toBe(false);
    rtc.setHold(false); h.net.broadcastHostSnapshot(true); expect(c.net.isSynchronized).toBe(true);
    expect(h.net.isSynchronized).toBe(true);
  });

  it('rejects reordered/duplicate movement and actions, normalizes movement and expires stalled input', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const apply = vi.spyOn(h.arena, 'applyRemoteInput');
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { inputSeq: 5, actionSeq: 3, moveX: 1, moveY: 1, dashPressed: true }));
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { inputSeq: 4, actionSeq: 2, moveX: -1, dashPressed: true }));
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { inputSeq: 5, actionSeq: 3, moveX: -1, dashPressed: true }));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(Math.hypot(apply.mock.calls[0][0].moveX, apply.mock.calls[0][0].moveY)).toBeCloseTo(1);
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { inputSeq: 6, actionSeq: 3, moveX: 1, dashPressed: true }));
    expect(apply.mock.calls.at(-1)?.[0].dashPressed).toBe(false);
    vi.advanceTimersByTime(300);
    expect(apply.mock.calls.at(-1)?.[0]).toMatchObject({ moveX: 0, moveY: 0, chargingParry: false });
  });

  it('drops input from a previous game/epoch and does not invoke actions during tournament roulette', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const old = input(c.net, { actionSeq: 1, parryPressed: true });
    h.net.switchGame('HOT_CORE'); const apply = vi.spyOn(h.hot, 'applyRemoteInput');
    sendRaw(c.net, 'CLIENT_INPUT', old);
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net), { hostEpoch: 'OLD-EPOCH' });
    expect(apply).not.toHaveBeenCalled();
    h.tournament.state.active = true; h.tournament.state.rouletteSpinning = true;
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { inputSeq: 2, parryPressed: true, actionSeq: 2 }));
    expect(apply).not.toHaveBeenCalled();
  });

  it('routes gameplay actions only to the active cartridge', () => {
    const h = host(), c = join(); h.net.switchGame('TURBO_PUTT');
    const putt = vi.spyOn(h.putt, 'applyRemoteInput');
    const inactive = [h.arena, h.chain, h.hot, h.volt, h.hex, h.rico].map(e => vi.spyOn(e, 'applyRemoteInput'));
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { actionSeq: 1, dashPressed: true }));
    expect(putt).toHaveBeenCalledTimes(1);
    for (const engine of inactive) expect(engine).not.toHaveBeenCalled();
  });

  it('applies only the latest snapshot when frames are delayed, duplicated and reordered', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const spy = vi.spyOn(c.arena, 'applySnapshot'); rtc.setHold(true);
    h.arena.players[0].score = 2; h.net.broadcastHostSnapshot(true);
    h.arena.players[0].score = 4; h.net.broadcastHostSnapshot(true);
    const snaps = rtc.pending.filter(x => JSON.parse(x.raw).type === 'WORLD_SNAP');
    snaps.at(-1)!.target.emit('data', snaps.at(-1)!.raw);
    snaps[0].target.emit('data', snaps[0].raw);
    snaps.at(-1)!.target.emit('data', snaps.at(-1)!.raw);
    expect(spy).toHaveBeenCalledTimes(1); expect(c.arena.players[0].score).toBe(4);
  });

  it('accepts a fresh authoritative HUB snapshot while rejecting an older game state', () => {
    const h = host(), c = join(); h.net.switchGame('TURBO_PUTT');
    const before = transport(c.net).server.sent.slice().reverse().find(raw => JSON.parse(raw).type === 'WORLD_SNAP')!;
    h.net.switchGame('HUB'); expect(c.net.activeGame).toBe('HUB');
    transport(c.net).client.emit('data', before); expect(c.net.activeGame).toBe('HUB');
  });

  it('recovers from a host restart with a new identity/epoch, ignoring data/close from the old connection', () => {
    const h = host(), c = join(); h.net.switchGame('HOT_CORE');
    const old = transport(c.net);
    const oldSnap = old.server.sent.slice().reverse().find(raw => JSON.parse(raw).type === 'WORLD_SNAP')!;
    h.net.dispose();
    const replacement = host(); replacement.net.switchGame('HEX_CRUSH');
    vi.advanceTimersByTime(900); open(c.net);
    expect(c.net.connectionState).toBe('CONNECTED_CLIENT'); expect(c.net.activeGame).toBe('HEX_CRUSH');
    old.client.emit('data', oldSnap); old.client.emit('close'); old.server.emit('close');
    expect(c.net.connectionState).toBe('CONNECTED_CLIENT'); expect(c.net.activeGame).toBe('HEX_CRUSH');
    expect(replacement.net.connectedPeersCount).toBe(1);
  });

  it('reserves an interrupted player slot and score through reconnection and expires abandoned reservations', () => {
    const h = host(), a = join('ALFA'), b = join('BETA'), c = join('GAMA');
    h.arena.players[2].score = 4;
    const previous = transport(b.net); previous.client.close();
    expect(h.arena.players[2].peerId).toBe(b.net.localPeerId);
    expect(h.arena.players[2].isBot).toBe(false);
    const overflow = join('WAITING'); expect(overflow.net.kickedNotice).toContain('llena');
    vi.advanceTimersByTime(900); open(b.net);
    expect(b.net.localSlotId).toBe(2); expect(h.arena.players[2].score).toBe(4);
    previous.server.emit('close'); expect(h.arena.players[2].isBot).toBe(false);
    transport(c.net).client.close(); c.net.dispose();
    vi.advanceTimersByTime(27000);
    expect(h.arena.players[3].isBot).toBe(true);
    expect(h.arena.players[1].peerId).toBe(a.net.localPeerId);
  });

  it('does not queue snapshots or continuous input under backpressure and preserves a prompt discrete action', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const { client, server } = transport(c.net);
    const hostBefore = server.sent.length, clientBefore = client.sent.length;
    server.dataChannel.bufferedAmount = 9000; client.dataChannel.bufferedAmount = 9000;
    for (let i = 0; i < 10; i++) { h.net.broadcastHostSnapshot(true); c.net.sendClientInput(input(c.net, { moveX: 1, parryPressed: i === 0 })); }
    expect(server.sent).toHaveLength(hostBefore); expect(client.sent).toHaveLength(clientBefore);
    client.dataChannel.bufferedAmount = 0; server.dataChannel.bufferedAmount = 0;
    const apply = vi.spyOn(h.arena, 'applyRemoteInput');
    c.net.sendClientInput(input(c.net));
    expect(apply.mock.calls.at(-1)?.[0].parryPressed).toBe(true);
    h.net.broadcastHostSnapshot(true); expect(server.sent.length).toBe(hostBefore + 1);
  });

  it('drops stale queued actions after a long congestion stall and keeps only current movement', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const { client } = transport(c.net); client.dataChannel.bufferedAmount = 9000;
    c.net.sendClientInput(input(c.net, { dashPressed: true }));
    vi.advanceTimersByTime(400); client.dataChannel.bufferedAmount = 0;
    const apply = vi.spyOn(h.arena, 'applyRemoteInput'); c.net.sendClientInput(input(c.net, { moveX: -1 }));
    expect(apply.mock.calls.at(-1)?.[0]).toMatchObject({ dashPressed: false, moveX: -1 });
  });

  it('synchronizes all seven games and repeated administrative actions only when host initiates them', () => {
    const h = host(), c = join();
    for (const game of ['BASH_BOT', 'CHAIN_PANIC', 'TURBO_PUTT', 'HOT_CORE', 'VOLT_CROWN', 'HEX_CRUSH', 'RICOCHET_1'] as const) {
      h.net.switchGame(game); expect(c.net.activeGame).toBe(game);
      h.net.sendOrApplyRoomAction({ kind: 'BOT_DIFF', botDifficulty: 'OFF' });
      expect(c.arena.botDifficulty).toBe('OFF');
      h.net.sendOrApplyRoomAction({ kind: 'BOT_DIFF', botDifficulty: 'NORMAL' });
    }
    c.net.switchGame('TURBO_PUTT'); c.net.sendOrApplyRoomAction({ kind: 'LOAD_STAGE', holeIndex: 3 });
    expect(h.net.activeGame).toBe('RICOCHET_1');
    h.net.switchGame('TURBO_PUTT'); h.net.sendOrApplyRoomAction({ kind: 'LOAD_STAGE', holeIndex: 3 });
    expect(c.putt.holeIndex).toBe(3);
  });

  it('applies full snapshots for every game with heterogeneous cosmetics and nullable bot peer IDs', () => {
    const h = host(), c = join();
    h.arena.players[0].cosmetics = { hat: 'CROWN', visor: 'CYAN', skin: 'STOCK' };
    c.arena.players[0].cosmetics = { hat: 'NONE', visor: 'WHITE', skin: 'STEALTH' };
    for (const [game, source, destination] of [
      ['BASH_BOT', h.arena, c.arena], ['CHAIN_PANIC', h.chain, c.chain], ['TURBO_PUTT', h.putt, c.putt],
      ['HOT_CORE', h.hot, c.hot], ['VOLT_CROWN', h.volt, c.volt], ['HEX_CRUSH', h.hex, c.hex], ['RICOCHET_1', h.rico, c.rico]
    ] as const) {
      h.net.switchGame(game);
      const applied = vi.spyOn(destination, 'applySnapshot');
      source.players[0].name = 'VERIFIED';
      h.arena.players[0].name = 'VERIFIED';
      source.players[0].x += 33;
      const previousError = Math.abs(destination.players[0].x - source.players[0].x);
      h.net.broadcastHostSnapshot(true);
      expect(applied, game).toHaveBeenCalledTimes(1);
      expect(applied.mock.calls[0][0].players[0].x, game).toBeCloseTo(source.players[0].x, 1);
      expect(Math.abs(destination.players[0].x - source.players[0].x), game).toBeLessThan(previousError);
      expect(c.arena.players[0].name, game).toBe('VERIFIED');
      expect(c.arena.players[0].cosmetics?.hat, game).toBe('CROWN');
      expect(c.arena.players[2].peerId, game).toBeNull();
      applied.mockRestore();
    }
  });

  it('rejects malformed authoritative snapshots atomically, including fields used by HUD and rendering', () => {
    const h = host(), c = join(); h.net.switchGame('VOLT_CROWN');
    const { server, client } = transport(c.net);
    const good = JSON.parse(server.sent.slice().reverse().find(s => JSON.parse(s).type === 'WORLD_SNAP')!);
    const apply = vi.spyOn(c.arena, 'applySnapshot');
    const variants = [
      (e: any) => { e.payload.hostName = 42; },
      (e: any) => { delete e.payload.voltCrownState.players[1].holdStreak; },
      (e: any) => { e.payload.voltCrownState.players[1].alive = null; },
      (e: any) => { e.payload.players = [null, null, null, null]; },
      (e: any) => { e.payload.voltCrownState.projectiles = [null]; },
      (e: any) => { e.payload.voltCrownState.status = 'BROKEN'; }
    ];
    for (const mutate of variants) {
      const value = structuredClone(good); value.payload.snapshotSeq += 10;
      mutate(value); expect(() => client.emit('data', JSON.stringify(value))).not.toThrow();
    }
    expect(apply).not.toHaveBeenCalled(); expect(c.net.activeGame).toBe('VOLT_CROWN');
  });

  it('discards in-transit input older than the host-issued snapshot freshness window', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const p = input(c.net, { inputSeq: 5, actionSeq: 5, parryPressed: true });
    const epoch = (c.net as unknown as { hostEpoch: string }).hostEpoch;
    const { server } = transport(c.net);
    const delayed = JSON.stringify({ protocolVersion: 1, sender: c.net.localPeerId, hostEpoch: epoch, type: 'CLIENT_INPUT', payload: p });
    vi.advanceTimersByTime(600);
    const apply = vi.spyOn(h.arena, 'applyRemoteInput'); server.emit('data', delayed);
    expect(apply).not.toHaveBeenCalled();
    h.net.broadcastHostSnapshot(true);
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { inputSeq: 6, actionSeq: 6, parryPressed: true }));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('never relabels a queued action when a cartridge or stage changes', () => {
    const h = host(), c = join(); h.net.switchGame('TURBO_PUTT');
    const { client } = transport(c.net); client.dataChannel.bufferedAmount = 9000;
    c.net.sendClientInput(input(c.net, { parryPressed: true, shotReleasedPower: 0.8 }));
    h.net.switchGame('HOT_CORE'); client.dataChannel.bufferedAmount = 0;
    const apply = vi.spyOn(h.hot, 'applyRemoteInput'); c.net.sendClientInput(input(c.net));
    expect(apply.mock.calls.at(-1)?.[0]).toMatchObject({ parryPressed: false, shotReleasedPower: undefined });
    client.dataChannel.bufferedAmount = 9000; c.net.sendClientInput(input(c.net, { dashPressed: true }));
    h.net.sendOrApplyRoomAction({ kind: 'RESET_MATCH' }); client.dataChannel.bufferedAmount = 0;
    vi.advanceTimersByTime(40); c.net.sendClientInput(input(c.net));
    expect(apply.mock.calls.at(-1)?.[0].dashPressed).toBe(false);
  });

  it('cancels an expired putt charge without shooting on behalf of a disconnected player', () => {
    const h = host(), c = join(); h.net.switchGame('TURBO_PUTT');
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { chargingParry: true }));
    h.putt.step(0.1, input(h.net));
    expect(h.putt.players[1].isCharging).toBe(true);
    vi.advanceTimersByTime(300);
    h.putt.step(0.02, input(h.net));
    expect(h.putt.players[1].strokes).toBe(0); expect(h.putt.players[1].isCharging).toBe(false);
    expect(Math.hypot(h.putt.players[1].vx, h.putt.players[1].vy)).toBe(0);
  });

  it('measures RTT on host challenges and overwrites forged lag compensation', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT'); rtc.setHold(true);
    vi.advanceTimersByTime(1400);
    const req = rtc.pending.find(x => { const e = JSON.parse(x.raw); return e.type === 'PING_REQ' && typeof e.payload === 'object'; })!;
    vi.advanceTimersByTime(80); req.target.emit('data', req.raw);
    const ack = rtc.pending.find(x => { const e = JSON.parse(x.raw); return e.type === 'PING_ACK' && typeof e.payload === 'object'; })!;
    vi.advanceTimersByTime(80); ack.target.emit('data', ack.raw);
    rtc.setHold(false); h.net.broadcastHostSnapshot(true);
    const apply = vi.spyOn(h.arena, 'applyRemoteInput');
    sendRaw(c.net, 'CLIENT_INPUT', input(c.net, { lagCompensationMs: 99999 }));
    expect(apply.mock.calls.at(-1)?.[0].lagCompensationMs).toBe(120);
  });

  it('rejects old-round input and queued actions when the same cartridge starts another round', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const previous = input(c.net, { actionSeq: 1, parryPressed: true });
    const { client } = transport(c.net); client.dataChannel.bufferedAmount = 9000;
    c.net.sendClientInput(previous);
    h.arena.spawnRound(); h.net.broadcastHostSnapshot(true);
    expect(c.net.activeRoundEpoch).toBe(h.net.activeRoundEpoch);
    expect(previous.roundEpoch).not.toBe(h.net.activeRoundEpoch);
    const apply = vi.spyOn(h.arena, 'applyRemoteInput');
    sendRaw(c.net, 'CLIENT_INPUT', previous);
    expect(apply).not.toHaveBeenCalled();
    client.dataChannel.bufferedAmount = 0; c.net.sendClientInput(input(c.net));
    expect(apply.mock.calls.at(-1)?.[0].parryPressed).toBe(false);
  });

  it('starts a fresh room in HUB without carrying an active tournament from the previous room', () => {
    const h = host(); h.net.switchGame('HOT_CORE');
    h.tournament.state.active = true; h.tournament.state.rouletteSpinning = true;
    h.net.hostRoom('FRESH', 'NUEVO');
    expect(h.net.activeGame).toBe('HUB'); expect(h.tournament.state.active).toBe(false);
    expect(h.net.connectedPeersCount).toBe(0); expect(h.arena.players[0].name).toBe('NUEVO');
    expect(h.arena.players.slice(1).every(p => p.peerId === null && p.isBot)).toBe(true);
  });

  it('continues authoritative movement and converges under 100 ± 40 ms jitter and reordered snapshots', () => {
    const h = host(), c = join();
    h.net.sendOrApplyRoomAction({ kind: 'BOT_DIFF', botDifficulty: 'OFF' }); h.net.switchGame('BASH_BOT');
    h.arena.balls = []; h.net.broadcastHostSnapshot(true); c.net.pingMs = 200;
    const received = vi.spyOn(h.arena, 'applyRemoteInput'), applied = vi.spyOn(c.arena, 'applySnapshot');
    const before = h.arena.players[1].x;
    const delays = [60, 140, 80, 120, 100]; let message = 0;
    rtc.setHold(true);
    const schedule = () => {
      for (const packet of rtc.pending.splice(0)) setTimeout(() => packet.target.emit('data', packet.raw), delays[message++ % delays.length]);
    };
    for (let frame = 0; frame < 60; frame++) {
      const packet = input(c.net, { moveX: 0.35 });
      c.arena.stepClientPrediction(1 / 60, c.net.localSlotId, packet); c.net.sendClientInput(packet);
      h.arena.step(1 / 60, input(h.net)); h.net.broadcastHostSnapshot();
      schedule(); vi.advanceTimersByTime(1000 / 60);
    }
    expect(received.mock.calls.length).toBeGreaterThan(12); expect(applied.mock.calls.length).toBeGreaterThan(8);
    expect(h.arena.players[1].x).toBeGreaterThan(before);
    // Stop, continue delivering snapshots, and let the local prediction reconcile with the host.
    for (let frame = 0; frame < 45; frame++) {
      const packet = input(c.net);
      c.arena.stepClientPrediction(1 / 60, c.net.localSlotId, packet); c.net.sendClientInput(packet);
      h.arena.step(1 / 60, input(h.net)); h.net.broadcastHostSnapshot();
      schedule(); vi.advanceTimersByTime(1000 / 60);
    }
    expect(Math.abs(c.arena.players[1].x - h.arena.players[1].x)).toBeLessThan(20);
    expect(c.net.connectionState).toBe('CONNECTED_CLIENT');
    expect(applied.mock.calls.some(call => call[2] === 0.1)).toBe(true);
    expect(applied.mock.calls.every(call => call[2] !== undefined && call[2] >= 0 && call[2] <= 0.12)).toBe(true);
  });

  it('retains the latest pilot name when reconnecting after a name change', () => {
    const h = host(), c = join('ORIGINAL');
    c.net.sendClientInput(input(c.net, { name: 'NUEVO' }));
    expect(h.arena.players[1].name).toBe('NUEVO');
    transport(c.net).client.close();
    vi.advanceTimersByTime(900);
    open(c.net);
    expect(c.net.localSlotId).toBe(1);
    expect(h.arena.players[1].name).toBe('NUEVO');
  });

  it('accepts fractional-clock RTT challenges despite wire rounding of echoed timestamps', () => {
    const h = host(), c = join(); h.net.switchGame('BASH_BOT');
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1400.1234567);
    vi.advanceTimersByTime(1400);
    clock.mockRestore();
    // A valid nonce measures from the host's stored clock, never from client-supplied time.
    expect((h.net as unknown as { pendingPings: Map<string, unknown> }).pendingPings.has(c.net.localPeerId)).toBe(false);
  });

  it('removes listeners, timers and connections on dispose; late network events do nothing', () => {
    const h = host(), c = join(); const old = transport(c.net); const apply = vi.spyOn(h.arena, 'applyRemoteInput');
    c.net.dispose(); h.net.dispose();
    old.server.emit('data', old.client.sent[0]); old.client.emit('close');
    vi.advanceTimersByTime(30000);
    expect(apply).not.toHaveBeenCalled(); expect(rtc.peers.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
});
