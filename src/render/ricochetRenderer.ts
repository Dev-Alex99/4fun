/**
 * 07 // RICOCHET-1 RENDERER
 * Renders the reflective arena, laser mirrors, bouncing plasma bullets,
 * particle sparks, and customized robots with slide-dodge animations.
 */

import {
  RICOCHET_HEIGHT,
  RICOCHET_WIDTH,
  RicochetEngine
} from '../game/ricochetEngine';
import { ReflectiveMirror, RicochetBullet, RicochetPlayer } from '../types';
import { robotWorkshop } from '../game/robotWorkshop';

export class RicochetRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D context for Ricochet');
    this.ctx = context;
  }

  private syncViewport(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.floor(parent.clientWidth * dpr);
    const targetH = Math.floor(parent.clientHeight * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padX = 24;
    const padY = 44;
    this.scale = Math.min((w - padX * 2) / RICOCHET_WIDTH, (h - padY * 2) / RICOCHET_HEIGHT);
    this.offsetX = (w - RICOCHET_WIDTH * this.scale) * 0.5;
    this.offsetY = (h - RICOCHET_HEIGHT * this.scale) * 0.5;
  }

  public screenToCourt(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const px = screenX - rect.left - this.offsetX;
    const py = screenY - rect.top - this.offsetY;
    return {
      x: px / this.scale,
      y: py / this.scale
    };
  }

  public render(engine: RicochetEngine, localSlotId: number): void {
    this.syncViewport();
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const nowSec = performance.now() * 0.001;

    // 1. Hardware Matte Putty Backdrop
    ctx.fillStyle = '#DCD6CB';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 2. Arena Well (Sunken Chamber)
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#27272A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, RICOCHET_WIDTH - 20, RICOCHET_HEIGHT - 20, 18);
    ctx.fill();
    ctx.stroke();

    // 3. Reflective Grid Floor
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 50; x < RICOCHET_WIDTH - 20; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, RICOCHET_HEIGHT - 10);
      ctx.stroke();
    }
    for (let y = 50; y < RICOCHET_HEIGHT - 20; y += 50) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(RICOCHET_WIDTH - 10, y);
      ctx.stroke();
    }

    // 4. Perimeter Neon Hazard Dashes
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 79, 0, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.roundRect(14, 14, RICOCHET_WIDTH - 28, RICOCHET_HEIGHT - 28, 14);
    ctx.stroke();
    ctx.restore();

    // 5. Draw Reflective Laser Mirrors
    engine.mirrors.forEach((m) => this.drawMirror(m));

    // 6. Draw Sparks
    engine.sparks.forEach((sp) => {
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 7. Draw Plasma Bullets
    engine.bullets.forEach((b) => this.drawBullet(b));

    // 8. Draw Robots
    engine.players.forEach((p) => {
      this.drawPlayer(p, p.id === localSlotId, nowSec);
    });

    // 9. Round / Match Over Overlay
    if (engine.status === 'ROUND_OVER' || engine.status === 'MATCH_OVER') {
      this.drawOverBanner(engine);
    }

    ctx.restore();
  }

  private drawMirror(m: ReflectiveMirror): void {
    const ctx = this.ctx;
    const halfLen = m.length / 2;
    const cos = Math.cos(m.angle);
    const sin = Math.sin(m.angle);

    const x1 = m.x - cos * halfLen;
    const y1 = m.y - sin * halfLen;
    const x2 = m.x + cos * halfLen;
    const y2 = m.y + sin * halfLen;

    ctx.save();

    // Flash glow on reflection
    if (m.flashTimer > 0) {
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Chrome mirror bar
    ctx.strokeStyle = '#F4F0E8';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Cyan reflective laser coating
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Center pivot joint
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawBullet(b: RicochetBullet): void {
    const ctx = this.ctx;

    // 1. Trail Dots
    b.trail.forEach((t) => {
      ctx.fillStyle = b.glowColor;
      ctx.globalAlpha = Math.max(0, t.alpha * 0.45);
      ctx.beginPath();
      ctx.arc(t.x, t.y, b.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // 2. Outer Glow Halo
    ctx.save();
    ctx.shadowColor = b.isSupercharged ? '#F59E0B' : b.glowColor;
    ctx.shadowBlur = b.isSupercharged ? 24 : 14;

    ctx.fillStyle = b.glowColor;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Bright White Hot Core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawPlayer(p: RicochetPlayer, isLocal: boolean, nowSec: number): void {
    if (!p.alive) return;

    const ctx = this.ctx;
    const isSliding = p.slideTimer > 0;
    const bobY = isSliding ? 8 : Math.abs(Math.sin(p.walkCycle)) * 4.5;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Slide Skid Sparks & Shadow
    if (isSliding) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, 12);
      ctx.lineTo(-32, 12);
      ctx.moveTo(16, 12);
      ctx.lineTo(0, 12);
      ctx.stroke();
    }

    // Contact Shadow
    ctx.beginPath();
    ctx.ellipse(0, 14, p.radius * 0.98, p.radius * 0.54, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // 3/4 Robot Body
    ctx.save();
    ctx.translate(0, isSliding ? 6 : -bobY);
    if (isSliding) ctx.rotate(0.25 * (p.vx > 0 ? 1 : -1));

    const cosmetics = p.cosmetics || (isLocal ? robotWorkshop.cosmetics : undefined);
    const skinColors = robotWorkshop.getSkinColors(cosmetics?.skin, p.bodyColor, p.shadeColor);

    // Bevel
    ctx.fillStyle = skinColors.shade;
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-16, -15, 32, 26, 9);
    ctx.fill();
    ctx.stroke();

    // Shell
    ctx.fillStyle = skinColors.body;
    ctx.beginPath();
    ctx.roundRect(-16, -21, 32, 24, 9);
    ctx.fill();
    ctx.stroke();

    // Visor
    const lookX = Math.cos(p.aimAngle) * 3.5;
    const lookY = Math.sin(p.aimAngle) * 2.2;
    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.roundRect(-12 + lookX * 0.4, -15 + lookY * 0.3, 24, 12, 4);
    ctx.fill();

    // Eyes
    const visorColor = robotWorkshop.getVisorColor(cosmetics?.visor);
    ctx.fillStyle = visorColor;
    ctx.beginPath();
    ctx.arc(-5 + lookX * 0.6, -9 + lookY * 0.4, 2.4, 0, Math.PI * 2);
    ctx.arc(5 + lookX * 0.6, -9 + lookY * 0.4, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Bat / Deflector Paddle
    ctx.save();
    ctx.rotate(p.aimAngle);
    ctx.fillStyle = '#18181B';
    ctx.fillRect(12, -2.5, 6, 5);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(17, -5, 18, 10);
    ctx.restore();

    // Parry Arc
    if (p.parryTimer > 0) {
      ctx.save();
      ctx.rotate(p.aimAngle);
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 24, -1.2, 1.2);
      ctx.stroke();
      ctx.restore();
    }

    // Hat
    if (cosmetics?.hat && cosmetics.hat !== 'NONE') {
      robotWorkshop.drawHat(ctx, cosmetics.hat, 0, -21, nowSec);
    }

    ctx.restore(); // chassis

    // Lives Indicator Pip Bar
    ctx.fillStyle = '#22C55E';
    for (let i = 0; i < p.lives; i++) {
      ctx.beginPath();
      ctx.arc(-10 + i * 10, -38, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Name Tag
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F4F0E8';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name} [${p.score}]`, 0, -46);

    ctx.restore();
  }

  private drawOverBanner(engine: RicochetEngine): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(24, 24, 27, 0.85)';
    ctx.fillRect(0, 0, RICOCHET_WIDTH, RICOCHET_HEIGHT);

    const winner =
      engine.matchWinnerId !== null
        ? engine.players[engine.matchWinnerId]
        : engine.roundWinnerId !== null
          ? engine.players[engine.roundWinnerId]
          : null;

    ctx.textAlign = 'center';
    ctx.font = '800 36px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#F59E0B';
    const title =
      engine.status === 'MATCH_OVER'
        ? `¡${winner ? winner.name : 'PILOTO'} GANÓ EL DUELO RICOCHET!`
        : `¡RONDA FINALIZADA! GANADOR: ${winner ? winner.name : 'NADIE'}`;
    ctx.fillText(title, RICOCHET_WIDTH / 2, RICOCHET_HEIGHT / 2 - 10);

    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#DCD6CB';
    ctx.fillText(
      `Siguiente ronda en ${engine.statusTimer.toFixed(1)}s`,
      RICOCHET_WIDTH / 2,
      RICOCHET_HEIGHT / 2 + 30
    );

    ctx.restore();
  }
}
