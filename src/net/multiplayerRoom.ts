import Peer, { DataConnection } from 'peerjs';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { HotCoreEngine } from '../game/hotCoreEngine';
import { PuttWarEngine } from '../game/puttWarEngine';
import {
  ActiveGameId,
  BotDifficulty,
  ChainGameMode,
  ClientInputPacket,
  WorldSnapshotPacket
} from '../types';

export type RoomConnectionState = 'HOSTING' | 'CONNECTING' | 'CONNECTED_CLIENT' | 'RECONNECTING';
export type RoomPeerRole = 'HOST' | 'CLIENT';

export interface RoomToastEvent {
  id: number;
  text: string;
  tone: 'join' | 'leave' | 'info' | 'warn';
}

export interface NetEnvelope {
  sender: string;
  type:
    | 'JOIN_CLAIM'
    | 'SLOT_ASSIGN'
    | 'GAME_SWITCH'
    | 'ROOM_ACTION'
    | 'CLIENT_INPUT'
    | 'WORLD_SNAP'
    | 'DRAFT_PICK'
    | 'KICK_PEER'
    | 'PEER_LEAVE'
    | 'ROOM_EVENT'
    | 'PING_REQ'
    | 'PING_ACK';
  payload: unknown;
}

interface JoinClaimMsg {
  peerId: string;
  name: string;
}

interface SlotAssignMsg {
  peerId: string;
  slotId: number;
  hostName: string;
  stateSeq: number;
  activeGame: ActiveGameId;
  botDifficulty: BotDifficulty;
}

interface GameSwitchMsg {
  stateSeq: number;
  activeGame: ActiveGameId;
  botDifficulty: BotDifficulty;
  levelIndex: number;
  holeIndex: number;
  arenaIndex?: number;
}

export interface RoomActionMsg {
  kind: 'BOT_DIFF' | 'LOAD_STAGE' | 'CHAIN_MODE' | 'RESET_MATCH';
  botDifficulty?: BotDifficulty;
  levelIndex?: number;
  holeIndex?: number;
  arenaIndex?: number;
  chainMode?: ChainGameMode;
}

interface DraftPickMsg {
  slotId: number;
  modId: string;
}

interface KickPeerMsg {
  targetPeerId: string;
  reason: string;
}

interface RoomEventMsg {
  text: string;
  tone: 'join' | 'leave' | 'info' | 'warn';
}

const HOST_ID_PREFIX = 'tp04-deck-room-v4-';
const DEFAULT_BOT_NAMES = ['UNIT-01', 'LEO-BOT', 'MAX-BOT', 'NICO-BOT'];

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

function compactJsonStringify(env: NetEnvelope): string {
  return JSON.stringify(env, (_key, val: unknown) =>
    typeof val === 'number' && !Number.isInteger(val) ? Math.round(val * 100) / 100 : val
  );
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class MultiplayerRoomManager {
  public roomCode = 'TP04';
  public localPeerId: string;
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
  public toasts: RoomToastEvent[] = [];

  private arenaEngine: ArenaEngine;
  private chainEngine: ChainPanicEngine;
  private puttEngine?: PuttWarEngine;
  private hotCoreEngine?: HotCoreEngine;
  private onStatusUpdate: () => void;

  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private authoritativeHostPeerId: string | null = null;
  private clientConns = new Map<string, DataConnection>();
  private connToLogicalPeer = new Map<string, string>();
  private peerToSlot = new Map<string, number>();
  private peerLastSeen = new Map<string, number>();
  private localBus: BroadcastChannel | null = null;

  private lastHostSnapReceivedAt = -10000;
  private lastRtcSnapSentAt = 0;
  private lastClientInputSentAt = 0;
  private lastChargingState = false;
  private clientActionSeq = 0;
  private activeActionBurst: {
    actionSeq: number;
    remainingSends: number;
    parryPressed: boolean;
    dashPressed: boolean;
    yankPressed?: boolean;
    emotePressed: number;
    shotReleasedPower?: number;
    feintPrimed?: boolean;
  } | null = null;
  private rtcBroadcastCounter = 0;
  private nextToastId = 1;
  private joinRetryTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    arenaEngine: ArenaEngine,
    chainEngine: ChainPanicEngine,
    onStatusUpdate: () => void,
    puttEngine?: PuttWarEngine,
    hotCoreEngine?: HotCoreEngine
  ) {
    this.arenaEngine = arenaEngine;
    this.chainEngine = chainEngine;
    this.onStatusUpdate = onStatusUpdate;
    this.puttEngine = puttEngine;
    this.hotCoreEngine = hotCoreEngine;

    // Always generate a unique peer ID per tab instance so duplicated tabs never collide!
    this.localPeerId =
      'P-' +
      Math.random().toString(36).substring(2, 7).toUpperCase() +
      '-' +
      Math.floor(10 + Math.random() * 89);

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.disconnectCleanly();
      });
    }

    this.startHeartbeatMonitor();
  }

  public pushToast(text: string, tone: 'join' | 'leave' | 'info' | 'warn' = 'info'): void {
    const id = this.nextToastId++;
    this.toasts.push({ id, text, tone });
    if (this.toasts.length > 4) {
      this.toasts.shift();
    }
    this.onStatusUpdate();
    setTimeout(() => {
      const idx = this.toasts.findIndex((t) => t.id === id);
      if (idx !== -1) {
        this.toasts.splice(idx, 1);
        this.onStatusUpdate();
      }
    }, 4200);
  }

  /**
   * Only the authoritative Host steps full game physics and bot AI.
   * Clients run local client-side prediction (`stepClientPrediction`) and apply Host snapshots,
   * so Clients NEVER spawn local bots or reset rounds on their own!
   */
  public shouldStepLocally(): boolean {
    return this.isHost;
  }

  private parseEnvelope(raw: unknown): NetEnvelope | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as NetEnvelope;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as NetEnvelope;
    }
    return null;
  }

  private sendOverConn(conn: DataConnection | null | undefined, env: NetEnvelope): void {
    if (!conn || !conn.open) return;
    try {
      conn.send(compactJsonStringify(env));
    } catch {
      // Ignore transient WebRTC send error
    }
  }

  private sendToAllClients(env: NetEnvelope): void {
    this.localBus?.postMessage(env);
    const serialized = compactJsonStringify(env);
    this.clientConns.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(serialized);
        } catch {
          // Ignore transient send error
        }
      }
    });
  }

  private sendToHost(env: NetEnvelope): void {
    this.localBus?.postMessage(env);
    this.sendOverConn(this.hostConn, env);
  }

  /**
   * Switches the active game cartridge for EVERYONE in the room.
   * - If called on the Host: increments `stateSeq`, transitions immediately, and broadcasts to all Clients.
   * - If called on a Client: NEVER mutates `this.activeGame` locally! Instead sends a request to the Host,
   *   and transitions only when the Host's authoritative `stateSeq` update arrives.
   */
  public switchGame(nextGame: ActiveGameId): void {
    if (this.isHost) {
      this.stateSeq++;
      this.activeGame = nextGame;
      this.syncEnginesRoster();

      if (nextGame === 'BASH_BOT') {
        this.arenaEngine.phase = 'PLAYING';
        this.arenaEngine.spawnRound();
      } else if (nextGame === 'CHAIN_PANIC') {
        this.chainEngine.loadLevel(this.chainEngine.levelIndex);
      } else if (nextGame === 'TURBO_PUTT') {
        this.puttEngine?.loadHole(this.puttEngine.holeIndex);
      } else if (nextGame === 'HOT_CORE') {
        this.hotCoreEngine?.loadArena(this.hotCoreEngine.arenaIndex);
      }

      const switchEnv: NetEnvelope = {
        sender: this.localPeerId,
        type: 'GAME_SWITCH',
        payload: {
          stateSeq: this.stateSeq,
          activeGame: nextGame,
          botDifficulty: this.arenaEngine.botDifficulty,
          levelIndex: this.chainEngine.levelIndex,
          holeIndex: this.puttEngine?.holeIndex ?? 0,
          arenaIndex: this.hotCoreEngine?.arenaIndex ?? 0
        } satisfies GameSwitchMsg
      };

      // Send immediately + redundant bursts at 90ms and 220ms so no peer ever misses the transition!
      this.sendToAllClients(switchEnv);
      this.broadcastHostSnapshot(true);
      const targetSeq = this.stateSeq;
      setTimeout(() => {
        if (this.isHost && this.stateSeq === targetSeq) {
          this.sendToAllClients(switchEnv);
          this.broadcastHostSnapshot(true);
        }
      }, 90);
      setTimeout(() => {
        if (this.isHost && this.stateSeq === targetSeq) {
          this.sendToAllClients(switchEnv);
          this.broadcastHostSnapshot(true);
        }
      }, 220);
      this.onStatusUpdate();
    } else {
      // CLIENT: Never mutate `this.activeGame` locally!
      // If the Client wants to return to HUB during a match, remind them only Host controls the room screen.
      if (nextGame === 'HUB') {
        this.pushToast('👑 Solo el Anfitrión puede volver al Hub grupal (o usa SALIR DE SALA)', 'info');
        return;
      }
      // Forward game request to Host; Client will transition as soon as Host's stateSeq arrives!
      this.sendToHost({
        sender: this.localPeerId,
        type: 'GAME_SWITCH',
        payload: {
          stateSeq: this.clientStateSeq,
          activeGame: nextGame,
          botDifficulty: this.arenaEngine.botDifficulty,
          levelIndex: this.chainEngine.levelIndex,
          holeIndex: this.puttEngine?.holeIndex ?? 0,
          arenaIndex: this.hotCoreEngine?.arenaIndex ?? 0
        } satisfies GameSwitchMsg
      });
    }
  }

  /**
   * Synchronizes room-wide actions (Bot difficulty, Sector/Hole change, Chain mode, Reset)
   */
  public sendOrApplyRoomAction(action: RoomActionMsg): void {
    if (this.isHost) {
      this.stateSeq++;
      this.executeRoomAction(action);
      const env: NetEnvelope = {
        sender: this.localPeerId,
        type: 'ROOM_ACTION',
        payload: action
      };
      this.sendToAllClients(env);
      this.broadcastHostSnapshot(true);
      this.onStatusUpdate();
    } else {
      this.sendToHost({
        sender: this.localPeerId,
        type: 'ROOM_ACTION',
        payload: action
      });
    }
  }

  private executeRoomAction(action: RoomActionMsg): void {
    if (action.kind === 'BOT_DIFF' && action.botDifficulty) {
      this.arenaEngine.botDifficulty = action.botDifficulty;
      this.syncEnginesRoster();
      if (this.isHost) {
        this.arenaEngine.spawnRound();
        this.chainEngine.loadLevel(this.chainEngine.levelIndex);
        this.puttEngine?.loadHole(this.puttEngine.holeIndex);
        this.hotCoreEngine?.loadArena(this.hotCoreEngine.arenaIndex);
      }
    } else if (action.kind === 'LOAD_STAGE') {
      if (typeof action.levelIndex === 'number' && this.chainEngine.levelIndex !== action.levelIndex) {
        this.chainEngine.loadLevel(action.levelIndex);
      }
      if (
        typeof action.holeIndex === 'number' &&
        this.puttEngine &&
        this.puttEngine.holeIndex !== action.holeIndex
      ) {
        this.puttEngine.loadHole(action.holeIndex);
      }
      if (
        typeof action.arenaIndex === 'number' &&
        this.hotCoreEngine &&
        this.hotCoreEngine.arenaIndex !== action.arenaIndex
      ) {
        this.hotCoreEngine.loadArena(action.arenaIndex);
      }
    } else if (action.kind === 'CHAIN_MODE' && action.chainMode) {
      this.chainEngine.mode = action.chainMode;
      if (this.isHost) {
        this.chainEngine.loadLevel(this.chainEngine.levelIndex);
      }
    } else if (action.kind === 'RESET_MATCH' && this.isHost) {
      if (this.activeGame === 'CHAIN_PANIC') {
        this.chainEngine.loadLevel(this.chainEngine.levelIndex);
      } else if (this.activeGame === 'TURBO_PUTT') {
        this.puttEngine?.loadHole(this.puttEngine.holeIndex);
      } else if (this.activeGame === 'HOT_CORE') {
        this.hotCoreEngine?.resetChampionship();
      } else {
        this.arenaEngine.resetChampionship();
      }
    }
  }

  public syncEnginesRoster(): void {
    const botsActive = this.arenaEngine.botDifficulty !== 'OFF';
    this.arenaEngine.players.forEach((p) => {
      if (p.isBot && !botsActive) {
        p.alive = false;
      }
    });
    const roster = this.arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot }));
    this.chainEngine.syncPlayerIdentities(roster, botsActive);
    this.puttEngine?.syncPlayerIdentities(roster, botsActive);
    this.hotCoreEngine?.syncPlayerIdentities(roster, botsActive);
  }

  /**
   * Host action: Kick & ban a connected player in slotId (1..3) from the room.
   */
  public kickPlayerSlot(slotId: number): boolean {
    if (!this.isHost || slotId <= 0) return false;
    const target = this.arenaEngine.players[slotId];
    if (!target || target.isBot || !target.peerId) return false;

    const kickedPeerId = target.peerId;
    const kickedName = target.name;
    this.bannedPeerIds.add(kickedPeerId);

    const kickEnv: NetEnvelope = {
      sender: this.localPeerId,
      type: 'KICK_PEER',
      payload: {
        targetPeerId: kickedPeerId,
        reason: `Fuiste vetado de la sala #${this.roomCode} por el Host.`
      } satisfies KickPeerMsg
    };

    this.sendToAllClients(kickEnv);
    this.freeSlotForPeer(kickedPeerId, `🚫 ${kickedName} FUE VETADO DE LA SALA`);
    return true;
  }

  public clearBanList(): void {
    this.bannedPeerIds.clear();
    this.pushToast('Lista de vetados desbloqueada', 'info');
    this.onStatusUpdate();
  }

  private freeSlotForPeer(peerId: string, customReason?: string): void {
    const slotPlayer = this.arenaEngine.players.find(
      (p, idx) => idx > 0 && p.peerId === peerId && !p.isBot
    );
    this.peerToSlot.delete(peerId);
    this.peerLastSeen.delete(peerId);

    if (!slotPlayer) return;

    const departedName = slotPlayer.name;
    const slotIdx = slotPlayer.id;
    slotPlayer.peerId = null;
    slotPlayer.isBot = true;
    slotPlayer.name = DEFAULT_BOT_NAMES[slotIdx] || `BOT-0${slotIdx + 1}`;
    slotPlayer.alive = this.arenaEngine.botDifficulty !== 'OFF';

    this.connectedPeersCount = this.arenaEngine.players.filter(
      (p, idx) => idx > 0 && !p.isBot
    ).length;

    this.syncEnginesRoster();
    const msg = customReason || `👋 ${departedName} SALIÓ DE LA SALA`;
    this.pushToast(msg, 'leave');
    this.broadcastRoomEvent(msg, 'leave');
    this.broadcastHostSnapshot(true);
    this.onStatusUpdate();
  }

  private broadcastRoomEvent(text: string, tone: 'join' | 'leave' | 'info' | 'warn'): void {
    if (!this.isHost) return;
    const env: NetEnvelope = {
      sender: this.localPeerId,
      type: 'ROOM_EVENT',
      payload: { text, tone } satisfies RoomEventMsg
    };
    this.sendToAllClients(env);
  }

  private startHeartbeatMonitor(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      const now = performance.now();
      if (this.isHost) {
        // Keep Host PeerJS signaling connection alive so 0.peerjs.com never drops the room registration
        if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
          try {
            this.peer.reconnect();
          } catch {
            // Ignore reconnect error
          }
        }
        // Tolerate up to 25 seconds of bad Wi-Fi freeze before freeing a human player's slot!
        this.peerLastSeen.forEach((lastSeen, peerId) => {
          if (now - lastSeen > 25000) {
            this.freeSlotForPeer(peerId);
          }
        });
      } else {
        // Client: send periodic PING_REQ so Host always knows we're alive even while idling in the Hub!
        const pingEnv: NetEnvelope = {
          sender: this.localPeerId,
          type: 'PING_REQ',
          payload: now
        };
        this.sendToHost(pingEnv);

        // If Host connection dropped for >12 seconds, reconnect to Host peer NON-DESTRUCTIVELY
        if (
          this.connectionState === 'CONNECTED_CLIENT' &&
          this.lastHostSnapReceivedAt > 0 &&
          now - this.lastHostSnapReceivedAt > 12000
        ) {
          this.connectionState = 'RECONNECTING';
          this.onStatusUpdate();
          const myName = this.arenaEngine.players[this.localSlotId]?.name || 'PILOTO';
          this.connectAsPeerClient(`${HOST_ID_PREFIX}${this.roomCode}`, myName);
        }
      }
    }, 1400);
  }

  public disconnectCleanly(): void {
    const leaveEnv: NetEnvelope = {
      sender: this.localPeerId,
      type: 'PEER_LEAVE',
      payload: { peerId: this.localPeerId }
    };
    try {
      this.sendToHost(leaveEnv);
      this.clientConns.forEach((c) => c.close());
      this.hostConn?.close();
      this.peer?.destroy();
    } catch {
      // Ignore unload errors
    }
  }

  private cleanupConnections(): void {
    if (this.joinRetryTimer) {
      clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.clientConns.forEach((c) => {
      try {
        c.close();
      } catch {
        // Ignore close error
      }
    });
    this.clientConns.clear();
    this.connToLogicalPeer.clear();
    this.peerToSlot.clear();
    this.peerLastSeen.clear();

    if (this.hostConn) {
      try {
        this.hostConn.close();
      } catch {
        // Ignore close error
      }
      this.hostConn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // Ignore destroy error
      }
      this.peer = null;
    }
    if (this.localBus) {
      this.localBus.close();
      this.localBus = null;
    }
  }

  /**
   * EXPLICIT HOST FLOW: Creates & owns a room as the authoritative Host (`👑 ANFITRIÓN`).
   */
  public hostRoom(rawCode: string, playerName: string): void {
    const cleanCode =
      (rawCode.trim().toUpperCase() || 'TP04').replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TP04';
    this.roomCode = cleanCode;
    this.cleanupConnections();

    this.role = 'HOST';
    this.isHost = true;
    this.hostName = playerName.toUpperCase() || 'ALEX';
    this.stateSeq = 1;
    this.clientStateSeq = 0;
    this.connectionState = 'HOSTING';
    this.localSlotId = 0;
    this.connectedPeersCount = 0;
    this.authoritativeHostPeerId = null;

    this.arenaEngine.players.forEach((p, idx) => {
      if (idx === 0) {
        p.peerId = this.localPeerId;
        p.isBot = false;
        p.name = playerName.toUpperCase();
        p.alive = true;
      } else {
        p.peerId = null;
        p.isBot = true;
        p.name = DEFAULT_BOT_NAMES[idx] || `BOT-0${idx + 1}`;
        p.alive = this.arenaEngine.botDifficulty !== 'OFF';
      }
    });
    this.syncEnginesRoster();

    const hostPeerId = `${HOST_ID_PREFIX}${cleanCode}`;
    try {
      const peer = new Peer(hostPeerId, {
        config: { iceServers: ICE_SERVERS }
      });
      this.peer = peer;

      peer.on('open', () => {
        if (!this.isHost) return;
        this.connectionState = 'HOSTING';
        this.onStatusUpdate();
      });

      peer.on('disconnected', () => {
        if (this.isHost && this.peer === peer && !peer.destroyed) {
          try {
            peer.reconnect();
          } catch {
            // Ignore reconnect error
          }
        }
      });

      peer.on('connection', (conn) => {
        this.clientConns.set(conn.peer, conn);

        conn.on('open', () => {
          this.clientConns.set(conn.peer, conn);
          this.onStatusUpdate();
        });

        conn.on('data', (raw) => {
          this.clientConns.set(conn.peer, conn);
          const env = this.parseEnvelope(raw);
          if (!env) return;
          if (env.sender) {
            this.connToLogicalPeer.set(conn.peer, env.sender);
            this.peerLastSeen.set(env.sender, performance.now());
          }
          this.handleEnvelope(env, (reply) => {
            this.sendOverConn(conn, reply);
          });
        });

        conn.on('close', () => {
          this.clientConns.delete(conn.peer);
          const logicalPeerId = this.connToLogicalPeer.get(conn.peer);
          this.connToLogicalPeer.delete(conn.peer);
          if (logicalPeerId) {
            this.freeSlotForPeer(logicalPeerId);
          }
          this.onStatusUpdate();
        });

        conn.on('error', () => {
          this.clientConns.delete(conn.peer);
          const logicalPeerId = this.connToLogicalPeer.get(conn.peer);
          this.connToLogicalPeer.delete(conn.peer);
          if (logicalPeerId) {
            this.freeSlotForPeer(logicalPeerId);
          }
        });
      });

      peer.on('error', (err: { type?: string }) => {
        if (err.type === 'unavailable-id') {
          // Someone is already hosting this room code! Switch immediately to Client mode.
          this.joinRoomAsClient(cleanCode, playerName);
        }
      });
    } catch {
      // Offline / unit-test fallback
    }

    this.onStatusUpdate();
  }

  /**
   * EXPLICIT CLIENT FLOW: Joins an existing room strictly as a Client (`🎮 INVITADO`).
   * Never attempts to register the Host PeerID, never becomes a fake Host, and never spawns local bots!
   */
  public joinRoomAsClient(rawCode: string, playerName: string): void {
    const cleanCode =
      (rawCode.trim().toUpperCase() || 'TP04').replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TP04';
    this.roomCode = cleanCode;
    this.cleanupConnections();

    this.role = 'CLIENT';
    this.isHost = false;
    this.clientStateSeq = 0;
    this.authoritativeHostPeerId = null;
    this.connectionState = 'CONNECTING';
    this.activeGame = 'HUB';

    // Hide all local bot placeholders while waiting for the Host's authoritative snapshot
    this.arenaEngine.players.forEach((p, idx) => {
      if (idx === 0) {
        p.name = playerName.toUpperCase();
        p.isBot = false;
        p.alive = true;
      } else {
        p.isBot = true;
        p.alive = false;
      }
    });
    this.syncEnginesRoster();

    const hostPeerId = `${HOST_ID_PREFIX}${cleanCode}`;
    this.connectAsPeerClient(hostPeerId, playerName);
  }

  /**
   * Alias for `hostRoom` kept for compatibility.
   */
  public connectToRoom(rawCode: string, playerName: string): void {
    this.hostRoom(rawCode, playerName);
  }

  private connectAsPeerClient(hostPeerId: string, playerName: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.joinRetryTimer) {
      clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }
    if (this.hostConn) {
      try {
        this.hostConn.close();
      } catch {
        // Ignore close error
      }
      this.hostConn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // Ignore destroy error
      }
      this.peer = null;
    }

    // Lock this tab into Client mode so it NEVER runs local Host bot AI or resets rounds!
    this.role = 'CLIENT';
    this.isHost = false;
    if (this.connectionState !== 'CONNECTED_CLIENT' && this.connectionState !== 'RECONNECTING') {
      this.connectionState = 'CONNECTING';
      this.arenaEngine.players.forEach((p, idx) => {
        if (idx > 0 && p.isBot) {
          p.alive = false;
        }
      });
      this.syncEnginesRoster();
    }
    this.onStatusUpdate();

    try {
      const clientPeer = new Peer({
        config: { iceServers: ICE_SERVERS }
      });
      this.peer = clientPeer;

      clientPeer.on('open', () => {
        const conn = clientPeer.connect(hostPeerId, { reliable: true });
        this.hostConn = conn;

        const sendJoinClaim = () => {
          const currentName =
            this.arenaEngine.players[this.localSlotId]?.name || playerName.toUpperCase();
          const claimEnv: NetEnvelope = {
            sender: this.localPeerId,
            type: 'JOIN_CLAIM',
            payload: { peerId: this.localPeerId, name: currentName } satisfies JoinClaimMsg
          };
          this.localBus?.postMessage(claimEnv);
          this.sendOverConn(conn, claimEnv);
        };

        conn.on('open', () => {
          if (this.hostConn !== conn) return;
          sendJoinClaim();
          // Retry JOIN_CLAIM every 850ms until SLOT_ASSIGN or WORLD_SNAP confirms connection
          if (this.joinRetryTimer) clearInterval(this.joinRetryTimer);
          this.joinRetryTimer = setInterval(() => {
            if (this.connectionState === 'CONNECTED_CLIENT' || this.hostConn !== conn) {
              if (this.joinRetryTimer) {
                clearInterval(this.joinRetryTimer);
                this.joinRetryTimer = null;
              }
              return;
            }
            sendJoinClaim();
          }, 850);
          this.onStatusUpdate();
        });

        conn.on('data', (raw) => {
          if (this.hostConn !== conn) return;
          const env = this.parseEnvelope(raw);
          if (!env) return;
          this.handleEnvelope(env, (reply) => {
            this.sendOverConn(conn, reply);
          });
        });

        conn.on('close', () => {
          if (this.hostConn !== conn) return;
          if (this.joinRetryTimer) {
            clearInterval(this.joinRetryTimer);
            this.joinRetryTimer = null;
          }
          this.scheduleClientReconnect(hostPeerId, playerName);
        });

        conn.on('error', () => {
          if (this.hostConn !== conn) return;
          this.scheduleClientReconnect(hostPeerId, playerName);
        });
      });

      clientPeer.on('error', () => {
        this.scheduleClientReconnect(hostPeerId, playerName);
      });
    } catch {
      this.scheduleClientReconnect(hostPeerId, playerName);
    }
  }

  private scheduleClientReconnect(hostPeerId: string, playerName: string): void {
    if (this.isHost) return;
    if (this.reconnectTimer) return;
    this.connectionState = 'RECONNECTING';
    this.onStatusUpdate();
    const myName = this.arenaEngine.players[this.localSlotId]?.name || playerName;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isHost) {
        this.connectAsPeerClient(hostPeerId, myName);
      }
    }, 900);
  }

  public handleEnvelope(
    env: NetEnvelope,
    replyFn: (reply: NetEnvelope) => void
  ): void {
    if (!env || env.sender === this.localPeerId) return;

    if (env.type === 'JOIN_CLAIM' && this.isHost) {
      const claim = env.payload as JoinClaimMsg;
      if (this.bannedPeerIds.has(claim.peerId)) {
        replyFn({
          sender: this.localPeerId,
          type: 'KICK_PEER',
          payload: {
            targetPeerId: claim.peerId,
            reason: `Estás vetado de la sala #${this.roomCode}.`
          } satisfies KickPeerMsg
        });
        return;
      }

      const isNewJoin = !this.arenaEngine.players.some(
        (p) => p.peerId === claim.peerId && !p.isBot
      );
      const assignedSlot = this.assignSlotForPeer(claim.peerId, claim.name);
      this.peerToSlot.set(claim.peerId, assignedSlot);
      this.peerLastSeen.set(claim.peerId, performance.now());

      const assignReply: NetEnvelope = {
        sender: this.localPeerId,
        type: 'SLOT_ASSIGN',
        payload: {
          peerId: claim.peerId,
          slotId: assignedSlot,
          hostName: this.arenaEngine.players[0].name,
          stateSeq: this.stateSeq,
          activeGame: this.activeGame,
          botDifficulty: this.arenaEngine.botDifficulty
        } satisfies SlotAssignMsg
      };

      replyFn(assignReply);
      this.sendToAllClients(assignReply);

      if (isNewJoin) {
        const joinText = `🟢 ¡${claim.name.toUpperCase()} SE UNIÓ A LA SALA! (SLOT ${assignedSlot + 1})`;
        this.pushToast(joinText, 'join');
        this.broadcastRoomEvent(joinText, 'join');
      }

      this.broadcastHostSnapshot(true);
      this.onStatusUpdate();
    } else if (env.type === 'SLOT_ASSIGN') {
      const assign = env.payload as SlotAssignMsg;
      if (assign.peerId === this.localPeerId) {
        if (this.authoritativeHostPeerId && this.authoritativeHostPeerId !== env.sender) {
          return;
        }
        this.authoritativeHostPeerId = env.sender;
        if (this.joinRetryTimer) {
          clearInterval(this.joinRetryTimer);
          this.joinRetryTimer = null;
        }
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        const wasConnecting = this.connectionState !== 'CONNECTED_CLIENT';
        this.role = 'CLIENT';
        this.isHost = false;
        this.hostName = assign.hostName || 'ANFITRIÓN';
        this.connectionState = 'CONNECTED_CLIENT';
        this.localSlotId = assign.slotId;

        const incomingSeq = typeof assign.stateSeq === 'number' ? assign.stateSeq : 1;
        if (incomingSeq >= this.clientStateSeq) {
          this.clientStateSeq = incomingSeq;
          if (assign.activeGame && (assign.activeGame !== 'HUB' || this.activeGame === 'HUB')) {
            this.activeGame = assign.activeGame;
          }
        }
        this.arenaEngine.botDifficulty = assign.botDifficulty;
        this.syncEnginesRoster();
        this.lastHostSnapReceivedAt = performance.now();
        if (wasConnecting) {
          this.pushToast(
            `🟢 CONECTADO A SALA #${this.roomCode} DE ${this.hostName} (SLOT ${assign.slotId + 1})`,
            'join'
          );
        }
        this.onStatusUpdate();
      }
    } else if (env.type === 'GAME_SWITCH') {
      const msg = env.payload as GameSwitchMsg;
      if (!msg?.activeGame) return;

      if (this.isHost) {
        // Ignore HUB switch requests from clients so a client never pulls the room out of a running game
        if (msg.activeGame === 'HUB') return;
        this.switchGame(msg.activeGame);
      } else {
        if (this.authoritativeHostPeerId && this.authoritativeHostPeerId !== env.sender) {
          return;
        }
        const incomingSeq = typeof msg.stateSeq === 'number' ? msg.stateSeq : this.clientStateSeq + 1;
        if (incomingSeq < this.clientStateSeq) {
          return;
        }
        this.clientStateSeq = incomingSeq;

        const gameChanged = this.activeGame !== msg.activeGame;
        this.activeGame = msg.activeGame;
        this.arenaEngine.botDifficulty = msg.botDifficulty;
        this.syncEnginesRoster();
        if (gameChanged) {
          if (msg.activeGame === 'CHAIN_PANIC' && typeof msg.levelIndex === 'number') {
            this.chainEngine.loadLevel(msg.levelIndex);
          } else if (msg.activeGame === 'TURBO_PUTT' && typeof msg.holeIndex === 'number') {
            this.puttEngine?.loadHole(msg.holeIndex);
          } else if (msg.activeGame === 'HOT_CORE' && typeof msg.arenaIndex === 'number') {
            this.hotCoreEngine?.loadArena(msg.arenaIndex);
          }
        }
        this.lastHostSnapReceivedAt = performance.now();
        this.onStatusUpdate();
      }
    } else if (env.type === 'ROOM_ACTION') {
      const action = env.payload as RoomActionMsg;
      if (!action?.kind) return;
      if (this.isHost) {
        this.sendOrApplyRoomAction(action);
      } else {
        if (this.authoritativeHostPeerId && this.authoritativeHostPeerId !== env.sender) {
          return;
        }
        this.executeRoomAction(action);
        this.onStatusUpdate();
      }
    } else if (env.type === 'PEER_LEAVE' && this.isHost) {
      const data = env.payload as { peerId: string };
      if (data?.peerId) {
        this.freeSlotForPeer(data.peerId);
      }
    } else if (env.type === 'ROOM_EVENT' && !this.isHost) {
      const evMsg = env.payload as RoomEventMsg;
      if (evMsg?.text) {
        this.pushToast(evMsg.text, evMsg.tone);
      }
    } else if (env.type === 'KICK_PEER') {
      const kick = env.payload as KickPeerMsg;
      if (kick.targetPeerId === this.localPeerId) {
        this.kickedNotice = kick.reason;
        const soloCode = generateRoomCode();
        this.hostRoom(soloCode, this.arenaEngine.players[this.localSlotId]?.name || 'PILOTO');
        this.onStatusUpdate();
      }
    } else if (env.type === 'PING_REQ' && this.isHost) {
      this.peerLastSeen.set(env.sender, performance.now());
      replyFn({
        sender: this.localPeerId,
        type: 'PING_ACK',
        payload: env.payload
      });
    } else if (env.type === 'PING_ACK' && !this.isHost) {
      this.lastHostSnapReceivedAt = performance.now();
      const sentAt = Number(env.payload) || 0;
      if (sentAt > 0) {
        this.pingMs = Math.max(1, Math.round(performance.now() - sentAt));
      }
    } else if (env.type === 'CLIENT_INPUT' && this.isHost) {
      if (this.bannedPeerIds.has(env.sender)) return;
      this.peerLastSeen.set(env.sender, performance.now());
      const inp = env.payload as ClientInputPacket;
      const prevName = this.arenaEngine.players[inp.slotId]?.name;
      this.arenaEngine.applyRemoteInput(inp);
      this.chainEngine.applyRemoteInput(inp);
      this.puttEngine?.applyRemoteInput(inp);
      this.hotCoreEngine?.applyRemoteInput(inp);
      if (prevName && prevName !== inp.name) {
        this.syncEnginesRoster();
        this.broadcastHostSnapshot(true);
        this.onStatusUpdate();
      }
    } else if (env.type === 'WORLD_SNAP' && !this.isHost) {
      if (this.authoritativeHostPeerId && this.authoritativeHostPeerId !== env.sender) {
        return;
      }
      this.authoritativeHostPeerId = env.sender;

      if (this.joinRetryTimer) {
        clearInterval(this.joinRetryTimer);
        this.joinRetryTimer = null;
      }
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.connectionState = 'CONNECTED_CLIENT';
      this.lastHostSnapReceivedAt = performance.now();

      const snap = env.payload as WorldSnapshotPacket;
      const prevGame = this.activeGame;
      const prevDiff = this.arenaEngine.botDifficulty;
      const prevPhase = this.arenaEngine.phase;
      const prevHumanCount = this.arenaEngine.players.filter((p) => !p.isBot).length;

      if (snap.hostName) {
        this.hostName = snap.hostName;
      }

      // Authoritative stateSeq check:
      // - WORLD_SNAP can bring a Client from HUB into an active game,
      // - and NEVER kicks a Client out of an active game back to HUB!
      const snapSeq = typeof snap.stateSeq === 'number' ? snap.stateSeq : this.clientStateSeq;
      if (snapSeq >= this.clientStateSeq) {
        this.clientStateSeq = snapSeq;
        if (snap.activeGame && snap.activeGame !== 'HUB') {
          this.activeGame = snap.activeGame;
        }
      }

      this.arenaEngine.applySnapshot(snap, this.localSlotId);
      this.syncEnginesRoster();

      if (snap.chainState) {
        this.chainEngine.applySnapshot(snap.chainState, this.localSlotId);
      }
      if (snap.puttState) {
        this.puttEngine?.applySnapshot(snap.puttState, this.localSlotId);
      }
      if (snap.hotCoreState) {
        this.hotCoreEngine?.applySnapshot(snap.hotCoreState, this.localSlotId);
      }
      this.syncEnginesRoster();

      const newHumanCount = this.arenaEngine.players.filter((p) => !p.isBot).length;
      if (
        prevGame !== this.activeGame ||
        prevDiff !== this.arenaEngine.botDifficulty ||
        prevPhase !== this.arenaEngine.phase ||
        prevHumanCount !== newHumanCount ||
        snap.tick % 15 === 0
      ) {
        this.onStatusUpdate();
      }
    } else if (env.type === 'DRAFT_PICK' && this.isHost) {
      this.peerLastSeen.set(env.sender, performance.now());
      const pick = env.payload as DraftPickMsg;
      this.arenaEngine.selectDraftMod(pick.slotId, pick.modId);
      this.broadcastHostSnapshot(true);
      this.onStatusUpdate();
    }
  }

  private assignSlotForPeer(peerId: string, name: string): number {
    const existing = this.arenaEngine.players.find((p) => p.peerId === peerId);
    if (existing) {
      const wasBot = existing.isBot;
      existing.isBot = false;
      existing.name = name.slice(0, 10).toUpperCase();
      if (wasBot || this.activeGame === 'HUB') {
        existing.alive = true;
      }
      this.connectedPeersCount = this.arenaEngine.players.filter(
        (p, idx) => idx > 0 && !p.isBot
      ).length;
      this.syncEnginesRoster();
      return existing.id;
    }

    const freeSlot = this.arenaEngine.players.find((p, idx) => idx > 0 && p.isBot);
    const targetSlot = freeSlot || this.arenaEngine.players[1];
    targetSlot.peerId = peerId;
    targetSlot.isBot = false;
    targetSlot.name = name.slice(0, 10).toUpperCase();
    targetSlot.alive = true;

    this.connectedPeersCount = this.arenaEngine.players.filter(
      (p, idx) => idx > 0 && !p.isBot
    ).length;
    this.syncEnginesRoster();
    return targetSlot.id;
  }

  public sendClientInput(input: ClientInputPacket): void {
    if (this.isHost) return;
    const now = performance.now();
    const hasDiscreteAction =
      input.parryPressed ||
      input.dashPressed ||
      Boolean(input.yankPressed) ||
      input.emotePressed > 0 ||
      Boolean(input.shotReleasedPower && input.shotReleasedPower > 0);

    // If a discrete action occurred, latch it into a 3-packet redundant burst so packet loss never drops it!
    if (hasDiscreteAction) {
      this.clientActionSeq++;
      this.activeActionBurst = {
        actionSeq: this.clientActionSeq,
        remainingSends: 3,
        parryPressed: input.parryPressed,
        dashPressed: input.dashPressed,
        yankPressed: input.yankPressed,
        emotePressed: input.emotePressed,
        shotReleasedPower: input.shotReleasedPower,
        feintPrimed: input.feintPrimed
      };
    }

    const isUrgentAction =
      hasDiscreteAction || input.chargingParry !== this.lastChargingState;

    this.lastChargingState = input.chargingParry;

    // Throttle continuous movement packets to ~28Hz (35ms) so slow/congested Wi-Fi links never choke,
    // while transmitting urgent action presses/releases immediately (0ms delay)!
    if (!isUrgentAction && now - this.lastClientInputSentAt < 35) {
      return;
    }
    this.lastClientInputSentAt = now;

    const outgoingPayload: ClientInputPacket = { ...input };
    if (this.activeActionBurst && this.activeActionBurst.remainingSends > 0) {
      outgoingPayload.actionSeq = this.activeActionBurst.actionSeq;
      outgoingPayload.parryPressed = this.activeActionBurst.parryPressed;
      outgoingPayload.dashPressed = this.activeActionBurst.dashPressed;
      outgoingPayload.yankPressed = this.activeActionBurst.yankPressed;
      outgoingPayload.emotePressed = this.activeActionBurst.emotePressed;
      outgoingPayload.shotReleasedPower = this.activeActionBurst.shotReleasedPower;
      if (this.activeActionBurst.feintPrimed) {
        outgoingPayload.feintPrimed = true;
      }
      this.activeActionBurst.remainingSends--;
      if (this.activeActionBurst.remainingSends <= 0) {
        this.activeActionBurst = null;
      }
    }

    const env: NetEnvelope = {
      sender: this.localPeerId,
      type: 'CLIENT_INPUT',
      payload: outgoingPayload
    };
    this.sendToHost(env);

    this.rtcBroadcastCounter++;
    if (this.rtcBroadcastCounter % 20 === 0) {
      const pingEnv: NetEnvelope = {
        sender: this.localPeerId,
        type: 'PING_REQ',
        payload: now
      };
      this.sendToHost(pingEnv);
    }
  }

  public broadcastHostSnapshot(forceRtc = false): void {
    if (!this.isHost) return;
    const now = performance.now();

    // Adaptive 21Hz (46ms) quantized snapshot tickrate: keeps bandwidth < 6 KB/sec for terrible connections
    // while 60/144fps client-side prediction & dead-reckoning keep visuals 100% smooth!
    if (!forceRtc && now - this.lastRtcSnapSentAt < 46) {
      return;
    }
    this.lastRtcSnapSentAt = now;

    const snap = this.arenaEngine.getSnapshot();
    snap.stateSeq = this.stateSeq;
    snap.hostName = this.arenaEngine.players[0]?.name || this.hostName;
    snap.activeGame = this.activeGame;
    snap.botDifficulty = this.arenaEngine.botDifficulty;

    if (this.activeGame === 'CHAIN_PANIC') {
      snap.chainState = this.chainEngine.getSnapshot();
    } else if (this.activeGame === 'TURBO_PUTT') {
      snap.puttState = this.puttEngine?.getSnapshot();
    } else if (this.activeGame === 'HOT_CORE') {
      snap.hotCoreState = this.hotCoreEngine?.getSnapshot();
    }

    const env: NetEnvelope = {
      sender: this.localPeerId,
      type: 'WORLD_SNAP',
      payload: snap
    };

    this.localBus?.postMessage(env);

    const serialized = compactJsonStringify(env);
    this.clientConns.forEach((conn) => {
      if (!conn.open) return;
      // Strict 8KB SCTP backpressure guard: if a friend's Wi-Fi is stalling, skip intermediate frames
      // so old snapshots never pile up in their buffer (zero bufferbloat!)
      const dc = (conn as unknown as { dataChannel?: RTCDataChannel }).dataChannel;
      if (!forceRtc && dc && dc.bufferedAmount > 8192) {
        return;
      }
      try {
        conn.send(serialized);
      } catch {
        // Ignore transient send error
      }
    });
  }

  public submitDraftSelection(modId: string): void {
    if (this.isHost) {
      this.arenaEngine.selectDraftMod(this.localSlotId, modId);
      this.broadcastHostSnapshot(true);
    } else {
      const env: NetEnvelope = {
        sender: this.localPeerId,
        type: 'DRAFT_PICK',
        payload: { slotId: this.localSlotId, modId } satisfies DraftPickMsg
      };
      this.sendToHost(env);
    }
  }
}
