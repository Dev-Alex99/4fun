import type { ActiveGameId } from '../types';
import { GAME_INSTRUCTIONS, instructionControls } from '../game/gameInstructions';
import { escapeHtml } from '../utils/browser';

interface PlayState { game: ActiveGameId; room: string; name: string; humans: number; touch: boolean; objective?: string }

/** Local navigation only. Opening panels neutralizes this player's controls, never the room clock. */
export class PlayModeUI {
  private state: PlayState = { game: 'HUB', room: '', name: '', humans: 1, touch: false };
  private roomOpen = false;
  private helpOpen = false;
  private focused = false;
  private compact = false;
  private deck = document.getElementById('controlDeck')!;
  private bar = document.getElementById('mobilePlayBar')!;
  private roomButton = document.getElementById('mobileRoomBtn') as HTMLButtonElement;
  private help = document.getElementById('gameHelpOverlay')!;
  private helpClose = document.getElementById('closeGameHelpBtn') as HTMLButtonElement;
  private removers: Array<() => void> = [];
  private previousHelpFocus: HTMLElement | null = null;

  constructor(private callbacks: { onBlockControls: () => void; onChange: () => void }) {
    const listen = (target: EventTarget, event: string, action: () => void) => {
      target.addEventListener(event, action); this.removers.push(() => target.removeEventListener(event, action));
    };
    listen(this.roomButton, 'click', () => this.setRoomOpen(!this.roomOpen));
    listen(document.getElementById('roomPanelScrim')!, 'click', () => this.setRoomOpen(false));
    listen(document.getElementById('closeRoomPanelBtn')!, 'click', () => this.setRoomOpen(false));
    listen(document.getElementById('focusGameBtn')!, 'click', () => { this.focused = true; this.render(); this.callbacks.onChange(); });
    for (const id of ['mobileHelpBtn', 'desktopHelpBtn']) listen(document.getElementById(id)!, 'click', () => this.openHelp());
    listen(this.helpClose, 'click', () => this.closeHelp());
    listen(document.getElementById('expandPlayBtn')!, 'click', () => { void this.expand(); });
    listen(window, 'resize', () => { this.render(); this.callbacks.onChange(); });
    listen(document, 'fullscreenchange', () => {
      document.getElementById('expandPlayBtn')!.setAttribute('aria-label', document.fullscreenElement ? 'Salir de pantalla completa' : 'Ampliar el juego');
      this.render(); this.callbacks.onChange();
    });
    for (const [proxy, source] of [['mobilePrevStageBtn', 'prevSectorBtn'], ['mobileNextStageBtn', 'nextSectorBtn'], ['mobileWorkshopBtn', 'hudWorkshopBtn']]) {
      listen(document.getElementById(proxy)!, 'click', () => this.forward(source));
    }
    listen(document.getElementById('mobileModeBtn')!, 'click', () => this.forward(this.state.game === 'CARGO_CREW' ? 'cargoRouteBtn' : this.state.game === 'VOLT_CROWN' ? 'voltModeBtn' : 'chainModeBtn'));
  }

  public get blocksControls(): boolean { return this.roomOpen || this.helpOpen; }

  public sync(state: PlayState): void {
    if (state.game !== this.state.game) {
      this.roomOpen = this.helpOpen = false;
      this.help.classList.add('hidden');
      if (state.game === 'HUB') this.focused = false;
    }
    this.state = state;
    this.render();
    if (this.helpOpen) this.renderHelp();
  }

  private render(): void {
    const active = this.state.game !== 'HUB';
    const small = window.innerWidth <= 900 || (window.innerWidth <= 1100 && window.innerHeight <= 560);
    this.compact = active && (small || this.focused);
    if (!this.compact) this.roomOpen = false;
    document.body.classList.toggle('compact-play', this.compact);
    document.body.classList.toggle('room-panel-open', this.roomOpen);
    this.bar.classList.toggle('hidden', !this.compact);
    this.deck.inert = this.compact && !this.roomOpen;
    this.deck.setAttribute('aria-hidden', String(this.compact && !this.roomOpen));
    this.roomButton.setAttribute('aria-expanded', String(this.roomOpen));
    document.getElementById('roomPanelScrim')!.classList.toggle('hidden', !this.roomOpen);
    document.getElementById('closeRoomPanelBtn')!.classList.toggle('hidden', !this.roomOpen);
    document.getElementById('mobileGameSettings')!.classList.toggle('hidden', !this.compact || !this.roomOpen);
    document.getElementById('focusGameBtn')!.classList.toggle('hidden', !active || this.compact);
    document.getElementById('desktopHelpBtn')!.classList.toggle('hidden', !active);
    document.getElementById('mobileGameName')!.textContent = active ? GAME_INSTRUCTIONS[this.state.game as Exclude<ActiveGameId, 'HUB'>].title : '';
    document.getElementById('mobileRoomStatus')!.textContent = `#${this.state.room} · ${this.state.name} · ${this.state.humans}/4`;
    const modeSource = this.state.game === 'CARGO_CREW' ? 'cargoRouteBtn' : this.state.game === 'VOLT_CROWN' ? 'voltModeBtn' : 'chainModeBtn';
    for (const [proxy, id] of [['mobilePrevStageBtn', 'prevSectorBtn'], ['mobileNextStageBtn', 'nextSectorBtn'], ['mobileModeBtn', modeSource]]) {
      const source = document.getElementById(id) as HTMLButtonElement;
      const button = document.getElementById(proxy) as HTMLButtonElement;
      button.textContent = source.textContent;
      button.disabled = source.disabled;
      button.classList.toggle('hidden', source.classList.contains('hidden'));
    }
  }

  private setRoomOpen(open: boolean): void {
    this.roomOpen = open;
    if (open) this.callbacks.onBlockControls();
    this.render(); this.callbacks.onChange();
    if (open) document.getElementById('closeRoomPanelBtn')!.focus({ preventScroll: true });
    else this.roomButton.focus({ preventScroll: true });
  }

  private forward(id: string): void {
    const source = document.getElementById(id) as HTMLButtonElement;
    if (source.disabled || source.classList.contains('hidden')) return;
    if (id === 'hudWorkshopBtn') this.setRoomOpen(false);
    source.click();
  }

  private openHelp(): void {
    if (this.state.game === 'HUB') return;
    this.previousHelpFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.roomOpen = false; this.helpOpen = true;
    this.callbacks.onBlockControls(); this.render(); this.renderHelp();
    this.help.classList.remove('hidden'); this.callbacks.onChange(); this.helpClose.focus({ preventScroll: true });
  }

  private renderHelp(): void {
    if (this.state.game === 'HUB') return;
    const game = GAME_INSTRUCTIONS[this.state.game];
    document.getElementById('gameHelpTitle')!.textContent = game.title;
    document.getElementById('gameHelpObjective')!.textContent = this.state.objective ?? game.objective;
    const controls = instructionControls(this.state.game, this.state.touch).map(c => `<dt>${escapeHtml(c.key)}</dt><dd>${escapeHtml(c.action)}</dd>`).join('');
    const list = document.getElementById('gameHelpControls')!;
    if (list.innerHTML !== controls) list.innerHTML = controls;
    document.getElementById('gameHelpTip')!.textContent = game.tip;
  }

  private closeHelp(): void {
    this.helpOpen = false; this.help.classList.add('hidden'); this.callbacks.onChange();
    const target = this.previousHelpFocus?.isConnected ? this.previousHelpFocus : document.getElementById('courtCanvas');
    target?.focus({ preventScroll: true });
  }

  private async expand(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else throw new Error('Fullscreen unavailable');
    } catch {
      // Expanded CSS layout also works on browsers without the Fullscreen API.
      document.body.classList.toggle('immersive-play');
      document.getElementById('expandPlayBtn')!.setAttribute('aria-pressed', String(document.body.classList.contains('immersive-play')));
    }
  }

  public handleKey(event: KeyboardEvent): boolean {
    if (!this.blocksControls) return false;
    if (event.key === 'Escape') {
      event.preventDefault(); if (this.helpOpen) this.closeHelp(); else this.setRoomOpen(false);
    } else if (event.key === 'Tab') {
      const root = this.helpOpen ? this.help : this.deck;
      const elements = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary')]
        .filter(element => !element.closest('.hidden') && !element.closest('details:not([open]) :not(summary)'));
      const first = elements[0], last = elements.at(-1);
      if (!first) event.preventDefault();
      else if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last!.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
    }
    return true;
  }

  public dispose(): void {
    this.removers.splice(0).forEach(remove => remove()); this.deck.inert = false;
    document.body.classList.remove('compact-play', 'room-panel-open', 'immersive-play');
  }
}
