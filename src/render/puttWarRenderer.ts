import { PuttWarEngine } from '../game/puttWarEngine';
import { PuttBallPlayer } from '../types';

export class PuttWarRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D context');
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

    const padX = 28;
    const padY = 48;
    this.scale = Math.min((w - padX * 2) / 1000, (h - padY * 2) / 516);
    this.offsetX = (w - 1000 * this.scale) * 0.5;
    this.offsetY = (h - 516 * this.scale) * 0.5;
  }

  public render(engine: PuttWarEngine, localSlotId: number): void {
    this.syncViewport();
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    // 1. Matte Warm Putty Backdrop
    ctx.fillStyle = '#DCD6CB';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 2. Course Table Shadow & 3D Base
    ctx.fillStyle = 'rgba(24, 24, 27, 0.22)';
    this.roundRect(ctx, 56, 48, 900, 444, 14);
    ctx.fill();

    ctx.fillStyle = '#B8B1A4';
    this.roundRect(ctx, 50, 40, 896, 442, 14);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    // 3. Synthetic Tactile Golf Turf Surface
    ctx.fillStyle = '#DDE5D4';
    ctx.fillRect(68, 56, 860, 408);

    // Subtle Checkerboard Fairway Mow Stripes
    ctx.fillStyle = '#D3DEC8';
    const tileSize = 44;
    for (let gx = 68; gx < 928; gx += tileSize) {
      for (let gy = 56; gy < 464; gy += tileSize) {
        if ((Math.floor(gx / tileSize) + Math.floor(gy / tileSize)) % 2 === 0) {
          ctx.fillRect(
            gx,
            gy,
            Math.min(tileSize, 928 - gx),
            Math.min(tileSize, 464 - gy)
          );
        }
      }
    }

    // Technical Stencil Header on Course Turf
    ctx.fillStyle = 'rgba(24, 24, 27, 0.16)';
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${engine.holeTitle} // PAR ${engine.par} // [E] MINA WORMS • [SHIFT] PULSO / POWERUP`,
      90,
      80
    );

    // 4. Hazards (Acid Vats, Sand Bunkers, Turbo Boost Strips)
    const nowSec = performance.now() * 0.001;
    for (const hz of engine.hazards) {
      ctx.save();
      if (hz.type === 'ACID') {
        ctx.fillStyle = '#14532D';
        ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
        ctx.fillStyle = '#4ADE80';
        ctx.fillRect(hz.x + 4, hz.y + 4, hz.w - 8, hz.h - 8);

        // Bubbling acid circles
        ctx.fillStyle = '#166534';
        for (let i = 0; i < 4; i++) {
          const bx = hz.x + ((i * 73 + Math.floor(nowSec * 25)) % Math.max(24, hz.w - 20)) + 10;
          const by = hz.y + ((i * 47 + Math.floor(nowSec * 18)) % Math.max(24, hz.h - 20)) + 10;
          const br = 4 + Math.sin(nowSec * 5 + i) * 2.5;
          ctx.beginPath();
          ctx.arc(bx, by, Math.max(2, br), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#18181B';
        ctx.strokeRect(hz.x, hz.y, hz.w, hz.h);

        ctx.fillStyle = '#14532D';
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('☣️ ÁCIDO (+1 GOLPE)', hz.x + hz.w * 0.5, hz.y + hz.h * 0.5 + 4);
      } else if (hz.type === 'SAND') {
        ctx.fillStyle = '#FDE68A';
        this.roundRect(ctx, hz.x, hz.y, hz.w, hz.h, 12);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#B45309';
        ctx.stroke();

        ctx.fillStyle = '#B45309';
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BUNKER ARENA', hz.x + hz.w * 0.5, hz.y + hz.h * 0.5 + 4);
      } else if (hz.type === 'BOOST') {
        ctx.fillStyle = '#1E3A8A';
        this.roundRect(ctx, hz.x, hz.y, hz.w, hz.h, 8);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#18181B';
        ctx.stroke();

        ctx.fillStyle = '#60A5FA';
        ctx.font = '800 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const shift = Math.floor((nowSec * 40) % 24);
        ctx.fillText(
          '» » TURBO PAD » »',
          hz.x + hz.w * 0.5 + (shift - 12) * 0.4,
          hz.y + hz.h * 0.5 + 4
        );
      }
      ctx.restore();
    }

    // 5. Cup Socket & Flagpole
    this.drawCupAndFlag(ctx, engine.cupX, engine.cupY, engine.cupRadius, nowSec);

    // 6. 3D Extruded Course Walls
    for (const wall of engine.walls) {
      // Bottom 3D shadow lip
      ctx.fillStyle = '#9E978B';
      ctx.fillRect(wall.x, wall.y + 4, wall.w, wall.h);

      // Top tactile surface
      ctx.fillStyle = '#F4F0E8';
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#18181B';
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }

    // 7. Pinball Bumpers
    for (const b of engine.bumpers) {
      const r = b.radius + b.hitAnim * 5;
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(b.x, b.y + 4, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = b.hitAnim > 0.1 ? '#FF4F00' : '#F59E0B';
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();

      ctx.fillStyle = '#F4F0E8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Rotating Windmill Obstacles
    for (const wm of engine.windmills) {
      const x1 = wm.cx - Math.cos(wm.angle) * wm.length;
      const y1 = wm.cy - Math.sin(wm.angle) * wm.length;
      const x2 = wm.cx + Math.cos(wm.angle) * wm.length;
      const y2 = wm.cy + Math.sin(wm.angle) * wm.length;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#18181B';
      ctx.beginPath();
      ctx.moveTo(x1, y1 + 4);
      ctx.lineTo(x2, y2 + 4);
      ctx.stroke();

      ctx.lineWidth = 10;
      ctx.strokeStyle = '#FF4F00';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Center pivot turret
      ctx.fillStyle = '#F4F0E8';
      ctx.beginPath();
      ctx.arc(wm.cx, wm.cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();
      ctx.restore();
    }

    // 9. Worms-style Weapon Crates
    for (const cr of engine.crates) {
      if (!cr.active) continue;
      const bob = Math.sin(nowSec * 4 + cr.id) * 2.5;
      ctx.save();
      ctx.translate(cr.x, cr.y + bob);

      ctx.fillStyle = '#18181B';
      this.roundRect(ctx, -14, -11, 28, 26, 5);
      ctx.fill();

      ctx.fillStyle =
        cr.type === 'BAZOOKA' ? '#FF4F00' : cr.type === 'NITRO' ? '#F59E0B' : '#1B4DFF';
      this.roundRect(ctx, -14, -14, 28, 26, 5);
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const icon = cr.type === 'BAZOOKA' ? '🚀' : cr.type === 'NITRO' ? '⚡' : '⚓';
      ctx.fillText(icon, 0, 4);
      ctx.restore();
    }

    // 10. Ticking Proximity Mines & Homing Rockets
    for (const b of engine.bombs) {
      ctx.save();
      ctx.translate(b.x, b.y);
      const pulse = Math.sin(nowSec * 18) > 0;

      ctx.fillStyle = pulse ? '#FF4F00' : '#18181B';
      ctx.beginPath();
      ctx.arc(0, 0, b.isRocket ? 11 : 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.isRocket ? '🚀' : b.timer.toFixed(1), 0, -14);
      ctx.restore();
    }

    // 11. Explosion / Shockwave Rings
    for (const ex of engine.explosions) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ex.life);
      ctx.lineWidth = 5;
      ctx.strokeStyle = ex.color;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = ex.color;
      ctx.globalAlpha = Math.max(0, ex.life * 0.22);
      ctx.fill();
      ctx.restore();
    }

    // 12. Golf-Bot Players & Aim Vectors
    const activePlayers = engine.getActivePlayers();
    for (const p of activePlayers) {
      this.drawGolfBotBall(ctx, p, p.id === localSlotId);
    }

    // 13. Hurry-Up Banner if someone already sunk their putt
    if (engine.hurryActive && engine.status === 'PLAYING') {
      ctx.save();
      ctx.fillStyle = '#FF4F00';
      this.roundRect(ctx, 360, 14, 280, 28, 6);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `⏱️ CIERRE DE HOYO EN ${Math.ceil(engine.hurryTimer)}S`,
        500,
        32
      );
      ctx.restore();
    }

    // 14. Floating Callouts
    for (const c of engine.callouts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, c.life * 1.4);
      ctx.font = '800 12px "JetBrains Mono", monospace';
      const pad = 10;
      const tw = ctx.measureText(c.text).width + pad * 2;
      ctx.fillStyle = c.bgColor;
      this.roundRect(ctx, c.x - tw * 0.5, c.y - 13, tw, 24, 5);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();

      ctx.fillStyle = c.textColor;
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.x, c.y + 3);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawCupAndFlag(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    nowSec: number
  ): void {
    ctx.save();
    // Outer target ring
    ctx.strokeStyle = 'rgba(24, 24, 27, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Recessed dark socket
    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#F4F0E8';
    ctx.stroke();

    // Flagpole
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#18181B';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 46);
    ctx.stroke();

    // Waving Pennant Flag
    const wave = Math.sin(nowSec * 6) * 4;
    ctx.fillStyle = '#FF4F00';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 46);
    ctx.lineTo(cx + 28, cy - 38 + wave);
    ctx.lineTo(cx, cy - 28);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();
    ctx.restore();
  }

  private drawGolfBotBall(
    ctx: CanvasRenderingContext2D,
    p: PuttBallPlayer,
    isLocal: boolean
  ): void {
    ctx.save();

    // If sunk in cup, render badge above cup
    if (p.sunkInCup) {
      ctx.fillStyle = p.bodyColor;
      this.roundRect(ctx, p.x - 32, p.y - 38 - p.sunkOrder * 20, 64, 18, 4);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`#${p.sunkOrder} ${p.name} (${p.strokes}G)`, p.x, p.y - 26 - p.sunkOrder * 20);
      ctx.restore();
      return;
    }

    // 1. Aim Line & Power Gauge for Local Player (or charging player)
    if ((isLocal || p.isCharging) && p.puttCooldown <= 0) {
      const previewLen = p.isCharging ? 45 + p.chargePower * 115 : 58;
      const ax = p.x + Math.cos(p.aimAngle) * previewLen;
      const ay = p.y + Math.sin(p.aimAngle) * previewLen;

      ctx.save();
      ctx.lineWidth = p.isCharging ? 4 : 2.5;
      ctx.strokeStyle = p.isCharging ? '#FF4F00' : 'rgba(24, 24, 27, 0.55)';
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);

      // Aim reticle tip
      ctx.fillStyle = p.isCharging ? '#FF4F00' : p.bodyColor;
      ctx.beginPath();
      ctx.arc(ax, ay, p.isCharging ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Mechanical Power Bar below ball when charging
      if (p.isCharging) {
        const barW = 46;
        const barH = 8;
        ctx.fillStyle = '#18181B';
        ctx.fillRect(p.x - barW * 0.5, p.y + 20, barW, barH);
        ctx.fillStyle = p.chargePower > 0.8 ? '#FF4F00' : '#F59E0B';
        ctx.fillRect(p.x - barW * 0.5 + 2, p.y + 22, (barW - 4) * p.chargePower, barH - 4);
      }
    }

    // 2. Shadow
    ctx.fillStyle = 'rgba(24, 24, 27, 0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 5, p.radius, p.radius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Spherical Golf-Bot Chassis
    ctx.fillStyle = p.anvilTimer > 0 ? '#52525B' : p.bodyColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = isLocal ? 3 : 2.2;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    // Inner mechanical equatorial ring
    ctx.fillStyle = '#F4F0E8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // Expressive visor eyes facing aimAngle
    const lookX = Math.cos(p.aimAngle) * 3.5;
    const lookY = Math.sin(p.aimAngle) * 3.5;
    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.arc(p.x + lookX, p.y + lookY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Held Weapon Badge
    if (p.heldPowerup !== 'NONE') {
      const icon =
        p.heldPowerup === 'BAZOOKA' ? '🚀' : p.heldPowerup === 'NITRO' ? '⚡' : '⚓';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(icon, p.x + 16, p.y - 12);
    }

    // Nameplate + Strokes Counter above ball
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const label = `${p.name} • ${p.strokes}G`;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = isLocal ? '#18181B' : 'rgba(24, 24, 27, 0.8)';
    this.roundRect(ctx, p.x - tw * 0.5, p.y - 31, tw, 15, 4);
    ctx.fill();
    ctx.fillStyle = '#F4F0E8';
    ctx.fillText(label, p.x, p.y - 20);

    // Emote Bubble
    if (p.emoteText) {
      ctx.fillStyle = '#F59E0B';
      const ew = ctx.measureText(p.emoteText).width + 12;
      this.roundRect(ctx, p.x - ew * 0.5, p.y - 50, ew, 17, 4);
      ctx.fill();
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#18181B';
      ctx.fillText(p.emoteText, p.x, p.y - 38);
    }

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
