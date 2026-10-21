import Peer, { DataConnection } from 'peerjs';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { PuttWarEngine } from '../game/puttWarEngine';
import { ActiveGameId, ClientInputPacket, WorldSnapshotPacket } from '../types';

interface NetEnvelope {
  sender: string;
  type:
    | 'JOIN_CLAIM'
    | 'SLOT_ASSIGN'
    | 'CLIENT_INPUT'
    | 'WORLD_SNAP'
    | 'DRAFT_PICK'
    | 'KICK_PEER'
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
}

interface DraftPickMsg {
  slotId: number;
  modId: string;
}

interface KickPeerMsg {
  targetPeerId: string;
  reason: string;
}

const HOST_ID_PREFIX = 'tp04-party-deck-v2-';
const DEFAULT_BOT_NAMES = ['UNIT-01', 'LEO-BOT', 'MAX-BOT', 'NICO-BOT'];

export class MultiplayerRoomManager {
  public roomCode = 'TP04';
  public localPeerId: string;
  public localSlotId = 0;
  public isHost = true;
  public activeGame: ActiveGameId = 'HUB';
  public connectedPeersCount = 0;
  public pingMs = 0;
  public bannedPeerIds = new Set<string>();
  public kickedNotice: string | null = null;

  private arenaEngine: ArenaEngine;
  private chainEngine: ChainPanicEngine;
  private puttEngine?: PuttWarEngine;
  private onStatusUpdate: () => void;

  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private clientConns = new Map<string, DataConnection>();
  private localBus: BroadcastChannel | null = null;

  private lastHostSnapReceivedAt = -10000;
  private rtcBroadcastCounter = 0;

  constructor(
    arenaEngine: ArenaEngine,
    chainEngine: ChainPanicEngine,
    onStatusUpdate: () => void,
    puttEngine?: PuttWarEngine
  ) {
    this.arenaEngine = arenaEngine;
    this.chainEngine = chainEngine;
    this.onStatusUpdate = onStatusUpdate;
    this.puttEngine = puttEngine;
    this.localPeerId = 'P-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Returns true if this tab should step the physics locally.
   * Even if assigned as a client, if the Host hasn't sent a snapshot in >2s,
   * we step locally so the game NEVER freezes!
   */
  public shouldStepLocally(): boolean {
    if (this.isHost) return true;
    const timeSinceLastSnap = performance.now() - this.lastHostSnapReceivedAt;
    return timeSinceLastSnap > 2000;
  }

  public switchGame(nextGame: ActiveGameId): void {
    this.activeGame = nextGame;
    this.syncEnginesRoster();
    if (this.isHost) {
      this.broadcastHostSnapshot(true);
    }
    this.onStatusUpdate();
  }

  public syncEnginesRoster(): void {
    const roster = this.arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot }));
    const botsActive = this.arenaEngine.botDifficulty !== 'OFF';
    this.chainEngine.syncPlayerIdentities(roster, botsActive);
    this.puttEngine?.syncPlayerIdentities(roster, botsActive);
  }

  /**
   * Host action: Kick & ban a connected player in slotId (1..3) from the room.
   */
  public kickPlayerSlot(slotId: number): boolean {
    if (!this.isHost || slotId <= 0) return false;
    const target = this.arenaEngine.players[slotId];
    if (!target || target.isBot || !target.peerId) return false;

    const kickedPeerId = target.peerId;
    this.bannedPeerIds.add(kickedPeerId);

    const kickEnv: NetEnvelope = {
      sender: this.localPeerId,
      type: 'KICK_PEER',
      payload: {
        targetPeerId: kickedPeerId,
        reason: `Fuiste vetado de la sala #${this.roomCode} por el Host.`
      } satisfies KickPeerMsg
    };

    this.localBus?.postMessage(kickEnv);
    this.clientConns.forEach((conn) => {
      if (conn.open) conn.send(kickEnv);
    });

    // Reset slot back to Bot
    target.peerId = null;
    target.isBot = true;
    target.name = DEFAULT_BOT_NAMES[slotId] || `BOT-0${slotId + 1}`;
    target.alive = this.arenaEngine.botDifficulty !== 'OFF';

    this.syncEnginesRoster();
    this.broadcastHostSnapshot(true);
    this.onStatusUpdate();
    return true;
  }

  public clearBanList(): void {
    this.bannedPeerIds.clear();
    this.onStatusUpdate();
  }

  public connectToRoom(rawCode: string, playerName: string): void {
    const cleanCode = (rawCode.trim().toUpperCase() || 'TP04').replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TP04';
    this.roomCode = cleanCode;

    // Clean up previous connections
    this.clientConns.forEach((c) => c.close());
    this.clientConns.clear();
    if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    if (this.localBus) {
      this.localBus.close();
      this.localBus = null;
    }

    this.isHost = true;
    this.localSlotId = 0;
    this.arenaEngine.players[0].peerId = this.localPeerId;
    this.arenaEngine.players[0].isBot = false;
    this.arenaEngine.players[0].name = playerName.toUpperCase();
    const roster = this.arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot }));
    const botsActive = this.arenaEngine.botDifficulty !== 'OFF';
    this.chainEngine.syncPlayerIdentities(roster, botsActive);
    this.puttEngine?.syncPlayerIdentities(roster, botsActive);

    // 1. Setup WebRTC PeerJS (Clean, fast, zero Nostr relay errors)
    const hostPeerId = `${HOST_ID_PREFIX}${cleanCode}`;
    try {
      const peer = new Peer(hostPeerId);
      this.peer = peer;

      peer.on('open', () => {
        // Successfully claimed the Host ID for this room!
        this.isHost = true;
        this.localSlotId = 0;
        this.onStatusUpdate();
      });

      peer.on('connection', (conn) => {
        // Incoming friend connection to our Host!
        conn.on('open', () => {
          this.clientConns.set(conn.peer, conn);
          this.connectedPeersCount = this.clientConns.size;
          this.onStatusUpdate();
        });

        conn.on('data', (raw) => {
          this.handleEnvelope(raw as NetEnvelope, (reply) => {
            if (conn.open) conn.send(reply);
          });
        });

        conn.on('close', () => {
          this.clientConns.delete(conn.peer);
          this.connectedPeersCount = this.clientConns.size;
          this.onStatusUpdate();
        });
      });

      peer.on('error', (err: { type?: string }) => {
        if (err.type === 'unavailable-id') {
          // Someone is already hosting this room code! Connect to them as a Client.
          this.connectAsPeerClient(hostPeerId, playerName);
        }
      });
    } catch {
      // Offline fallback
    }

    // 2. Also setup BroadcastChannel for same-browser multi-tab testing
    this.localBus = new BroadcastChannel(`tp04_bus_v2_${cleanCode}`);
    this.localBus.onmessage = (ev) => {
      const env = ev.data as NetEnvelope;
      if (!env || env.sender === this.localPeerId) return;
      this.handleEnvelope(env, (reply) => {
        this.localBus?.postMessage(reply);
      });
    };

    // Only claim join over BroadcastChannel if another tab in the same browser is actively running
    this.localBus.postMessage({
      sender: this.localPeerId,
      type: 'JOIN_CLAIM',
      payload: { peerId: this.localPeerId, name: playerName }
    } satisfies NetEnvelope);

    this.onStatusUpdate();
  }

  private connectAsPeerClient(hostPeerId: string, playerName: string): void {
    if (this.peer) {
      this.peer.destroy();
    }
    const clientPeer = new Peer();
    this.peer = clientPeer;

    clientPeer.on('open', () => {
      const conn = clientPeer.connect(hostPeerId, { reliable: false });
      this.hostConn = conn;

      conn.on('open', () => {
        this.connectedPeersCount = 1;
        conn.send({
          sender: this.localPeerId,
          type: 'JOIN_CLAIM',
          payload: { peerId: this.localPeerId, name: playerName }
        } satisfies NetEnvelope);
        this.onStatusUpdate();
      });

      conn.on('data', (raw) => {
        this.handleEnvelope(raw as NetEnvelope, () => {});
      });

      conn.on('close', () => {
        // Host disconnected -> become local Host so game never freezes
        this.isHost = true;
        this.connectedPeersCount = 0;
        this.onStatusUpdate();
      });
    });
  }

  private handleEnvelope(
    env: NetEnvelope,
    replyFn: (reply: NetEnvelope) => void
  ): void {
    if (!env || env.sender === this.localPeerId) return;

    if (env.type === 'JOIN_CLAIM' && this.isHost && !document.hidden) {
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
      const assignedSlot = this.assignSlotForPeer(claim.peerId, claim.name);
      replyFn({
        sender: this.localPeerId,
        type: 'SLOT_ASSIGN',
        payload: { peerId: claim.peerId, slotId: assignedSlot } satisfies SlotAssignMsg
      });
      this.broadcastHostSnapshot(true);
      this.onStatusUpdate();
    } else if (env.type === 'KICK_PEER') {
      const kick = env.payload as KickPeerMsg;
      if (kick.targetPeerId === this.localPeerId) {
        this.kickedNotice = kick.reason;
        const soloCode = 'SOLO' + Math.floor(10 + Math.random() * 89);
        this.connectToRoom(soloCode, this.arenaEngine.players[this.localSlotId]?.name || 'PILOTO');
        this.onStatusUpdate();
      }
    } else if (env.type === 'PING_REQ' && this.isHost) {
      replyFn({
        sender: this.localPeerId,
        type: 'PING_ACK',
        payload: env.payload
      });
    } else if (env.type === 'PING_ACK' && !this.isHost) {
      const sentAt = Number(env.payload) || 0;
      if (sentAt > 0) {
        this.pingMs = Math.max(1, Math.round(performance.now() - sentAt));
      }
    } else if (env.type === 'SLOT_ASSIGN') {
      const assign = env.payload as SlotAssignMsg;
      if (assign.peerId === this.localPeerId) {
        this.isHost = false;
        this.localSlotId = assign.slotId;
        this.lastHostSnapReceivedAt = performance.now();
        this.onStatusUpdate();
      }
    } else if (env.type === 'CLIENT_INPUT' && this.isHost) {
      if (this.bannedPeerIds.has(env.sender)) return;
      const inp = env.payload as ClientInputPacket;
      const prevName = this.arenaEngine.players[inp.slotId]?.name;
      this.arenaEngine.applyRemoteInput(inp);
      this.chainEngine.applyRemoteInput(inp);
      this.puttEngine?.applyRemoteInput(inp);
      if (prevName && prevName !== inp.name) {
        this.syncEnginesRoster();
        this.onStatusUpdate();
      }
    } else if (env.type === 'WORLD_SNAP' && !this.isHost) {
      this.lastHostSnapReceivedAt = performance.now();
      const snap = env.payload as WorldSnapshotPacket;
      const prevGame = this.activeGame;
      this.activeGame = snap.activeGame;
      this.arenaEngine.applySnapshot(snap, this.localSlotId);
      if (snap.chainState) {
        this.chainEngine.applySnapshot(snap.chainState);
      }
      if (snap.puttState) {
        this.puttEngine?.applySnapshot(snap.puttState);
      }
      if (prevGame !== this.activeGame) {
        this.onStatusUpdate();
      }
    } else if (env.type === 'DRAFT_PICK' && this.isHost) {
      const pick = env.payload as DraftPickMsg;
      this.arenaEngine.selectDraftMod(pick.slotId, pick.modId);
    }
  }

  private assignSlotForPeer(peerId: string, name: string): number {
    const existing = this.arenaEngine.players.find((p) => p.peerId === peerId);
    if (existing) {
      existing.isBot = false;
      existing.name = name.slice(0, 10).toUpperCase();
      existing.alive = true;
      const roster = this.arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot }));
      const botsActive = this.arenaEngine.botDifficulty !== 'OFF';
      this.chainEngine.syncPlayerIdentities(roster, botsActive);
      this.puttEngine?.syncPlayerIdentities(roster, botsActive);
      return existing.id;
    }

    const freeSlot = this.arenaEngine.players.find((p, idx) => idx > 0 && p.isBot);
    const targetSlot = freeSlot || this.arenaEngine.players[1];
    targetSlot.peerId = peerId;
    targetSlot.isBot = false;
    targetSlot.name = name.slice(0, 10).toUpperCase();
    targetSlot.alive = true;

    const roster = this.arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot }));
    const botsActive = this.arenaEngine.botDifficulty !== 'OFF';
    this.chainEngine.syncPlayerIdentities(roster, botsActive);
    this.puttEngine?.syncPlayerIdentities(roster, botsActive);
    return targetSlot.id;
  }

  public sendClientInput(input: ClientInputPacket): void {
    if (this.isHost) return;
    const env: NetEnvelope = {
      sender: this.localPeerId,
      type: 'CLIENT_INPUT',
      payload: input
    };
    this.localBus?.postMessage(env);
    if (this.hostConn?.open) {
      this.hostConn.send(env);
    }

    // Periodic lightweight ping measurement every ~30 frames
    this.rtcBroadcastCounter++;
    if (this.rtcBroadcastCounter % 30 === 0) {
      const pingEnv: NetEnvelope = {
        sender: this.localPeerId,
        type: 'PING_REQ',
        payload: performance.now()
      };
      this.localBus?.postMessage(pingEnv);
      if (this.hostConn?.open) {
        this.hostConn.send(pingEnv);
      }
    }
  }

  public broadcastHostSnapshot(_forceRtc = false): void {
    if (!this.isHost) return;
    const snap = this.arenaEngine.getSnapshot();
    snap.activeGame = this.activeGame;
    snap.chainState = this.chainEngine.getSnapshot();
    snap.puttState = this.puttEngine?.getSnapshot();

    const env: NetEnvelope = {
      sender: this.localPeerId,
      type: 'WORLD_SNAP',
      payload: snap
    };

    this.localBus?.postMessage(env);

    // Send at full 60Hz over WebRTC DataChannel (reliable: false) for minimum latency!
    this.clientConns.forEach((conn) => {
      if (conn.open) conn.send(env);
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
      this.localBus?.postMessage(env);
      if (this.hostConn?.open) {
        this.hostConn.send(env);
      }
    }
  }
}
