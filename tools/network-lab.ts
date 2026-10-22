import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { MultiplayerRoomManager } from '../src/net/multiplayerRoom';
import { readRtcConfiguration } from '../src/net/rtcConfiguration';
import { ArenaEngine } from '../src/game/arenaEngine';
import { ChainPanicEngine } from '../src/game/chainPanicEngine';
import { PuttWarEngine } from '../src/game/puttWarEngine';
import { HotCoreEngine } from '../src/game/hotCoreEngine';
import { VoltCrownEngine } from '../src/game/voltCrownEngine';
import { HexCrushEngine } from '../src/game/hexCrushEngine';
import { RicochetEngine } from '../src/game/ricochetEngine';
import { TournamentManager } from '../src/game/tournamentManager';
import { FixedStepClock } from '../src/runtime/fixedStepClock';
import { sfx } from '../src/audio/mechanicalSfx';
import type { ClientInputPacket } from '../src/types';

type ProfileId = 'base' | 'light' | 'moderate' | 'severe' | 'outage';
type Profile = { label: string; rtt: number; jitter: number; loss: number; outage: boolean };
const profiles: Record<ProfileId, Profile> = {
  base: { label: 'Base', rtt: 0, jitter: 0, loss: 0, outage: false },
  light: { label: '100 ms + jitter ±20 ms + 1 %', rtt: 100, jitter: 20, loss: 0.01, outage: false },
  moderate: { label: '200 ms + jitter ±60 ms + 5 %', rtt: 200, jitter: 60, loss: 0.05, outage: false },
  severe: { label: '350 ms + jitter ±100 ms + 10 %', rtt: 350, jitter: 100, loss: 0.1, outage: false },
  outage: { label: 'Corte WebRTC de 3 s', rtt: 0, jitter: 0, loss: 0, outage: true }
};

const form = document.querySelector<HTMLFormElement>('#controls')!;
const startButton = document.querySelector<HTMLButtonElement>('#start')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const profileSelect = document.querySelector<HTMLSelectElement>('#profile')!;
const durationInput = document.querySelector<HTMLInputElement>('#duration')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const status = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;
const metrics = document.querySelector<HTMLTableSectionElement>('#metrics')!;
const configuration = document.querySelector<HTMLElement>('#configuration')!;
const query = new URLSearchParams(location.search);
if (query.get('profile') && query.get('profile')! in profiles) profileSelect.value = query.get('profile')!;
if (query.has('duration')) durationInput.value = String(Math.max(8, Math.min(120, Number(query.get('duration')) || 15)));
if (query.has('seed')) seedInput.value = String((Number(query.get('seed')) >>> 0) || 12345);

interface CandidateSummary { local: string; remote: string; rttMs: number | null; relay: boolean; state: string }
interface NodeMetrics {
  attempted: number; sent: number; dropped: number; closedBeforeSend: number;
  acceptedSnapshots: number; lastSnapshotAt: number; lastSnapshotSeq: number;
  corrections: number[]; errors: number[]; settleErrors: number[]; currentError: number; remoteError: number;
}
interface LabNode {
  index: number; name: string; arena: ArenaEngine; net: MultiplayerRoomManager;
  peers: Peer[]; connections: Set<DataConnection>; ice: CandidateSummary[]; metrics: NodeMetrics; errors: string[];
}

let nodes: LabNode[] = [];
let running = false;
let finishing = false;
let frame = 0;
let generation = 0;
let runStart = 0;
let connectingSince = 0;
let requestedDuration = 15;
let settleDuration = 3;
let selected: Profile = profiles.base;
let selectedId: ProfileId = 'base';
let seed = 12345;
let randomState = 12345;
let room = '';
let cutUntil = 0;
let cutTriggered = false;
let lastMeasurement = 0;
let lastIceUpdate = 0;
let iceBusy = false;
const scheduled = new Set<number>();
const clock = new FixedStepClock(60, 8);
let rtcConfig: RTCConfiguration = {};

function random(): number {
  randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
  return randomState / 4294967296;
}

function later(callback: () => void, delay: number): void {
  const token = generation;
  const timer = window.setTimeout(() => {
    scheduled.delete(timer);
    if (token === generation && running) callback();
  }, delay);
  scheduled.add(timer);
}

function safeConfiguration(config: RTCConfiguration) {
  const urls = (config.iceServers ?? []).flatMap((server) => typeof server.urls === 'string' ? [server.urls] : server.urls);
  return {
    policy: config.iceTransportPolicy ?? 'all', servers: config.iceServers?.length ?? 0,
    stunUrls: urls.filter((url) => /^stuns?:/i.test(url)).length,
    turnUrls: urls.filter((url) => /^turns?:/i.test(url)).length
  };
}

function observeConnection(node: LabNode, connection: DataConnection): DataConnection {
  if (node.connections.has(connection)) return connection;
  node.connections.add(connection);
  const send = connection.send.bind(connection);
  connection.send = ((data: unknown, chunked?: boolean) => {
    node.metrics.attempted++;
    let type = '';
    try { if (typeof data === 'string') type = JSON.parse(data).type ?? ''; } catch { /* Opaque data passes through. */ }
    const gameplay = type === 'WORLD_SNAP' || type === 'CLIENT_INPUT';
    const ping = type === 'PING_REQ' || type === 'PING_ACK';
    if (gameplay && selected.loss > 0 && random() < selected.loss) { node.metrics.dropped++; return; }
    const delay = gameplay || ping ? Math.max(0, selected.rtt / 2 + (random() * 2 - 1) * selected.jitter) : 0;
    const deliver = () => {
      if (!connection.open) { node.metrics.closedBeforeSend++; return; }
      try {
        const pending = send(data, chunked);
        node.metrics.sent++;
        if (pending) void pending.catch(() => { node.metrics.closedBeforeSend++; });
      } catch { node.metrics.closedBeforeSend++; }
    };
    if (delay > 0) later(deliver, delay); else deliver();
  }) as DataConnection['send'];
  return connection;
}

function peerFactory(node: LabNode, id: string, options: PeerOptions): Peer {
  if (node.index === 1 && performance.now() < cutUntil) throw new Error('Laboratory reconnect hold');
  const peer = new Peer(id, options);
  node.peers.push(peer);
  const connect = peer.connect.bind(peer);
  peer.connect = ((...args: Parameters<Peer['connect']>) => observeConnection(node, connect(...args))) as Peer['connect'];
  peer.on('connection', (connection) => observeConnection(node, connection));
  peer.on('error', (error: { type?: string }) => {
    const type = String(error.type || 'connection-error').replace(/[^a-z-]/gi, '').slice(0, 50);
    if (!node.errors.includes(type)) node.errors.push(type);
  });
  return peer;
}

function createNode(index: number): LabNode {
  const arena = new ArenaEngine();
  const node: LabNode = {
    index, name: index === 0 ? 'Anfitrión' : `Invitado ${index}`, arena,
    net: undefined as unknown as MultiplayerRoomManager,
    peers: [], connections: new Set<DataConnection>(), ice: [], errors: [],
    metrics: { attempted: 0, sent: 0, dropped: 0, closedBeforeSend: 0, acceptedSnapshots: 0,
      lastSnapshotAt: 0, lastSnapshotSeq: 0, corrections: [], errors: [], settleErrors: [], currentError: 0, remoteError: 0 }
  };
  node.net = new MultiplayerRoomManager(arena, new ChainPanicEngine(), () => {}, new PuttWarEngine(),
    new HotCoreEngine(), new VoltCrownEngine(), new HexCrushEngine(), new TournamentManager(), new RicochetEngine(),
    { rtcConfig, createPeer: (id, options) => peerFactory(node, id, options) });
  const apply = arena.applySnapshot.bind(arena);
  arena.applySnapshot = (...args: Parameters<ArenaEngine['applySnapshot']>) => {
    const slot = node.net.localSlotId;
    const before = arena.players[slot];
    const x = before?.x ?? 0, y = before?.y ?? 0;
    apply(...args);
    const now = performance.now();
    node.metrics.acceptedSnapshots++;
    node.metrics.lastSnapshotAt = now;
    node.metrics.lastSnapshotSeq = args[0].snapshotSeq ?? 0;
    if (runStart > 0 && node.index > 0) {
      const after = arena.players[slot];
      if (after) node.metrics.corrections.push(Math.hypot(after.x - x, after.y - y));
    }
  };
  return node;
}

function input(node: LabNode, elapsed: number): ClientInputPacket {
  const moving = elapsed < requestedDuration - settleDuration;
  const phase = elapsed * 1.1 + node.index * Math.PI / 2;
  return {
    slotId: node.net.localSlotId, name: `LAB-${node.index}`, moveX: moving ? Math.cos(phase) * 0.7 : 0,
    moveY: moving ? Math.sin(phase) * 0.55 : 0, aimAngle: phase % (Math.PI * 2),
    parryPressed: false, dashPressed: false, chargingParry: false, anchorHeld: false, emotePressed: 0, clientBallDist: 999
  };
}

function percentile(values: number[], quantile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))];
}

const rounded = (value: number | null) => value === null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100;
const format = (value: number | null, suffix = '') => value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}${suffix}`;

function measure(now: number): void {
  const host = nodes[0];
  if (!host || !runStart) return;
  for (const node of nodes.slice(1)) {
    const slot = node.net.localSlotId;
    const authoritative = host.arena.players[slot], predicted = node.arena.players[slot];
    if (!authoritative || !predicted) continue;
    node.metrics.currentError = Math.hypot(predicted.x - authoritative.x, predicted.y - authoritative.y);
    node.metrics.remoteError = Math.max(...host.arena.players.map((player, id) => {
      if (id === slot) return 0;
      const remote = node.arena.players[id];
      return remote ? Math.hypot(remote.x - player.x, remote.y - player.y) : Infinity;
    }));
    node.metrics.errors.push(node.metrics.currentError);
    if ((now - runStart) / 1000 >= requestedDuration - 1) node.metrics.settleErrors.push(node.metrics.currentError);
  }
}

async function updateIce(): Promise<void> {
  if (iceBusy) return;
  iceBusy = true;
  const token = generation;
  try {
    await Promise.all(nodes.map(async (node) => {
      const summaries: CandidateSummary[] = [];
      for (const connection of node.connections) {
        if (!connection.open || !connection.peerConnection) continue;
        try {
          const report = await connection.peerConnection.getStats();
          let pair: any;
          report.forEach((entry: any) => {
            if (entry.type === 'transport' && entry.selectedCandidatePairId) pair = report.get(entry.selectedCandidatePairId);
          });
          if (!pair) report.forEach((entry: any) => {
            if (entry.type === 'candidate-pair' && entry.state === 'succeeded' && entry.nominated) pair = entry;
          });
          if (pair) {
            const local = report.get(pair.localCandidateId), remote = report.get(pair.remoteCandidateId);
            summaries.push({ local: local?.candidateType ?? 'unknown', remote: remote?.candidateType ?? 'unknown',
              relay: local?.candidateType === 'relay' || remote?.candidateType === 'relay', state: pair.state,
              rttMs: Number.isFinite(pair.currentRoundTripTime) ? pair.currentRoundTripTime * 1000 : null });
          }
        } catch { /* A closed/reconnecting transport may not have stats. */ }
      }
      if (generation === token) node.ice = summaries;
    }));
  } finally { iceBusy = false; }
}

function renderMetrics(): void {
  metrics.replaceChildren();
  const now = performance.now();
  for (const node of nodes) {
    const row = document.createElement('tr');
    row.dataset.player = String(node.index);
    const values = [
      node.name, `${node.net.localSlotId} · ${node.net.connectionState}`,
      node.index === 0 ? 'Emisor autoritativo' : `${node.metrics.acceptedSnapshots} · ${node.net.isSynchronized ? 'vigente' : 'sin estado reciente'} · ${node.metrics.lastSnapshotAt ? Math.round(now - node.metrics.lastSnapshotAt) + ' ms' : 'sin recepción'}`,
      node.index === 0 ? '—' : format(node.net.pingMs > 0 ? node.net.pingMs : null, ' ms'),
      node.ice.length ? node.ice.map((pair) => `${pair.local}/${pair.remote} · ${format(pair.rttMs, ' ms')}`).join('; ') : 'Esperando par seleccionado',
      node.index === 0 ? '—' : `${format(node.metrics.errors.length ? node.metrics.currentError : null)} / ${format(percentile(node.metrics.errors, 0.95))}`,
      node.index === 0 ? '—' : format(percentile(node.metrics.corrections, 0.95)),
      `${node.metrics.sent} / ${node.metrics.dropped}`
    ];
    values.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      if (index === 2 && node.index > 0) cell.dataset.state = node.net.isSynchronized ? 'ok' : 'warn';
      row.append(cell);
    });
    metrics.append(row);
  }
}

function allReady(): boolean {
  if (nodes.length !== 4 || nodes[0].net.connectedPeersCount !== 3) return false;
  const roster = JSON.stringify(nodes[0].arena.players.map((player) => [player.name, player.isBot, player.peerId]));
  const assigned = new Set(nodes.slice(1).map((node) => node.net.localSlotId));
  return assigned.size === 3 && !assigned.has(0) && nodes.slice(1).every((node) => node.net.isSynchronized &&
    JSON.stringify(node.arena.players.map((player) => [player.name, player.isBot, player.peerId])) === roster);
}

function startExercise(now: number): void {
  const host = nodes[0];
  host.net.sendOrApplyRoomAction({ kind: 'BOT_DIFF', botDifficulty: 'OFF' });
  host.net.switchGame('BASH_BOT');
  host.arena.balls = [];
  runStart = now;
  clock.reset(now);
  status.textContent = `Cuatro jugadores conectados. Ejecutando ${selected.label}; movimiento y ${settleDuration} s finales de reposo.`;
}

function advance(dt: number): void {
  const elapsed = (performance.now() - runStart) / 1000;
  const host = nodes[0];
  // Remove combat from this experiment; only real movement, input transport and reconciliation run.
  host.arena.balls = [];
  host.arena.step(dt, input(host, elapsed));
  host.net.broadcastHostSnapshot();
  for (const node of nodes.slice(1)) {
    const packet = input(node, elapsed);
    if (node.net.isSynchronized && node.net.activeGame === 'BASH_BOT') node.arena.stepClientPrediction(dt, node.net.localSlotId, packet);
    node.net.sendClientInput(packet);
  }
}

function animate(now: number): void {
  if (!running || finishing) return;
  if (!runStart) {
    nodes[0]?.net.broadcastHostSnapshot();
    if (allReady()) startExercise(now);
    else if (now - connectingSince > 30000) { void finish('connection-timeout'); return; }
  } else {
    const elapsed = (now - runStart) / 1000;
    if (selected.outage && !cutTriggered && elapsed >= 3) {
      cutTriggered = true; cutUntil = now + 3000;
      for (const peer of nodes[1].peers) peer.destroy();
      status.textContent = 'Corte de 3 s del invitado 1; se bloquea temporalmente su reconexión.';
    }
    if (selected.outage && cutTriggered && now >= cutUntil && nodes[1].net.isSynchronized) status.textContent = 'Invitado 1 reconectado; midiendo recuperación y convergencia.';
    clock.advance(now, advance);
    if (elapsed >= requestedDuration) { void finish('complete'); return; }
  }
  if (now - lastMeasurement > 100) { measure(now); renderMetrics(); lastMeasurement = now; }
  if (now - lastIceUpdate > 1000) { void updateIce(); lastIceUpdate = now; }
  frame = requestAnimationFrame(animate);
}

function cleanup(): void {
  running = false;
  generation++;
  cancelAnimationFrame(frame);
  for (const timer of scheduled) clearTimeout(timer);
  scheduled.clear();
  for (const node of nodes) {
    node.net.dispose();
    for (const peer of node.peers) if (!peer.destroyed) peer.destroy();
  }
  startButton.disabled = false;
  stopButton.disabled = true;
  profileSelect.disabled = durationInput.disabled = seedInput.disabled = false;
}

async function finish(reason: 'complete' | 'stopped' | 'connection-timeout'): Promise<void> {
  if (finishing || !running) return;
  finishing = true;
  cancelAnimationFrame(frame);
  measure(performance.now());
  await updateIce();
  renderMetrics();
  const host = nodes[0];
  const roster = host ? JSON.stringify(host.arena.players.map((player) => [player.name, player.isBot, player.peerId])) : '';
  const clients = nodes.slice(1).map((node) => ({
    player: node.index, slot: node.net.localSlotId, connection: node.net.connectionState,
    synchronized: node.net.isSynchronized, roundMatches: node.net.activeRoundEpoch === host.net.activeRoundEpoch,
    rosterMatches: JSON.stringify(node.arena.players.map((player) => [player.name, player.isBot, player.peerId])) === roster,
    acceptedSnapshots: node.metrics.acceptedSnapshots, snapshotAgeMs: rounded(node.metrics.lastSnapshotAt ? performance.now() - node.metrics.lastSnapshotAt : null),
    protocolPingMs: node.net.pingMs, selectedIcePairs: node.ice,
    localErrorNow: rounded(node.metrics.errors.length ? node.metrics.currentError : null), localErrorP95: rounded(percentile(node.metrics.errors, 0.95)),
    localErrorMax: rounded(node.metrics.errors.length ? Math.max(...node.metrics.errors) : null),
    remoteErrorNow: rounded(node.metrics.errors.length ? node.metrics.remoteError : null), correctionP95: rounded(percentile(node.metrics.corrections, 0.95)),
    settledLocalErrorP95: rounded(percentile(node.metrics.settleErrors, 0.95)),
    sent: node.metrics.sent, artificiallyDropped: node.metrics.dropped, closedBeforeSend: node.metrics.closedBeforeSend,
    transportErrors: node.errors
  }));
  const converged = clients.length === 3 && clients.every((client) => client.synchronized && client.rosterMatches && client.roundMatches &&
    client.localErrorNow !== null && client.localErrorNow <= 8 && client.remoteErrorNow !== null && client.remoteErrorNow <= 8);
  const relayRequired = rtcConfig.iceTransportPolicy === 'relay';
  const relayVerified = clients.length === 3 && clients.every((client) => client.selectedIcePairs.length > 0 && client.selectedIcePairs.every((pair) => pair.relay));
  results.textContent = JSON.stringify({
    status: reason, completed: reason === 'complete', movementConverged: reason === 'complete' && converged,
    criterion: 'Final local and remote position error <= 8 game units, current snapshots, equal rosters and rounds. This is a laboratory criterion, not a network guarantee.',
    room, profile: selectedId, addedRttMs: selected.rtt, jitterPerMessageMs: selected.jitter, dropProbability: selected.loss,
    seed, requestedDurationSeconds: requestedDuration, elapsedSeconds: rounded(runStart ? (performance.now() - runStart) / 1000 : 0),
    settleSeconds: settleDuration, controlledOutageTriggered: cutTriggered,
    simulation: 'BASH movement only, no balls/combat/bots; 4 real peers in one page', countsIncludeConnectionSetup: true,
    impairmentLayer: 'Application messages before DataConnection.send; not UDP/SCTP packet loss',
    iceConfiguration: safeConfiguration(rtcConfig), relayRequired, relayVerified,
    clients, limits: 'Same-device experiment. No WAN latency, NAT diversity or real UDP/SCTP loss measured. Credentials and candidate addresses omitted.'
  }, null, 2);
  status.textContent = reason === 'connection-timeout' ? 'No se conectaron los cuatro jugadores en 30 s. Revisa señalización, política ICE y configuración TURN.' :
    reason === 'stopped' ? 'Prueba detenida; resultado parcial conservado.' :
    `Prueba terminada. ${converged ? 'Movimiento convergente al finalizar.' : 'Hay divergencia o una conexión sin estado reciente; revisa el resultado.'}${relayRequired && !relayVerified ? ' No se pudo verificar un par relay en cada invitado.' : ''}`;
  cleanup();
  finishing = false;
}

function start(): void {
  if (running || finishing) return;
  if (!form.reportValidity()) return;
  try { rtcConfig = readRtcConfiguration(); }
  catch (error) {
    status.textContent = 'La configuración RTC es inválida. Corrige las variables Vite y vuelve a cargar.';
    results.textContent = error instanceof Error && error.name === 'RtcConfigurationError' ? error.message : 'No se pudo leer la configuración RTC.';
    return;
  }
  generation++;
  nodes = [];
  running = true;
  runStart = 0; connectingSince = performance.now(); lastMeasurement = lastIceUpdate = 0;
  cutUntil = 0; cutTriggered = false;
  requestedDuration = Math.max(8, Math.min(120, Number(durationInput.value) || 15));
  settleDuration = Math.min(3, requestedDuration / 4);
  selectedId = profileSelect.value as ProfileId; selected = profiles[selectedId];
  seed = (Number(seedInput.value) >>> 0) || 12345; randomState = seed;
  room = `L${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase()}`.slice(0, 8);
  const config = safeConfiguration(rtcConfig);
  configuration.textContent = `Sala ${room}. Política ICE: ${config.policy}; servidores: ${config.servers}; URLs STUN: ${config.stunUrls}; URLs TURN: ${config.turnUrls}.`;
  results.textContent = 'Ejecución en curso. El resultado aparecerá al finalizar o detener.';
  status.textContent = 'Conectando al anfitrión y tres invitados mediante PeerJS/WebRTC real…';
  startButton.disabled = true; stopButton.disabled = false;
  profileSelect.disabled = durationInput.disabled = seedInput.disabled = true;
  sfx.enabled = false;
  try {
    for (let index = 0; index < 4; index++) nodes.push(createNode(index));
    nodes[0].net.hostRoom(room, 'LAB-0');
    for (const node of nodes.slice(1)) node.net.joinRoomAsClient(room, `LAB-${node.index}`);
    clock.reset(performance.now());
    renderMetrics();
    frame = requestAnimationFrame(animate);
  } catch {
    status.textContent = 'No se pudo iniciar el laboratorio. Revisa la configuración RTC y vuelve a intentar.';
    results.textContent = JSON.stringify({ status: 'initialization-error', iceConfiguration: safeConfiguration(rtcConfig) }, null, 2);
    cleanup();
  }
}

form.addEventListener('submit', (event) => { event.preventDefault(); start(); });
stopButton.addEventListener('click', () => { void finish('stopped'); });
window.addEventListener('pagehide', cleanup);
try {
  const initialConfiguration = safeConfiguration(readRtcConfiguration());
  configuration.textContent = `Política ICE: ${initialConfiguration.policy}; servidores configurados: ${initialConfiguration.servers}.`;
} catch {
  configuration.textContent = 'Configuración RTC inválida: corrige las variables Vite antes de iniciar.';
}
if (query.get('autorun') === '1') start();
