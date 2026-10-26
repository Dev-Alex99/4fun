export interface LinkDiagnostic {
  slot: number;
  open: boolean;
  route: 'DIRECT' | 'RELAY' | 'UNKNOWN';
  transport: 'udp' | 'tcp' | 'unknown';
  rttMs: number | null;
  iceState: string;
  bytesSent: number;
  bytesReceived: number;
}

export interface ConnectionDiagnostic {
  version: 1;
  capturedAt: string;
  protocolVersion: number;
  role: 'HOST' | 'CLIENT';
  state: string;
  signalingReady: boolean;
  synchronized: boolean;
  configurationError: boolean;
  turnConfigured: boolean;
  icePolicy: 'all' | 'relay';
  humans: number;
  links: LinkDiagnostic[];
}

const nonnegative = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(value, 1e15)) : 0;

/** Allowlist only: addresses, candidate IDs, peer identities, URLs and credentials never leave this function. */
export function summarizeLink(report: RTCStatsReport | null, slot: number, open: boolean, iceState = 'unknown'): LinkDiagnostic {
  let selectedId = '';
  let pair: Record<string, unknown> | undefined;
  report?.forEach(value => {
    const stat = value as Record<string, unknown>;
    if (stat.type === 'transport' && typeof stat.selectedCandidatePairId === 'string') selectedId = stat.selectedCandidatePairId;
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && (stat.selected === true || stat.nominated === true)) pair = stat;
  });
  if (selectedId) pair = report?.get(selectedId) as Record<string, unknown> | undefined;
  const local = pair && report?.get(String(pair.localCandidateId)) as Record<string, unknown> | undefined;
  const remote = pair && report?.get(String(pair.remoteCandidateId)) as Record<string, unknown> | undefined;
  const established = pair?.state === 'succeeded';
  const route = established && (local?.candidateType === 'relay' || remote?.candidateType === 'relay') ? 'RELAY' :
    established && ['host', 'srflx', 'prflx'].includes(String(local?.candidateType)) && ['host', 'srflx', 'prflx'].includes(String(remote?.candidateType)) ? 'DIRECT' : 'UNKNOWN';
  const protocol = local?.protocol;
  return { slot, open, route, transport: protocol === 'udp' || protocol === 'tcp' ? protocol : 'unknown',
    rttMs: typeof pair?.currentRoundTripTime === 'number' && Number.isFinite(pair.currentRoundTripTime) ? Math.round(nonnegative(pair.currentRoundTripTime) * 1000) : null,
    iceState: ['new', 'checking', 'connected', 'completed', 'disconnected', 'failed', 'closed'].includes(iceState) ? iceState : 'unknown',
    bytesSent: nonnegative(pair?.bytesSent), bytesReceived: nonnegative(pair?.bytesReceived) };
}

export async function readLinkDiagnostic(connection: { open: boolean; peerConnection?: RTCPeerConnection }, slot: number): Promise<LinkDiagnostic> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const pc = connection.peerConnection;
    const report = pc?.getStats ? await Promise.race([pc.getStats(), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 2000); })]) : null;
    return summarizeLink(report, slot, connection.open, pc?.iceConnectionState);
  } catch { return summarizeLink(null, slot, connection.open); }
  finally { if (timer) clearTimeout(timer); }
}
