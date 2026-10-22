import Peer, { DataConnection, type PeerOptions } from 'peerjs';
import { readRtcConfiguration, RtcConfigurationError } from './rtcConfiguration';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { PuttWarEngine } from '../game/puttWarEngine';
import { HotCoreEngine } from '../game/hotCoreEngine';
import { VoltCrownEngine } from '../game/voltCrownEngine';
import { HexCrushEngine } from '../game/hexCrushEngine';
import { RicochetEngine } from '../game/ricochetEngine';
import { TournamentManager } from '../game/tournamentManager';
import type { ActiveGameId, BotDifficulty, ChainGameMode, ClientInputPacket, WorldSnapshotPacket } from '../types';
import { PROTOCOL_VERSION, MAX_MESSAGE_CHARS, GAME_IDS, BOT_LEVELS, MESSAGE_TYPES, record, finite, integer, text, peerId,
  cleanText, cleanName, boundedJson, validInput, validAction, validSnapshot } from './protocol';

export type RoomConnectionState = 'HOSTING' | 'CONNECTING' | 'CONNECTED_CLIENT' | 'RECONNECTING';
export type RoomPeerRole = 'HOST' | 'CLIENT';
export interface RoomToastEvent { id: number; text: string; tone: 'join' | 'leave' | 'info' | 'warn' }
export interface NetEnvelope {
  protocolVersion?: number;
  hostEpoch?: string;
  sender: string;
  type: 'JOIN_CLAIM' | 'SLOT_ASSIGN' | 'GAME_SWITCH' | 'ROOM_ACTION' | 'CLIENT_INPUT' | 'WORLD_SNAP' | 'DRAFT_PICK' |
    'KICK_PEER' | 'PEER_LEAVE' | 'ROOM_EVENT' | 'PING_REQ' | 'PING_ACK';
  payload: unknown;
}
export interface RoomActionMsg {
  kind: 'BOT_DIFF' | 'LOAD_STAGE' | 'CHAIN_MODE' | 'RESET_MATCH' | 'START_TOURNAMENT' | 'STOP_TOURNAMENT';
  stateSeq?: number;
  botDifficulty?: BotDifficulty;
  levelIndex?: number;
  holeIndex?: number;
  arenaIndex?: number;
  chainMode?: ChainGameMode;
}

const HOST_ID_PREFIX = 'tp04-deck-room-v4-';
const DEFAULT_BOT_NAMES = ['UNIT-01', 'LEO-BOT', 'MAX-BOT', 'NICO-BOT'];
const INPUT_EXPIRY_MS = 250;
const MAX_BUFFERED_BYTES = 8192;
const ACTION_HISTORY_SIZE = 128;
const uniqueId = (): string => globalThis.crypto?.randomUUID?.() ?? `P-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export interface RoomNetworkOptions {
  rtcConfig?: RTCConfiguration;
  createPeer?: (id: string, options: PeerOptions) => Peer;
  /** A/B diagnostics only. PeerJS 1.5.5 maps this to RTCDataChannel.ordered, preserving reliability. */
  ordered?: boolean;
}

function serialize(env: NetEnvelope): string {
  return JSON.stringify(env, (_key, v: unknown) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(4);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, b => chars[(b || Math.floor(Math.random() * 256)) % chars.length]).join('');
}

type Action = Pick<ClientInputPacket, 'parryPressed' | 'dashPressed' | 'yankPressed' | 'emotePressed' | 'shotReleasedPower' | 'feintPrimed'> &
  { actionSeq: number; at: number; stateSeq: number; activeGame: ActiveGameId; roundEpoch: number };

/** Host-authoritative room. All received messages are tied to the current WebRTC connection. */
export class MultiplayerRoomManager {
  public roomCode = 'TP04';
  public localPeerId = uniqueId();
  public localSlotId = 0;
  public role: RoomPeerRole = 'HOST';
  public isHost = true;
  public hostName = 'ALEX';
  public stateSeq = 1;
  public clientStateSeq = 0;
  public connectionState: RoomConnectionState = 'HOSTING';
  public activeGame: ActiveGameId = 'HUB';
  public connectedPeersCount = 0;
  public pingMs = 0;
  public bannedPeerIds = new Set<string>();
  public kickedNotice: string | null = null;
  public networkConfigurationError: string | null = null;
  public toasts: RoomToastEvent[] = [];

  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private authoritativeHostPeerId: string | null = null;
  private hostEpoch = uniqueId();
  private clientConns = new Map<string, DataConnection>();
  private connToLogicalPeer = new Map<string, string>();
  private peerToSlot = new Map<string, number>();
  private peerLastSeen = new Map<string, number>();
  private latestInputSeq = new Map<string, number>();
  private latestActionSeq = new Map<string, number>();
  private seenActionIds = new Map<string, Set<number>>();
  private dispatchedActionSeq = new Map<string, number>();
  private continuousInputs = new Map<string, ClientInputPacket>();
  private inputLastSeen = new Map<string, number>();
  private staleInputs = new Set<string>();
  private rates = new Map<DataConnection, { since: number; count: number }>();
  private joinReplies = new Map<string, number>();
  private pendingPings = new Map<string, { nonce: string; at: number }>();
  private peerRtt = new Map<string, number>();
  private lastSnapshotSeq = 0;
  private snapshotSentTimes = new Map<number, number>();
  private lastWorldSnapReceivedAt = -10000;
  private snapshotSeq = 0;
  private inputSeq = 0;
  private clientActionSeq = 0;
  private pendingActions: Action[] = [];
  private lastHostSnapReceivedAt = -10000;
  private lastRtcSnapSentAt = -10000;
  private lastClientInputSentAt = -10000;
  private lastChargingState = false;
  private nextToastId = 1;
  private joinRetryTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval>;
  private expiryInterval: ReturnType<typeof setInterval>;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private disposed = false;
  private localPilotName = 'PILOTO';
  private generation = 0;
  private beforeUnload = () => this.disconnectCleanly();

  constructor(private arenaEngine: ArenaEngine, private chainEngine: ChainPanicEngine, private onStatusUpdate: () => void,
    private puttEngine?: PuttWarEngine, private hotCoreEngine?: HotCoreEngine, private voltCrownEngine?: VoltCrownEngine,
    private hexCrushEngine?: HexCrushEngine, public tournamentManager?: TournamentManager, private ricochetEngine?: RicochetEngine,
    private networkOptions: RoomNetworkOptions = {}) {
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', this.beforeUnload);
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 1400);
    this.expiryInterval = setInterval(() => this.expireRemoteInputs(), 50);
  }

  private createNetworkPeer(id: string): Peer {
    const options: PeerOptions = { config: this.networkOptions.rtcConfig ?? readRtcConfiguration() };
    const peer = this.networkOptions.createPeer ? this.networkOptions.createPeer(id, options) : new Peer(id, options);
    this.networkConfigurationError = null;
    return peer;
  }

  private reportConfigurationError(error: unknown): boolean {
    if (!(error instanceof RtcConfigurationError)) return false;
    this.networkConfigurationError = error.message;
    this.pushToast(error.message, 'warn');
    return true;
  }

  private later(callback: () => void, delay: number): void {
    const generation = this.generation;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.disposed && generation === this.generation) callback();
    }, delay);
    this.timers.add(timer);
  }

  public pushToast(message: string, tone: RoomToastEvent['tone'] = 'info'): void {
    if (this.disposed) return;
    const id = this.nextToastId++;
    this.toasts.push({ id, text: cleanText(message), tone });
    if (this.toasts.length > 4) this.toasts.shift();
    this.onStatusUpdate();
    this.later(() => {
      const index = this.toasts.findIndex(t => t.id === id);
      if (index >= 0) { this.toasts.splice(index, 1); this.onStatusUpdate(); }
    }, 4200);
  }

  public shouldStepLocally(): boolean { return this.isHost; }

  public get isSynchronized(): boolean {
    return !this.disposed && (this.isHost || (this.connectionState === 'CONNECTED_CLIENT' && this.hostConn?.open === true &&
      this.lastSnapshotSeq > 0 && performance.now() - this.lastWorldSnapReceivedAt <= 500));
  }

  public get activeRoundEpoch(): number {
    if (this.activeGame === 'CHAIN_PANIC') return this.chainEngine.roundEpoch;
    if (this.activeGame === 'TURBO_PUTT') return this.puttEngine?.roundEpoch ?? 0;
    return this.currentArenaEngine()?.roundEpoch ?? this.arenaEngine.roundEpoch;
  }

  private get gameplayIsActive(): boolean {
    if (this.activeGame === 'HUB') return false;
    if (this.activeGame === 'BASH_BOT') return this.arenaEngine.phase === 'PLAYING';
    if (this.activeGame === 'CHAIN_PANIC') return this.chainEngine.status === 'PLAYING';
    if (this.activeGame === 'TURBO_PUTT') return this.puttEngine?.status === 'PLAYING';
    return this.currentArenaEngine()?.status === 'PLAYING';
  }

  private parseEnvelope(raw: unknown): NetEnvelope | null {
    try {
      if (typeof raw === 'string') {
        if (raw.length > (this.isHost ? 2048 : MAX_MESSAGE_CHARS)) return null;
        raw = JSON.parse(raw);
      }
      if (!record(raw) || raw.protocolVersion !== PROTOCOL_VERSION || !peerId(raw.sender) ||
          !MESSAGE_TYPES.includes(String(raw.type)) || !boundedJson(raw)) return null;
      return raw as unknown as NetEnvelope;
    } catch { return null; }
  }

  private isCongested(conn: DataConnection): boolean {
    return (conn.dataChannel?.bufferedAmount ?? 0) > MAX_BUFFERED_BYTES || ((conn as unknown as { bufferSize?: number }).bufferSize ?? 0) > 0;
  }

  private sendOverConn(conn: DataConnection | null | undefined, env: NetEnvelope): boolean {
    if (!conn?.open || this.disposed) return false;
    if (['WORLD_SNAP', 'CLIENT_INPUT'].includes(env.type) && this.isCongested(conn)) return false;
    try {
      conn.send(serialize({ ...env, protocolVersion: PROTOCOL_VERSION, hostEpoch: this.hostEpoch }));
      return true;
    } catch { return false; }
  }

  private sendToAllClients(env: NetEnvelope): void { this.clientConns.forEach(c => this.sendOverConn(c, env)); }
  private sendToHost(env: NetEnvelope): boolean { return this.sendOverConn(this.hostConn, env); }
  private engines() { return [this.arenaEngine, this.chainEngine, this.puttEngine, this.hotCoreEngine, this.voltCrownEngine, this.hexCrushEngine, this.ricochetEngine]; }
  private applyRemoteInput(input: ClientInputPacket): void {
    const engine = this.activeGame === 'BASH_BOT' ? this.arenaEngine : this.activeGame === 'CHAIN_PANIC' ? this.chainEngine :
      this.activeGame === 'TURBO_PUTT' ? this.puttEngine : this.currentArenaEngine();
    engine?.applyRemoteInput({ ...input });
  }
  private clearRemoteSlot(slot: number): void {
    for (const e of this.engines()) (e as unknown as { clearRemoteInput?: (slot: number) => void } | undefined)?.clearRemoteInput?.(slot);
  }

  public expireRemoteInputs(): void {
    if (!this.isHost || this.disposed) return;
    const now = performance.now();
    this.inputLastSeen.forEach((at, id) => {
      if (now - at <= INPUT_EXPIRY_MS || this.staleInputs.has(id)) return;
      const slotId = this.peerToSlot.get(id);
      if (slotId === undefined) return;
      this.staleInputs.add(id);
      // Cancel held abilities before sending neutral flags: releasing a timed-out putt
      // charge must not synthesize a shot that the disconnected player never requested.
      this.clearRemoteSlot(slotId);
      const neutral = this.neutralInput(slotId);
      this.continuousInputs.set(id, neutral);
      this.applyRemoteInput(neutral);
    });
  }

  private neutralInput(slotId: number): ClientInputPacket {
    return { slotId, name: this.arenaEngine.players[slotId].name, cosmetics: this.arenaEngine.players[slotId].cosmetics,
      moveX: 0, moveY: 0, aimAngle: 0, parryPressed: false, dashPressed: false, chargingParry: false,
      anchorHeld: false, emotePressed: 0, clientBallDist: 100000 };
  }

  private continuousInput(input: ClientInputPacket): ClientInputPacket {
    return { ...input, actionSeq: undefined, parryPressed: false, dashPressed: false, yankPressed: false,
      emotePressed: 0, shotReleasedPower: undefined };
  }

  private acceptAction(id: string, input: ClientInputPacket): boolean {
    if (!integer(input.actionSeq, 1) || !(input.parryPressed || input.dashPressed || input.yankPressed ||
        input.emotePressed > 0 || input.shotReleasedPower !== undefined)) return false;
    const highest = this.latestActionSeq.get(id) ?? 0;
    const seen = this.seenActionIds.get(id) ?? new Set<number>();
    if (input.actionSeq <= highest - ACTION_HISTORY_SIZE || seen.has(input.actionSeq)) return false;
    const nextHighest = Math.max(highest, input.actionSeq);
    for (const sequence of seen) if (sequence <= nextHighest - ACTION_HISTORY_SIZE) seen.delete(sequence);
    seen.add(input.actionSeq);
    this.seenActionIds.set(id, seen); this.latestActionSeq.set(id, nextHighest);
    return true;
  }

  public syncEnginesRoster(): void {
    const bots = this.arenaEngine.botDifficulty !== 'OFF';
    this.arenaEngine.players.forEach(p => { if (p.isBot && !bots) p.alive = false; });
    const roster = this.arenaEngine.players.map(p => ({ name: cleanName(p.name), isBot: p.isBot, cosmetics: p.cosmetics }));
    for (const e of this.engines().slice(1)) {
      (e as Exclude<typeof e, ArenaEngine | undefined> | undefined)?.syncPlayerIdentities(roster, bots);
    }
  }

  public switchGame(next: ActiveGameId): void {
    if (this.disposed || !GAME_IDS.includes(next)) return;
    if (!this.isHost) { this.pushToast('👑 Solo el Anfitrión puede cambiar el juego de la sala'); return; }
    this.stateSeq++;
    this.activeGame = next;
    for (let slot = 1; slot < 4; slot++) this.clearRemoteSlot(slot);
    this.syncEnginesRoster();
    if (next === 'BASH_BOT') { this.arenaEngine.phase = 'PLAYING'; this.arenaEngine.spawnRound(); }
    else if (next === 'CHAIN_PANIC') this.chainEngine.loadLevel(this.chainEngine.levelIndex);
    else if (next === 'TURBO_PUTT') this.puttEngine?.loadHole(this.puttEngine.holeIndex);
    else this.currentArenaEngine()?.loadArena(this.currentArenaEngine()!.arenaIndex);
    const env: NetEnvelope = { sender: this.localPeerId, type: 'GAME_SWITCH', payload: {
      stateSeq: this.stateSeq, activeGame: next, botDifficulty: this.arenaEngine.botDifficulty,
      levelIndex: this.chainEngine.levelIndex, holeIndex: this.puttEngine?.holeIndex ?? 0, arenaIndex: this.currentArenaEngine()?.arenaIndex ?? 0
    } };
    this.sendToAllClients(env);
    this.broadcastHostSnapshot(true);
    const seq = this.stateSeq;
    for (const ms of [90, 220]) this.later(() => {
      if (this.isHost && this.stateSeq === seq) { this.sendToAllClients(env); this.broadcastHostSnapshot(true); }
    }, ms);
    this.onStatusUpdate();
  }

  private currentArenaEngine() {
    if (this.activeGame === 'HOT_CORE') return this.hotCoreEngine;
    if (this.activeGame === 'VOLT_CROWN') return this.voltCrownEngine;
    if (this.activeGame === 'HEX_CRUSH') return this.hexCrushEngine;
    if (this.activeGame === 'RICOCHET_1') return this.ricochetEngine;
    return undefined;
  }

  public sendOrApplyRoomAction(action: RoomActionMsg): void {
    if (!validAction(action) || this.disposed) return;
    if (!this.isHost) { this.pushToast('👑 Solo el Anfitrión puede cambiar los ajustes de la sala'); return; }
    this.stateSeq++;
    this.executeRoomAction(action);
    this.sendToAllClients({ sender: this.localPeerId, type: 'ROOM_ACTION', payload: { ...action, stateSeq: this.stateSeq } });
    this.broadcastHostSnapshot(true);
    this.onStatusUpdate();
  }

  private executeRoomAction(a: RoomActionMsg): void {
    if (a.kind === 'BOT_DIFF' && a.botDifficulty) {
      this.arenaEngine.botDifficulty = a.botDifficulty;
      this.syncEnginesRoster();
      if (this.isHost) {
        this.arenaEngine.spawnRound();
        this.chainEngine.loadLevel(this.chainEngine.levelIndex);
        this.puttEngine?.loadHole(this.puttEngine.holeIndex);
        for (const e of [this.hotCoreEngine, this.voltCrownEngine, this.hexCrushEngine, this.ricochetEngine]) e?.loadArena(e.arenaIndex);
      }
    } else if (a.kind === 'LOAD_STAGE') {
      if (a.levelIndex !== undefined && this.chainEngine.levelIndex !== a.levelIndex) this.chainEngine.loadLevel(a.levelIndex);
      if (a.holeIndex !== undefined && this.puttEngine?.holeIndex !== a.holeIndex) this.puttEngine?.loadHole(a.holeIndex);
      const e = this.currentArenaEngine();
      if (a.arenaIndex !== undefined && e && e.arenaIndex !== a.arenaIndex) e.loadArena(a.arenaIndex);
    } else if (a.kind === 'CHAIN_MODE' && a.chainMode) {
      this.chainEngine.mode = a.chainMode;
      if (this.isHost) this.chainEngine.loadLevel(this.chainEngine.levelIndex);
    } else if (a.kind === 'RESET_MATCH' && this.isHost) {
      if (this.activeGame === 'CHAIN_PANIC') this.chainEngine.loadLevel(this.chainEngine.levelIndex);
      else if (this.activeGame === 'TURBO_PUTT') this.puttEngine?.loadHole(this.puttEngine.holeIndex);
      else if (this.activeGame === 'RICOCHET_1') this.ricochetEngine?.resetChampionship();
      else if (this.currentArenaEngine()) (this.currentArenaEngine() as HotCoreEngine | VoltCrownEngine | HexCrushEngine).resetChampionship();
      else this.arenaEngine.resetChampionship();
    } else if (a.kind === 'START_TOURNAMENT' && this.isHost) {
      this.tournamentManager?.startTournament(game => this.switchGame(game));
    } else if (a.kind === 'STOP_TOURNAMENT' && this.isHost) {
      this.tournamentManager?.stopTournament(); this.switchGame('HUB');
    }
  }

  public kickPlayerSlot(slot: number): boolean {
    if (!this.isHost || !integer(slot, 1, 3)) return false;
    const p = this.arenaEngine.players[slot];
    if (!p || p.isBot || !p.peerId) return false;
    const id = p.peerId;
    this.bannedPeerIds.add(id);
    const conn = this.clientConns.get(id);
    this.sendOverConn(conn, { sender: this.localPeerId, type: 'KICK_PEER', payload: { targetPeerId: id, reason: `Fuiste vetado de la sala #${this.roomCode}.` } });
    this.clientConns.delete(id);
    this.connToLogicalPeer.delete(id);
    this.freeSlotForPeer(id, `🚫 ${p.name} FUE VETADO DE LA SALA`);
    // Let the reliable moderation message drain before closing its transport.
    this.later(() => conn?.close(), 150);
    return true;
  }

  public clearBanList(): void {
    if (!this.isHost) return;
    this.bannedPeerIds.clear();
    this.pushToast('Lista de vetados desbloqueada');
  }

  private freeSlotForPeer(id: string, reason?: string): void {
    const p = this.arenaEngine.players.find((p, i) => i > 0 && p.peerId === id && !p.isBot);
    this.peerToSlot.delete(id); this.peerLastSeen.delete(id); this.latestInputSeq.delete(id); this.latestActionSeq.delete(id);
    this.seenActionIds.delete(id); this.dispatchedActionSeq.delete(id); this.continuousInputs.delete(id);
    this.inputLastSeen.delete(id); this.staleInputs.delete(id);
    this.joinReplies.delete(id); this.pendingPings.delete(id); this.peerRtt.delete(id);
    if (!p) return;
    const name = p.name;
    this.clearRemoteSlot(p.id);
    p.peerId = null; p.isBot = true; p.name = DEFAULT_BOT_NAMES[p.id]; p.cosmetics = undefined;
    p.alive = this.arenaEngine.botDifficulty !== 'OFF';
    this.connectedPeersCount = this.arenaEngine.players.filter((p, i) => i > 0 && !p.isBot).length;
    this.syncEnginesRoster();
    const message = reason || `👋 ${name} SALIÓ DE LA SALA`;
    this.pushToast(message, 'leave'); this.broadcastRoomEvent(message, 'leave'); this.broadcastHostSnapshot(true);
    this.onStatusUpdate();
  }

  private broadcastRoomEvent(message: string, tone: RoomToastEvent['tone']): void {
    if (this.isHost) this.sendToAllClients({ sender: this.localPeerId, type: 'ROOM_EVENT', payload: { text: cleanText(message), tone } });
  }

  private heartbeat(): void {
    if (this.disposed) return;
    const now = performance.now();
    if (this.isHost) {
      if (this.peer?.disconnected && !this.peer.destroyed) { try { this.peer.reconnect(); } catch { /* signaling retry */ } }
      this.clientConns.forEach((conn, id) => { if (this.peerToSlot.has(id)) this.pingClient(id, conn); });
      this.peerLastSeen.forEach((at, id) => {
        if (now - at <= 25000) return;
        const conn = this.clientConns.get(id);
        this.clientConns.delete(id); this.connToLogicalPeer.delete(id);
        this.freeSlotForPeer(id); conn?.close();
      });
    } else {
      this.sendToHost({ sender: this.localPeerId, type: 'PING_REQ', payload: now });
      if (this.connectionState === 'CONNECTED_CLIENT' && now - this.lastWorldSnapReceivedAt > 12000) this.scheduleReconnect();
    }
  }

  private pingClient(id: string, conn: DataConnection): void {
    const ping = { nonce: uniqueId(), at: performance.now() };
    this.pendingPings.set(id, ping);
    this.sendOverConn(conn, { sender: this.localPeerId, type: 'PING_REQ', payload: { nonce: ping.nonce, sentAtMs: ping.at } });
  }

  public disconnectCleanly(): void {
    if (!this.isHost) this.sendToHost({ sender: this.localPeerId, type: 'PEER_LEAVE', payload: { peerId: this.localPeerId } });
    this.dispose();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanupConnections(); clearInterval(this.heartbeatInterval); clearInterval(this.expiryInterval);
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', this.beforeUnload);
  }

  private cleanupConnections(): void {
    this.generation++;
    this.timers.forEach(clearTimeout); this.timers.clear();
    if (this.joinRetryTimer) clearInterval(this.joinRetryTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.joinRetryTimer = null; this.reconnectTimer = null;
    const conns = [...this.clientConns.values(), this.hostConn];
    const peer = this.peer;
    this.hostConn = null; this.peer = null; this.clientConns.clear(); this.connToLogicalPeer.clear();
    this.peerToSlot.clear(); this.peerLastSeen.clear(); this.rates.clear(); this.latestInputSeq.clear(); this.latestActionSeq.clear(); this.snapshotSentTimes.clear();
    this.seenActionIds.clear(); this.dispatchedActionSeq.clear(); this.continuousInputs.clear();
    this.inputLastSeen.clear(); this.staleInputs.clear(); this.pendingActions = [];
    this.joinReplies.clear(); this.pendingPings.clear(); this.peerRtt.clear();
    for (let i = 1; i < 4; i++) this.clearRemoteSlot(i);
    for (const conn of conns) { try { conn?.close(); } catch { /* closed */ } }
    try { peer?.destroy(); } catch { /* destroyed */ }
  }

  public hostRoom(rawCode: string, playerName: string): void {
    if (this.disposed) return;
    this.localPilotName = cleanName(playerName);
    this.cleanupConnections();
    this.roomCode = (rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TP04');
    this.role = 'HOST'; this.isHost = true; this.localSlotId = 0; this.hostName = cleanName(playerName);
    this.activeGame = 'HUB'; this.kickedNotice = null; this.tournamentManager?.stopTournament();
    this.hostEpoch = uniqueId(); this.snapshotSeq = 0; this.lastSnapshotSeq = 0; this.stateSeq = 1; this.clientStateSeq = 0;
    this.authoritativeHostPeerId = null; this.connectionState = 'HOSTING'; this.connectedPeersCount = 0;
    this.arenaEngine.players.forEach((p, i) => {
      p.peerId = i === 0 ? this.localPeerId : null; p.isBot = i !== 0;
      p.name = i === 0 ? this.hostName : DEFAULT_BOT_NAMES[i]; p.alive = i === 0 || this.arenaEngine.botDifficulty !== 'OFF';
    });
    this.syncEnginesRoster();
    try {
      const peer = this.createNetworkPeer(`${HOST_ID_PREFIX}${this.roomCode}`);
      this.peer = peer;
      peer.on('open', () => { if (this.peer === peer && this.isHost) this.onStatusUpdate(); });
      peer.on('disconnected', () => {
        if (this.peer === peer && this.isHost && !peer.destroyed) { try { peer.reconnect(); } catch { /* retry on heartbeat */ } }
      });
      peer.on('connection', conn => this.acceptConnection(peer, conn));
      peer.on('error', (error: { type?: string }) => {
        if (this.peer === peer && error.type === 'unavailable-id') this.joinRoomAsClient(this.roomCode, playerName);
      });
    } catch (error) { this.reportConfigurationError(error); }
    this.onStatusUpdate();
  }

  private acceptConnection(peer: Peer, conn: DataConnection): void {
    if (this.peer !== peer || !this.isHost || this.disposed || !peerId(conn.peer) || this.bannedPeerIds.has(conn.peer) ||
        (this.clientConns.size >= 12 && !this.clientConns.has(conn.peer))) { conn.close(); return; }
    const previous = this.clientConns.get(conn.peer);
    this.clientConns.set(conn.peer, conn);
    if (previous && previous !== conn) previous.close();
    const current = () => this.peer === peer && this.clientConns.get(conn.peer) === conn && this.isHost && !this.disposed;
    this.later(() => { if (current() && !this.connToLogicalPeer.has(conn.peer)) conn.close(); }, 15000);
    conn.on('open', () => { if (current()) this.onStatusUpdate(); });
    conn.on('data', raw => { if (current()) this.handleEnvelope(raw, reply => this.sendOverConn(conn, reply), conn); });
    const closed = () => {
      if (!current()) return;
      this.clientConns.delete(conn.peer); this.rates.delete(conn);
      const id = this.connToLogicalPeer.get(conn.peer); this.connToLogicalPeer.delete(conn.peer);
      this.joinReplies.delete(conn.peer);
      if (id) {
        // Preserve this player's slot and score through a short Wi-Fi interruption.
        // An explicit leave/kick still frees it immediately; heartbeat expires the reservation.
        const slot = this.peerToSlot.get(id);
        if (slot !== undefined) this.clearRemoteSlot(slot);
        if (slot !== undefined) this.continuousInputs.set(id, this.neutralInput(slot));
        this.inputLastSeen.delete(id);
        this.peerLastSeen.set(id, performance.now());
      }
      this.onStatusUpdate();
    };
    conn.on('close', closed); conn.on('error', closed);
  }

  public joinRoomAsClient(rawCode: string, name: string): void {
    if (this.disposed) return;
    this.localPilotName = cleanName(name);
    this.cleanupConnections();
    this.roomCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TP04';
    this.role = 'CLIENT'; this.isHost = false; this.localSlotId = 0; this.kickedNotice = null;
    this.clientStateSeq = 0; this.connectionState = 'CONNECTING'; this.activeGame = 'HUB';
    this.arenaEngine.players.forEach((p, i) => { p.name = i === 0 ? cleanName(name) : DEFAULT_BOT_NAMES[i]; p.isBot = i !== 0; p.alive = i === 0; });
    this.syncEnginesRoster();
    this.connectAsPeerClient(name);
  }

  public connectToRoom(rawCode: string, playerName: string): void { this.hostRoom(rawCode, playerName); }

  private connectAsPeerClient(name: string): void {
    if (this.disposed || this.isHost || this.kickedNotice) return;
    this.cleanupConnections();
    this.authoritativeHostPeerId = null; this.clientStateSeq = 0; this.lastSnapshotSeq = 0; this.hostEpoch = '';
    this.lastHostSnapReceivedAt = -10000; this.lastWorldSnapReceivedAt = performance.now();
    const hostId = `${HOST_ID_PREFIX}${this.roomCode}`;
    try {
      // Stable transport identity prevents changing envelope.sender to impersonate another occupied slot.
      const peer = this.createNetworkPeer(this.localPeerId);
      this.peer = peer;
      // ICE/DTLS or signaling can stall without emitting close/error. Bound setup
      // even before PeerJS opens so a player is never left joining indefinitely.
      this.later(() => {
        if (this.peer === peer && !this.isHost && this.connectionState !== 'CONNECTED_CLIENT') {
          this.cleanupConnections();
          this.scheduleReconnect();
        }
      }, 12000);
      peer.on('open', () => {
        if (this.peer !== peer || this.disposed || this.isHost) return;
        // In the installed PeerJS version this flag controls ordering only. Retransmission stays
        // reliable; newer snapshots/input no longer wait for a delayed older message to arrive.
        const conn = peer.connect(hostId, { reliable: this.networkOptions.ordered ?? false, serialization: 'raw' });
        this.hostConn = conn;
        const current = () => this.peer === peer && this.hostConn === conn && !this.disposed && !this.isHost;
        const claim = () => this.sendOverConn(conn, { sender: this.localPeerId, type: 'JOIN_CLAIM', payload: { peerId: this.localPeerId, name: this.localPilotName } });
        conn.on('open', () => {
          if (!current()) return;
          claim();
          if (this.connectionState !== 'CONNECTED_CLIENT') this.joinRetryTimer = setInterval(() => { if (current() && this.connectionState !== 'CONNECTED_CLIENT') claim(); }, 850);
        });
        conn.on('data', raw => { if (current()) this.handleEnvelope(raw, reply => this.sendOverConn(conn, reply), conn); });
        conn.on('close', () => { if (current()) this.scheduleReconnect(name); });
        conn.on('error', () => { if (current()) this.scheduleReconnect(name); });
      });
      peer.on('error', () => { if (this.peer === peer) this.scheduleReconnect(name); });
    } catch (error) { if (!this.reportConfigurationError(error)) this.scheduleReconnect(name); }
    this.onStatusUpdate();
  }

  private scheduleReconnect(name = this.localPilotName): void {
    if (this.isHost || this.disposed || this.kickedNotice || this.networkConfigurationError || this.reconnectTimer) return;
    if (this.joinRetryTimer) clearInterval(this.joinRetryTimer);
    this.joinRetryTimer = null;
    this.connectionState = 'RECONNECTING'; this.onStatusUpdate();
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connectAsPeerClient(this.localPilotName); }, 900);
  }

  /** Entry from transport callbacks. A sender string alone never grants permission. */
  public handleEnvelope(raw: unknown, reply: (env: NetEnvelope) => void, source?: DataConnection): void {
    if (!source || this.disposed) return;
    const now = performance.now();
    const rate = this.rates.get(source);
    if (!rate || now - rate.since > 1000) this.rates.set(source, { since: now, count: 1 });
    else if (++rate.count > 160) return;
    const env = this.parseEnvelope(raw);
    if (!env || env.sender === this.localPeerId) return;
    if (this.isHost) {
      if (this.clientConns.get(source.peer) !== source || env.sender !== source.peer || this.bannedPeerIds.has(source.peer)) return;
      if (env.type !== 'JOIN_CLAIM' && (this.connToLogicalPeer.get(source.peer) !== env.sender || !this.peerToSlot.has(env.sender))) return;
      if (!['JOIN_CLAIM', 'PEER_LEAVE', 'PING_REQ', 'PING_ACK', 'CLIENT_INPUT', 'DRAFT_PICK'].includes(env.type)) return;
      if (env.type !== 'JOIN_CLAIM' && env.type !== 'PING_REQ' && env.hostEpoch !== this.hostEpoch) return;
    } else {
      if (source !== this.hostConn || source.peer !== `${HOST_ID_PREFIX}${this.roomCode}`) return;
      if (['JOIN_CLAIM', 'CLIENT_INPUT', 'DRAFT_PICK', 'PEER_LEAVE'].includes(env.type)) return;
      if (env.type !== 'SLOT_ASSIGN' && env.type !== 'KICK_PEER' && (!this.authoritativeHostPeerId || env.sender !== this.authoritativeHostPeerId || env.hostEpoch !== this.hostEpoch)) return;
      if (this.authoritativeHostPeerId && env.sender !== this.authoritativeHostPeerId) return;
    }
    const p = env.payload;
    if (env.type === 'JOIN_CLAIM') {
      if (!record(p) || p.peerId !== env.sender || !text(p.name, 80)) return;
      if (now - (this.joinReplies.get(env.sender) ?? -10000) < 700) return;
      this.joinReplies.set(env.sender, now);
      const isNew = !this.peerToSlot.has(env.sender);
      const slotId = this.assignSlotForPeer(env.sender, cleanName(p.name));
      if (slotId < 1) { reply({ sender: this.localPeerId, type: 'KICK_PEER', payload: { targetPeerId: env.sender, reason: 'La sala está llena (4 jugadores).' } }); return; }
      this.connToLogicalPeer.set(source.peer, env.sender); this.peerToSlot.set(env.sender, slotId); this.peerLastSeen.set(env.sender, now);
      reply({ sender: this.localPeerId, type: 'SLOT_ASSIGN', payload: { peerId: env.sender, slotId, hostName: cleanName(this.arenaEngine.players[0].name), stateSeq: this.stateSeq, activeGame: this.activeGame, botDifficulty: this.arenaEngine.botDifficulty } });
      this.pingClient(env.sender, source);
      if (isNew) { const m = `🟢 ¡${cleanName(p.name)} SE UNIÓ A LA SALA! (SLOT ${slotId + 1})`; this.pushToast(m, 'join'); this.broadcastRoomEvent(m, 'join'); }
      this.broadcastHostSnapshot(true); this.onStatusUpdate();
    } else if (env.type === 'SLOT_ASSIGN') {
      if (!record(p) || p.peerId !== this.localPeerId || !integer(p.slotId, 1, 3) || !text(p.hostName, 80) || !integer(p.stateSeq, 1) ||
          !GAME_IDS.includes(String(p.activeGame)) || !BOT_LEVELS.includes(String(p.botDifficulty)) || !peerId(env.hostEpoch)) return;
      if (this.authoritativeHostPeerId && (env.hostEpoch !== this.hostEpoch || p.stateSeq < this.clientStateSeq)) return;
      const connecting = this.connectionState !== 'CONNECTED_CLIENT';
      this.authoritativeHostPeerId = env.sender; this.hostEpoch = env.hostEpoch; this.localSlotId = p.slotId;
      this.hostName = cleanName(p.hostName); this.clientStateSeq = p.stateSeq; this.activeGame = p.activeGame as ActiveGameId;
      this.arenaEngine.botDifficulty = p.botDifficulty as BotDifficulty; this.connectionState = 'CONNECTED_CLIENT'; this.lastHostSnapReceivedAt = now;
      if (this.joinRetryTimer) clearInterval(this.joinRetryTimer); if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.joinRetryTimer = null; this.reconnectTimer = null; this.syncEnginesRoster();
      if (connecting) this.pushToast(`🟢 CONECTADO A SALA #${this.roomCode} DE ${this.hostName} (SLOT ${p.slotId + 1})`, 'join');
      this.onStatusUpdate();
    } else if (env.type === 'GAME_SWITCH') {
      if (!record(p) || !integer(p.stateSeq, 1) || p.stateSeq <= this.clientStateSeq || !GAME_IDS.includes(String(p.activeGame)) ||
          !BOT_LEVELS.includes(String(p.botDifficulty)) || !integer(p.levelIndex, 0, 50) || !integer(p.holeIndex, 0, 50) || (p.arenaIndex !== undefined && !integer(p.arenaIndex, 0, 50))) return;
      this.clientStateSeq = p.stateSeq; this.activeGame = p.activeGame as ActiveGameId; this.arenaEngine.botDifficulty = p.botDifficulty as BotDifficulty;
      this.lastHostSnapReceivedAt = now; this.syncEnginesRoster(); this.onStatusUpdate();
    } else if (env.type === 'ROOM_ACTION') {
      if (!validAction(p) || !record(p) || !integer(p.stateSeq, 1) || p.stateSeq <= this.clientStateSeq) return;
      this.clientStateSeq = p.stateSeq; this.executeRoomAction(p as unknown as RoomActionMsg); this.onStatusUpdate();
    } else if (env.type === 'PEER_LEAVE') {
      if (!record(p) || p.peerId !== env.sender) return;
      this.connToLogicalPeer.delete(source.peer); this.freeSlotForPeer(env.sender);
    } else if (env.type === 'ROOM_EVENT') {
      if (record(p) && text(p.text, 240) && ['join', 'leave', 'info', 'warn'].includes(String(p.tone))) this.pushToast(p.text, p.tone as RoomToastEvent['tone']);
    } else if (env.type === 'KICK_PEER') {
      if (!record(p) || p.targetPeerId !== this.localPeerId || !text(p.reason, 240)) return;
      this.kickedNotice = cleanText(p.reason); this.cleanupConnections(); this.onStatusUpdate();
    } else if (env.type === 'PING_REQ') {
      if (this.isHost) {
        if (!finite(p, 0, 1e15)) return;
        this.peerLastSeen.set(env.sender, now);
      } else if (!record(p) || !peerId(p.nonce) || !finite(p.sentAtMs, 0, 1e15)) return;
      reply({ sender: this.localPeerId, type: 'PING_ACK', payload: p });
    } else if (env.type === 'PING_ACK') {
      if (this.isHost) {
        const ping = this.pendingPings.get(env.sender);
        if (!record(p) || !ping || p.nonce !== ping.nonce || !finite(p.sentAtMs, 0, 1e15)) return;
        this.pendingPings.delete(env.sender);
        this.peerRtt.set(env.sender, Math.max(0, now - ping.at));
        this.peerLastSeen.set(env.sender, now);
        return;
      }
      if (!finite(p, 0, now)) return;
      this.lastHostSnapReceivedAt = now; this.pingMs = Math.max(1, Math.round(now - p));
    } else if (env.type === 'CLIENT_INPUT') {
      this.receiveInput(env.sender, p, now);
    } else if (env.type === 'WORLD_SNAP') {
      this.receiveSnapshot(p, now);
    } else if (env.type === 'DRAFT_PICK') {
      if (!record(p) || p.slotId !== this.peerToSlot.get(env.sender) || !text(p.modId, 80) || this.activeGame !== 'BASH_BOT' ||
          this.arenaEngine.phase !== 'CARD_DRAFT' || !this.arenaEngine.draftOptions.includes(p.modId)) return;
      this.peerLastSeen.set(env.sender, now); this.arenaEngine.selectDraftMod(p.slotId as number, p.modId); this.broadcastHostSnapshot(true); this.onStatusUpdate();
    }
  }

  private receiveInput(id: string, p: unknown, now: number): void {
    if (!validInput(p) || p.slotId !== this.peerToSlot.get(id) || !integer(p.inputSeq, 1) ||
        p.stateSeq !== this.stateSeq || p.activeGame !== this.activeGame || p.roundEpoch !== this.activeRoundEpoch) return;
    const snapshotAt = this.snapshotSentTimes.get(p.lastSeenSnapshotSeq ?? 0);
    if (snapshotAt === undefined || now - snapshotAt > 500) return;
    const newMovement = p.inputSeq > (this.latestInputSeq.get(id) ?? 0);
    const newAction = this.acceptAction(id, p);
    if (!newMovement && !newAction) return;
    this.peerLastSeen.set(id, now);
    const input = { ...p, name: cleanName(p.name) };
    // Client timestamps and claims never determine lag compensation on the host.
    input.lagCompensationMs = Math.min(180, (this.peerRtt.get(id) ?? 0) / 2 + 40);
    const length = Math.hypot(input.moveX, input.moveY); if (length > 1) { input.moveX /= length; input.moveY /= length; }
    const player = this.arenaEngine.players[input.slotId];
    const changed = newMovement && (player.name !== input.name || JSON.stringify(player.cosmetics) !== JSON.stringify(input.cosmetics ?? player.cosmetics));
    if (newMovement) {
      this.latestInputSeq.set(id, p.inputSeq); this.inputLastSeen.set(id, now); this.staleInputs.delete(id);
      player.name = input.name; if (input.cosmetics) player.cosmetics = { ...input.cosmetics };
      this.continuousInputs.set(id, this.continuousInput(input));
    }
    // Old movement may carry a still-fresh, unseen discrete event. Apply its original aim and
    // direction once, then restore the newest held controls and identity without replaying it.
    input.name = player.name; input.cosmetics = player.cosmetics;
    if (newAction) {
      const dispatch = (this.dispatchedActionSeq.get(id) ?? 0) + 1;
      this.dispatchedActionSeq.set(id, dispatch); input.actionSeq = dispatch;
    }
    const tournament = this.tournamentManager;
    if (this.gameplayIsActive && !(tournament?.state.active && (tournament.state.rouletteSpinning || tournament.state.isFinished || tournament.isIntermission))) {
      if (newAction) this.applyRemoteInput(input);
      if (newMovement && !newAction || newAction && !newMovement) {
        this.applyRemoteInput(this.continuousInputs.get(id) ?? this.neutralInput(input.slotId));
      }
    }
    if (changed) { this.syncEnginesRoster(); this.broadcastHostSnapshot(true); this.onStatusUpdate(); }
  }

  private receiveSnapshot(value: unknown, now: number): void {
    if (!validSnapshot(value)) return;
    const snap = value as WorldSnapshotPacket;
    if (snap.hostEpoch !== this.hostEpoch || snap.stateSeq! < this.clientStateSeq || snap.snapshotSeq! <= this.lastSnapshotSeq) return;
    const prevGame = this.activeGame, prevDiff = this.arenaEngine.botDifficulty, prevPhase = this.arenaEngine.phase;
    const prevHumans = this.arenaEngine.players.filter(p => !p.isBot).length;
    this.lastSnapshotSeq = snap.snapshotSeq!; this.clientStateSeq = snap.stateSeq!; this.activeGame = snap.activeGame;
    this.hostName = cleanName(snap.hostName || 'ANFITRION'); this.lastHostSnapReceivedAt = now; this.lastWorldSnapReceivedAt = now;
    snap.players.forEach(p => { p.name = cleanName(p.name); });
    const predictionLeadSeconds = Math.min(0.12, this.pingMs / 2000);
    this.arenaEngine.applySnapshot(snap, this.localSlotId, predictionLeadSeconds);
    if (snap.chainState) this.chainEngine.applySnapshot(snap.chainState, this.localSlotId, predictionLeadSeconds);
    if (snap.puttState) this.puttEngine?.applySnapshot(snap.puttState, this.localSlotId, predictionLeadSeconds);
    if (snap.hotCoreState) this.hotCoreEngine?.applySnapshot(snap.hotCoreState, this.localSlotId, predictionLeadSeconds);
    if (snap.voltCrownState) this.voltCrownEngine?.applySnapshot(snap.voltCrownState, this.localSlotId, predictionLeadSeconds);
    if (snap.hexCrushState) this.hexCrushEngine?.applySnapshot(snap.hexCrushState, this.localSlotId, predictionLeadSeconds);
    if (snap.ricochetState) this.ricochetEngine?.applySnapshot(snap.ricochetState, this.localSlotId, predictionLeadSeconds);
    if (snap.tournamentState) this.tournamentManager?.applySnapshot(snap.tournamentState);
    this.syncEnginesRoster();
    if (prevGame !== this.activeGame || prevDiff !== this.arenaEngine.botDifficulty || prevPhase !== this.arenaEngine.phase ||
        prevHumans !== this.arenaEngine.players.filter(p => !p.isBot).length || snap.tick % 15 === 0) this.onStatusUpdate();
  }

  private assignSlotForPeer(id: string, name: string): number {
    const existing = this.arenaEngine.players.find((p, i) => i > 0 && p.peerId === id && !p.isBot);
    if (existing) { existing.name = cleanName(name); return existing.id; }
    const p = this.arenaEngine.players.find((p, i) => i > 0 && p.isBot);
    if (!p) return -1;
    this.clearRemoteSlot(p.id); p.peerId = id; p.isBot = false; p.name = cleanName(name); p.alive = true; p.cosmetics = undefined;
    this.connectedPeersCount = this.arenaEngine.players.filter((p, i) => i > 0 && !p.isBot).length;
    this.syncEnginesRoster(); return p.id;
  }

  public sendClientInput(input: ClientInputPacket): void {
    if (!this.disposed) this.localPilotName = cleanName(input.name);
    if (this.isHost || this.disposed || this.connectionState !== 'CONNECTED_CLIENT') return;
    const now = performance.now();
    const discrete = input.parryPressed || input.dashPressed || input.yankPressed || input.emotePressed > 0 || input.shotReleasedPower !== undefined;
    if (discrete) {
      this.pendingActions.push({ actionSeq: ++this.clientActionSeq, at: now, stateSeq: this.clientStateSeq, activeGame: this.activeGame, roundEpoch: this.activeRoundEpoch, parryPressed: input.parryPressed, dashPressed: input.dashPressed,
        yankPressed: input.yankPressed, emotePressed: input.emotePressed, shotReleasedPower: input.shotReleasedPower, feintPrimed: input.feintPrimed });
      if (this.pendingActions.length > 16) this.pendingActions.shift();
    }
    // Late actions are discarded after the same short window used to neutralize disconnected movement.
    while (this.pendingActions[0] && (now - this.pendingActions[0].at > INPUT_EXPIRY_MS || this.pendingActions[0].stateSeq !== this.clientStateSeq || this.pendingActions[0].activeGame !== this.activeGame || this.pendingActions[0].roundEpoch !== this.activeRoundEpoch)) this.pendingActions.shift();
    const urgent = this.pendingActions.length > 0 || input.chargingParry !== this.lastChargingState;
    if (!urgent && now - this.lastClientInputSentAt < 35) return;
    if (!this.hostConn?.open || this.isCongested(this.hostConn)) return;
    const outgoing: ClientInputPacket = { ...input, slotId: this.localSlotId, inputSeq: ++this.inputSeq,
      stateSeq: this.clientStateSeq, activeGame: this.activeGame, roundEpoch: this.activeRoundEpoch, lastSeenSnapshotSeq: this.lastSnapshotSeq, sentAtMs: now };
    const action = this.pendingActions[0];
    if (action) { const { at: _at, stateSeq: _seq, activeGame: _game, roundEpoch: _epoch, ...flags } = action; Object.assign(outgoing, flags); }
    if (this.sendToHost({ sender: this.localPeerId, type: 'CLIENT_INPUT', payload: outgoing })) {
      if (action) this.pendingActions.shift();
      this.lastChargingState = input.chargingParry; this.lastClientInputSentAt = now;
    }
  }

  public broadcastHostSnapshot(force = false): void {
    if (!this.isHost || this.disposed) return;
    const now = performance.now(); if (!force && now - this.lastRtcSnapSentAt < 46) return;
    this.lastRtcSnapSentAt = now;
    const snap = this.arenaEngine.getSnapshot();
    snap.stateSeq = this.stateSeq; snap.snapshotSeq = ++this.snapshotSeq; snap.hostEpoch = this.hostEpoch;
    this.snapshotSentTimes.set(snap.snapshotSeq, now);
    while (this.snapshotSentTimes.size > 128) this.snapshotSentTimes.delete(this.snapshotSentTimes.keys().next().value!);
    snap.hostName = cleanName(this.arenaEngine.players[0]?.name || this.hostName); snap.activeGame = this.activeGame;
    snap.botDifficulty = this.arenaEngine.botDifficulty; snap.hostSentAtMs = now;
    if (this.activeGame === 'CHAIN_PANIC') snap.chainState = this.chainEngine.getSnapshot();
    else if (this.activeGame === 'TURBO_PUTT') snap.puttState = this.puttEngine?.getSnapshot();
    else if (this.activeGame === 'HOT_CORE') snap.hotCoreState = this.hotCoreEngine?.getSnapshot();
    else if (this.activeGame === 'VOLT_CROWN') snap.voltCrownState = this.voltCrownEngine?.getSnapshot();
    else if (this.activeGame === 'HEX_CRUSH') snap.hexCrushState = this.hexCrushEngine?.getSnapshot();
    else if (this.activeGame === 'RICOCHET_1') snap.ricochetState = this.ricochetEngine?.getSnapshot();
    // Include inactive state too, so stopping a tournament also clears it on clients.
    if (this.tournamentManager) snap.tournamentState = this.tournamentManager.getSnapshot();
    this.sendToAllClients({ sender: this.localPeerId, type: 'WORLD_SNAP', payload: snap });
  }

  public submitDraftSelection(modId: string): void {
    if (!text(modId, 80)) return;
    if (this.isHost) { this.arenaEngine.selectDraftMod(this.localSlotId, modId); this.broadcastHostSnapshot(true); }
    else this.sendToHost({ sender: this.localPeerId, type: 'DRAFT_PICK', payload: { slotId: this.localSlotId, modId } });
  }
}
