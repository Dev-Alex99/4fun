import { PracticeSession, PRACTICE_TASKS } from '../game/practiceSession';
import { PARTY_GAMES, type PlayableGame } from '../game/partyVote';
import { GAME_INSTRUCTIONS } from '../game/gameInstructions';
import { FixedStepClock } from '../runtime/fixedStepClock';
import { TouchGamepad } from '../input/touchGamepad';
import { actionPresentation } from './actionHints';
import { CourtRenderer } from '../render/courtRenderer';
import { ChainPanicRenderer } from '../render/chainPanicRenderer';
import { CargoCrewRenderer } from '../render/cargoCrewRenderer';
import { PuttWarRenderer } from '../render/puttWarRenderer';
import { HotCoreRenderer } from '../render/hotCoreRenderer';
import { VoltCrownRenderer } from '../render/voltCrownRenderer';
import { HexCrushRenderer } from '../render/hexCrushRenderer';
import { RicochetRenderer } from '../render/ricochetRenderer';
import type { ClientInputPacket } from '../types';
import { playPreferences } from '../game/playPreferences';
import { readStorage, writeStorage } from '../utils/browser';

export class PracticeRoom {
  private overlay = document.getElementById('practiceOverlay')!;
  private canvas = document.getElementById('practiceCanvas') as HTMLCanvasElement;
  private select = document.getElementById('practiceGameSelect') as HTMLSelectElement;
  private pad = new TouchGamepad(); private session: PracticeSession | null = null;
  private renderers: ReturnType<PracticeRoom['createRenderers']> | null = null;
  private clock = new FixedStepClock(60, 8);
  private keys = new Set<string>(); private primary = false; private secondary = false;
  private heldMouse = false; private heldRight = false; private skill = false; private aim = 0; private seq = 0;
  private focus: HTMLElement | null = null; private renderedTask = -1;
  public get isOpen(): boolean { return this.session !== null; }
  constructor(private options: { touch: () => boolean; game: () => import('../types').ActiveGameId; block: () => void }) {
    const pad = document.getElementById('virtualGamepad')!.cloneNode(true) as HTMLElement;
    pad.id = 'practiceGamepad'; pad.querySelectorAll<HTMLElement>('[id]').forEach(el => el.id = 'practice-' + el.id);
    document.getElementById('practiceSurface')!.appendChild(pad);
    this.pad.init('practiceGamepad', { idPrefix: 'practice-', onPressA: () => { this.primary = true; },
      onPressB: () => { this.secondary = true; }, onPressE: () => { this.skill = true; } });
    this.pad.hide();
    document.getElementById('closePracticeBtn')!.addEventListener('click', () => this.close());
    document.getElementById('restartPracticeBtn')!.addEventListener('click', () => { if (this.session) this.open(this.session.game); });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('pointermove', e => {
      if (!this.session || !this.renderers) return;
      const r = this.renderer!, at = r.screenToCourt(e.clientX, e.clientY), p = this.session.engine.players[0];
      this.aim = Math.atan2(at.y - p.y, at.x - p.x);
    });
    this.canvas.addEventListener('pointerdown', e => {
      if (!this.session) return; e.preventDefault(); this.canvas.focus();
      if (e.button === 2) { this.secondary = this.heldRight = true; } else { this.primary = this.heldMouse = true; }
    });
    window.addEventListener('pointerup', e => { if (e.button === 0) this.heldMouse = false; if (e.button === 2) this.heldRight = false; });
    window.addEventListener('pointercancel', () => { this.heldMouse = this.heldRight = false; });
    window.addEventListener('blur', () => this.cancelInput());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.cancelInput(); });
  }
  private createRenderers() {
    const c = this.canvas;
    return { BASH_BOT: new CourtRenderer(c), CHAIN_PANIC: new ChainPanicRenderer(c), CARGO_CREW: new CargoCrewRenderer(c),
      TURBO_PUTT: new PuttWarRenderer(c), HOT_CORE: new HotCoreRenderer(c), VOLT_CROWN: new VoltCrownRenderer(c),
      HEX_CRUSH: new HexCrushRenderer(c), RICOCHET_1: new RicochetRenderer(c) };
  }
  private get renderer() { return this.session && this.renderers ? this.renderers[this.session.game] : null; }
  public selectGame(game: PlayableGame): void { this.select.value = game; }
  public open(game: PlayableGame): void {
    if (!PARTY_GAMES.includes(game)) return;
    if (!this.session) this.focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.cancelInput(); this.session?.dispose(); this.session = new PracticeSession(game);
    this.renderers ??= this.createRenderers(); this.renderedTask = -1;
    this.overlay.classList.remove('hidden'); this.options.block(); this.select.value = game;
    document.getElementById('practiceTitle')!.textContent = `${GAME_INSTRUCTIONS[game].title} · PRÁCTICA`;
    if (this.options.touch()) this.pad.show(); else this.pad.hide();
    this.clock.reset(performance.now()); this.canvas.focus({ preventScroll: true }); this.update();
  }
  public close(): void {
    this.cancelInput(); this.session?.dispose(); this.session = null; this.pad.hide();
    this.overlay.classList.add('hidden'); this.options.block(); this.focus?.focus({ preventScroll: true });
  }
  public cancelInput(): void {
    this.keys.clear(); this.primary = this.secondary = this.skill = this.heldMouse = this.heldRight = false;
    this.pad.cancelInput(); this.session?.engine.clearRemoteInput(0);
  }
  public handleKey(event: KeyboardEvent, down: boolean): void {
    if (event.key === 'Escape' && down) { event.preventDefault(); this.close(); return; }
    if (event.key === 'Tab') {
      if (!down) return;
      const elements = [...this.overlay.querySelectorAll<HTMLElement>('button:not(:disabled), canvas')].filter(el => !el.closest('.hidden'));
      const index = elements.indexOf(document.activeElement as HTMLElement);
      event.preventDefault(); elements[(index + (event.shiftKey ? -1 : 1) + elements.length) % elements.length]?.focus(); return;
    }
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(event.code)) return;
    event.preventDefault();
    if (down) this.keys.add(event.code); else this.keys.delete(event.code);
    if (!down || event.repeat) return;
    if (event.code === 'Space') this.primary = true;
    if (event.code.startsWith('Shift')) this.secondary = true;
    if (event.code === 'KeyE') this.skill = true;
  }
  public frame(now: number): void {
    const s = this.session; if (!s) return;
    if (document.hidden) { this.clock.reset(now); return; }
    this.clock.advance(now, dt => {
      const key = (...codes: string[]) => codes.some(c => this.keys.has(c));
      let x = Number(key('KeyD', 'ArrowRight')) - Number(key('KeyA', 'ArrowLeft'));
      let y = Number(key('KeyS', 'ArrowDown')) - Number(key('KeyW', 'ArrowUp'));
      if (this.pad.enabled && Math.hypot(this.pad.moveX, this.pad.moveY) > 0.05) { x = this.pad.moveX; y = this.pad.moveY; this.aim = Math.atan2(y, x); }
      const held = this.heldMouse || key('Space') || this.pad.isHoldingA;
      const packet: ClientInputPacket = { slotId: 0, name: 'PRACTICE', moveX: x, moveY: y, aimAngle: this.aim,
        parryPressed: this.primary, dashPressed: this.secondary, yankPressed: this.skill,
        chargingParry: held, anchorHeld: this.heldRight || key('ShiftLeft', 'ShiftRight') || this.pad.isHoldingB,
        emotePressed: 0, clientBallDist: 999, actionSeq: ++this.seq,
        shotReleasedPower: s.game === 'TURBO_PUTT' && this.primary && !held ? 0.32 : undefined };
      s.step(dt, packet); this.primary = this.secondary = this.skill = false;
    });
    this.update();
    const landscape = window.innerWidth > window.innerHeight, scale = playPreferences.controlScale;
    this.renderer!.setPlayInsets({ top: 0, bottom: this.pad.enabled && !landscape ? 175 * scale : 0,
      left: this.pad.enabled && landscape ? 124 * scale : 0, right: this.pad.enabled && landscape ? 144 * scale : 0, compact: true });
    switch (s.game) {
      case 'CHAIN_PANIC': this.renderers!.CHAIN_PANIC.render(s.chain, 0); break;
      case 'CARGO_CREW': this.renderers!.CARGO_CREW.render(s.cargo, 0, this.pad.enabled); break;
      case 'TURBO_PUTT': this.renderers!.TURBO_PUTT.render(s.putt, 0); break;
      case 'HOT_CORE': this.renderers!.HOT_CORE.render(s.hot, 0); break;
      case 'VOLT_CROWN': this.renderers!.VOLT_CROWN.render(s.volt, 0); break;
      case 'HEX_CRUSH': this.renderers!.HEX_CRUSH.render(s.hex, 0); break;
      case 'RICOCHET_1': this.renderers!.RICOCHET_1.render(s.ricochet, 0); break;
      default: this.renderers!.BASH_BOT.render(s.arena, 0);
    }
  }
  private update(): void {
    const s = this.session!;
    const cues = actionPresentation({ game: s.game, slot: 0, touch: this.pad.enabled, connected: true, blocked: s.complete,
      holdingA: this.pad.isHoldingA, arena: s.arena, chain: s.chain, cargo: s.cargo, putt: s.putt, hot: s.hot, volt: s.volt, hex: s.hex, ricochet: s.ricochet });
    for (const key of ['A', 'B', 'E'] as const) this.pad.presentButton(key, cues[key]);
    if (this.renderedTask === s.task) return;
    this.renderedTask = s.task;
    document.getElementById('practiceProgress')!.textContent = `${Math.min(s.task + 1, PRACTICE_TASKS[s.game].length)}/${PRACTICE_TASKS[s.game].length}`;
    document.getElementById('practiceTask')!.textContent = s.complete ? '¡Práctica completada! Ya puedes volver a tu sala.' : PRACTICE_TASKS[s.game][s.task];
    document.getElementById('practiceTask')!.classList.toggle('practice-complete', s.complete);
    if (s.complete) {
      let completed: string[] = []; try { const value: unknown = JSON.parse(readStorage('local', 'tp04_practice_complete') ?? '[]'); if (Array.isArray(value)) completed = value.filter(g => PARTY_GAMES.includes(g)); } catch {}
      writeStorage('local', 'tp04_practice_complete', JSON.stringify([...new Set([...completed, s.game])]));
    }
  }
  public dispose(): void { this.session?.dispose(); this.pad.dispose(); }
}
