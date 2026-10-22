import { CanvasViewportRenderer } from './canvasViewport';
import {
  ArenaEngine,
  COURT_CENTER_X,
  COURT_CENTER_Y,
  COURT_HEIGHT,
  COURT_RX,
  COURT_RY,
  COURT_WIDTH
} from '../game/arenaEngine';
import { GyroBallState, PinballBumper, PlayerState } from '../types';
import { robotWorkshop } from '../game/robotWorkshop';

export class CourtRenderer extends CanvasViewportRenderer {
  constructor(canvas: HTMLCanvasElement) {
    super(canvas, COURT_WIDTH, COURT_HEIGHT);
  }

  public render(engine: ArenaEngine, localSlotId: number): void {
    this.syncViewport();
    const ctx = this.ctx;
    const w = this.viewportWidth;
    const h = this.viewportHeight;

    // Outer worktable mat
    ctx.fillStyle = '#D6CFC2';
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

    // 1. Corner Industrial Screw Heads
    const screws = [
      [34, 34],
      [COURT_WIDTH - 34, 34],
      [34, COURT_HEIGHT - 34],
      [COURT_WIDTH - 34, COURT_HEIGHT - 34]
    ];
    screws.forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#B8B1A3';
      ctx.fill();
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy - 4);
      ctx.lineTo(sx + 4, sy + 4);
      ctx.stroke();
    });

    // 2. 3/4 Perspective Recessed Arena Dish
    ctx.beginPath();
    ctx.ellipse(COURT_CENTER_X, COURT_CENTER_Y + 12, COURT_RX + 10, COURT_RY + 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#18181B';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(COURT_CENTER_X, COURT_CENTER_Y, COURT_RX + 8, COURT_RY + 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#BDB6A7';
    ctx.fill();
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Main Playable Cream Surface
    ctx.beginPath();
    ctx.ellipse(COURT_CENTER_X, COURT_CENTER_Y, COURT_RX, COURT_RY, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#F4F0E8';
    ctx.fill();
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Printed Technical Court Markings
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(COURT_CENTER_X, COURT_CENTER_Y, COURT_RX, COURT_RY, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(24, 24, 27, 0.12)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(COURT_CENTER_X - COURT_RX, COURT_CENTER_Y);
    ctx.lineTo(COURT_CENTER_X + COURT_RX, COURT_CENTER_Y);
    ctx.moveTo(COURT_CENTER_X, COURT_CENTER_Y - COURT_RY);
    ctx.lineTo(COURT_CENTER_X, COURT_CENTER_Y + COURT_RY);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(COURT_CENTER_X, COURT_CENTER_Y, 68, 38, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(24, 24, 27, 0.28)';
    ctx.textAlign = 'center';
    const layoutTag =
      engine.courtLayout === 'PINBALL'
        ? 'MESA 01 // PINBALL BUMPERS'
        : engine.courtLayout === 'CORE'
        ? 'MESA 03 // NÚCLEO CENTRAL'
        : 'MESA 02 // CLÁSICA';
    ctx.fillText(`TP-04 // ${layoutTag}`, COURT_CENTER_X, COURT_CENTER_Y + 62);

    const botsActive = engine.botDifficulty !== 'OFF';

    // Target Dotted Guide Lines on Floor for each Ball
    engine.balls.forEach((ball) => {
      const tgt = engine.players[ball.targetId];
      if (tgt?.alive && (!tgt.isBot || botsActive)) {
        ctx.beginPath();
        ctx.setLineDash([7, 7]);
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = ball.isFeint ? 'rgba(27, 77, 255, 0.55)' : 'rgba(255, 79, 0, 0.45)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Loose nuts & bolts from KOs
    engine.looseParts.forEach((part) => {
      ctx.save();
      ctx.translate(part.x, part.y);
      ctx.rotate(part.rot);
      ctx.fillStyle = part.color;
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-5, -3.5, 10, 7);
      ctx.strokeRect(-5, -3.5, 10, 7);
      ctx.restore();
    });

    ctx.restore(); // End court clip

    // 3. Y-Depth Sorted 3/4 Entities (Players, Pinball Bumpers, Balls)
    const renderables: Array<{
      type: 'player' | 'ball' | 'bumper';
      y: number;
      player?: PlayerState;
      ball?: GyroBallState;
      bumper?: PinballBumper;
    }> = [];

    engine.players.forEach((p) => {
      if (p.alive && (!p.isBot || botsActive)) {
        renderables.push({ type: 'player', y: p.y, player: p });
      }
    });
    engine.bumpers.forEach((b) => {
      renderables.push({ type: 'bumper', y: b.y, bumper: b });
    });
    engine.balls.forEach((b) => {
      renderables.push({ type: 'ball', y: b.y, ball: b });
    });

    renderables.sort((a, b) => a.y - b.y);

    renderables.forEach((item) => {
      if (item.type === 'player' && item.player) {
        this.drawBot34(item.player, engine, item.player.id === localSlotId);
      } else if (item.type === 'bumper' && item.bumper) {
        this.drawPinballBumper34(item.bumper);
      } else if (item.type === 'ball' && item.ball) {
        this.drawGyroBall34(item.ball);
      }
    });

    // 4. Particles
    engine.particles.forEach((pt) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life);
      if (pt.type === 'ring') {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 2.8;
        ctx.stroke();
      } else if (pt.type === 'dust') {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
        ctx.fillStyle = '#F4F0E8';
        ctx.fill();
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 1.6;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        ctx.strokeRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.restore();
    });

    // 5. Stamp Callouts
    engine.callouts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = '800 12px "JetBrains Mono", monospace';
      const textW = ctx.measureText(ft.text).width + 14;
      ctx.fillStyle = ft.bgColor;
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(ft.x - textW / 2, ft.y - 11, textW, 22, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ft.textColor;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y + 4);
      ctx.restore();
    });

    ctx.restore();
  }

  private drawPinballBumper34(b: PinballBumper): void {
    const ctx = this.ctx;
    const popScale = 1 + b.hitAnim * 0.22;
    const r = b.radius * popScale;

    ctx.save();
    ctx.translate(b.x, b.y);

    // Base shadow
    ctx.beginPath();
    ctx.ellipse(0, 8, r * 1.05, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.22)';
    ctx.fill();

    // Lower cylinder body
    ctx.beginPath();
    ctx.arc(0, 3, r, 0, Math.PI * 2);
    ctx.fillStyle = '#18181B';
    ctx.fill();

    // Upper bumper cap
    ctx.beginPath();
    ctx.arc(0, -4, r, 0, Math.PI * 2);
    ctx.fillStyle = b.hitAnim > 0.1 ? '#FF4F00' : '#F59E0B';
    ctx.fill();
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Inner bolt ring
    ctx.beginPath();
    ctx.arc(0, -4, r * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = '#F4F0E8';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawGyroBall34(ball: GyroBallState): void {
    const ctx = this.ctx;

    // Floor shadow
    ctx.beginPath();
    ctx.ellipse(ball.x, ball.y + 9, ball.radius * 0.95, ball.radius * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.22)';
    ctx.fill();

    // Motion trail
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const ratio = (i + 1) / ball.trail.length;
      ctx.beginPath();
      ctx.arc(t.x, t.y - t.z * 0.5, ball.radius * ratio * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = ball.isFeint
        ? 'rgba(27, 77, 255, 0.28)'
        : i % 2 === 0
        ? 'rgba(255, 79, 0, 0.30)'
        : 'rgba(24, 24, 27, 0.16)';
      ctx.fill();
    }

    // Physical Gyro Ball
    const drawY = ball.y - ball.z * 0.55;
    ctx.save();
    ctx.translate(ball.x, drawY);
    ctx.rotate(ball.rotation);

    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.isFeint ? '#1B4DFF' : ball.accentColor;
    ctx.fill();
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-ball.radius + 1, 0);
    ctx.lineTo(ball.radius - 1, 0);
    ctx.strokeStyle = '#F4F0E8';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    ctx.restore();
  }

  private drawBot34(p: PlayerState, engine: ArenaEngine, isLocal: boolean): void {
    const ctx = this.ctx;
    const isTargeted = engine.balls.some((b) => b.targetId === p.id);
    const fastThreat = engine.balls.some((b) => b.targetId === p.id && b.speed > 350);

    const bobY = Math.abs(Math.sin(p.walkCycle)) * 4.5;
    const footLeftY = Math.sin(p.walkCycle) * 4.5;
    const footRightY = -Math.sin(p.walkCycle) * 4.5;

    ctx.save();
    this.applyGhostPulse();
    ctx.translate(p.x, p.y);

    // 1. Target Lock Floor Ring
    if (isTargeted) {
      const pulse = 1 + Math.sin(performance.now() * 0.022) * 0.08;
      ctx.save();
      ctx.scale(pulse, pulse * 0.68);
      ctx.beginPath();
      ctx.arc(0, 9, p.radius + 14, 0, Math.PI * 2);
      ctx.strokeStyle = '#FF4F00';
      ctx.lineWidth = 3.2;
      ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.restore();
    }

    // Feint Primed Ring (Blue/Gold coil around feet when Amago is charged!)
    if (p.feintPrimed) {
      ctx.save();
      ctx.scale(1, 0.65);
      ctx.beginPath();
      ctx.arc(0, 8, p.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#1B4DFF';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Contact Shadow
    ctx.beginPath();
    ctx.ellipse(0, 14, p.radius * 0.98, p.radius * 0.54, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.22)';
    ctx.fill();

    // 3. Stubby Mechanical Feet
    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.roundRect(-11, 5 + footLeftY, 8, 9, 3);
    ctx.roundRect(3, 5 + footRightY, 8, 9, 3);
    ctx.fill();

    // 4. Parry Swing Smear Arc
    if (p.parryTimer > 0) {
      const swingReach = (p.radius + 23) * p.parryRadiusMult;
      ctx.save();
      ctx.rotate(p.aimAngle);
      ctx.beginPath();
      ctx.arc(0, 0, swingReach, -1.15, 1.15);
      ctx.strokeStyle = p.feintPrimed ? '#1B4DFF' : '#FF4F00';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, swingReach - 6, -0.95, 0.95);
      ctx.strokeStyle = '#F4F0E8';
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.restore();
    }

    // 5. 3/4 Robot Chassis
    ctx.save();
    ctx.translate(0, -bobY);
    ctx.rotate(p.tiltX);

    const cosmetics = robotWorkshop.resolveCosmetics(p.cosmetics, isLocal);
    const skinColors = robotWorkshop.getSkinColors(cosmetics?.skin, p.bodyColor, p.shadeColor);

    // Lower shade bevel
    ctx.fillStyle = skinColors.shade;
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-16, -15, 32, 26, 9);
    ctx.fill();
    ctx.stroke();

    // Upper matte shell
    ctx.fillStyle = skinColors.body;
    ctx.beginPath();
    ctx.roundRect(-16, -21, 32, 24, 9);
    ctx.fill();
    ctx.stroke();

    // Hazard stripes if WARNING skin
    if (cosmetics?.skin === 'WARNING') {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-16, -21, 32, 24, 9);
      ctx.clip();
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 3.5;
      for (let x = -26; x < 26; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, -24);
        ctx.lineTo(x + 9, 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Antenna with inertia (only if not wearing an obstructing hat)
    if (!cosmetics?.hat || cosmetics.hat === 'NONE') {
      const antTipX = -p.vx * 0.025;
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.lineTo(antTipX, -30);
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(antTipX, -31, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.feintPrimed ? '#1B4DFF' : isTargeted ? '#FF4F00' : '#F4F0E8';
      ctx.fill();
      ctx.stroke();
    }

    // Dark Glass Visor
    const lookX = Math.cos(p.aimAngle) * 3.5;
    const lookY = Math.sin(p.aimAngle) * 2.2;
    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.roundRect(-12 + lookX * 0.4, -15 + lookY * 0.3, 24, 12, 4);
    ctx.fill();

    // Expressive LED Eyes
    const visorColor = robotWorkshop.getVisorColor(cosmetics?.visor);
    ctx.fillStyle = visorColor;
    if (p.parryTimer > 0) {
      ctx.strokeStyle = visorColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-6.5, -12);
      ctx.lineTo(-3, -9);
      ctx.lineTo(-6.5, -6);
      ctx.moveTo(6.5, -12);
      ctx.lineTo(3, -9);
      ctx.lineTo(6.5, -6);
      ctx.stroke();
    } else if (fastThreat) {
      ctx.strokeStyle = '#FF4F00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-5 + lookX * 0.5, -9 + lookY * 0.3, 3, 0, Math.PI * 2);
      ctx.arc(5 + lookX * 0.5, -9 + lookY * 0.3, 3, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-5 + lookX * 0.6, -9 + lookY * 0.4, 2.4, 0, Math.PI * 2);
      ctx.arc(5 + lookX * 0.6, -9 + lookY * 0.4, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Equipped Hat on Top
    if (cosmetics?.hat && cosmetics.hat !== 'NONE') {
      robotWorkshop.drawHat(ctx, cosmetics.hat, 0, -21, performance.now() * 0.001);
    }

    // 6. Physical Bat Paddle
    const swingProgress = p.parryTimer > 0 ? p.parryTimer / 0.24 : 0;
    const batAngle = p.aimAngle + p.batSwingDir * (0.78 - swingProgress * 1.65);
    ctx.save();
    ctx.rotate(batAngle);
    ctx.fillStyle = '#18181B';
    ctx.fillRect(13, -2.5, 6, 5);

    const bladeLen = 17 * p.parryRadiusMult;
    ctx.fillStyle = p.feintPrimed ? '#1B4DFF' : p.batColor;
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(17, -5, bladeLen, 10, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // End chassis

    // 7. Player Name Tag OR Active Horn Emote Bubble above Head
    if (p.emoteText && p.emoteTimer > 0) {
      ctx.font = '800 12px "JetBrains Mono", monospace';
      const w = ctx.measureText(p.emoteText).width + 14;
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -58, w, 22, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#18181B';
      ctx.textAlign = 'center';
      ctx.fillText(p.emoteText, 0, -43);
    } else {
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#18181B';
      ctx.fillText(isLocal ? `★ ${p.name}` : p.name, 0, -37);
    }

    ctx.restore();
  }
}
