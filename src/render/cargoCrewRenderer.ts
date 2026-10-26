import { CanvasViewportRenderer } from './canvasViewport';
import { CargoCrewEngine } from '../game/cargoCrewEngine';
import { robotWorkshop } from '../game/robotWorkshop';

export class CargoCrewRenderer extends CanvasViewportRenderer {
  constructor(canvas: HTMLCanvasElement) { super(canvas, 1000, 520, 24, 44); }

  public render(engine: CargoCrewEngine, localSlot: number, touch = false): void {
    this.syncViewport();
    const ctx = this.ctx;
    ctx.fillStyle = '#D6CFC2'; ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    ctx.save(); ctx.translate(this.offsetX, this.offsetY); ctx.scale(this.scale, this.scale);
    if (engine.screenShake > 0) ctx.translate((Math.random() - 0.5) * this.shakeAmount(engine.screenShake), (Math.random() - 0.5) * this.shakeAmount(engine.screenShake));
    ctx.fillStyle = '#18181b'; ctx.fillRect(68, 55, 864, 412);
    ctx.fillStyle = '#f4f0e8'; ctx.fillRect(80, 64, 840, 392);
    ctx.strokeStyle = '#d6d3d1'; ctx.lineWidth = 1;
    for (let x = 100; x < 920; x += 40) { ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x, 456); ctx.stroke(); }
    for (let y = 80; y < 456; y += 40) { ctx.beginPath(); ctx.moveTo(80, y); ctx.lineTo(920, y); ctx.stroke(); }
    ctx.fillStyle = '#52525b'; ctx.font = '800 13px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`CARGO-CREW // ${engine.definition.title}`, 90, 43);
    ctx.font = '700 11px monospace'; ctx.fillText(engine.definition.hint, 90, 491);

    for (const pit of engine.definition.pits) {
      ctx.fillStyle = '#27272a'; ctx.fillRect(pit.x, pit.y, pit.w, pit.h);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 4; ctx.strokeRect(pit.x, pit.y, pit.w, pit.h);
      ctx.fillStyle = '#71717a'; ctx.font = '900 12px monospace'; ctx.fillText('VACÍO', pit.x + 20, pit.y + pit.h / 2);
    }
    for (const belt of engine.definition.conveyors) {
      ctx.fillStyle = '#334155'; ctx.fillRect(belt.x, belt.y, belt.w, belt.h);
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.strokeRect(belt.x, belt.y, belt.w, belt.h);
      ctx.fillStyle = '#fef08a'; ctx.font = '900 22px monospace'; ctx.textAlign = 'center';
      const symbol = belt.conveyorVx ? '→' : (belt.conveyorVy ?? 0) > 0 ? '↓' : '↑';
      for (let i = 0; i < 3; i++) ctx.fillText(symbol, belt.x + belt.w * (i + 0.5) / 3, belt.y + belt.h / 2 + Math.sin(engine.simulationTime * 4) * 4);
    }
    for (const barrier of engine.definition.barriers) {
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(barrier.x, barrier.y, barrier.w, barrier.h);
      ctx.strokeStyle = '#18181b'; ctx.lineWidth = 3; ctx.strokeRect(barrier.x, barrier.y, barrier.w, barrier.h);
    }
    ctx.fillStyle = engine.checkpoint ? '#bbf7d0' : '#e7e5e4';
    ctx.fillRect(510, 235, 45, 50); ctx.strokeStyle = '#15803d'; ctx.strokeRect(510, 235, 45, 50);
    ctx.fillStyle = '#15803d'; ctx.font = '800 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('CP', 532, 263);
    ctx.fillStyle = engine.gateOpen ? '#dcfce7' : '#fee2e2'; ctx.fillRect(825, 185, 85, 150);
    ctx.strokeStyle = engine.gateOpen ? '#15803d' : '#b91c1c'; ctx.lineWidth = 3; ctx.strokeRect(825, 185, 85, 150);
    ctx.fillStyle = engine.gateOpen ? '#15803d' : '#b91c1c'; ctx.font = '900 12px monospace'; ctx.fillText('REACTOR', 868, 247); ctx.fillText(engine.gateOpen ? 'ENTREGA →' : 'BLOQUEADO', 868, 270);
    if (!engine.gateOpen) { ctx.fillStyle = '#ef4444'; ctx.fillRect(795, 64, 16, 392); }
    for (const sw of engine.switches) {
      ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.fillStyle = sw.pressed ? '#22c55e' : '#facc15'; ctx.fill(); ctx.strokeStyle = '#18181b'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#18181b'; ctx.font = '900 14px monospace'; ctx.fillText(sw.pressed ? '✓' : String(sw.id + 1), sw.x, sw.y + 5);
    }
    const crane = engine.definition.crane;
    if (crane) {
      ctx.fillStyle = '#64748b'; ctx.fillRect(crane.x - 20, 74, crane.w + 40, 12);
      ctx.strokeStyle = '#18181b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(crane.x + crane.w / 2, 86);
      ctx.lineTo(crane.x + crane.w / 2, engine.craneActive ? crane.y : 115); ctx.stroke();
      ctx.fillStyle = engine.craneActive ? 'rgba(239,68,68,0.75)' : engine.craneWarning ? 'rgba(245,158,11,0.55)' : 'rgba(100,116,139,0.12)';
      ctx.fillRect(crane.x, crane.y, crane.w, crane.h);
      ctx.strokeStyle = engine.craneActive ? '#b91c1c' : '#f59e0b'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.strokeRect(crane.x, crane.y, crane.w, crane.h); ctx.setLineDash([]);
      ctx.fillStyle = engine.craneActive ? '#dc2626' : '#f59e0b'; ctx.font = '900 12px monospace';
      ctx.fillText(engine.craneActive ? '¡ABAJO!' : engine.craneWarning ? '¡AVISO!' : 'GRÚA', crane.x + crane.w / 2, crane.y - 10);
    }
    const battery = engine.battery;
    const local = engine.players[localSlot];
    const canGrab = engine.status === 'PLAYING' && !local.gripping && Math.hypot(local.x - battery.x, local.y - battery.y) <= 86;
    if (canGrab) {
      ctx.beginPath(); ctx.arc(battery.x, battery.y, 38, 0, Math.PI * 2); ctx.strokeStyle = '#15803d'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#14532d'; ctx.fillRect(battery.x - 66, battery.y - 64, 132, 22);
      ctx.fillStyle = '#fff'; ctx.font = '800 12px monospace'; ctx.textAlign = 'center'; ctx.fillText(`${touch ? 'A' : 'ESPACIO'} · ENGANCHAR`, battery.x, battery.y - 49);
    }
    for (const p of engine.getActivePlayers()) if (p.gripping) {
      ctx.strokeStyle = p.isAnchored ? '#15803d' : '#334155'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(battery.x, battery.y); ctx.stroke();
    }
    ctx.save(); ctx.translate(battery.x, battery.y);
    ctx.fillStyle = 'rgba(24,24,27,0.2)'; ctx.beginPath(); ctx.ellipse(2, 17, 33, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#92400e'; ctx.fillRect(-25, -17, 50, 40);
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(-25, -25, 50, 38); ctx.strokeStyle = '#18181b'; ctx.lineWidth = 3; ctx.strokeRect(-25, -25, 50, 38);
    ctx.fillStyle = engine.integrity > 35 ? '#15803d' : '#dc2626'; ctx.fillRect(-17, -18, 34 * engine.integrity / 100, 6);
    ctx.fillStyle = '#18181b'; ctx.font = '900 22px monospace'; ctx.fillText('⚡', 0, 9); ctx.restore();

    for (const p of engine.getActivePlayers().slice().sort((a, b) => a.y - b.y)) {
      const cosmetics = robotWorkshop.resolveCosmetics(p.cosmetics, p.id === localSlot);
      const color = robotWorkshop.getSkinColors(cosmetics.skin, p.bodyColor, p.shadeColor);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(24,24,27,0.2)'; ctx.beginPath(); ctx.ellipse(0, 10, 23, 11, 0, 0, Math.PI * 2); ctx.fill();
      if (p.id === localSlot) { ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.fillStyle = color.shade; ctx.fillRect(-15, 0, 11, 14 + Math.sin(p.walkCycle) * 3); ctx.fillRect(4, 0, 11, 14 - Math.sin(p.walkCycle) * 3);
      ctx.fillStyle = color.body; ctx.beginPath(); ctx.roundRect(-18, -24, 36, 30, 7); ctx.fill(); ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2.5; ctx.stroke();
      robotWorkshop.drawSkinStripes(ctx, cosmetics.skin, -18, -24, 36, 30, 7);
      ctx.fillStyle = '#18181b'; ctx.fillRect(-13, -19, 26, 10); ctx.fillStyle = robotWorkshop.getVisorColor(cosmetics.visor); ctx.fillRect(-10, -16, 20, 4);
      robotWorkshop.drawHat(ctx, cosmetics.hat, 0, -25, engine.simulationTime);
      ctx.fillStyle = '#18181b'; ctx.font = '800 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(p.name + (p.id === localSlot ? ' · TÚ' : ''), 0, -47);
      if (p.gripping) { ctx.fillStyle = '#15803d'; ctx.fillText(p.isAnchored ? 'ANCLADO' : 'ENGANCHADO', 0, 33); }
      ctx.restore();
    }
    if (engine.status !== 'PLAYING') {
      ctx.fillStyle = 'rgba(24,24,27,0.92)'; ctx.beginPath(); ctx.roundRect(230, 215, 540, 84, 12); ctx.fill();
      ctx.fillStyle = '#fef08a'; ctx.font = '900 20px monospace'; ctx.textAlign = 'center';
      ctx.fillText(engine.status === 'RECOVERING' ? 'RECUPERANDO CARGA EN EL CHECKPOINT…' : engine.status === 'ROUTE_COMPLETE' ? '¡RUTA COMPLETADA EN EQUIPO!' : '¡ENTREGA CONFIRMADA!', 500, 263);
    }
    ctx.restore();
  }
}
