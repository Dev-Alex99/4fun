import { robotWorkshop } from '../game/robotWorkshop';
import { CanvasViewportRenderer } from './canvasViewport';
import {
  CHAMBER_BOTTOM,
  CHAMBER_CENTER_X,
  CHAMBER_CENTER_Y,
  CHAMBER_LEFT,
  CHAMBER_RIGHT,
  CHAMBER_TOP,
  HexCrushEngine
} from '../game/hexCrushEngine';
import { HexCrushPlayer, HexTile } from '../types';

export class HexCrushRenderer extends CanvasViewportRenderer {
  constructor(canvas: HTMLCanvasElement) {
    super(canvas, 1000, 516, 24, 44);
  }

  public render(engine: HexCrushEngine, localSlotId: number): void {
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
        (Math.random() - 0.5) * this.shakeAmount(engine.screenShake),
        (Math.random() - 0.5) * this.shakeAmount(engine.screenShake)
      );
    }

    const cw = CHAMBER_RIGHT - CHAMBER_LEFT;
    const ch = CHAMBER_BOTTOM - CHAMBER_TOP;

    // 2. Outer Housing & Chamber Rim
    ctx.fillStyle = 'rgba(24, 24, 27, 0.25)';
    this.roundRect(ctx, CHAMBER_LEFT - 14, CHAMBER_TOP - 6, cw + 36, ch + 30, 16);
    ctx.fill();

    ctx.fillStyle = '#B8B1A4';
    this.roundRect(ctx, CHAMBER_LEFT - 16, CHAMBER_TOP - 14, cw + 32, ch + 28, 16);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#18181B';
    this.roundRect(ctx, CHAMBER_LEFT - 16, CHAMBER_TOP - 14, cw + 32, ch + 28, 16);
    ctx.stroke();

    // 3. Abyss Void Pit Interior (Deep abyss beneath floating tiles)
    ctx.fillStyle = '#111113';
    ctx.fillRect(CHAMBER_LEFT, CHAMBER_TOP, cw, ch);

    // Deep grid abyss pattern
    ctx.save();
    ctx.beginPath();
    ctx.rect(CHAMBER_LEFT, CHAMBER_TOP, cw, ch);
    ctx.clip();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1.5;
    const gridSize = 40;
    for (let gx = CHAMBER_LEFT; gx < CHAMBER_RIGHT; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, CHAMBER_TOP);
      ctx.lineTo(gx, CHAMBER_BOTTOM);
      ctx.stroke();
    }
    for (let gy = CHAMBER_TOP; gy < CHAMBER_BOTTOM; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(CHAMBER_LEFT, gy);
      ctx.lineTo(CHAMBER_RIGHT, gy);
      ctx.stroke();
    }

    // Abyss bottom red hazard glow
    const glowGradient = ctx.createLinearGradient(0, CHAMBER_BOTTOM - 60, 0, CHAMBER_BOTTOM);
    glowGradient.addColorStop(0, 'rgba(239, 68, 68, 0)');
    glowGradient.addColorStop(1, 'rgba(239, 68, 68, 0.22)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(CHAMBER_LEFT, CHAMBER_BOTTOM - 60, cw, 60);

    // 4. Render Hexagonal Tiles
    // Render falling tiles first (in background)
    for (const tile of engine.tiles) {
      if (tile.health === 0) {
        this.drawHexTile(ctx, tile, nowSec);
      }
    }
    // Render solid intact/cracked tiles
    for (const tile of engine.tiles) {
      if (tile.health > 0) {
        this.drawHexTile(ctx, tile, nowSec);
      }
    }

    // 5. Pinball Bumpers
    for (const b of engine.bumpers) {
      const flash = b.hitAnim > 0 && !this.reducedFlashes;
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

    // 6. Seismic Shockwaves
    for (const sw of engine.shockwaves) {
      this.drawSeismicShockwave(ctx, sw, nowSec);
    }

    // 7. Loose Metallic Debris
    for (const part of engine.looseParts) {
      ctx.save();
      ctx.translate(part.x, part.y);
      ctx.rotate(part.rot);
      const alpha = typeof part.life === 'number' ? Math.max(0, Math.min(1, part.life / 0.8)) : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = part.color;
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-5, -4, 10, 8);
      ctx.strokeRect(-5, -4, 10, 8);
      ctx.restore();
    }

    // 8. Dust Particles
    for (const pt of engine.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Players (Robots)
    const activePlayers = engine.getActiveParticipants();
    for (const p of activePlayers) {
      this.drawPlayer(ctx, p, p.id === localSlotId, nowSec);
    }

    // 10. Explosions
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

    // 11. Tactical Floating Callouts
    for (const c of engine.callouts) {
      const alpha = Math.min(1, c.life * 2.2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(c.text).width + 16;
      ctx.fillStyle = c.bgColor;
      this.roundRect(ctx, c.x - tw * 0.5, c.y - 12, tw, 22, 6);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#18181B';
      this.roundRect(ctx, c.x - tw * 0.5, c.y - 12, tw, 22, 6);
      ctx.stroke();

      ctx.fillStyle = c.textColor;
      ctx.fillText(c.text, c.x, c.y + 3);
      ctx.restore();
    }

    // 12. Match / Round Overlays
    if (engine.status === 'ROUND_OVER') {
      const winner = engine.players.find((p) => p.id === engine.roundWinnerId);
      ctx.save();
      ctx.fillStyle = 'rgba(24, 24, 27, 0.72)';
      ctx.fillRect(CHAMBER_LEFT, CHAMBER_TOP, cw, ch);

      ctx.font = '900 24px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('FIN DE LA RONDA', CHAMBER_CENTER_X, CHAMBER_CENTER_Y - 14);

      ctx.font = '800 16px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(
        winner ? `👑 ¡${winner.name} ES EL ÚLTIMO EN PIE!` : '¡EMPATE SÍSMICO!',
        CHAMBER_CENTER_X,
        CHAMBER_CENTER_Y + 18
      );
      ctx.restore();
    } else if (engine.status === 'MATCH_OVER') {
      const champ = engine.players.find((p) => p.id === engine.matchWinnerId);
      ctx.save();
      ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';
      ctx.fillRect(CHAMBER_LEFT, CHAMBER_TOP, cw, ch);

      ctx.font = '900 28px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#F59E0B';
      ctx.fillText('🏆 CAMPEONATO FINALIZADO', CHAMBER_CENTER_X, CHAMBER_CENTER_Y - 20);

      ctx.font = '900 20px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(
        champ ? `¡${champ.name} ES EL GRAN CAMPEÓN DEL PANAL!` : '¡VICTORIA!',
        CHAMBER_CENTER_X,
        CHAMBER_CENTER_Y + 16
      );
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('RESETEANDO EN BREVES...', CHAMBER_CENTER_X, CHAMBER_CENTER_Y + 44);
      ctx.restore();
    }

    ctx.restore();
    ctx.restore();
  }

  private drawHexTile(ctx: CanvasRenderingContext2D, tile: HexTile, nowSec: number): void {
    ctx.save();
    let tx = tile.x;
    let ty = tile.y + tile.fallOffset;

    if (tile.shakeTimer > 0) {
      tx += (Math.random() - 0.5) * this.shakeAmount(4);
      ty += (Math.random() - 0.5) * this.shakeAmount(4);
    }

    ctx.globalAlpha = Math.max(0, tile.fadeAlpha);
    ctx.translate(tx, ty);

    const r = tile.radius;

    // 3D Lower Extrusion Lip
    if (tile.fallOffset === 0) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i - Math.PI / 6;
        const hx = r * Math.cos(ang);
        const hy = r * Math.sin(ang) + 5;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fillStyle = '#18181B';
      ctx.fill();
    }

    // Upper Hexagon Face
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      const hx = r * Math.cos(ang);
      const hy = r * Math.sin(ang);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();

    // Tile Color based on state & type
    if (tile.type === 'BRIDGE') {
      // Holographic Nanobridge
      ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#38BDF8';
      ctx.stroke();

      // Pulsing grid on bridge
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile.health === 1) {
      // CRACKED tile (warning fissures!)
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();

      // Jagged crack fissures
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.lineTo(-2, 2);
      ctx.lineTo(8, -8);
      ctx.moveTo(-2, 2);
      ctx.lineTo(4, 12);
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    } else if (tile.type === 'GLASS') {
      // Fragile Neon Glass
      ctx.fillStyle = '#FEF08A';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();
    } else if (tile.type === 'STEEL') {
      // Reinforced Heavy Plate
      ctx.fillStyle = '#94A3B8';
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();

      // Heavy bolts at center
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // NORMAL tile
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawSeismicShockwave(
    ctx: CanvasRenderingContext2D,
    sw: { x: number; y: number; vx: number; vy: number; radius: number; color: string; life: number; maxLife: number },
    nowSec: number
  ): void {
    ctx.save();
    ctx.translate(sw.x, sw.y);
    const alpha = Math.max(0, sw.life / sw.maxLife);
    ctx.globalAlpha = alpha;

    const angle = Math.atan2(sw.vy, sw.vx);
    ctx.rotate(angle);

    // Shockwave crescent energy wave
    ctx.beginPath();
    ctx.arc(0, 0, sw.radius, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.lineWidth = 5.5;
    ctx.strokeStyle = sw.color;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(4, 0, sw.radius * 0.65, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.restore();
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    p: HexCrushPlayer,
    isLocal: boolean,
    nowSec: number
  ): void {
    if (!p.alive && p.fallTimer <= 0) return;

    ctx.save();
    this.applyGhostPulse();
    const cosmetics = robotWorkshop.resolveCosmetics(p.cosmetics, isLocal);
    const skinColors = robotWorkshop.getSkinColors(cosmetics.skin, p.bodyColor, p.shadeColor);
    ctx.translate(p.x, p.y);

    // 1. Floor Drop Shadow (Scales down as elevation z increases)
    if (p.fallTimer <= 0) {
      const shadowScale = Math.max(0.3, 1 - p.z / 180);
      ctx.beginPath();
      ctx.ellipse(0, 11, p.radius * 0.95 * shadowScale, p.radius * 0.55 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(24, 24, 27, ${0.32 * shadowScale})`;
      ctx.fill();
    }

    // 2. Vertical Z Elevation Offset & Abyss Fall animation
    ctx.translate(0, -p.z);
    if (p.fallTimer > 0) {
      ctx.scale(p.fallScale, p.fallScale);
      ctx.rotate(p.fallRotation);
    }

    // Aim Laser Guide for local player
    if (isLocal && p.fallTimer <= 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(Math.cos(p.aimAngle) * 20, Math.sin(p.aimAngle) * 20);
      ctx.lineTo(Math.cos(p.aimAngle) * 90, Math.sin(p.aimAngle) * 90);
      ctx.stroke();
      ctx.restore();
    }

    // Ground Pound Aerodynamic Speed Lines
    if (p.isGroundPounding) {
      ctx.save();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.5;
      for (let s = -12; s <= 12; s += 8) {
        ctx.beginPath();
        ctx.moveTo(s, -30);
        ctx.lineTo(s, -14);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Base Treads
    ctx.fillStyle = '#27272A';
    this.roundRect(ctx, -18, -4, 36, 16, 5);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    // Robot Chassis Body
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

    // Heavy Mechanical Hammer on back / side
    ctx.save();
    ctx.translate(Math.cos(p.aimAngle) * 14, Math.sin(p.aimAngle) * 10 - 6);
    ctx.rotate(p.aimAngle);
    ctx.fillStyle = '#71717A';
    ctx.fillRect(0, -3, 14, 6);
    ctx.fillStyle = '#18181B';
    ctx.fillRect(12, -7, 10, 14);
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12, -7, 10, 14);
    ctx.restore();

    // Stun Sparks
    if (p.stunTimer > 0) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -26, 10, nowSec * 10, nowSec * 10 + Math.PI * 1.4);
      ctx.stroke();
    }

    // Score / Rounds Won Trophy Pips
    const pipsY = -28;
    for (let pip = 0; pip < 3; pip++) {
      const pipX = -10 + pip * 10;
      ctx.beginPath();
      ctx.arc(pipX, pipsY, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = pip < p.score ? '#F59E0B' : 'rgba(24, 24, 27, 0.4)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();
    }

    // Player Name Badge
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const label = `${p.name} (${p.score}/3)`;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = isLocal ? '#18181B' : 'rgba(244, 240, 232, 0.92)';
    this.roundRect(ctx, -tw * 0.5, 16, tw, 15, 4);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    ctx.fillStyle = isLocal ? '#F4F0E8' : '#18181B';
    ctx.fillText(label, 0, 27);

    // Emote Bubble
    if (p.emoteText) {
      ctx.save();
      ctx.font = '16px "Segoe UI Emoji", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.emoteText, 0, -42);
      ctx.restore();
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
