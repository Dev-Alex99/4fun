import Peer, { DataConnection } from 'peerjs';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { PuttWarEngine } from '../game/puttWarEngine';
import { ActiveGameId, ClientInputPacket, WorldSnapshotPacket } from '../types';

export type RoomConnectionState = 'HOSTING' | 'CONNECTING' | 'CONNECTED_CLIENT' | 'RECONNECTING';

export interface RoomToastEvent {
  id: number;
  text: string;
  tone: 'join' | 'leave' | 'info' | 'warn';
}

interface NetEnvelope {
  sender: string;
  type:
    | 'JOIN_CLAIM'
    | 'SLOT_ASSIGN'
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

const HOST_ID_PREFIX = 'tp04-deck-room-v3-';
const DEFAULT_BOT_NAMES = ['UNIT-01', 'LEO-BOT', 'MAX-BOT', 'NICO-BOT'];

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

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
  public isHost = true;
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
  private onStatusUpdate: () => void;

  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private clientConns = new Map<string, DataConnection>();
  private connToLogicalPeer = new Map<string, string>();
  private peerToSlot = new Map<string, number>();
  private peerLastSeen = new Map<string, number>();
  private localBus: BroadcastChannel | null = null;

  private lastHostSnapReceivedAt = -10000;
  private rtcBroadcastCounter = 0;
  private nextToastId = 1;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private hostEpoch = 0;

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

    // Persist localPeerId in sessionStorage so refreshing the tab keeps your identity & slot!
    const existingId =
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tp04_peer_id') : null;
    if (existingId) {
      this.localPeerId = existingId;
    } else {
      this.localPeerId = 'P-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        sessionStorage.setItem('tp04_peer_id', this.localPeerId);
      } catch {
        // Ignore storage errors
      }
    }

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

    this.localBus?.postMessage(kickEnv);
    this.clientConns.forEach((conn) => {
      if (conn.open) conn.send(kickEnv);
    });

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
    this.localBus?.postMessage(env);
    this.clientConns.forEach((conn) => {
      if (conn.open) conn.send(env);
    });
  }

  private startHeartbeatMonitor(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      const now = performance.now();
      if (this.isHost) {
        // Check if any remote human peer timed out (>6.5 seconds without any packet)
        this.peerLastSeen.forEach((lastSeen, peerId) => {
          if (now - lastSeen > 6500) {
            this.freeSlotForPeer(peerId);
          }
        });
      } else {
        // Client: if Host stopped sending snapshots for >4.5 seconds, attempt automatic reconnect
        if (
          this.connectionState === 'CONNECTED_CLIENT' &&
          this.lastHostSnapReceivedAt > 0 &&
          now - this.lastHostSnapReceivedAt > 4500
        ) {
          this.connectionState = 'RECONNECTING';
          this.onStatusUpdate();
          const myName = this.arenaEngine.players[this.localSlotId]?.name || 'PILOTO';
          this.connectToRoom(this.roomCode, myName);
        }
      }
    }, 1500);
  }

  public disconnectCleanly(): void {
    const leaveEnv: NetEnvelope = {
      sender: this.localPeerId,
      type: 'PEER_LEAVE',
      payload: { peerId: this.localPeerId }
    };
    try {
      this.localBus?.postMessage(leaveEnv);
      if (this.hostConn?.open) {
        this.hostConn.send(leaveEnv);
      }
      this.clientConns.forEach((c) => c.close());
      this.hostConn?.close();
      this.peer?.destroy();
    } catch {
      // Ignore unload errors
    }
  }

  public connectToRoom(rawCode: string, playerName: string, epoch = 0): void {
    const cleanCode =
      (rawCode.trim().toUpperCase() || 'TP04').replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TP04';
    this.roomCode = cleanCode;
    this.hostEpoch = epoch;

    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }

    // Clean up previous connections
    this.clientConns.forEach((c) => c.close());
    this.clientConns.clear();
    this.connToLogicalPeer.clear();
    this.peerToSlot.clear();
    this.peerLastSeen.clear();

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

    // Reset slots 1..3 to bots when initializing a new room
    this.isHost = true;
    this.connectionState = 'HOSTING';
    this.localSlotId = 0;
    this.connectedPeersCount = 0;

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

    // 1. Setup BroadcastChannel for instant same-browser multi-tab sync
    this.localBus = new BroadcastChannel(`tp04_bus_v3_${cleanCode}`);
    this.localBus.onmessage = (ev) => {
      const env = ev.data as NetEnvelope;
      if (!env || env.sender === this.localPeerId) return;
      this.handleEnvelope(env, (reply) => {
        this.localBus?.postMessage(reply);
      });
    };

    // Broadcast JOIN_CLAIM on local BroadcastChannel in case another tab in this browser is already Host
    this.localBus.postMessage({
      sender: this.localPeerId,
      type: 'JOIN_CLAIM',
      payload: { peerId: this.localPeerId, name: playerName.toUpperCase() }
    } satisfies NetEnvelope);

    // 2. Setup WebRTC PeerJS with explicit Google STUN servers for reliable cross-network P2P
    const hostPeerId =
      epoch === 0 ? `${HOST_ID_PREFIX}${cleanCode}` : `${HOST_ID_PREFIX}${cleanCode}-${epoch}`;
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

      peer.on('connection', (conn) => {
        conn.on('open', () => {
          this.clientConns.set(conn.peer, conn);
          this.onStatusUpdate();
        });

        conn.on('data', (raw) => {
          const env = raw as NetEnvelope;
          if (env && env.sender) {
            this.connToLogicalPeer.set(conn.peer, env.sender);
            this.peerLastSeen.set(env.sender, performance.now());
          }
          this.handleEnvelope(env, (reply) => {
            if (conn.open) conn.send(reply);
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
          // Someone is already hosting this room code! Connect to them as a Client.
          this.connectAsPeerClient(hostPeerId, playerName);
        }
      });
    } catch {
      // Offline / test fallback
    }

    this.onStatusUpdate();
  }

  private connectAsPeerClient(hostPeerId: string, playerName: string): void {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.connectionState = 'CONNECTING';
    this.onStatusUpdate();

    try {
      const clientPeer = new Peer({
        config: { iceServers: ICE_SERVERS }
      });
      this.peer = clientPeer;

      // Handshake Watchdog: if the Host ID on PeerJS is a dead "ghost" session (e.g. Host refreshed page)
      // and doesn't answer within 3.8s, automatically take over as Host on epoch+1 so room never breaks!
      if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
      this.handshakeTimer = setTimeout(() => {
        if (this.connectionState === 'CONNECTING') {
          this.connectToRoom(this.roomCode, playerName, this.hostEpoch + 1);
        }
      }, 3800);

      clientPeer.on('open', () => {
        const conn = clientPeer.connect(hostPeerId, { reliable: true });
        this.hostConn = conn;

        conn.on('open', () => {
          conn.send({
            sender: this.localPeerId,
            type: 'JOIN_CLAIM',
            payload: { peerId: this.localPeerId, name: playerName.toUpperCase() }
          } satisfies NetEnvelope);
          this.onStatusUpdate();
        });

        conn.on('data', (raw) => {
          this.handleEnvelope(raw as NetEnvelope, (reply) => {
            if (conn.open) conn.send(reply);
          });
        });

        conn.on('close', () => {
          // Host closed their tab! Promote this tab or notify
          this.pushToast('⚠️ EL HOST CERRÓ LA SALA — AHORA ERES EL HOST', 'warn');
          this.isHost = true;
          this.connectionState = 'HOSTING';
          this.connectedPeersCount = 0;
          this.connectToRoom(this.roomCode, playerName, this.hostEpoch + 1);
        });
      });
    } catch {
      this.isHost = true;
      this.connectionState = 'HOSTING';
    }
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

      const isNewJoin = !this.arenaEngine.players.some(
        (p) => p.peerId === claim.peerId && !p.isBot
      );
      const assignedSlot = this.assignSlotForPeer(claim.peerId, claim.name);
      this.peerToSlot.set(claim.peerId, assignedSlot);
      this.peerLastSeen.set(claim.peerId, performance.now());

      replyFn({
        sender: this.localPeerId,
        type: 'SLOT_ASSIGN',
        payload: {
          peerId: claim.peerId,
          slotId: assignedSlot,
          hostName: this.arenaEngine.players[0].name
        } satisfies SlotAssignMsg
      });

      if (isNewJoin) {
        const joinText = `🟢 ¡${claim.name.toUpperCase()} SE UNIÓ A LA SALA! (SLOT ${assignedSlot + 1})`;
        this.pushToast(joinText, 'join');
        this.broadcastRoomEvent(joinText, 'join');
      }

      this.broadcastHostSnapshot(true);
      this.onStatusUpdate();
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
        this.connectToRoom(soloCode, this.arenaEngine.players[this.localSlotId]?.name || 'PILOTO');
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
      const sentAt = Number(env.payload) || 0;
      if (sentAt > 0) {
        this.pingMs = Math.max(1, Math.round(performance.now() - sentAt));
      }
    } else if (env.type === 'SLOT_ASSIGN') {
      const assign = env.payload as SlotAssignMsg;
      if (assign.peerId === this.localPeerId) {
        if (this.handshakeTimer) {
          clearTimeout(this.handshakeTimer);
          this.handshakeTimer = null;
        }
        const wasConnecting = this.connectionState !== 'CONNECTED_CLIENT';
        this.isHost = false;
        this.connectionState = 'CONNECTED_CLIENT';
        this.localSlotId = assign.slotId;
        this.lastHostSnapReceivedAt = performance.now();
        if (wasConnecting) {
          this.pushToast(
            `🟢 CONECTADO A SALA #${this.roomCode} DE ${assign.hostName} (SLOT ${assign.slotId + 1})`,
            'join'
          );
        }
        this.onStatusUpdate();
      }
    } else if (env.type === 'CLIENT_INPUT' && this.isHost) {
      if (this.bannedPeerIds.has(env.sender)) return;
      this.peerLastSeen.set(env.sender, performance.now());
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
      if (this.handshakeTimer) {
        clearTimeout(this.handshakeTimer);
        this.handshakeTimer = null;
      }
      this.connectionState = 'CONNECTED_CLIENT';
      this.lastHostSnapReceivedAt = performance.now();
      const snap = env.payload as WorldSnapshotPacket;
      const prevGame = this.activeGame;
      const prevHumanCount = this.arenaEngine.players.filter((p) => !p.isBot).length;
      this.activeGame = snap.activeGame;
      this.arenaEngine.applySnapshot(snap, this.localSlotId);
      if (snap.chainState) {
        this.chainEngine.applySnapshot(snap.chainState);
      }
      if (snap.puttState) {
        this.puttEngine?.applySnapshot(snap.puttState);
      }
      const newHumanCount = this.arenaEngine.players.filter((p) => !p.isBot).length;
      if (prevGame !== this.activeGame || prevHumanCount !== newHumanCount) {
        this.onStatusUpdate();
      }
    } else if (env.type === 'DRAFT_PICK' && this.isHost) {
      this.peerLastSeen.set(env.sender, performance.now());
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
    const env: NetEnvelope = {
      sender: this.localPeerId,
      type: 'CLIENT_INPUT',
      payload: input
    };
    this.localBus?.postMessage(env);
    if (this.hostConn?.open) {
      this.hostConn.send(env);
    }

    // Periodic lightweight ping/heartbeat every ~25 frames
    this.rtcBroadcastCounter++;
    if (this.rtcBroadcastCounter % 25 === 0) {
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

    // Send at full 60Hz over WebRTC DataChannel for minimum latency!
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
