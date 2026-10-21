import Peer, { DataConnection } from 'peerjs';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { ActiveGameId, ClientInputPacket, WorldSnapshotPacket } from '../types';

interface NetEnvelope {
  sender: string;
  type: 'JOIN_CLAIM' | 'SLOT_ASSIGN' | 'CLIENT_INPUT' | 'WORLD_SNAP' | 'DRAFT_PICK';
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

const HOST_ID_PREFIX = 'tp04-party-deck-v2-';

export class MultiplayerRoomManager {
  public roomCode = 'TP04';
  public localPeerId: string;
  public localSlotId = 0;
  public isHost = true;
  public activeGame: ActiveGameId = 'HUB';
  public connectedPeersCount = 0;

  private arenaEngine: ArenaEngine;
  private chainEngine: ChainPanicEngine;
  private onStatusUpdate: () => void;

  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private clientConns = new Map<string, DataConnection>();
  private localBus: BroadcastChannel | null = null;

  private lastHostSnapReceivedAt = 0;
  private rtcBroadcastCounter = 0;

  constructor(
    arenaEngine: ArenaEngine,
    chainEngine: ChainPanicEngine,
    onStatusUpdate: () => void
  ) {
    this.arenaEngine = arenaEngine;
    this.chainEngine = chainEngine;
    this.onStatusUpdate = onStatusUpdate;
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
    this.chainEngine.syncPlayerIdentities(
      this.arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot })),
      this.arenaEngine.botDifficulty !== 'OFF'
    );
    if (this.isHost) {
      this.broadcastHostSnapshot(true);
    }
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
    this.chainEngine.syncPlayerIdentities(
      this.arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot })),
      this.arenaEngine.botDifficulty !== 'OFF'
    );

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
      const assignedSlot = this.assignSlotForPeer(claim.peerId, claim.name);
      replyFn({
        sender: this.localPeerId,
        type: 'SLOT_ASSIGN',
        payload: { peerId: claim.peerId, slotId: assignedSlot } satisfies SlotAssignMsg
      });
      this.broadcastHostSnapshot(true);
      this.onStatusUpdate();
    } else if (env.type === 'SLOT_ASSIGN') {
      const assign = env.payload as SlotAssignMsg;
      if (assign.peerId === this.localPeerId) {
        this.isHost = false;
        this.localSlotId = assign.slotId;
        this.lastHostSnapReceivedAt = performance.now();
        this.onStatusUpdate();
      }
    } else if (env.type === 'CLIENT_INPUT' && this.isHost) {
      const inp = env.payload as ClientInputPacket;
      this.arenaEngine.applyRemoteInput(inp);
      this.chainEngine.applyRemoteInput(inp);
    } else if (env.type === 'WORLD_SNAP' && !this.isHost) {
      this.lastHostSnapReceivedAt = performance.now();
      const snap = env.payload as WorldSnapshotPacket;
      const prevGame = this.activeGame;
      this.activeGame = snap.activeGame;
      this.arenaEngine.applySnapshot(snap);
      if (snap.chainState) {
        this.chainEngine.applySnapshot(snap.chainState);
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
      this.chainEngine.syncPlayerIdentities(
        this.arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot })),
        this.arenaEngine.botDifficulty !== 'OFF'
      );
      return existing.id;
    }

    const freeSlot = this.arenaEngine.players.find((p, idx) => idx > 0 && p.isBot);
    const targetSlot = freeSlot || this.arenaEngine.players[1];
    targetSlot.peerId = peerId;
    targetSlot.isBot = false;
    targetSlot.name = name.slice(0, 10).toUpperCase();
    targetSlot.alive = true;

    this.chainEngine.syncPlayerIdentities(
      this.arenaEngine.players.map((p) => ({ name: p.name, isBot: p.isBot })),
      this.arenaEngine.botDifficulty !== 'OFF'
    );
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
  }

  public broadcastHostSnapshot(forceRtc = false): void {
    if (!this.isHost) return;
    const snap = this.arenaEngine.getSnapshot();
    snap.activeGame = this.activeGame;
    snap.chainState = this.chainEngine.getSnapshot();

    const env: NetEnvelope = {
      sender: this.localPeerId,
      type: 'WORLD_SNAP',
      payload: snap
    };

    this.localBus?.postMessage(env);

    this.rtcBroadcastCounter++;
    if (forceRtc || this.rtcBroadcastCounter % 2 === 0) {
      this.clientConns.forEach((conn) => {
        if (conn.open) conn.send(env);
      });
    }
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
