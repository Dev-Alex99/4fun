import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { PlayModeUI } from '../ui/playMode';
import { TouchGamepad } from '../input/touchGamepad';
import { actionPresentation, type ActionContext } from '../ui/actionHints';
import { ArenaEngine } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { CargoCrewEngine } from '../game/cargoCrewEngine';
import { PuttWarEngine } from '../game/puttWarEngine';
import { HotCoreEngine } from '../game/hotCoreEngine';
import { VoltCrownEngine } from '../game/voltCrownEngine';
import { HexCrushEngine } from '../game/hexCrushEngine';
import { RicochetEngine } from '../game/ricochetEngine';
import { CourtRenderer } from '../render/courtRenderer';
import { summarizeLink } from '../net/connectionDiagnostics';

const dispose: Array<() => void> = [];
beforeEach(() => {
  document.body.innerHTML = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)![1];
});
afterEach(() => { dispose.splice(0).forEach(fn => fn()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function context(): ActionContext {
  return { game: 'CARGO_CREW', slot: 0, touch: true, connected: true, blocked: false, holdingA: false,
    arena: new ArenaEngine(), chain: new ChainPanicEngine(), cargo: new CargoCrewEngine(), putt: new PuttWarEngine(),
    hot: new HotCoreEngine(), volt: new VoltCrownEngine(), hex: new HexCrushEngine(), ricochet: new RicochetEngine() };
}

describe('Compact game view and actionable touch controls', () => {
  it('opens a local room panel, releases controls, traps focus and adapts to orientation and desktop', () => {
    vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844);
    const block = vi.fn(), change = vi.fn();
    const ui = new PlayModeUI({ onBlockControls: block, onChange: change }); dispose.push(() => ui.dispose());
    const state = { game: 'CARGO_CREW' as const, room: 'ABCD', name: 'ALEX', humans: 4, touch: true };
    ui.sync(state);
    expect(document.body.classList.contains('compact-play')).toBe(true);
    expect(document.getElementById('controlDeck')!.inert).toBe(true);
    document.getElementById('mobileRoomBtn')!.click();
    expect(block).toHaveBeenCalledOnce();
    expect(ui.blocksControls).toBe(true);
    expect(document.getElementById('controlDeck')!.inert).toBe(false);
    expect(document.getElementById('mobileRoomBtn')!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.id).toBe('closeRoomPanelBtn');
    ui.handleKey(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(ui.blocksControls).toBe(false);
    expect(document.activeElement?.id).toBe('mobileRoomBtn');
    vi.stubGlobal('innerWidth', 932); vi.stubGlobal('innerHeight', 430); ui.sync(state);
    expect(document.body.classList.contains('compact-play')).toBe(true);
    vi.stubGlobal('innerWidth', 1280); vi.stubGlobal('innerHeight', 900); ui.sync(state);
    expect(document.body.classList.contains('compact-play')).toBe(false);
    expect(document.getElementById('controlDeck')!.inert).toBe(false);
  });

  it('offers instructions for cooperative games and keeps local help separate from shared match state', () => {
    const ui = new PlayModeUI({ onBlockControls: vi.fn(), onChange: vi.fn() }); dispose.push(() => ui.dispose());
    ui.sync({ game: 'CHAIN_PANIC', room: 'ABCD', name: 'ALEX', humans: 2, touch: true });
    document.getElementById('desktopHelpBtn')!.click();
    expect(ui.blocksControls).toBe(true);
    expect(document.getElementById('gameHelpTitle')!.textContent).toBe('CHAIN-PANIC');
    expect(document.getElementById('gameHelpControls')!.textContent).toContain('JOYSTICK');
    expect(document.activeElement?.id).toBe('closeGameHelpBtn');
    document.getElementById('closeGameHelpBtn')!.click();
    expect(ui.blocksControls).toBe(false);
    ui.sync({ game: 'HUB', room: 'ABCD', name: 'ALEX', humans: 2, touch: true });
    expect(document.body.classList.contains('compact-play')).toBe(false);
  });

  it('shows cargo reach, repair cooldown, confirmed damage and the correct release action', () => {
    const c = context(), p = c.cargo.players[0];
    p.x = 800; p.y = 400;
    expect(actionPresentation(c).A.available).toBe(false);
    p.x = c.cargo.battery.x - 50; p.y = c.cargo.battery.y;
    expect(actionPresentation(c).A.available).toBe(true);
    c.cargo.triggerGrip(p); expect(actionPresentation(c).A.label).toBe('SOLTAR');
    c.cargo.integrity = 70;
    expect(actionPresentation(c).E.available).toBe(true);
    c.cargo.triggerRepair(p);
    expect(actionPresentation(c).E.available).toBe(false);
    expect(actionPresentation(c).E.cooldown).toBe(8);
    c.cargo.feedback = { seq: 3, kind: 'CRANE', text: 'La grúa golpeó la batería (−30 de integridad).', atSeconds: c.cargo.elapsedSeconds };
    expect(actionPresentation(c).message).toContain('grúa');
    expect(actionPresentation(c).tone).toBe('danger');
  });

  it('prompts only adjacent active chain rescues, enables aerial stomps and hides unused skills', () => {
    const c = context(); c.game = 'CHAIN_PANIC'; c.chain.botsEnabled = false; c.chain.players[2].isBot = false;
    c.chain.players[2].isDangling = true;
    expect(actionPresentation(c).E.label).toBe('RESCATAR');
    expect(actionPresentation(c).message).toContain('anclar');
    c.game = 'HEX_CRUSH'; c.hex.players[0].z = 30; c.hex.players[0].jumpCooldown = 1;
    expect(actionPresentation(c).B.label).toBe('PISOTÓN');
    expect(actionPresentation(c).B.available).toBe(true);
    c.game = 'RICOCHET_1'; expect(actionPresentation(c).E.hidden).toBe(true);
  });

  it('retains a held pointer until release even if the action starts cooling down', () => {
    const pad = new TouchGamepad(), release = vi.fn(), press = vi.fn(); pad.enabled = true;
    pad.init('virtualGamepad', { onPressA: press, onReleaseA: release }); dispose.push(() => pad.dispose());
    const button = document.getElementById('touchBtnA')!;
    const pointer = (type: string, id: number) => { const event = new Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { pointerId: id, button: 0 }); return event; };
    pad.presentButton('A', { label: 'ENGANCHAR', hint: 'Acércate', available: false, cooldown: 0, progress: 1 });
    button.dispatchEvent(pointer('pointerdown', 1)); expect(press).not.toHaveBeenCalled();
    pad.presentButton('A', { label: 'CARGAR', hint: 'Mantén', available: true, cooldown: 0, progress: 1 });
    button.dispatchEvent(pointer('pointerdown', 2)); expect(pad.isHoldingA).toBe(true);
    pad.presentButton('A', { label: 'SOLTAR', hint: 'Suelta', available: false, active: true, cooldown: 0.5, progress: 0.5 });
    window.dispatchEvent(pointer('pointerup', 2)); expect(release).toHaveBeenCalledOnce();
    expect(pad.isHoldingA).toBe(false);
    expect(button.querySelector('.touch-btn-sub')!.textContent).toBe('SOLTAR');
  });

  it('keeps drawing and pointer aiming aligned when HUD and gamepad reserve canvas space', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 800 }); Object.defineProperty(canvas, 'clientHeight', { value: 500 });
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 800, height: 500 }) as DOMRect;
    vi.spyOn(canvas, 'getContext').mockReturnValue({ setTransform() {} } as unknown as CanvasRenderingContext2D);
    const renderer = new CourtRenderer(canvas);
    renderer.setPlayInsets({ top: 50, bottom: 150, left: 100, right: 100, compact: true });
    const center = renderer.screenToCourt(400, 200);
    expect(center.x).toBeCloseTo(500);
    expect(center.y).toBeCloseTo(260);
  });
});

describe('Shareable connection diagnostics', () => {
  it('reports the selected relay without exposing IPs, IDs or credentials', () => {
    const stats = new Map([
      ['transport', { type: 'transport', selectedCandidatePairId: 'pair-secret' }],
      ['pair-secret', { type: 'candidate-pair', state: 'succeeded', localCandidateId: 'local', remoteCandidateId: 'remote', currentRoundTripTime: 0.04, bytesSent: 1024, bytesReceived: 2048 }],
      ['local', { type: 'local-candidate', candidateType: 'relay', protocol: 'udp', address: '192.0.2.55', url: 'turn:private.invalid', username: 'secret-user', credential: 'never-share' }],
      ['remote', { type: 'remote-candidate', candidateType: 'host', address: '10.0.0.5' }]
    ]) as unknown as RTCStatsReport;
    const report = summarizeLink(stats, 1, true, 'connected');
    expect(report.route).toBe('RELAY'); expect(report.rttMs).toBe(40);
    const json = JSON.stringify(report);
    for (const secret of ['192.0.2.55', '10.0.0.5', 'private.invalid', 'secret-user', 'never-share', 'pair-secret']) expect(json).not.toContain(secret);
    expect(summarizeLink(null, 0, false).route).toBe('UNKNOWN');
  });
});
