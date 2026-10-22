import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CourtRenderer } from '../render/courtRenderer';
import { ChainPanicRenderer } from '../render/chainPanicRenderer';
import { PuttWarRenderer } from '../render/puttWarRenderer';
import { HotCoreRenderer } from '../render/hotCoreRenderer';
import { VoltCrownRenderer } from '../render/voltCrownRenderer';
import { HexCrushRenderer } from '../render/hexCrushRenderer';
import { RicochetRenderer } from '../render/ricochetRenderer';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { PuttWarEngine } from '../game/puttWarEngine';
import { HotCoreEngine } from '../game/hotCoreEngine';
import { VoltCrownEngine } from '../game/voltCrownEngine';
import { HexCrushEngine } from '../game/hexCrushEngine';
import { RicochetEngine } from '../game/ricochetEngine';
import { TouchGamepad } from '../input/touchGamepad';
import { ProceduralChiptuneEngine } from '../audio/chiptuneBgm';
import { DEFAULT_ROBOT_COSMETICS, normalizeRobotCosmetics, RobotWorkshopManager, robotWorkshop } from '../game/robotWorkshop';

function canvasFixture() {
  const canvas = document.createElement('canvas');
  let width = 1000;
  let height = 600;
  let cssScale = 1;
  Object.defineProperty(canvas, 'clientWidth', { get: () => width });
  Object.defineProperty(canvas, 'clientHeight', { get: () => height });
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: width * cssScale, height: height * cssScale }) as DOMRect;
  const draws: Array<{ color: string; alpha: number }> = [];
  const stack: Array<{ fillStyle: string; globalAlpha: number }> = [];
  const ctx: Record<string, any> = { fillStyle: '#000', globalAlpha: 1 };
  const record = () => draws.push({ color: ctx.fillStyle, alpha: ctx.globalAlpha });
  ctx.save = () => stack.push({ fillStyle: ctx.fillStyle, globalAlpha: ctx.globalAlpha });
  ctx.restore = () => Object.assign(ctx, stack.pop() ?? {});
  ctx.fill = record;
  ctx.fillRect = record;
  ctx.fillText = record;
  ctx.measureText = () => ({ width: 50 });
  ctx.createLinearGradient = () => ({ addColorStop() {} });
  const context = new Proxy(ctx, { get: (target, key: string) => key in target ? target[key] : () => {} });
  canvas.getContext = vi.fn(() => context) as unknown as typeof canvas.getContext;
  return { canvas, draws, resize: (w: number, h: number) => { width = w; height = h; }, cssScale: (value: number) => { cssScale = value; } };
}

const cameras = [
  { name: 'BASH', Renderer: CourtRenderer, input: [210, 160], centerY: 260 },
  { name: 'CHAIN', Renderer: ChainPanicRenderer, input: [210, 160], centerY: 260 },
  { name: 'PUTT', Renderer: PuttWarRenderer, input: [226.8, 170.848], centerY: 258 },
  { name: 'HOT', Renderer: HotCoreRenderer, input: [224.4, 169.584], centerY: 258 },
  { name: 'VOLT', Renderer: VoltCrownRenderer, input: [224.4, 169.584], centerY: 258 },
  { name: 'HEX', Renderer: HexCrushRenderer, input: [224.4, 169.584], centerY: 258 },
  { name: 'RICOCHET', Renderer: RicochetRenderer, input: [224.4, 169.584], centerY: 258 }
];

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Shared drawing and pointer cameras', () => {
  it.each(cameras)('$name aims correctly before rendering and after resize, including fractional DPR', ({ Renderer, input, centerY }) => {
    const fixture = canvasFixture();
    vi.stubGlobal('devicePixelRatio', 1.333);
    const renderer = new Renderer(fixture.canvas);
    const widthSetter = vi.spyOn(fixture.canvas, 'width', 'set');
    const heightSetter = vi.spyOn(fixture.canvas, 'height', 'set');
    const point = renderer.screenToCourt(input[0], input[1]);
    expect(point.x).toBeCloseTo(200, 7);
    expect(point.y).toBeCloseTo(100, 7);
    expect(fixture.canvas.width).toBe(1333);
    expect(fixture.canvas.height).toBe(800);
    renderer.syncViewport();
    renderer.syncViewport();
    expect(widthSetter).toHaveBeenCalledTimes(1);
    expect(heightSetter).toHaveBeenCalledTimes(1);
    fixture.resize(800, 500);
    fixture.cssScale(1.5);
    const center = renderer.screenToCourt(610, 395);
    expect(center.x).toBeCloseTo(500);
    expect(center.y).toBeCloseTo(centerY);
    expect(fixture.canvas.width).toBe(1066);
    expect(fixture.canvas.height).toBe(667);
  });

  it.each(cameras)('$name keeps a finite camera in a collapsed viewport', ({ Renderer }) => {
    const fixture = canvasFixture();
    fixture.resize(0, 0);
    const point = new Renderer(fixture.canvas).screenToCourt(10, 20);
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });
});

const games = [
  { name: 'BASH', Renderer: CourtRenderer, Engine: ArenaEngine },
  { name: 'CHAIN', Renderer: ChainPanicRenderer, Engine: ChainPanicEngine },
  { name: 'PUTT', Renderer: PuttWarRenderer, Engine: PuttWarEngine },
  { name: 'HOT', Renderer: HotCoreRenderer, Engine: HotCoreEngine },
  { name: 'VOLT', Renderer: VoltCrownRenderer, Engine: VoltCrownEngine },
  { name: 'HEX', Renderer: HexCrushRenderer, Engine: HexCrushEngine },
  { name: 'RICOCHET', Renderer: RicochetRenderer, Engine: RicochetEngine }
];

describe('Cosmetics in every game', () => {
  beforeEach(() => localStorage.clear());

  it('validates runtime updates, restores saved choices, and keeps remote defaults independent', () => {
    const workshop = new RobotWorkshopManager();
    workshop.saveCosmetics({ hat: 'CROWN', visor: 'MAGENTA', skin: 'STEALTH' });
    expect(workshop.saveCosmetics({ hat: 'UNKNOWN_HAT', visor: null, skin: 4 } as never)).toEqual({ hat: 'CROWN', visor: 'MAGENTA', skin: 'STEALTH' });
    expect(new RobotWorkshopManager().cosmetics).toEqual(workshop.cosmetics);
    expect(workshop.resolveCosmetics(undefined)).toEqual(DEFAULT_ROBOT_COSMETICS);
    expect(workshop.resolveCosmetics(undefined, true)).toEqual(workshop.cosmetics);
    expect(workshop.getVisorColor()).toBe('#00e5ff');
    expect(workshop.getSkinColors(undefined, '#123456', '#654321')).toEqual({ body: '#123456', shade: '#654321' });
    expect(normalizeRobotCosmetics(null)).toEqual(DEFAULT_ROBOT_COSMETICS);
  });

  it.each(games)('$name renders a remote skin, visor and hat and applies the shared ghost phase', ({ Renderer, Engine }) => {
    const fixture = canvasFixture();
    const renderer = new Renderer(fixture.canvas);
    const engine = new Engine();
    engine.players[1].cosmetics = { hat: 'CONE', visor: 'RED', skin: 'VAPOR' };
    const hat = vi.spyOn(robotWorkshop, 'drawHat');
    renderer.setGhostPulse(true, 4.5);
    // Every renderer deliberately keeps its concrete engine type.
    (renderer.render as (engine: unknown, localSlot: number) => void)(engine, 0);
    expect(fixture.draws.some((draw) => draw.color === '#d946ef' && draw.alpha === 0.18)).toBe(true);
    expect(fixture.draws.some((draw) => draw.color === '#ff2222' && draw.alpha === 0.18)).toBe(true);
    expect(hat.mock.calls.some((call) => call[1] === 'CONE')).toBe(true);
    fixture.draws.length = 0;
    renderer.setGhostPulse(true, 5.1);
    (renderer.render as (engine: unknown, localSlot: number) => void)(engine, 0);
    expect(fixture.draws.some((draw) => draw.color === '#d946ef' && draw.alpha === 1)).toBe(true);
  });
});

function pointer(target: EventTarget, type: string, pointerId: number, x = 0, y = 0) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
}

function gamepadFixture() {
  document.body.innerHTML = '<div id="virtualGamepad"><div id="touchJoystickZone"><div id="touchJoystickBase"><div id="touchJoystickThumb"></div></div></div><button id="touchBtnA"></button><button id="touchBtnB"></button><button id="touchBtnE"></button></div>';
  const base = document.getElementById('touchJoystickBase')!;
  base.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  for (const element of document.querySelectorAll<HTMLElement>('button, #touchJoystickZone')) {
    element.setPointerCapture = vi.fn();
    element.releasePointerCapture = vi.fn();
  }
  return { a: document.getElementById('touchBtnA')!, b: document.getElementById('touchBtnB')!, e: document.getElementById('touchBtnE')!, stick: document.getElementById('touchJoystickZone')! };
}

describe('Pointer gamepad lifecycle through DOM events', () => {
  it('releases every held button and the captured joystick when hidden, once per press', () => {
    const ui = gamepadFixture();
    const pad = new TouchGamepad();
    const releases = [vi.fn(), vi.fn(), vi.fn()];
    const press = vi.fn();
    pad.init(undefined, { onPressA: press, onReleaseA: releases[0], onReleaseB: releases[1], onReleaseE: releases[2] });
    pad.show();
    pointer(ui.a, 'pointerdown', 1);
    ui.a.dispatchEvent(new Event('touchstart', { bubbles: true }));
    pointer(ui.b, 'pointerdown', 2);
    pointer(ui.e, 'pointerdown', 3);
    pointer(ui.stick, 'pointerdown', 4, 95, 50);
    expect(pad.moveX).toBe(1);
    expect(press).toHaveBeenCalledTimes(1);
    expect(ui.a.setPointerCapture).toHaveBeenCalledWith(1);
    pad.hide();
    pad.hide();
    pointer(window, 'pointerup', 1);
    expect([pad.isHoldingA, pad.isHoldingB, pad.isHoldingE]).toEqual([false, false, false]);
    expect([pad.moveX, pad.moveY]).toEqual([0, 0]);
    expect(document.querySelectorAll('.touch-btn-pressed')).toHaveLength(0);
    releases.forEach((release) => expect(release).toHaveBeenCalledTimes(1));
    pointer(ui.a, 'pointerdown', 6);
    expect(press).toHaveBeenCalledTimes(1);
    pad.dispose();
  });

  it('handles cancel, lost capture, release outside, blur, and repeated init without duplicate listeners', () => {
    const ui = gamepadFixture();
    const pad = new TouchGamepad();
    const press = vi.fn();
    const release = vi.fn();
    pad.init(undefined, { onPressA: press, onReleaseA: release });
    pad.init(undefined, { onPressA: press, onReleaseA: release });
    pad.show();
    pointer(ui.a, 'pointerdown', 1);
    pointer(ui.a, 'pointerdown', 2);
    pointer(window, 'pointerup', 2);
    expect(pad.isHoldingA).toBe(true);
    pointer(window, 'pointercancel', 1);
    pointer(ui.a, 'pointerdown', 3);
    pointer(ui.a, 'lostpointercapture', 3);
    pointer(ui.a, 'pointerdown', 4);
    pointer(document.body, 'pointerup', 4);
    pointer(ui.a, 'pointerdown', 5);
    window.dispatchEvent(new Event('blur'));
    expect(press).toHaveBeenCalledTimes(4);
    expect(release).toHaveBeenCalledTimes(4);
    expect(pad.isHoldingA).toBe(false);
    pad.dispose();
    pad.dispose();
    pad.show();
    pointer(ui.a, 'pointerdown', 6);
    expect(press).toHaveBeenCalledTimes(4);
  });
});

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  sampleRate = 1000;
  state = 'running';
  destination = {};
  starts: number[] = [];
  closed = false;
  constructor() { FakeAudioContext.instances.push(this); }
  param() { return { setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }; }
  createGain() { return { gain: this.param(), connect() {}, disconnect() {} }; }
  source() { return { connect() {}, frequency: this.param(), start: (time: number) => { this.starts.push(time); }, stop() {} }; }
  createOscillator() { return this.source(); }
  createBufferSource() { return this.source(); }
  createBiquadFilter() { return { connect() {}, frequency: this.param() }; }
  createBuffer(_channels: number, size: number) { return { getChannelData: () => new Float32Array(size) }; }
  async resume() {}
  async close() { this.closed = true; this.state = 'closed'; }
}

describe('Audio and persistence recovery', () => {
  it('continues without exceptions when access to storage is denied', () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    const engine = new ProceduralChiptuneEngine();
    expect(() => { engine.toggle(); engine.toggle(); engine.dispose(); }).not.toThrow();
    const workshop = new RobotWorkshopManager();
    expect(() => workshop.saveCosmetics({ hat: 'CROWN' })).not.toThrow();
    expect(workshop.cosmetics.hat).toBe('CROWN');
    getter.mockRestore();
  });

  it('skips minutes of stale notes after background throttling and disposes its timer/context', () => {
    vi.useFakeTimers();
    localStorage.clear();
    FakeAudioContext.instances.length = 0;
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const engine = new ProceduralChiptuneEngine();
    engine.toggle();
    const ac = FakeAudioContext.instances[0];
    vi.advanceTimersByTime(25);
    expect(ac.starts.length).toBeGreaterThan(0);
    ac.starts.length = 0;
    ac.currentTime = 600;
    vi.advanceTimersByTime(25);
    expect(ac.starts.length).toBeLessThanOrEqual(8);
    expect(ac.starts.every((time) => time >= 600 && time <= 600.12)).toBe(true);
    expect(ac.starts.length).toBeGreaterThan(0);
    engine.dispose();
    engine.dispose();
    expect(ac.closed).toBe(true);
    ac.starts.length = 0;
    vi.advanceTimersByTime(1000);
    expect(ac.starts).toHaveLength(0);
  });
});
