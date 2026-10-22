import { afterEach, describe, expect, it, vi } from 'vitest';
import { FixedStepClock } from '../runtime/fixedStepClock';
import { escapeHtml, normalizePilotName, readStorage, removeStorage, writeStorage } from '../utils/browser';

afterEach(() => vi.restoreAllMocks());

describe('Fixed simulation clock', () => {
  it.each([30, 60, 144])('simulates the same second at %i rendering FPS', (fps) => {
    const clock = new FixedStepClock();
    clock.reset(0);
    let simulated = 0;
    let ticks = 0;
    for (let frame = 1; frame <= fps; frame++) {
      clock.advance(frame * 1000 / fps, (dt) => {
        expect(dt).toBe(1 / 60);
        simulated += dt;
        ticks++;
      });
    }
    expect(ticks).toBe(60);
    expect(simulated).toBeCloseTo(1, 10);
  });

  it('does not double-step when background and animation callbacks share a timestamp', () => {
    const clock = new FixedStepClock();
    clock.reset(0);
    const step = vi.fn();
    clock.advance(100, step);
    clock.advance(100, step);
    clock.advance(90, step);
    expect(step).toHaveBeenCalledTimes(6);
    clock.advance(200, step);
    expect(step).toHaveBeenCalledTimes(12);
  });

  it('bounds recovery after a long suspended tab and resumes normal ticks', () => {
    const clock = new FixedStepClock(60, 8);
    clock.reset(0);
    const step = vi.fn();
    expect(clock.advance(60_000, step)).toBe(8);
    expect(clock.advance(60_000 + 1000 / 60, step)).toBe(1);
    expect(step).toHaveBeenCalledTimes(9);
  });

  it('reset discards elapsed hidden time and invalid timestamps do not poison the clock', () => {
    const clock = new FixedStepClock();
    const step = vi.fn();
    clock.reset(5000);
    expect(clock.advance(NaN, step)).toBe(0);
    expect(clock.advance(Infinity, step)).toBe(0);
    expect(clock.advance(5000, step)).toBe(0);
    expect(clock.advance(5000 + 1000 / 60, step)).toBe(1);
  });
});

describe('Untrusted text and denied browser storage', () => {
  it('renders names, attributes and room messages as text', () => {
    const container = document.createElement('div');
    const value = '<img src=x onerror="alert(1)"> & \'NAME\'';
    container.innerHTML = `<span title="${escapeHtml(value)}">${escapeHtml(value)}</span>`;
    expect(container.querySelector('img')).toBeNull();
    expect(container.firstElementChild?.textContent).toBe(value);
    expect(container.firstElementChild?.getAttribute('title')).toBe(value);
    expect(normalizePilotName('<pilot> /_01')).toBe('PILOT_01');
    expect(normalizePilotName(null)).toBe('PILOTO');
  });

  it('remains usable if storage property access throws SecurityError', () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(readStorage('local', 'name')).toBeNull();
    expect(() => writeStorage('local', 'name', 'PILOT')).not.toThrow();
    expect(() => removeStorage('local', 'name')).not.toThrow();
    getter.mockRestore();
  });

  it('tolerates storage quota and method failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStorage('session', 'room')).toBeNull();
    expect(() => writeStorage('session', 'room', 'TP04')).not.toThrow();
    expect(() => removeStorage('session', 'room')).not.toThrow();
  });
});
