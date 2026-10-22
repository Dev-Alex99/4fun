import { VOLT_CROWN_ARENAS, VoltCrownEngine } from '../game/voltCrownEngine';
import { VoltCrownPlayer } from '../types';

const CHAMBER_LEFT = 96;
const CHAMBER_RIGHT = 904;
const CHAMBER_TOP = 66;
const CHAMBER_BOTTOM = 450;

export class VoltCrownRenderer {
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

    const padX = 24;
    const padY = 44;
    this.scale = Math.min((w - padX * 2) / 1000, (h - padY * 2) / 516);
    this.offsetX = (w - 1000 * this.scale) * 0.5;
    this.offsetY = (h - 516 * this.scale) * 0.5;
  }

  public render(engine: VoltCrownEngine, localSlotId: number): void {
    this.syncViewport();
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
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

    // 2. Outer Housing & Rim
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

    // 3. Playable Cream Floor
    ctx.fillStyle = '#F4F0E8';
    this.roundRect(ctx, CHAMBER_LEFT, CHAMBER_TOP, cw, ch, 10);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    // Blueprint Grid
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

    // Central Crown Dais marking
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(500, 258, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Top stencil header
    ctx.fillStyle = 'rgba(24, 24, 27, 0.22)';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${engine.arenaTitle} (${engine.arenaIndex + 1}/${VOLT_CROWN_ARENAS.length}) // [CLIC/ESPACIO] TÁSER O ESCUDO REY • [E] PULSO / TRAMPA • [SHIFT] DASH`,
      CHAMBER_LEFT + 16,
      CHAMBER_TOP + 22
    );

    // 4. Map Traps & Hazards
    for (const trap of engine.traps) {
      if (trap.type === 'CONVEYOR') {
        // Conveyor Belt
        ctx.fillStyle = '#D6D3CD';
        ctx.fillRect(trap.x, trap.y, trap.w, trap.h);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#18181B';
        ctx.strokeRect(trap.x, trap.y, trap.w, trap.h);

        // Animated chevrons
        ctx.save();
        ctx.beginPath();
        ctx.rect(trap.x, trap.y, trap.w, trap.h);
        ctx.clip();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        const speed = (trap.dirX || 0) * 0.4;
        const shift = ((nowSec * speed) % 24);
        for (let cx = trap.x - 30; cx < trap.x + trap.w + 30; cx += 24) {
          const ox = cx + shift;
          ctx.beginPath();
          ctx.moveTo(ox - 6, trap.y + 8);
          ctx.lineTo(ox + 4, trap.y + trap.h * 0.5);
          ctx.lineTo(ox - 6, trap.y + trap.h - 8);
          ctx.stroke();
        }
        ctx.restore();
      } else if (trap.type === 'CRUSHER') {
        const isWarning = !trap.active && (trap.period - trap.timer) <= 0.75;
        // Hydraulic Crusher
        ctx.fillStyle = trap.active ? '#DC2626' : (isWarning ? '#E11D48' : '#71717A');
        this.roundRect(ctx, trap.x, trap.y, trap.w, trap.h, 6);
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#18181B';
        this.roundRect(ctx, trap.x, trap.y, trap.w, trap.h, 6);
        ctx.stroke();

        // Caution Stripes on Crusher
        ctx.fillStyle = isWarning ? '#FDE047' : '#FEF08A';
        ctx.fillRect(trap.x + 6, trap.y + 6, trap.w - 12, 10);
        ctx.fillStyle = '#18181B';
        for (let sx = trap.x + 8; sx < trap.x + trap.w - 14; sx += 14) {
          ctx.fillRect(sx, trap.y + 6, 7, 10);
        }

        // Telegraph hazard alert 0.75s before slamming down
        if (isWarning) {
          ctx.save();
          ctx.font = '800 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          const blink = Math.sin(nowSec * 22) > 0;
          ctx.fillStyle = blink ? '#EF4444' : '#F59E0B';
          ctx.fillText('⚠️ ¡PELIGRO!', trap.x + trap.w * 0.5, trap.y + trap.h * 0.5 + 4);
          ctx.restore();
        }
      } else if (trap.type === 'LASER_GATE') {
        // Laser Gate Emitters
        ctx.fillStyle = '#18181B';
        this.roundRect(ctx, trap.x - 4, trap.y - 6, trap.w + 8, 12, 3);
        ctx.fill();
        this.roundRect(ctx, trap.x - 4, trap.y + trap.h - 6, trap.w + 8, 12, 3);
        ctx.fill();

        if (trap.active) {
          // Pulsing beam
          const beamAlpha = 0.75 + Math.sin(nowSec * 22) * 0.25;
          ctx.save();
          ctx.strokeStyle = `rgba(239, 68, 68, ${beamAlpha})`;
          ctx.lineWidth = trap.w;
          ctx.beginPath();
          ctx.moveTo(trap.x + trap.w * 0.5, trap.y);
          ctx.lineTo(trap.x + trap.w * 0.5, trap.y + trap.h);
          ctx.stroke();

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(trap.x + trap.w * 0.5, trap.y);
          ctx.lineTo(trap.x + trap.w * 0.5, trap.y + trap.h);
          ctx.stroke();
          ctx.restore();
        } else {
          // Inactive warning wire
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.22)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(trap.x + trap.w * 0.5, trap.y);
          ctx.lineTo(trap.x + trap.w * 0.5, trap.y + trap.h);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (trap.type === 'PLASMA_GRATE') {
        // Floor Plasma Grate
        ctx.fillStyle = trap.active ? 'rgba(56, 189, 248, 0.32)' : '#E4DFD3';
        ctx.fillRect(trap.x, trap.y, trap.w, trap.h);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#18181B';
        ctx.strokeRect(trap.x, trap.y, trap.w, trap.h);

        // Grate mesh bars
        ctx.strokeStyle = trap.active ? '#0284C7' : 'rgba(24, 24, 27, 0.15)';
        ctx.lineWidth = 1.6;
        for (let gy = trap.y + 12; gy < trap.y + trap.h; gy += 14) {
          ctx.beginPath();
          ctx.moveTo(trap.x, gy);
          ctx.lineTo(trap.x + trap.w, gy);
          ctx.stroke();
        }
      }
    }

    // 5. Pressure Plates
    for (const plate of engine.plates) {
      const sink = plate.pressed ? 2 : 0;
      ctx.fillStyle = plate.pressed ? '#F59E0B' : '#FEF3C7';
      this.roundRect(ctx, plate.x, plate.y + sink, plate.w, plate.h - sink, 6);
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#18181B';
      this.roundRect(ctx, plate.x, plate.y + sink, plate.w, plate.h - sink, 6);
      ctx.stroke();

      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#18181B';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', plate.x + plate.w * 0.5, plate.y + plate.h * 0.5 + 4);
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
      const alpha = typeof part.life === 'number' ? Math.max(0, Math.min(1, part.life / 0.8)) : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = part.color;
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-5, -4, 10, 8);
      ctx.strokeRect(-5, -4, 10, 8);
      ctx.restore();
    }

    ctx.restore(); // End chamber clip

    // 8. Taser Shock Projectiles
    for (const proj of engine.projectiles) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = proj.isReflected ? '#10B981' : '#38BDF8';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#18181B';
      ctx.stroke();

      // Laser trail
      ctx.strokeStyle = proj.isReflected ? 'rgba(16, 185, 129, 0.55)' : 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      ctx.lineTo(proj.x - proj.vx * 0.035, proj.y - proj.vy * 0.035);
      ctx.stroke();
      ctx.restore();
    }

    // 9. Players (Y-sorted for 3/4 depth)
    const activePlayers = engine
      .getActiveParticipants()
      .slice()
      .sort((a, b) => a.y - b.y);

    for (const p of activePlayers) {
      this.drawPlayer(ctx, p, engine.crown.holderId === p.id, p.id === localSlotId, nowSec);
    }

    // 10. Free Golden Crown (if bouncing on the floor)
    if (engine.crown.holderId === null) {
      this.drawFreeCrown(ctx, engine.crown.x, engine.crown.y, nowSec);
    }

    // 11. Explosions
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

    // 12. Floating Tactical Callouts
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

    // 13. Victory Banner Overlay
    if (engine.status === 'MATCH_OVER') {
      const winner =
        engine.lastWinnerId !== null ? engine.players[engine.lastWinnerId] : null;
      ctx.save();
      ctx.fillStyle = 'rgba(24, 24, 27, 0.92)';
      this.roundRect(ctx, 210, 215, 580, 74, 12);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#F59E0B';
      ctx.stroke();

      ctx.fillStyle = '#F4F0E8';
      ctx.font = '900 20px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        winner ? `👑 ¡${winner.name} GANA LA CORONA VOLTAICA (100%)!` : '¡PARTIDA COMPLETADA!',
        500,
        250
      );

      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('REINICIANDO BATERÍAS PARA LA REVANCHA...', 500, 272);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawFreeCrown(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    nowSec: number
  ): void {
    ctx.save();
    ctx.translate(x, y);

    // Floor drop shadow
    ctx.beginPath();
    ctx.ellipse(0, 10, 18, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.28)';
    ctx.fill();

    // Radar Sonar Ping expanding rings across arena!
    const cycle = (nowSec * 1.25) % 1.0;
    const radarRadius = 26 + cycle * 75;
    const radarAlpha = Math.max(0, 0.7 * (1 - cycle));
    ctx.beginPath();
    ctx.arc(0, 0, radarRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(245, 158, 11, ${radarAlpha})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pulsing radiant halo
    const halo = 24 + Math.sin(nowSec * 14) * 4;
    ctx.beginPath();
    ctx.arc(0, 0, halo, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.fill();

    // Floating Holographic Beacon Badge above Crown
    const bob = Math.sin(nowSec * 6) * 4;
    ctx.save();
    ctx.translate(0, -34 + bob);
    ctx.font = '900 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const tag = '👑 ¡CORONA LIBRE!';
    const tw = ctx.measureText(tag).width + 12;
    ctx.fillStyle = '#FEF08A';
    this.roundRect(ctx, -tw * 0.5, -9, tw, 18, 4);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#18181B';
    this.roundRect(ctx, -tw * 0.5, -9, tw, 18, 4);
    ctx.stroke();
    ctx.fillStyle = '#18181B';
    ctx.fillText(tag, 0, 4);
    // Downward arrow pip
    ctx.beginPath();
    ctx.moveTo(-4, 9);
    ctx.lineTo(4, 9);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fillStyle = '#18181B';
    ctx.fill();
    ctx.restore();

    // Golden Crown Icon
    this.renderCrownJewel(ctx, 0, 0);

    ctx.restore();
  }

  private renderCrownJewel(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.moveTo(-14, 8);
    ctx.lineTo(-14, -6);
    ctx.lineTo(-7, 1);
    ctx.lineTo(0, -10);
    ctx.lineTo(7, 1);
    ctx.lineTo(14, -6);
    ctx.lineTo(14, 8);
    ctx.closePath();

    ctx.fillStyle = '#F59E0B';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    // Center jewel pip
    ctx.beginPath();
    ctx.arc(0, 2, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    ctx.restore();
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    p: VoltCrownPlayer,
    isKing: boolean,
    isLocal: boolean,
    nowSec: number
  ): void {
    ctx.save();
    ctx.translate(p.x, p.y);

    // King aura & aim trajectory
    if (isKing) {
      const pulse = 30 + Math.sin(nowSec * 16) * 4;
      ctx.beginPath();
      ctx.arc(0, 2, pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#F59E0B';
      ctx.stroke();
    } else if (isLocal) {
      // Hunter aiming laser guide
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(Math.cos(p.aimAngle) * 22, Math.sin(p.aimAngle) * 22);
      ctx.lineTo(Math.cos(p.aimAngle) * 110, Math.sin(p.aimAngle) * 110);
      ctx.stroke();
      ctx.restore();
    }

    // Ground shadow
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
    ctx.fillStyle = p.bodyColor;
    this.roundRect(ctx, -16, -18, 32, 24, 8);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#18181B';
    ctx.stroke();

    // Directional Visor Eye
    const vx = Math.cos(p.aimAngle) * 6;
    const vy = Math.sin(p.aimAngle) * 4 - 8;
    ctx.fillStyle = '#18181B';
    this.roundRect(ctx, vx - 8, vy - 4, 16, 8, 3);
    ctx.fill();

    ctx.fillStyle = isKing ? '#F59E0B' : '#38BDF8';
    ctx.beginPath();
    ctx.arc(vx + Math.cos(p.aimAngle) * 2, vy, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Crown mounted above King's head
    if (isKing) {
      this.renderCrownJewel(ctx, 0, -28);
    }

    // Deflect Parry Shield
    if (p.shieldTimer > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -3, p.radius + 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.26)';
      ctx.fill();
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = '#D97706';
      ctx.stroke();
      ctx.restore();
    }

    // Stun sparks
    if (p.stunTimer > 0) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -26, 10, nowSec * 10, nowSec * 10 + Math.PI * 1.4);
      ctx.stroke();
    }

    // Hazard grace period immunity field
    if (p.trapImmunityTimer && p.trapImmunityTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 6, nowSec * 4, nowSec * 4 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Battery / Score bar above head
    const barW = 38;
    const barH = 5;
    const barY = isKing ? -42 : -28;
    ctx.fillStyle = 'rgba(24, 24, 27, 0.7)';
    ctx.fillRect(-barW * 0.5, barY, barW, barH);
    ctx.fillStyle = isKing ? '#F59E0B' : '#10B981';
    ctx.fillRect(-barW * 0.5, barY, barW * (Math.min(100, p.score) / 100), barH);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#18181B';
    ctx.strokeRect(-barW * 0.5, barY, barW, barH);

    // Player Name & Score Badge below chassis
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const label = `${p.name} ⚡${Math.floor(p.score)}%`;
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
