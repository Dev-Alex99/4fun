import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPilotName, writePilotName } from '../utils/browser';

const KEY = 'tp04_pilot_name';
function storage(values: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(values));
  return {
    get length() { return data.size; },
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: key => { data.delete(key); },
    clear: () => { data.clear(); },
    key: index => [...data.keys()][index] ?? null
  };
}

let shared: Storage;
let tab: Storage;
beforeEach(() => {
  shared = storage(); tab = storage();
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => shared);
  vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => tab);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('pilot identity is isolated per browser tab', () => {
  it('pins an existing host preference even when the host never edits its name', () => {
    shared.setItem(KEY, 'HOST');
    const hostTab = tab;
    expect(readPilotName()).toBe('HOST');
    expect(hostTab.getItem(KEY)).toBe('HOST');
    tab = storage(); writePilotName('INVITADO');
    expect(shared.getItem(KEY)).toBe('INVITADO');
    tab = hostTab;
    expect(readPilotName()).toBe('HOST'); // Reloading the host tab reads its preserved session.
    expect(shared.getItem(KEY)).toBe('INVITADO');
  });

  it('keeps each current name on reload/reconnect while a new tab inherits the latest preference', () => {
    writePilotName('HOST'); const hostTab = tab;
    tab = storage(); expect(readPilotName()).toBe('HOST'); writePilotName('PLAYER2'); const guestTab = tab;
    tab = hostTab; expect(writePilotName('HOST-NEW')).toBe('HOST-NEW');
    tab = guestTab; expect(readPilotName()).toBe('PLAYER2');
    tab = hostTab; expect(readPilotName()).toBe('HOST-NEW');
    tab = storage(); expect(readPilotName()).toBe('HOST-NEW');
    tab = guestTab; expect(readPilotName()).toBe('PLAYER2');
  });

  it('normalizes stored session names before using them and never replaces them with global names', () => {
    shared.setItem(KEY, 'OTHERTAB'); tab.setItem(KEY, 'høst <1>_longname');
    expect(readPilotName()).toBe('HST1_LONGN');
    expect(tab.getItem(KEY)).toBe('HST1_LONGN');
    expect(shared.getItem(KEY)).toBe('OTHERTAB');
  });

  it('normalizes initial global names and pins the normalized value locally to the tab', () => {
    shared.setItem(KEY, ' host 42! ');
    expect(readPilotName()).toBe('HOST42');
    expect(tab.getItem(KEY)).toBe('HOST42');
    expect(shared.getItem(KEY)).toBe(' host 42! ');
    expect(writePilotName(' a_b-123456789! ')).toBe('A_B-123456');
    expect(shared.getItem(KEY)).toBe('A_B-123456'); expect(tab.getItem(KEY)).toBe('A_B-123456');
  });

  it('preserves first-run detection when neither storage area contains an identity', () => {
    expect(readPilotName()).toBeNull();
    expect(shared.getItem(KEY)).toBeNull(); expect(tab.getItem(KEY)).toBeNull();
    expect(writePilotName('!')).toBe('PILOTO'); expect(readPilotName()).toBe('PILOTO');
  });

  it('continues using the tab identity when local storage is denied', () => {
    tab.setItem(KEY, 'HOST');
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    expect(readPilotName()).toBe('HOST');
    expect(writePilotName('RECONNECTED')).toBe('RECONNECTE');
    expect(readPilotName()).toBe('RECONNECTE');
  });

  it('uses a normalized global fallback when session storage is denied', () => {
    shared.setItem(KEY, ' host ');
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    expect(readPilotName()).toBe('HOST');
    expect(writePilotName(' guest ')).toBe('GUEST'); expect(readPilotName()).toBe('GUEST');
  });

  it('does not throw when both storage access or quota operations are unavailable', () => {
    const denied = storage();
    vi.spyOn(denied, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(denied, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    shared = denied; tab = denied;
    expect(readPilotName()).toBeNull();
    expect(writePilotName('HOST')).toBe('HOST');
  });
});
