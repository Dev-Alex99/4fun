import { ChaosPhysics } from './chaosPhysics';
import { reconcilePlayer, type PredictionHint } from './reconciliation';
import { sfx } from '../audio/mechanicalSfx';
import type { CargoFeedback, CargoPlayer, CargoSnapshot, ClientInputPacket, HeavyBattery, PlatformRect, PressureSwitch, RobotCosmetics } from '../types';

interface CargoStage {
  title: string;
  hint: string;
  conveyors: PlatformRect[];
  pits: PlatformRect[];
  barriers: PlatformRect[];
  crane?: PlatformRect;
  locks: Array<{ x: number; y: number }>;
}

export const CARGO_STAGES: CargoStage[] = [
  { title: '01 · MUELLE DE CINTAS', hint: 'Enganchen la batería y compensen el empuje lateral de las cintas.',
    conveyors: [{ x: 250, y: 190, w: 140, h: 140, conveyorVy: 95 }, { x: 590, y: 190, w: 140, h: 140, conveyorVy: -95 }],
    pits: [{ x: 420, y: 80, w: 90, h: 110 }, { x: 420, y: 330, w: 90, h: 110 }], barriers: [], locks: [] },
  { title: '02 · GRÚA DE TRANSFERENCIA', hint: 'La luz ámbar avisa del descenso de la grúa. Esperen o rodeen la carga.',
    conveyors: [], pits: [], barriers: [{ x: 340, y: 64, w: 50, h: 160 }, { x: 340, y: 336, w: 50, h: 120 }],
    crane: { x: 560, y: 190, w: 75, h: 140 }, locks: [] },
  { title: '03 · ENTREGA AL REACTOR', hint: 'Suelten la carga para activar los dos seguros del reactor. Después, todos a la entrega.',
    conveyors: [{ x: 555, y: 180, w: 150, h: 160, conveyorVx: 90 }],
    pits: [{ x: 420, y: 64, w: 90, h: 140 }, { x: 420, y: 316, w: 90, h: 140 }], barriers: [],
    crane: { x: 600, y: 210, w: 65, h: 100 }, locks: [{ x: 735, y: 135 }, { x: 735, y: 385 }] }
];

const inside = (x: number, y: number, rect: PlatformRect): boolean => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
export const CARGO_ROUTE_NAMES = ['RUTA CLÁSICA', 'CONTRACORRIENTE', 'CARGA DE PRECISIÓN'];
export const cargoStageMedal = (seconds: number, damage: number): string => seconds <= 90 && damage === 0 ? 'ORO' : seconds <= 150 && damage <= 30 ? 'PLATA' : 'BRONCE';
export const CARGO_ROUTES: CargoStage[][] = [CARGO_STAGES, ...[1, 2].map(route => CARGO_STAGES.map(stage => ({
  ...stage,
  conveyors: stage.conveyors.map(belt => ({ ...belt,
    conveyorVx: belt.conveyorVx ? belt.conveyorVx * (route === 1 ? -1 : 1.15) : undefined,
    conveyorVy: belt.conveyorVy ? belt.conveyorVy * (route === 1 ? -1 : 1.15) : undefined })),
  pits: stage.pits.map(pit => ({ ...pit, x: pit.x + (route === 1 ? 30 : 0), h: pit.h + (route === 2 && pit.y < 200 ? 25 : 0) })),
  barriers: stage.barriers.map(barrier => ({ ...barrier, x: barrier.x + (route === 1 ? 45 : -35) })),
  crane: stage.crane ? { ...stage.crane, x: stage.crane.x + (route === 1 ? 45 : -40) } : undefined,
  locks: stage.locks.map(lock => ({ ...lock, x: lock.x + (route === 1 ? 20 : -20) }))
})))];
const PALETTE = [['#FF4F00', '#B33600'], ['#1B4DFF', '#0D2E99'], ['#F59E0B', '#B45309'], ['#15803D', '#0F5127']];

/** Cooperative cargo physics. Only step() resolves damage, deliveries and route results. */
export class CargoCrewEngine extends ChaosPhysics {
  public routeIndex = 0;
  public stageIndex = 0;
  public status: CargoSnapshot['status'] = 'PLAYING';
  public statusTimer = 0;
  public elapsedSeconds = 0;
  public stageSeconds = 0;
  public stageTimes: number[] = [];
  public stageDamage: number[] = [];
  public stageRepairs: number[] = [];
  private stageStartDamage = 0;
  private currentStageRepairs = 0;
  public integrity = 100;
  public damageTaken = 0;
  public retries = 0;
  public checkpoint = false;
  public feedback: CargoFeedback | null = null;
  private feedbackSeq = 0;
  public botsEnabled = true;
  public screenShake = 0;
  public players: CargoPlayer[] = PALETTE.map(([bodyColor, shadeColor], id) => ({
    id, name: id ? `UNIT-0${id + 1}` : 'ALEX', bodyColor, shadeColor, isBot: id > 0, isSaboteur: false,
    x: 150, y: 200 + id * 35, z: 0, vx: 0, vy: 0, vz: 0, radius: 16, onGround: true, isDangling: false,
    dangleTime: 0, isAnchored: false, yankCooldown: 0, walkCycle: 0, emoteText: null, emoteTimer: 0, gripping: false, toolCooldown: 0
  }));
  public battery: HeavyBattery = { x: 185, y: 260, vx: 0, vy: 0, radius: 24, delivered: false };
  public switches: PressureSwitch[] = [];
  private inputs = new Map<number, ClientInputPacket>();
  private actionSeqs = new Map<number, number>();
  private damageCooldown = 0;

  constructor() { super(); this.startRoute(); }
  public get definition(): CargoStage { return CARGO_ROUTES[this.routeIndex][this.stageIndex]; }
  public setRoute(index: number): void { this.routeIndex = Math.max(0, Math.min(2, Math.floor(index))); this.startRoute(); }
  public get craneWarning(): boolean { return Boolean(this.definition.crane) && this.stageSeconds % 7 >= 4 && this.stageSeconds % 7 < 5; }
  public get craneActive(): boolean { return Boolean(this.definition.crane) && this.stageSeconds % 7 >= 5 && this.stageSeconds % 7 < 6.4; }
  public get gateOpen(): boolean { return this.switches.every(sw => sw.pressed); }
  public getActivePlayers(): CargoPlayer[] { return this.players.filter(p => !p.isBot || this.botsEnabled); }
  public syncPlayerIdentities(roster: Array<{ name: string; isBot: boolean; cosmetics?: RobotCosmetics }>, botsEnabled = true): void {
    this.botsEnabled = botsEnabled;
    roster.forEach((p, i) => { Object.assign(this.players[i], { name: p.name, isBot: p.isBot, cosmetics: p.cosmetics ? { ...p.cosmetics } : undefined }); });
    this.players.filter(p => p.isBot && !botsEnabled).forEach(p => { p.gripping = false; });
  }

  public startRoute(): void {
    this.resetMatchStats(); this.elapsedSeconds = 0; this.stageTimes = []; this.damageTaken = 0; this.retries = 0;
    this.feedback = null; this.feedbackSeq = 0; this.stageDamage = []; this.stageRepairs = [];
    this.loadStage(0);
  }

  public loadStage(index: number, restoreCheckpoint = false): void {
    this.resetChaosRound();
    this.stageIndex = Math.max(0, Math.min(CARGO_STAGES.length - 1, Math.floor(index)));
    this.status = 'PLAYING'; this.statusTimer = 0;
    if (!restoreCheckpoint) { this.stageSeconds = 0; this.stageStartDamage = this.damageTaken; this.currentStageRepairs = 0; }
    this.checkpoint = restoreCheckpoint;
    this.integrity = 100; this.damageCooldown = 1;
    this.inputs.clear(); this.actionSeqs.clear();
    this.battery = { x: restoreCheckpoint ? 530 : 185, y: 260, vx: 0, vy: 0, radius: 24, delivered: false };
    this.players.forEach((p, i) => Object.assign(p, { x: this.battery.x - 55 + (i % 2) * 20, y: 215 + Math.floor(i / 2) * 80,
      z: 0, vx: 0, vy: 0, vz: 0, gripping: false, isAnchored: false, toolCooldown: 0 }));
    this.switches = this.definition.locks.map((sw, id) => ({ ...sw, id, radius: 26, pressed: false }));
  }

  public clearRemoteInput(slot: number): void {
    this.inputs.delete(slot); this.actionSeqs.delete(slot);
    Object.assign(this.players[slot], { vx: 0, vy: 0, gripping: false, isAnchored: false });
  }

  public triggerGrip(p: CargoPlayer): void {
    if (this.status !== 'PLAYING') return;
    if (p.gripping) p.gripping = false;
    else if (Math.hypot(p.x - this.battery.x, p.y - this.battery.y) <= 86) p.gripping = true;
  }

  public triggerRepair(p: CargoPlayer): void {
    if (this.status !== 'PLAYING' || p.toolCooldown > 0 || this.integrity >= 100 || Math.hypot(p.x - this.battery.x, p.y - this.battery.y) > 96) return;
    p.toolCooldown = 8; this.integrity = Math.min(100, this.integrity + 12); this.currentStageRepairs++; sfx.playCartridgeClick();
    this.announce('REPAIR', `${p.name} reparó la batería. Integridad: ${Math.ceil(this.integrity)}%.`);
  }

  public applyRemoteInput(input: ClientInputPacket): void {
    this.inputs.set(input.slotId, { ...input });
    const previous = this.actionSeqs.get(input.slotId) ?? 0;
    if (input.actionSeq && input.actionSeq <= previous) return;
    if (input.actionSeq) this.actionSeqs.set(input.slotId, input.actionSeq);
    const p = this.players[input.slotId];
    if (input.parryPressed) this.triggerGrip(p);
    if (input.yankPressed) this.triggerRepair(p);
  }

  private keepOut(p: { x: number; y: number; vx: number; vy: number; radius: number }, rect: PlatformRect): void {
    const cx = Math.max(rect.x, Math.min(rect.x + rect.w, p.x)), cy = Math.max(rect.y, Math.min(rect.y + rect.h, p.y));
    const dx = p.x - cx, dy = p.y - cy, distance = Math.hypot(dx, dy);
    if (distance >= p.radius) return;
    if (distance > 0.001) { p.x = cx + dx / distance * p.radius; p.y = cy + dy / distance * p.radius; }
    else {
      const sides = [Math.abs(p.x - rect.x), Math.abs(p.x - rect.x - rect.w), Math.abs(p.y - rect.y), Math.abs(p.y - rect.y - rect.h)];
      const side = sides.indexOf(Math.min(...sides));
      if (side === 0) p.x = rect.x - p.radius; else if (side === 1) p.x = rect.x + rect.w + p.radius;
      else if (side === 2) p.y = rect.y - p.radius; else p.y = rect.y + rect.h + p.radius;
    }
    p.vx *= 0.3; p.vy *= 0.3;
  }

  private announce(kind: CargoFeedback['kind'], text: string): void {
    if (this.feedback && ['PIT', 'FALL', 'CRANE'].includes(this.feedback.kind) && this.elapsedSeconds - this.feedback.atSeconds < 2 &&
      !['PIT', 'FALL', 'CRANE', 'DELIVERY'].includes(kind)) return;
    this.feedback = { seq: ++this.feedbackSeq, kind, text, atSeconds: this.elapsedSeconds };
  }

  private damage(amount: number, kind: 'PIT' | 'FALL' | 'CRANE', reason: string): void {
    if (this.damageCooldown > 0 || this.status !== 'PLAYING') return;
    this.integrity = Math.max(0, this.integrity - amount); this.damageTaken += amount; this.damageCooldown = 1;
    this.screenShake = 12; sfx.playKODisassembly();
    this.announce(kind, `${reason} (−${amount} de integridad).`);
    if (this.integrity === 0) { this.status = 'RECOVERING'; this.statusTimer = 2; this.retries++; }
  }

  private movePlayer(p: CargoPlayer, mx: number, my: number, anchored: boolean, dt: number): void {
    p.isAnchored = anchored;
    const length = Math.max(1, Math.hypot(mx, my)), speed = (anchored ? 35 : p.gripping ? 160 : 200) * this.speedMultiplier;
    const blend = Math.min(1, dt * 10);
    p.vx += (mx / length * speed - p.vx) * blend; p.vy += (my / length * speed - p.vy) * blend;
    p.x = Math.max(80 + p.radius, Math.min(920 - p.radius, p.x + p.vx * dt));
    p.y = Math.max(64 + p.radius, Math.min(456 - p.radius, p.y + p.vy * dt));
    p.walkCycle += Math.hypot(p.vx, p.vy) * dt * 0.08;
    for (const barrier of this.definition.barriers) this.keepOut(p, barrier);
    if (p.gripping) {
      const dx = p.x - this.battery.x, dy = p.y - this.battery.y, d = Math.hypot(dx, dy);
      if (d > 110) { p.x = this.battery.x + dx / d * 110; p.y = this.battery.y + dy / d * 110; }
    }
  }

  public step(dt: number, localInput: ClientInputPacket): void {
    if (this.status === 'ROUTE_COMPLETE') return;
    this.advanceChaos(dt, true, this.status === 'PLAYING', () => {});
    this.inputs.set(localInput.slotId, localInput);
    this.screenShake = Math.max(0, this.screenShake - dt * 30);
    if (this.status !== 'PLAYING') {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) {
        const recovering = this.status === 'RECOVERING';
        this.loadStage(this.status === 'STAGE_CLEAR' ? this.stageIndex + 1 : this.stageIndex, recovering && this.checkpoint);
        if (recovering) this.announce('RECOVER', 'Carga recuperada. La batería vuelve al 100% en el punto seguro.');
      }
      return;
    }
    this.elapsedSeconds += dt; this.stageSeconds += dt; this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    const active = this.getActivePlayers(), leader = active.find(p => !p.isBot) ?? active[0];
    if (!leader) return;
    const leadInput = this.inputs.get(leader.id);
    active.forEach((p, i) => {
      p.toolCooldown = Math.max(0, p.toolCooldown - dt);
      let mx = 0, my = 0, anchor = false;
      if (!p.isBot) { const input = this.inputs.get(p.id); mx = input?.moveX ?? 0; my = input?.moveY ?? 0; anchor = Boolean(input?.anchorHeld); }
      else {
        const lock = this.switches.filter(sw => !sw.pressed)[i % Math.max(1, this.switches.filter(sw => !sw.pressed).length)];
        if (lock && this.battery.x > 550) {
          p.gripping = false;
          const distance = Math.hypot(lock.x - p.x, lock.y - p.y);
          if (distance > 8) { mx = (lock.x - p.x) / distance; my = (lock.y - p.y) / distance; }
        } else {
          const moving = Math.hypot(leadInput?.moveX ?? 0, leadInput?.moveY ?? 0) > 0.1;
          const targetX = this.battery.x + (moving ? (leadInput?.moveX ?? 0) * 70 : (i % 2 ? -48 : 48));
          const targetY = this.battery.y + (moving ? (leadInput?.moveY ?? 0) * 70 : (i < 2 ? -40 : 40));
          const distance = Math.hypot(targetX - p.x, targetY - p.y);
          if (distance > 12) { mx = (targetX - p.x) / distance; my = (targetY - p.y) / distance; }
          if (Math.hypot(p.x - this.battery.x, p.y - this.battery.y) < 85) p.gripping = leader.gripping;
          if (this.integrity < 65) this.triggerRepair(p);
        }
      }
      this.movePlayer(p, mx, my, anchor, dt);
      if (this.definition.pits.some(pit => inside(p.x, p.y, pit))) {
        p.x = this.checkpoint ? 530 : 150; p.y = 260; p.vx = p.vy = 0; p.gripping = false; this.damage(8, 'FALL', `${p.name} cayó al vacío`);
      }
    });
    const grippers = active.filter(p => p.gripping);
    for (const p of grippers) {
      const dx = p.x - this.battery.x, dy = p.y - this.battery.y, distance = Math.hypot(dx, dy) || 1;
      const force = Math.min(900, Math.max(0, distance - 45) * 28) / Math.max(1, grippers.length * 0.6);
      this.battery.vx += dx / distance * force * dt; this.battery.vy += dy / distance * force * dt;
    }
    for (const p of active) {
      const dx = this.battery.x - p.x, dy = this.battery.y - p.y, distance = Math.hypot(dx, dy) || 1;
      if (distance < p.radius + this.battery.radius) {
        const overlap = p.radius + this.battery.radius - distance;
        this.battery.x += dx / distance * overlap * 0.4; this.battery.y += dy / distance * overlap * 0.4;
        this.battery.vx += p.vx * dt * 2; this.battery.vy += p.vy * dt * 2;
      }
    }
    for (const belt of this.definition.conveyors) if (inside(this.battery.x, this.battery.y, belt)) {
      const braced = grippers.some(p => p.isAnchored) ? 0.2 : 1;
      this.battery.vx += (belt.conveyorVx ?? 0) * dt * 2 * braced;
      this.battery.vy += (belt.conveyorVy ?? 0) * dt * 2 * braced;
    }
    const speed = Math.hypot(this.battery.vx, this.battery.vy);
    if (speed > 180) { this.battery.vx *= 180 / speed; this.battery.vy *= 180 / speed; }
    this.battery.vx *= Math.exp(-1.4 * dt); this.battery.vy *= Math.exp(-1.4 * dt);
    this.battery.x = Math.max(104, Math.min(896, this.battery.x + this.battery.vx * dt));
    this.battery.y = Math.max(88, Math.min(432, this.battery.y + this.battery.vy * dt));
    this.definition.barriers.forEach(rect => this.keepOut(this.battery, rect));
    this.switches.forEach(sw => { sw.pressed ||= active.some(p => Math.hypot(p.x - sw.x, p.y - sw.y) <= sw.radius); });
    if (!this.gateOpen) this.keepOut(this.battery, { x: 795, y: 64, w: 16, h: 392 });
    if (this.definition.pits.some(pit => inside(this.battery.x, this.battery.y, pit))) {
      this.damage(35, 'PIT', 'La batería cayó al vacío'); this.battery.x = this.checkpoint ? 530 : 185; this.battery.y = 260; this.battery.vx = this.battery.vy = 0;
      active.forEach(p => { p.gripping = false; });
    }
    if (this.craneActive && this.definition.crane && inside(this.battery.x, this.battery.y, this.definition.crane)) this.damage(30, 'CRANE', 'La grúa golpeó la batería');
    if (this.status !== 'PLAYING') return;
    if (this.battery.x >= 520 && !this.checkpoint) { this.checkpoint = true; this.announce('CHECKPOINT', 'Checkpoint activado. La carga se recuperará aquí si pierde toda la integridad.'); }
    if (this.gateOpen && this.battery.x >= 850 && Math.abs(this.battery.y - 260) < 60) {
      this.battery.delivered = true; this.stageTimes.push(this.stageSeconds);
      this.stageDamage.push(this.damageTaken - this.stageStartDamage); this.stageRepairs.push(this.currentStageRepairs);
      active.forEach(p => { this.matchStats[p.id].deliveries++; });
      this.status = this.stageIndex === CARGO_STAGES.length - 1 ? 'ROUTE_COMPLETE' : 'STAGE_CLEAR';
      this.statusTimer = 2; sfx.playBatParry(4, true);
      this.announce('DELIVERY', this.status === 'ROUTE_COMPLETE' ? '¡Tres entregas confirmadas! Ruta completada en equipo.' : `¡Entrega ${this.stageIndex + 1} de 3 confirmada! Preparando la siguiente etapa.`);
    }
  }

  public stepClientPrediction(dt: number, slot: number, input: ClientInputPacket): void {
    if (this.status !== 'PLAYING') return;
    this.advanceChaos(dt, false, true, () => {});
    this.stageSeconds += dt;
    this.movePlayer(this.players[slot], input.moveX, input.moveY, Boolean(input.anchorHeld), dt);
    this.battery.x += this.battery.vx * dt; this.battery.y += this.battery.vy * dt;
  }

  public getSnapshot(): CargoSnapshot {
    return { stageDamage: [...this.stageDamage], stageRepairs: [...this.stageRepairs], routeIndex: this.routeIndex, roundEpoch: this.roundEpoch, simulationTime: this.simulationTime, stageIndex: this.stageIndex, status: this.status,
      statusTimer: this.statusTimer, elapsedSeconds: this.elapsedSeconds, stageSeconds: this.stageSeconds, stageTimes: [...this.stageTimes],
      integrity: this.integrity, damageTaken: this.damageTaken, retries: this.retries, checkpoint: this.checkpoint, feedback: this.feedback ? { ...this.feedback } : null,
      players: this.players.map(p => ({ ...p })), battery: { ...this.battery }, switches: this.switches.map(sw => ({ ...sw })) };
  }

  public applySnapshot(snapshot: CargoSnapshot, localSlot = 0, prediction: PredictionHint = 0): void {
    const reset = this.roundEpoch !== snapshot.roundEpoch || this.status !== snapshot.status || this.stageIndex !== snapshot.stageIndex;
    this.stageDamage = [...(snapshot.stageDamage ?? [])]; this.stageRepairs = [...(snapshot.stageRepairs ?? [])];
    this.routeIndex = snapshot.routeIndex ?? 0;
    this.stageIndex = snapshot.stageIndex; this.status = snapshot.status; this.statusTimer = snapshot.statusTimer;
    this.elapsedSeconds = snapshot.elapsedSeconds; this.stageSeconds = snapshot.stageSeconds; this.stageTimes = [...snapshot.stageTimes];
    this.integrity = snapshot.integrity; this.damageTaken = snapshot.damageTaken; this.retries = snapshot.retries; this.checkpoint = snapshot.checkpoint;
    this.feedback = snapshot.feedback ? { ...snapshot.feedback } : null;
    this.players = snapshot.players.map(p => reconcilePlayer(this.players[p.id], p, p.id === localSlot, reset, prediction));
    this.battery = { ...snapshot.battery }; this.switches = snapshot.switches.map(sw => ({ ...sw }));
    this.roundEpoch = snapshot.roundEpoch ?? this.roundEpoch; this.simulationTime = snapshot.simulationTime ?? this.simulationTime;
  }
}
