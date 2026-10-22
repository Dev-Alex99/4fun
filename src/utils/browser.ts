type StorageArea = 'local' | 'session';

function getStorage(area: StorageArea): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window[`${area}Storage`];
  } catch {
    return null;
  }
}

export function readStorage(area: StorageArea, key: string): string | null {
  try { return getStorage(area)?.getItem(key) ?? null; } catch { return null; }
}

export function writeStorage(area: StorageArea, key: string, value: string): void {
  try { getStorage(area)?.setItem(key, value); } catch { /* Storage can be denied or full. */ }
}

export function removeStorage(area: StorageArea, key: string): void {
  try { getStorage(area)?.removeItem(key); } catch { /* Session remains usable in memory. */ }
}

export function normalizePilotName(value: unknown): string {
  return typeof value === 'string'
    ? value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 10) || 'PILOTO'
    : 'PILOTO';
}

const PILOT_NAME_KEY = 'tp04_pilot_name';

/** Pin the initial preference to this tab so another tab cannot rename it on reload. */
export function readPilotName(): string | null {
  const stored = readStorage('session', PILOT_NAME_KEY) ?? readStorage('local', PILOT_NAME_KEY);
  if (stored === null) return null;
  const name = normalizePilotName(stored);
  writeStorage('session', PILOT_NAME_KEY, name);
  return name;
}

/** Save the current tab's identity and the default preference for newly opened tabs. */
export function writePilotName(value: string): string {
  const name = normalizePilotName(value);
  writeStorage('session', PILOT_NAME_KEY, name);
  writeStorage('local', PILOT_NAME_KEY, name);
  return name;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]!);
}
