import { validChallengeCode } from '../game/sharedChallenge';

/** Links only carry the intended invitation; copied debug/query parameters never propagate. */
export function shareUrl(base: string, target: { room: string } | { challenge: string }): string {
  const url = new URL(base); url.search = ''; url.hash = '';
  if ('room' in target) { url.searchParams.set('room', target.room.replace(/[^A-Z0-9]/g, '').slice(0, 8)); url.searchParams.set('join', '1'); }
  else if (validChallengeCode(target.challenge)) url.searchParams.set('challenge', target.challenge);
  return url.toString();
}

export class SharePanel {
  private overlay = document.getElementById('shareOverlay')!;
  private input = document.getElementById('shareUrlInput') as HTMLInputElement;
  private status = document.getElementById('shareStatus')!;
  private qrGeneration = 0;
  private title = ''; private description = ''; private previousFocus: HTMLElement | null = null;
  public get isOpen(): boolean { return !this.overlay.classList.contains('hidden'); }
  constructor(private block: () => void) {
    document.getElementById('closeShareBtn')!.addEventListener('click', () => this.close());
    document.getElementById('copyShareBtn')!.addEventListener('click', () => { void this.copy(); });
    document.getElementById('nativeShareBtn')!.addEventListener('click', () => { void this.share(); });
  }
  public open(url: string, title: string, description: string): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) description += ' Este enlace apunta a este equipo. Para invitar a otros dispositivos, abre la versión publicada o la dirección de la red local.';
    this.input.value = url; this.title = title; this.description = description;
    document.getElementById('shareTitle')!.textContent = title; document.getElementById('shareDescription')!.textContent = description;
    this.status.textContent = '';
    document.getElementById('shareQr')!.textContent = 'Preparando QR…';
    document.getElementById('nativeShareBtn')!.classList.toggle('hidden', typeof navigator.share !== 'function');
    this.overlay.classList.remove('hidden'); this.block(); document.getElementById('closeShareBtn')!.focus({ preventScroll: true });
    void this.drawQr(url);
  }
  private async drawQr(url: string): Promise<void> {
    const generation = ++this.qrGeneration;
    try {
      const { default: qrcode } = await import('qrcode-generator');
      if (!this.isOpen || generation !== this.qrGeneration) return;
      const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
      document.getElementById('shareQr')!.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 20, scalable: true });
    } catch { if (this.isOpen && generation === this.qrGeneration) document.getElementById('shareQr')!.textContent = 'Usa el enlace para compartir.'; }
  }
  public close(): void { this.qrGeneration++; this.overlay.classList.add('hidden'); this.block(); this.previousFocus?.focus({ preventScroll: true }); }
  public async copy(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(this.input.value); this.status.textContent = 'Enlace copiado.';
    } catch { this.input.focus(); this.input.select(); this.status.textContent = 'Selecciona y copia el enlace.'; }
  }
  private async share(): Promise<void> {
    try { await navigator.share({ title: this.title, text: this.description, url: this.input.value }); this.status.textContent = 'Enlace compartido.'; }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) await this.copy(); }
  }
  public handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); this.close(); }
    if (event.key === 'Tab') {
      const elements = [...this.overlay.querySelectorAll<HTMLElement>('button, input')].filter(el => !el.closest('.hidden'));
      const index = elements.indexOf(document.activeElement as HTMLElement); event.preventDefault();
      elements[(index + (event.shiftKey ? -1 : 1) + elements.length) % elements.length]?.focus();
    }
  }
}
