import { describe, expect, it } from 'vitest';
import { readRtcConfiguration, RtcConfigurationError } from '../net/rtcConfiguration';

const turn = { urls: ['turn:127.0.0.1:3478?transport=udp', 'turn:127.0.0.1:3478?transport=tcp'], username: '123:pilot', credential: 'temporary' };
describe('explicit ICE and TURN configuration', () => {
  it('keeps direct/STUN defaults when no deployment config exists', () => {
    const config = readRtcConfiguration({});
    expect(config.iceTransportPolicy).toBe('all');
    expect(config.iceServers?.length).toBe(2);
    expect(config.iceServers?.every(s => String(s.urls).startsWith('stun:'))).toBe(true);
  });
  it('passes authenticated UDP and TCP TURN to relay-only WebRTC without leaking extra server fields', () => {
    const config = readRtcConfiguration({ VITE_RTC_ICE_TRANSPORT_POLICY: 'relay', VITE_RTC_ICE_SERVERS: JSON.stringify([{ ...turn, serverSharedSecret: 'never-export' }]) });
    expect(config).toEqual({ iceTransportPolicy: 'relay', iceServers: [turn] });
  });
  it('requires actual TURN rather than substituting STUN when relay is requested', () => {
    for (const servers of [undefined, JSON.stringify([{ urls: 'stun:example.com:3478' }])]) {
      expect(() => readRtcConfiguration({ VITE_RTC_ICE_TRANSPORT_POLICY: 'relay', VITE_RTC_ICE_SERVERS: servers })).toThrow(RtcConfigurationError);
    }
    expect(readRtcConfiguration({ VITE_RTC_ICE_TRANSPORT_POLICY: 'relay', VITE_RTC_ICE_SERVERS: JSON.stringify([turn]) })).toEqual({ iceTransportPolicy: 'relay', iceServers: [turn] });
  });
  it('accepts TLS, IPv6 and normal automatic ICE selection', () => {
    const servers = [{ ...turn, urls: 'turns:relay.example.com:443?transport=tcp' }, { ...turn, urls: 'turn:[::1]:3478' }];
    expect(readRtcConfiguration({ VITE_RTC_ICE_SERVERS: JSON.stringify(servers) }).iceServers).toEqual(servers);
  });
  it.each(['{', 'null', '[]', '[null]', '[{}]', JSON.stringify(Array.from({ length: 13 }, () => turn))])('rejects malformed deployment JSON and server lists: %s', servers => {
    expect(() => readRtcConfiguration({ VITE_RTC_ICE_SERVERS: servers })).toThrow(RtcConfigurationError);
  });
  it.each([
    { urls: 'https://example.com' }, { urls: [] }, { urls: ['stun:example.com', 'invalid'] },
    { urls: 'turn:example.com:3478' }, { ...turn, username: '' }, { ...turn, credential: '' },
    { ...turn, credentialType: 'oauth' }, { ...turn, urls: 'turn:user:password@example.com' },
    { ...turn, urls: 'turn:example.com:99999' }, { ...turn, urls: 'turn:example.com:0' },
    { ...turn, urls: 'turn:example.com?transport=http' }, { urls: 'stun:example.com?transport=udp' }
  ])('rejects bad URLs and missing authentication without printing credentials', server => {
    expect(() => readRtcConfiguration({ VITE_RTC_ICE_SERVERS: JSON.stringify([server]) })).toThrow(RtcConfigurationError);
  });
  it('does not expose a supplied credential in validation errors', () => {
    const credential = 'DO-NOT-PRINT-THIS';
    try { readRtcConfiguration({ VITE_RTC_ICE_SERVERS: JSON.stringify([{ ...turn, credential, username: null }]) }); }
    catch (error) { expect(String(error)).not.toContain(credential); return; }
    throw new Error('Invalid credentials were accepted');
  });
  it('rejects misspelled transport policies', () => {
    expect(() => readRtcConfiguration({ VITE_RTC_ICE_TRANSPORT_POLICY: 'realay' })).toThrow(RtcConfigurationError);
  });
});
