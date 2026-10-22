import { robotWorkshop } from '../game/robotWorkshop';
import { CanvasViewportRenderer } from './canvasViewport';
import { HOT_CORE_ARENAS, HotCoreEngine } from '../game/hotCoreEngine';
import { HotCorePlayer } from '../types';

const CHAMBER_LEFT = 96;
const CHAMBER_RIGHT = 904;
const CHAMBER_TOP = 66;
const CHAMBER_BOTTOM = 450;

export class HotCoreRenderer extends CanvasViewportRenderer {
  constructor(canvas: HTMLCanvasElement) {
    super(canvas, 1000, 516, 24, 44);
  }

  public render(engine: HotCoreEngine, localSlotId: number): void {
    this.syncViewport();
    const ctx = this.ctx;
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    const nowSec = performance.now() * 0.001;

    // 1. Matte Warm Putty Backdrop
    ctx.fillStyle = '#DCD6CB';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    if (engine.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * engine.screenShake,
        (Math.random() - 0.5) * engine.screenShake
      );
    }

    const cw = CHAMBER_RIGHT - CHAMBER_LEFT;
    const ch = CHAMBER_BOTTOM - CHAMBER_TOP;

    // 2. Outer Reactor Housing & Recessed Rim
    ctx.fillStyle = 'rgba(24, 24, 27, 0.25)';
    this.roundRect(ctx, CHAMBER_LEFT - 14, CHAMBER_TOP - 6, cw + 36, ch + 30, 16);
    ctx.fill();

    ctx.fillStyle = '#B8B1A4';
    this.roundRect(ctx, CHAMBER_LEFT - 16, CHAMBER_TOP - 14, cw + 32, ch + 28, 16);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    // Corner Industrial Bolts
    const bolts = [
      [CHAMBER_LEFT - 4, CHAMBER_TOP - 2],
      [CHAMBER_RIGHT + 4, CHAMBER_TOP - 2],
      [CHAMBER_LEFT - 4, CHAMBER_BOTTOM + 2],
      [CHAMBER_RIGHT + 4, CHAMBER_BOTTOM + 2]
    ];
    for (const [bx, by] of bolts) {
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#8C857B';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();
    }

    // 3. Playable Cream Reactor Floor
    const criticalUrgency =
      engine.core.fuseTimer < 3.0 ? (3.0 - engine.core.fuseTimer) / 3.0 : 0;
    ctx.fillStyle = '#F4F0E8';
    this.roundRect(ctx, CHAMBER_LEFT, CHAMBER_TOP, cw, ch, 10);
    ctx.fill();

    if (criticalUrgency > 0 && Math.sin(nowSec * 18) > 0) {
      ctx.fillStyle = `rgba(255, 79, 0, ${0.09 * criticalUrgency})`;
      this.roundRect(ctx, CHAMBER_LEFT, CHAMBER_TOP, cw, ch, 10);
      ctx.fill();
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#18181B';
    this.roundRect(ctx, CHAMBER_LEFT, CHAMBER_TOP, cw, ch, 10);
    ctx.stroke();

    // Technical Blueprint Grid & Center Reactor Ring
    ctx.save();
    this.roundRect(ctx, CHAMBER_LEFT, CHAMBER_TOP, cw, ch, 10);
    ctx.clip();

    ctx.strokeStyle = 'rgba(24, 24, 27, 0.06)';
    ctx.lineWidth = 1;
    for (let gx = CHAMBER_LEFT + 48; gx < CHAMBER_RIGHT; gx += 48) {
      ctx.beginPath();
      ctx.moveTo(gx, CHAMBER_TOP);
      ctx.lineTo(gx, CHAMBER_BOTTOM);
      ctx.stroke();
    }
    for (let gy = CHAMBER_TOP + 48; gy < CHAMBER_BOTTOM; gy += 48) {
      ctx.beginPath();
      ctx.moveTo(CHAMBER_LEFT, gy);
      ctx.lineTo(CHAMBER_RIGHT, gy);
      ctx.stroke();
    }

    // Center Reactor containment circles
    ctx.strokeStyle = 'rgba(24, 24, 27, 0.13)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(500, 258, 92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(500, 258, 145, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Top stencil header
    ctx.fillStyle = 'rgba(24, 24, 27, 0.22)';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${engine.arenaTitle} (${engine.arenaIndex + 1}/${HOT_CORE_ARENAS.length}) // [CLIC/ESPACIO] LANZAR O ESCUDO PARRY • [E] PULSO EMP • [SHIFT] DASH`,
      CHAMBER_LEFT + 16,
      CHAMBER_TOP + 22
    );

    // 4. Boost Pads
    for (const pad of engine.boostPads) {
      ctx.save();
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#18181B';
      ctx.strokeRect(pad.x, pad.y, pad.w, pad.h);

      // Animated Chevrons
      const cx = pad.x + pad.w * 0.5;
      const cy = pad.y + pad.h * 0.5;
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(pad.vy, pad.vx));
      ctx.strokeStyle = '#FF4F00';
      ctx.lineWidth = 3;
      const shift = ((nowSec * 36) % 18) - 9;
      for (const offset of [-14, 0, 14]) {
        const ox = offset + shift * 0.5;
        ctx.beginPath();
        ctx.moveTo(ox - 5, -7);
        ctx.lineTo(ox + 4, 0);
        ctx.lineTo(ox - 5, 7);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Ricochet Pillars
    for (const pil of engine.pillars) {
      ctx.fillStyle = 'rgba(24, 24, 27, 0.22)';
      this.roundRect(ctx, pil.x + 4, pil.y + 6, pil.w, pil.h, 6);
      ctx.fill();

      ctx.fillStyle = '#52525B';
      this.roundRect(ctx, pil.x, pil.y, pil.w, pil.h, 6);
      ctx.fill();

      ctx.fillStyle = '#E4DFD3';
      this.roundRect(ctx, pil.x + 4, pil.y + 4, pil.w - 8, pil.h - 10, 4);
      ctx.fill();

      // Hazard stripe bar on pillar
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(pil.x + 6, pil.y + pil.h * 0.5 - 4, pil.w - 12, 8);

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#18181B';
      this.roundRect(ctx, pil.x, pil.y, pil.w, pil.h, 6);
      ctx.stroke();
    }

    // 6. Pinball Bumpers
    for (const b of engine.bumpers) {
      const flash = b.hitAnim > 0;
      ctx.beginPath();
      ctx.arc(b.x, b.y + 4, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(24, 24, 27, 0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = flash ? '#FF4F00' : '#F59E0B';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.52, 0, Math.PI * 2);
      ctx.fillStyle = flash ? '#FFFBEB' : '#18181B';
      ctx.fill();
    }

    // 7. Loose Metallic Parts (Debris)
    for (const part of engine.looseParts) {
      ctx.save();
      ctx.translate(part.x, part.y);
      ctx.rotate(part.rot);
      ctx.fillStyle = part.color;
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-5, -4, 10, 8);
      ctx.strokeRect(-5, -4, 10, 8);
      ctx.restore();
    }

    ctx.restore(); // End chamber clip

    // 8. Carrier Aiming Laser & Players (sorted by Y for 3/4 depth)
    const activePlayers = engine
      .getActiveParticipants()
      .slice()
      .sort((a, b) => a.y - b.y);

    for (const p of activePlayers) {
      if (!p.alive) {
        this.drawEliminatedMarker(ctx, p);
      } else {
        this.drawPlayer(ctx, p, engine.core.holderId === p.id, p.id === localSlotId, nowSec);
      }
    }

    // 9. Unstable Nuclear Core (Free/Thrown or Mounted on Carrier)
    this.drawNuclearCore(ctx, engine, nowSec);

    // 10. Shockwave / Detonation Rings
    for (const exp of engine.explosions) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.strokeStyle = exp.color;
      ctx.globalAlpha = Math.max(0, exp.life);
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }

    // 11. Floating Tactical Callouts
    for (const c of engine.callouts) {
      const alpha = Math.min(1, c.life * 2.2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const textW = ctx.measureText(c.text).width + 14;
      ctx.fillStyle = c.bgColor || '#18181B';
      this.roundRect(ctx, c.x - textW * 0.5, c.y - 13, textW, 20, 5);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();
      ctx.fillStyle = c.textColor || '#F4F0E8';
      ctx.fillText(c.text, c.x, c.y + 1);
      ctx.restore();
    }

    // 12. Round / Match End Banner
    if (engine.status !== 'PLAYING') {
      const winner =
        engine.lastWinnerId !== null ? engine.players[engine.lastWinnerId] : null;
      ctx.save();
      ctx.fillStyle = 'rgba(24, 24, 27, 0.9)';
      this.roundRect(ctx, 210, 215, 580, 74, 12);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FF4F00';
      ctx.stroke();

      ctx.fillStyle = '#F4F0E8';
      ctx.font = '900 20px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        winner
          ? engine.status === 'MATCH_OVER'
            ? `🏆 ¡${winner.name} DOMINA EL REACTOR (5 PTOS)!`
            : `🏆 ¡${winner.name} SOBREVIVE AL NÚCLEO (+1 PTO)!`
          : '💥 ¡DETONACIÓN TÉRMICA!',
        500,
        250
      );

      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('PREPARANDO SIGUIENTE CÁMARA DE REACTOR...', 500, 272);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawEliminatedMarker(ctx: CanvasRenderingContext2D, p: HotCorePlayer): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = p.bodyColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(10, 10);
    ctx.moveTo(10, -10);
    ctx.lineTo(-10, 10);
    ctx.stroke();

    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#52525B';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name} [CHAMUSCADO]`, 0, 24);
    ctx.restore();
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    p: HotCorePlayer,
    isCarrier: boolean,
    isLocal: boolean,
    nowSec: number
  ): void {
    ctx.save();
    this.applyGhostPulse();
    const cosmetics = robotWorkshop.resolveCosmetics(p.cosmetics, isLocal);
    const skinColors = robotWorkshop.getSkinColors(cosmetics.skin, p.bodyColor, p.shadeColor);
    ctx.translate(p.x, p.y);

    // Carrier danger floor ring & throw trajectory guide
    if (isCarrier) {
      const pulse = 29 + Math.sin(nowSec * 16) * 4;
      ctx.beginPath();
      ctx.arc(0, 2, pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 79, 0, 0.22)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FF4F00';
      ctx.stroke();

      // Aiming laser guide for throwing core
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 79, 0, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(Math.cos(p.aimAngle) * 24, Math.sin(p.aimAngle) * 24);
      ctx.lineTo(Math.cos(p.aimAngle) * 95, Math.sin(p.aimAngle) * 95);
      ctx.stroke();
      ctx.restore();
    } else if (isLocal) {
      ctx.beginPath();
      ctx.arc(0, 3, 25, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.35)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ground drop shadow
    ctx.beginPath();
    ctx.ellipse(0, 11, p.radius * 0.95, p.radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.28)';
    ctx.fill();

    // Base Treads
    ctx.fillStyle = '#27272A';
    this.roundRect(ctx, -18, -4, 36, 16, 5);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    // 3/4 Robot Chassis Body
    ctx.fillStyle = skinColors.body;
    this.roundRect(ctx, -16, -18, 32, 24, 8);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    robotWorkshop.drawSkinStripes(ctx, cosmetics.skin, -16, -18, 32, 24, 8);

    // Directional Visor Eye
    const vx = Math.cos(p.aimAngle) * 6;
    const vy = Math.sin(p.aimAngle) * 4 - 8;
    ctx.fillStyle = '#18181B';
    this.roundRect(ctx, vx - 8, vy - 4, 16, 8, 3);
    ctx.fill();

    ctx.fillStyle = robotWorkshop.getVisorColor(cosmetics.visor);
    ctx.beginPath();
    ctx.arc(vx + Math.cos(p.aimAngle) * 2, vy, 2.6, 0, Math.PI * 2);
    ctx.fill();

    robotWorkshop.drawHat(ctx, cosmetics.hat, 0, -18, nowSec);

    // Reflector Parry Shield Barrier
    if (p.shieldTimer > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -3, p.radius + 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
      ctx.fill();
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = '#0284C7';
      ctx.stroke();
      ctx.restore();
    }

    // Emote Speech Bubble
    if (p.emoteText && p.emoteTimer > 0) {
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const ew = ctx.measureText(p.emoteText).width + 12;
      ctx.fillStyle = '#18181B';
      this.roundRect(ctx, -ew * 0.5, -42, ew, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(p.emoteText, 0, -31);
    }

    // Player Name & Score Badge below chassis
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const label = `${p.name} ★${p.score}`;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = isLocal ? '#18181B' : 'rgba(244, 240, 232, 0.92)';
    this.roundRect(ctx, -tw * 0.5, 16, tw, 15, 4);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    ctx.fillStyle = isLocal ? '#F4F0E8' : '#18181B';
    ctx.fillText(label, 0, 27);

    ctx.restore();
  }

  private drawNuclearCore(ctx: CanvasRenderingContext2D, engine: HotCoreEngine, nowSec: number): void {
    const core = engine.core;
    const isHeld = core.holderId !== null;
    const cx = core.x;
    const cy = isHeld ? core.y - 34 : core.y;
    const urgent = core.fuseTimer < 3.0;
    const blink = Math.sin(nowSec * (urgent ? 26 : 12)) > 0;

    ctx.save();

    // Projectile trail when thrown
    if (!isHeld && Math.hypot(core.vx, core.vy) > 60) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - core.vx * 0.045, cy - core.vy * 0.045);
      ctx.strokeStyle = 'rgba(255, 79, 0, 0.55)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Floor shadow when free
    if (!isHeld) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, core.radius * 0.95, core.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(24, 24, 27, 0.28)';
      ctx.fill();
    }

    // Outer pulsing radiation halo
    const haloRadius = core.radius + (urgent ? 10 : 6) + Math.sin(nowSec * 15) * 3;
    ctx.beginPath();
    ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2);
    ctx.fillStyle = urgent ? 'rgba(220, 38, 38, 0.28)' : 'rgba(255, 79, 0, 0.20)';
    ctx.fill();

    // Core Metallic Sphere
    ctx.beginPath();
    ctx.arc(cx, cy, core.radius, 0, Math.PI * 2);
    ctx.fillStyle = blink ? '#FF4F00' : '#18181B';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    // Inner Isotope LED
    ctx.beginPath();
    ctx.arc(cx, cy, core.radius * 0.48, 0, Math.PI * 2);
    ctx.fillStyle = blink ? '#FEF08A' : '#FF4F00';
    ctx.fill();

    // Floating Digital Countdown Badge above Core
    const timerStr = `💣 ${core.fuseTimer.toFixed(1)}s`;
    ctx.font = '900 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const bw = ctx.measureText(timerStr).width + 14;
    const by = cy - core.radius - 22;

    ctx.fillStyle = urgent && blink ? '#DC2626' : '#18181B';
    this.roundRect(ctx, cx - bw * 0.5, by, bw, 18, 5);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#F4F0E8';
    ctx.stroke();

    ctx.fillStyle = '#FEF08A';
    ctx.fillText(timerStr, cx, by + 13);

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
