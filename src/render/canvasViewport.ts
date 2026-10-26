import { playPreferences } from '../game/playPreferences';
/** Shared CSS-pixel camera used by drawing and pointer aiming. */
export class CanvasViewportRenderer {
  protected get reducedFlashes(): boolean { return playPreferences.reducedFlashes; }
  protected get reducedMotion(): boolean { return playPreferences.reducedMotion; }
  protected shakeAmount(amount: number): number { return this.reducedMotion ? 0 : amount; }
  protected readonly canvas: HTMLCanvasElement;
  protected readonly ctx: CanvasRenderingContext2D;
  protected scale = 1;
  protected offsetX = 0;
  protected offsetY = 0;
  protected viewportWidth = 1;
  protected viewportHeight = 1;
  private ghostActive = false;
  private ghostTime = 0;
  private playInsets = { top: 0, bottom: 0, left: 0, right: 0, compact: false };

  public setPlayInsets(insets: typeof this.playInsets): void {
    this.playInsets = { ...insets };
  }

  constructor(
    canvas: HTMLCanvasElement,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly padX = 0,
    private readonly padY = 0
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D Canvas not supported');
    this.ctx = context;
  }

  public syncViewport(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, this.canvas.clientWidth || rect.width || this.canvas.parentElement?.clientWidth || 1);
    const h = Math.max(1, this.canvas.clientHeight || rect.height || this.canvas.parentElement?.clientHeight || 1);
    const rawDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
    const dpr = Number.isFinite(rawDpr) && rawDpr > 0 ? Math.min(rawDpr, 2) : 1;
    const targetW = Math.max(1, Math.round(w * dpr));
    const targetH = Math.max(1, Math.round(h * dpr));
    // Compare integer backing dimensions, so fractional DPR never resets the canvas each frame.
    if (this.canvas.width !== targetW) this.canvas.width = targetW;
    if (this.canvas.height !== targetH) this.canvas.height = targetH;
    this.viewportWidth = w;
    this.viewportHeight = h;
    this.ctx.setTransform(targetW / w, 0, 0, targetH / h, 0, 0);
    this.ctx.globalAlpha = 1;
    const inset = this.playInsets;
    const width = Math.max(1, w - inset.left - inset.right), height = Math.max(1, h - inset.top - inset.bottom);
    const padX = inset.compact ? 4 : this.padX, padY = inset.compact ? 4 : this.padY;
    this.scale = Math.min(Math.max(1, width - padX * 2) / this.worldWidth, Math.max(1, height - padY * 2) / this.worldHeight);
    this.offsetX = inset.left + (width - this.worldWidth * this.scale) * 0.5;
    this.offsetY = inset.top + (height - this.worldHeight * this.scale) * 0.5;
  }

  public screenToCourt(clientX: number, clientY: number): { x: number; y: number } {
    this.syncViewport();
    const rect = this.canvas.getBoundingClientRect();
    // Account for a CSS transform on the canvas or its container as well as resize.
    const x = (clientX - rect.left) * (rect.width > 0 ? this.viewportWidth / rect.width : 1);
    const y = (clientY - rect.top) * (rect.height > 0 ? this.viewportHeight / rect.height : 1);
    return { x: (x - this.offsetX) / this.scale, y: (y - this.offsetY) / this.scale };
  }

  /** Pass the same authoritative clock to every peer for matching visibility windows. */
  public setGhostPulse(active: boolean, timeSeconds = 0): void {
    this.ghostActive = active;
    this.ghostTime = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
  }

  public renderChaosBombs(bombs: ReadonlyArray<{ x: number; y: number; fuse: number; radius: number }>): void {
    if (bombs.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    for (const bomb of bombs) {
      ctx.beginPath();
      ctx.arc(bomb.x, bomb.y, bomb.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 79, 0, 0.16)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FF4F00';
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(bomb.x, bomb.y - 8, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#18181B';
      ctx.fill();
      ctx.strokeStyle = '#F59E0B';
      ctx.stroke();
      ctx.fillStyle = '#FF4F00';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(Math.max(0, bomb.fuse).toFixed(1), bomb.x, bomb.y - 24);
    }
    ctx.restore();
  }

  protected applyGhostPulse(): void {
    if (this.ghostActive && this.ghostTime % 5 >= 4) this.ctx.globalAlpha *= 0.18;
  }
}
