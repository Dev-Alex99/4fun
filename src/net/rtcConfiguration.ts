/** Browser-visible ICE configuration. TURN shared secrets must stay on the server. */
export class RtcConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = 'RtcConfigurationError'; }
}

const defaults: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

function validUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 500) return false;
  const match = /^(stun|stuns|turn|turns):(?:\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(?::([0-9]{1,5}))?(?:\?transport=(udp|tcp))?$/.exec(url);
  return !!match && (!match[2] || (Number(match[2]) > 0 && Number(match[2]) <= 65535))
    && (!url.startsWith('stun') || !match[3]);
}

export function readRtcConfiguration(env: Record<string, string | undefined> = import.meta.env): RTCConfiguration {
  const policy = env.VITE_RTC_ICE_TRANSPORT_POLICY?.trim() || 'all';
  if (policy !== 'all' && policy !== 'relay') throw new RtcConfigurationError('RTC: la política ICE debe ser all o relay.');
  let servers = defaults.map(server => ({ ...server }));
  const configured = env.VITE_RTC_ICE_SERVERS?.trim();
  if (configured) {
    let value: unknown;
    try { value = JSON.parse(configured); }
    catch { throw new RtcConfigurationError('RTC: VITE_RTC_ICE_SERVERS contiene JSON inválido.'); }
    if (!Array.isArray(value) || value.length < 1 || value.length > 12) {
      throw new RtcConfigurationError('RTC: configura entre 1 y 12 servidores ICE.');
    }
    servers = value.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new RtcConfigurationError('RTC: servidor ICE inválido.');
      const server = entry as Record<string, unknown>;
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      if (urls.length < 1 || urls.length > 6 || !urls.every(validUrl)) throw new RtcConfigurationError('RTC: URL STUN/TURN inválida.');
      const turn = urls.some(url => /^turns?:/.test(url as string));
      if (turn && (typeof server.username !== 'string' || !server.username.trim() || server.username.length > 1024
        || typeof server.credential !== 'string' || !server.credential.trim() || server.credential.length > 1024
        || (server.credentialType !== undefined && server.credentialType !== 'password'))) {
        throw new RtcConfigurationError('RTC: TURN requiere usuario y credencial temporal válidos.');
      }
      return {
        urls: Array.isArray(server.urls) ? [...urls] as string[] : urls[0] as string,
        ...(turn ? { username: server.username as string, credential: server.credential as string } : {})
      };
    });
  }
  if (policy === 'relay' && !servers.some(server => (Array.isArray(server.urls) ? server.urls : [server.urls]).some(url => /^turns?:/.test(url)))) {
    throw new RtcConfigurationError('RTC: relay requiere un servidor TURN autenticado; no se permite sustituirlo por STUN.');
  }
  return { iceServers: servers, iceTransportPolicy: policy };
}

export interface PeerServerOptions { host?: string; port?: number; path?: string; secure?: boolean; key?: string }

/**
 * Optional self-hosted PeerJS signaling server. Without VITE_PEER_HOST the public PeerJS cloud is used;
 * signaling only brokers connections, gameplay traffic still flows over WebRTC.
 */
export function readPeerServerOptions(env: Record<string, string | undefined> = import.meta.env): PeerServerOptions {
  const read = (key: string) => env[key]?.trim() || undefined;
  const host = read('VITE_PEER_HOST');
  const extras = ['VITE_PEER_PORT', 'VITE_PEER_PATH', 'VITE_PEER_SECURE', 'VITE_PEER_KEY'].filter(read);
  if (!host) {
    if (extras.length) throw new RtcConfigurationError(`PeerJS: ${extras[0]} requiere VITE_PEER_HOST.`);
    return {};
  }
  if (!/^[a-zA-Z0-9.-]{1,253}$/.test(host)) throw new RtcConfigurationError('PeerJS: VITE_PEER_HOST inválido.');
  const options: PeerServerOptions = { host };
  const port = read('VITE_PEER_PORT');
  if (port !== undefined) {
    const value = Number(port);
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new RtcConfigurationError('PeerJS: VITE_PEER_PORT inválido.');
    options.port = value;
  }
  const path = read('VITE_PEER_PATH');
  if (path !== undefined) {
    if (!/^\/[A-Za-z0-9._~/-]{0,200}$/.test(path)) throw new RtcConfigurationError('PeerJS: VITE_PEER_PATH inválido.');
    options.path = path;
  }
  const secure = read('VITE_PEER_SECURE');
  if (secure !== undefined) {
    if (secure !== 'true' && secure !== 'false') throw new RtcConfigurationError('PeerJS: VITE_PEER_SECURE debe ser true o false.');
    options.secure = secure === 'true';
  }
  const key = read('VITE_PEER_KEY');
  if (key !== undefined) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(key)) throw new RtcConfigurationError('PeerJS: VITE_PEER_KEY inválido.');
    options.key = key;
  }
  return options;
}
