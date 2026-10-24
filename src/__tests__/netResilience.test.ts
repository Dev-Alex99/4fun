import { describe, expect, it } from 'vitest';
import { RttEstimator, inputExpiryMs, inputFreshnessMs, syncGraceMs } from '../net/linkQuality';
import { decodeDeflateFrame, encodeDeflateFrame, FRAME_DEFLATE, MAX_COMPRESSED_BYTES } from '../net/frameCodec';
import { reconcilePlayer } from '../game/reconciliation';
import { readPeerServerOptions, RtcConfigurationError } from '../net/rtcConfiguration';

describe('link quality windows', () => {
  it('keeps the original fixed windows until a link has been measured', () => {
    const rtt = new RttEstimator();
    expect([syncGraceMs(rtt), inputFreshnessMs(rtt), inputExpiryMs(rtt), inputFreshnessMs(undefined), inputExpiryMs(undefined)])
      .toEqual([500, 500, 250, 500, 250]);
  });

  it('smooths samples like RFC 6298 and ignores impossible values', () => {
    const rtt = new RttEstimator();
    rtt.add(100);
    expect([rtt.srtt, rtt.rttvar]).toEqual([100, 50]);
    rtt.add(200);
    expect(rtt.srtt).toBeCloseTo(112.5); expect(rtt.rttvar).toBeCloseTo(62.5);
    for (const bad of [NaN, -5, Infinity]) rtt.add(bad);
    expect(rtt.samples).toBe(2);
    rtt.reset(); expect([rtt.srtt, rtt.rttvar, rtt.samples]).toEqual([0, 0, 0]);
  });

  it('stretches windows for slow, jittery links but always within fixed bounds', () => {
    const steady = new RttEstimator(), slow = new RttEstimator(), awful = new RttEstimator();
    for (let i = 0; i < 40; i++) { steady.add(40); slow.add(i % 2 ? 380 : 480); awful.add(i % 2 ? 300 : 5000); }
    expect([syncGraceMs(steady), inputFreshnessMs(steady), inputExpiryMs(steady)].map(Math.round)).toEqual([500, 500, 250]);
    expect(syncGraceMs(slow)).toBeGreaterThan(900); expect(syncGraceMs(slow)).toBeLessThanOrEqual(1500);
    expect(inputFreshnessMs(slow)).toBeGreaterThan(800);
    expect(inputExpiryMs(slow)).toBeGreaterThan(300); expect(inputExpiryMs(slow)).toBeLessThanOrEqual(600);
    expect([syncGraceMs(awful), inputFreshnessMs(awful), inputExpiryMs(awful)]).toEqual([1500, 1500, 600]);
  });
});

describe('deflate snapshot frames', () => {
  it('round-trips text and is much smaller for repetitive snapshot JSON', async () => {
    const text = JSON.stringify({ players: Array.from({ length: 4 }, (_, id) => ({ id, x: 100.25 * id, y: 50, alive: true, name: 'PILOTO' })), tiles: Array.from({ length: 90 }, (_, id) => ({ id, health: 3, fadeAlpha: 1 })) });
    const frame = await encodeDeflateFrame(text);
    expect(frame[0]).toBe(FRAME_DEFLATE);
    expect(frame.byteLength).toBeLessThan(text.length / 3);
    expect(await decodeDeflateFrame(frame, text.length)).toBe(text);
  });

  it('rejects wrong tags, corrupt data, oversized input and decompression bombs without throwing', async () => {
    const deflate = async (bytes: Uint8Array<ArrayBuffer>) => new Uint8Array(await new Response(
      new ReadableStream<BufferSource>({ start(c) { c.enqueue(bytes); c.close(); } }).pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const tagged = (body: Uint8Array, tag = FRAME_DEFLATE) => { const out = new Uint8Array(body.byteLength + 1); out[0] = tag; out.set(body, 1); return out; };
    // 5 MB of spaces deflate to a few KB: the output limit must stop it, not the input size.
    const bomb = await encodeDeflateFrame(' '.repeat(5_000_000));
    expect(bomb.byteLength).toBeLessThan(MAX_COMPRESSED_BYTES);
    expect(await decodeDeflateFrame(bomb, 256 * 1024)).toBeNull();
    const valid = await encodeDeflateFrame('{"a":1}');
    expect(await decodeDeflateFrame(tagged(valid.subarray(1), 7), 1024)).toBeNull();
    expect(await decodeDeflateFrame(tagged(new Uint8Array([1, 2, 3, 4, 5])), 1024)).toBeNull();
    expect(await decodeDeflateFrame(new Uint8Array(MAX_COMPRESSED_BYTES + 2).fill(1), 1024)).toBeNull();
    expect(await decodeDeflateFrame(tagged(await deflate(new Uint8Array([0xff, 0xfe, 0xfd]))), 1024)).toBeNull();
    expect(await decodeDeflateFrame(new Uint8Array([FRAME_DEFLATE]), 1024)).toBeNull();
    expect(await decodeDeflateFrame(valid, 1024)).toBe('{"a":1}');
  });
});

describe('acknowledged-input reconciliation', () => {
  type Body = { x: number; y: number; vx: number; vy: number; [key: string]: unknown };
  const player = (x: number, extra: Record<string, unknown> = {}): Body => ({ x, y: 0, vx: 180, vy: 0, alive: true, ...extra });

  it('adds only in-flight local movement to host state instead of guessing from ping', () => {
    // Host applied input up to x=100; 54 px of local movement are still in flight; prediction shows 154.
    const result = reconcilePlayer(player(154), player(100), true, false, { dx: 54, dy: 0 });
    expect(result.x).toBeCloseTo(154);
    expect(result.vx).toBe(180);
    // The legacy lead (velocity x ~RTT/2, capped) would have pulled the robot back toward ~118.
    expect(reconcilePlayer(player(154), player(100), true, false, 0.1).x).toBeLessThan(150);
  });

  it('still converges toward genuine disagreement and resets on discontinuities', () => {
    const disagreement = reconcilePlayer(player(180), player(100), true, false, { dx: 54, dy: 0 });
    expect(disagreement.x).toBeLessThan(180); expect(disagreement.x).toBeGreaterThan(154);
    expect(reconcilePlayer(player(400), player(100), true, false, { dx: 54, dy: 0 }).x).toBe(154);
    expect(reconcilePlayer(player(154), player(100), true, true, { dx: 54, dy: 0 }).x).toBe(100);
  });

  it('never applies offsets to remote players, stunned, fallen or dead robots, or absurd values', () => {
    expect(reconcilePlayer(player(100), player(100), false, false, { dx: 54, dy: 0 }).x).toBe(100);
    for (const state of [{ stunTimer: 0.5 }, { fallTimer: 0.2 }, { alive: false }, { isDangling: true }]) {
      expect(reconcilePlayer(player(100), player(100, state), true, false, { dx: 54, dy: 0 }).x, JSON.stringify(state)).toBe(100);
    }
    for (const hint of [{ dx: 9999, dy: 0 }, { dx: NaN, dy: 0 }, { dx: 0, dy: Infinity }]) {
      expect(reconcilePlayer(player(100), player(100), true, false, hint).x).toBe(100);
    }
  });

  it('keeps a predicted jump and self-started dash timers while the action is still in flight', () => {
    const predicted = player(130, { z: 40, vz: 120, dashTimer: 0.15, dashCooldown: 0.9, stunTimer: 0 });
    const host = player(100, { z: 0, vz: 0, dashTimer: 0, dashCooldown: 0, stunTimer: 0 });
    const result = reconcilePlayer(predicted, host, true, false, { dx: 30, dy: 0, dz: 40 });
    expect(result.z as number).toBeCloseTo(40); expect(result.vz).toBe(120);
    expect(result.dashTimer).toBe(0.15); expect(result.dashCooldown).toBe(0.9);
    // Host-imposed states such as stuns are not kept from the prediction.
    const stunned = reconcilePlayer({ ...predicted, stunTimer: 0.4 }, host, true, false, { dx: 30, dy: 0, dz: 40 });
    expect(stunned.stunTimer).toBe(0);
  });
});

describe('self-hosted PeerJS signaling', () => {
  it('uses the public PeerJS cloud by default', () => {
    expect(readPeerServerOptions({})).toEqual({});
  });

  it('passes a validated self-hosted server', () => {
    expect(readPeerServerOptions({ VITE_PEER_HOST: 'peer.example.com', VITE_PEER_PORT: '9000', VITE_PEER_PATH: '/tp', VITE_PEER_SECURE: 'true', VITE_PEER_KEY: 'deck_1' }))
      .toEqual({ host: 'peer.example.com', port: 9000, path: '/tp', secure: true, key: 'deck_1' });
  });

  it.each([
    { VITE_PEER_PORT: '9000' }, { VITE_PEER_HOST: 'evil.com/x' }, { VITE_PEER_HOST: 'ok.com', VITE_PEER_PORT: '70000' },
    { VITE_PEER_HOST: 'ok.com', VITE_PEER_PATH: 'no-slash' }, { VITE_PEER_HOST: 'ok.com', VITE_PEER_SECURE: 'yes' },
    { VITE_PEER_HOST: 'ok.com', VITE_PEER_KEY: 'bad key' }
  ])('rejects incomplete or malformed signaling settings visibly: %o', env => {
    expect(() => readPeerServerOptions(env)).toThrow(RtcConfigurationError);
  });
});
