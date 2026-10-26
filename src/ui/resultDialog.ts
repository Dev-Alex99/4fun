export interface ResultDialogContent {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onExit?: () => void;
}

/** Stable buttons preserve keyboard focus while authoritative snapshots refresh the HUD. */
export class ResultDialog {
  private content: ResultDialogContent | null = null;
  private overlay = document.getElementById('sessionResultOverlay')!;
  private primary = document.getElementById('sessionResultPrimary') as HTMLButtonElement;
  private secondary = document.getElementById('sessionResultSecondary') as HTMLButtonElement;
  private exit = document.getElementById('sessionResultExit') as HTMLButtonElement;

  constructor() {
    this.primary.addEventListener('click', () => this.content?.onPrimary?.());
    this.secondary.addEventListener('click', () => this.content?.onSecondary?.());
    this.exit.addEventListener('click', () => this.content?.onExit?.());
  }

  public get isOpen(): boolean { return this.content !== null; }

  public show(content: ResultDialogContent): void {
    if (this.content?.key === content.key) return;
    this.content = content;
    document.getElementById('sessionResultEyebrow')!.textContent = content.eyebrow;
    document.getElementById('sessionResultTitle')!.textContent = content.title;
    document.getElementById('sessionResultBody')!.innerHTML = content.body;
    this.primary.textContent = content.primaryLabel;
    this.primary.disabled = !content.onPrimary;
    this.secondary.textContent = content.secondaryLabel ?? '';
    this.secondary.classList.toggle('hidden', !content.secondaryLabel);
    this.secondary.disabled = !content.onSecondary;
    this.exit.disabled = !content.onExit;
    this.overlay.classList.remove('hidden');
    (content.onPrimary ? this.primary : this.overlay.querySelector<HTMLElement>('.session-result-box'))?.focus({ preventScroll: true });
  }

  public hide(): void {
    if (!this.content) return;
    this.content = null;
    const focused = this.overlay.contains(document.activeElement);
    this.overlay.classList.add('hidden');
    if (focused) document.getElementById('courtCanvas')?.focus({ preventScroll: true });
  }

  public handleKey(event: KeyboardEvent): boolean {
    if (!this.content) return false;
    if (event.key === 'Tab') {
      const buttons = [this.primary, this.secondary, this.exit].filter(button => !button.disabled && !button.classList.contains('hidden'));
      const first = buttons[0], last = buttons.at(-1);
      if (!first) event.preventDefault();
      else if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement as HTMLButtonElement))) {
        event.preventDefault(); last!.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement as HTMLButtonElement))) {
        event.preventDefault(); first.focus();
      }
    }
    return true;
  }
}
