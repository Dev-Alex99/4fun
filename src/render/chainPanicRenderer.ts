import { robotWorkshop } from '../game/robotWorkshop';
import { CanvasViewportRenderer } from './canvasViewport';
import { COURT_HEIGHT, COURT_WIDTH } from '../game/arenaEngine';
import { ChainPanicEngine } from '../game/chainPanicEngine';
import { ChainPlayerState, PlatformRect } from '../types';

export class ChainPanicRenderer extends CanvasViewportRenderer {
  constructor(canvas: HTMLCanvasElement) {
    super(canvas, COURT_WIDTH, COURT_HEIGHT);
  }

  public render(engine: ChainPanicEngine, localSlotId: number): void {
    this.syncViewport();
    const ctx = this.ctx;
    const w = this.viewportWidth;
    const h = this.viewportHeight;

    // Abyss Pit Background
    ctx.fillStyle = '#27272A';
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

    // Subtle Abyss Grid
    ctx.strokeStyle = 'rgba(244, 240, 232, 0.05)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= COURT_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, COURT_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= COURT_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(COURT_WIDTH, y);
      ctx.stroke();
    }

    const def = engine.getCurrentLevelDef();

    // 1. Draw Main Platforms
    def.platforms.forEach((plat) => {
      this.drawPlatform34(plat, '#F4F0E8', '#BDB6A7');
    });

    // 2. Draw Fragile Crumbling Tiles (Sector 02 & 06)
    engine.fragileTiles.forEach((ft) => {
      if (ft.state === 'FALLEN') {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.32)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(ft.x + 2, ft.y + 2, ft.w - 4, ft.h - 4);
        ctx.restore();
      } else {
        const shakeX = ft.state === 'CRACKING' && !this.reducedMotion ? (Math.random() - 0.5) * 5 : 0;
        const shakeY = ft.state === 'CRACKING' && !this.reducedMotion ? (Math.random() - 0.5) * 5 : 0;
        this.drawPlatform34(
          { x: ft.x + shakeX, y: ft.y + shakeY, w: ft.w, h: ft.h },
          ft.state === 'CRACKING' ? '#FDBA74' : '#FED7AA',
          '#EA580C'
        );
        // Crack lines if cracking
        if (ft.state === 'CRACKING') {
          ctx.beginPath();
          ctx.moveTo(ft.x + 12, ft.y + 18);
          ctx.lineTo(ft.x + ft.w * 0.5, ft.y + ft.h * 0.5);
          ctx.lineTo(ft.x + ft.w - 10, ft.y + ft.h - 22);
          ctx.strokeStyle = '#18181B';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }
    });

    // 3. Draw Retractable Bridge
    if (engine.doorOpen) {
      this.drawPlatform34(def.bridgeRect, '#D9F99D', '#84CC16');
    } else {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(
        def.bridgeRect.x + 4,
        def.bridgeRect.y + 4,
        def.bridgeRect.w - 8,
        def.bridgeRect.h - 8
      );
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#F59E0B';
      ctx.textAlign = 'center';
      ctx.fillText(
        'PUENTE BLOQUEADO',
        def.bridgeRect.x + def.bridgeRect.w / 2,
        def.bridgeRect.y + def.bridgeRect.h / 2 - 4
      );
      ctx.fillText(
        `(${engine.switches.filter((s) => s.pressed).length}/${engine.switches.length} BOTONES)`,
        def.bridgeRect.x + def.bridgeRect.w / 2,
        def.bridgeRect.y + def.bridgeRect.h / 2 + 12
      );
      ctx.restore();
    }

    // 4. Draw Extraction Goal Platform
    this.drawPlatform34(def.goalRect, '#FEF08A', '#EAB308');
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#18181B';
    ctx.textAlign = 'center';
    ctx.fillText(
      engine.battery && !engine.battery.delivered
        ? '🏁 TRAER BATERÍA + 4 ROBOTS'
        : '🏁 EXTRACCIÓN (4/4)',
      def.goalRect.x + def.goalRect.w / 2,
      def.goalRect.y + def.goalRect.h / 2 + 4
    );

    // 5. Draw Pressure Switches
    engine.switches.forEach((sw) => {
      ctx.beginPath();
      ctx.moveTo(sw.x, sw.y);
      ctx.lineTo(def.bridgeRect.x, def.bridgeRect.y + def.bridgeRect.h / 2);
      ctx.strokeStyle = sw.pressed ? '#15803D' : 'rgba(24, 24, 27, 0.25)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sw.x, sw.y + 3, sw.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#18181B';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sw.x, sw.y - (sw.pressed ? 0 : 3), sw.radius, 0, Math.PI * 2);
      ctx.fillStyle = sw.pressed ? '#22C55E' : '#F59E0B';
      ctx.fill();
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#18181B';
      ctx.textAlign = 'center';
      ctx.fillText(sw.pressed ? 'OK' : 'PISAR', sw.x, sw.y + 3);
    });

    const activePlayers = engine.getActivePlayers();

    // 6. Draw Elastic Steel Cable Linking Active Players
    for (let i = 0; i < activePlayers.length - 1; i++) {
      const a = activePlayers[i];
      const b = activePlayers[i + 1];
      const ax = a.x;
      const ay = a.y - a.z * 0.7 - 6;
      const bx = b.x;
      const by = b.y - b.z * 0.7 - 6;

      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const tension = Math.min(1, Math.max(0, (dist - 70) / 42));
      const sag = Math.max(0, (1 - tension) * 22);

      const midX = (ax + bx) / 2;
      const midY = (ay + by) / 2 + sag;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y + 8);
      ctx.quadraticCurveTo(midX, (a.y + b.y) / 2 + 8 + sag * 0.5, b.x, b.y + 8);
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.22)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(midX, midY, bx, by);
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 6.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(midX, midY, bx, by);
      ctx.strokeStyle = tension > 0.75 ? '#FF4F00' : '#D4D4D8';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 7. Draw Linear & 360° Rotary Laser Beams
    engine.lasers.forEach((l) => {
      [l.y1, l.y2].forEach((py) => {
        ctx.fillStyle = '#18181B';
        ctx.fillRect(l.x1 - 7, py - 7, 14, 14);
        ctx.fillStyle = '#FF4F00';
        ctx.fillRect(l.x1 - 4, py - 4, 8, 8);
      });

      const beamOffset = l.zHeight * 0.65;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1 - beamOffset);
      ctx.lineTo(l.x2, l.y2 - beamOffset);
      ctx.strokeStyle = '#FF4F00';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1 - beamOffset);
      ctx.lineTo(l.x2, l.y2 - beamOffset);
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    engine.rotaryLasers.forEach((rl) => {
      const lx = rl.cx + Math.cos(rl.angle) * rl.length;
      const ly = rl.cy + Math.sin(rl.angle) * rl.length;
      const beamOffset = rl.zHeight * 0.65;

      // Central Turret Pylon
      ctx.beginPath();
      ctx.arc(rl.cx, rl.cy, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#18181B';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rl.cx, rl.cy - 4, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#FF4F00';
      ctx.fill();
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Rotating Beam
      ctx.beginPath();
      ctx.moveTo(rl.cx, rl.cy - beamOffset);
      ctx.lineTo(lx, ly - beamOffset);
      ctx.strokeStyle = '#FF4F00';
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rl.cx, rl.cy - beamOffset);
      ctx.lineTo(lx, ly - beamOffset);
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    });

    // 8. Draw Heavy Battery CORE-99 if active
    if (engine.battery) {
      const bat = engine.battery;
      ctx.save();
      ctx.translate(bat.x, bat.y);

      ctx.beginPath();
      ctx.ellipse(0, 12, 22, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(24, 24, 27, 0.25)';
      ctx.fill();

      // 3/4 Battery Cylinder
      ctx.fillStyle = bat.delivered ? '#22C55E' : '#F59E0B';
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-18, -22, 36, 32, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#18181B';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CORE-99', 0, -3);
      ctx.restore();
    }

    // 9. Depth-Sorted 3/4 Chained Robots
    const sortedPlayers = [...activePlayers].sort((a, b) => a.y - b.y);
    sortedPlayers.forEach((p) => {
      this.drawChainedBot34(p, p.id === localSlotId);
    });

    // 10. Wind Gust Visual Streaks (Sector 04)
    if (engine.windActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 79, 0, 0.55)';
      ctx.lineWidth = 3;
      const t = performance.now() * 0.4;
      for (let i = 0; i < 8; i++) {
        const wx = 180 + i * 75;
        const wy = ((t + i * 90) % 340) + 80;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx, wy + 45);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 11. Particles & Rings
    engine.particles.forEach((pt) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life);
      if (pt.type === 'ring') {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
        ctx.fillStyle = '#F4F0E8';
        ctx.fill();
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    });

    // 12. Top Sector Title & Subtitle Banner
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#F4F0E8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(COURT_WIDTH / 2 - 235, 10, 470, 44, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F59E0B';
    ctx.textAlign = 'center';
    ctx.fillText(def.title, COURT_WIDTH / 2, 27);

    ctx.font = '700 11px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#F4F0E8';
    ctx.fillText(def.subtitle, COURT_WIDTH / 2, 44);

    // 13. Callouts
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

  private drawPlatform34(plat: PlatformRect, topColor: string, sideColor: string): void {
    const ctx = this.ctx;

    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.roundRect(plat.x, plat.y + 14, plat.w, plat.h, 8);
    ctx.fill();

    ctx.fillStyle = sideColor;
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(plat.x, plat.y + 8, plat.w, plat.h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.roundRect(plat.x, plat.y, plat.w, plat.h, 8);
    ctx.fill();
    ctx.stroke();

    if (plat.conveyorVx || plat.conveyorVy) {
      ctx.save();
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.18)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(plat.x + 10, plat.y + 10, plat.w - 20, plat.h - 20);
      ctx.setLineDash([]);
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(24, 24, 27, 0.45)';
      ctx.textAlign = 'center';
      const dirArrow = plat.conveyorVy
        ? plat.conveyorVy > 0
          ? '▼ CINTA EMPUJE ▼'
          : '▲ CINTA EMPUJE ▲'
        : '◄ CINTA EMPUJE ◄';
      ctx.fillText(dirArrow, plat.x + plat.w / 2, plat.y + plat.h / 2 + 4);
      ctx.restore();
    }
  }

  private drawChainedBot34(p: ChainPlayerState, isLocal: boolean): void {
    const ctx = this.ctx;
    const bobY = Math.abs(Math.sin(p.walkCycle)) * 4;
    const drawY = p.y - p.z * 0.75 + (p.isDangling ? Math.sin(performance.now() * 0.03) * 3 : 0);

    ctx.save();
    this.applyGhostPulse();
    const cosmetics = robotWorkshop.resolveCosmetics(p.cosmetics, isLocal);
    const skinColors = robotWorkshop.getSkinColors(cosmetics.skin, p.bodyColor, p.shadeColor);
    ctx.translate(p.x, drawY);

    if (!p.isDangling) {
      const shadowScale = Math.max(0.45, 1 - p.z * 0.012);
      ctx.beginPath();
      ctx.ellipse(
        0,
        13 + p.z * 0.75,
        p.radius * shadowScale,
        p.radius * 0.52 * shadowScale,
        0,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = 'rgba(24, 24, 27, 0.24)';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 9, 0, Math.PI * 2);
      ctx.strokeStyle = '#FF4F00';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (p.isAnchored) {
      ctx.fillStyle = '#18181B';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-20, 2, 40, 12, 4);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.roundRect(-10, 5, 7, 8, 3);
    ctx.roundRect(3, 5, 7, 8, 3);
    ctx.fill();

    ctx.save();
    ctx.translate(0, -bobY);

    ctx.fillStyle = skinColors.shade;
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-15, -14, 30, 24, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = skinColors.body;
    ctx.beginPath();
    ctx.roundRect(-15, -20, 30, 22, 8);
    ctx.fill();
    ctx.stroke();

    robotWorkshop.drawSkinStripes(ctx, cosmetics.skin, -15, -20, 30, 22, 8);

    ctx.fillStyle = '#D4D4D8';
    ctx.beginPath();
    ctx.arc(0, -21, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.roundRect(-11, -14, 22, 11, 4);
    ctx.fill();

    if (p.isDangling) {
      ctx.strokeStyle = '#FF4F00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-4.5, -8.5, 2.8, 0, Math.PI * 2);
      ctx.arc(4.5, -8.5, 2.8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.isAnchored) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -11);
      ctx.lineTo(-3, -8.5);
      ctx.lineTo(-6, -6);
      ctx.moveTo(6, -11);
      ctx.lineTo(3, -8.5);
      ctx.lineTo(6, -6);
      ctx.stroke();
    } else {
      ctx.fillStyle = robotWorkshop.getVisorColor(cosmetics.visor);
      ctx.beginPath();
      ctx.arc(-4.5, -8.5, 2.2, 0, Math.PI * 2);
      ctx.arc(4.5, -8.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    robotWorkshop.drawHat(ctx, cosmetics.hat, 0, -20, performance.now() * 0.001);

    ctx.restore();

    if (p.emoteText && p.emoteTimer > 0) {
      ctx.font = '800 11px "JetBrains Mono", monospace';
      const w = ctx.measureText(p.emoteText).width + 12;
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -52, w, 20, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#18181B';
      ctx.textAlign = 'center';
      ctx.fillText(p.emoteText, 0, -38);
    } else {
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#F4F0E8';
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 3;
      const label =
        isLocal && p.isSaboteur
          ? `🕵️ ${p.name} [TRAIDOR]`
          : isLocal
          ? `★ ${p.name}`
          : p.name;
      ctx.strokeText(label, 0, -32);
      ctx.fillText(label, 0, -32);
    }

    ctx.restore();
  }
}
