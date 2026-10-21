import {
  BotDifficulty,
  ClientInputPacket,
  CourtLayout,
  FloatingCallout,
  GyroBallState,
  LoosePart,
  ParticleEffect,
  PinballBumper,
  PlayerState,
  RoundPhase,
  WorldSnapshotPacket
} from '../types';
import { sfx } from '../audio/mechanicalSfx';
import { applyHardwareMod, pickRandomModIds } from './hardwareMods';

export const COURT_WIDTH = 1000;
export const COURT_HEIGHT = 520;
export const COURT_CENTER_X = 500;
export const COURT_CENTER_Y = 258;
export const COURT_RX = 395;
export const COURT_RY = 195;
export const WINNING_SCORE = 5;

const SLOT_PALETTE = [
  { defaultName: 'UNIT-01', bodyColor: '#FF4F00', shadeColor: '#C83A00', batColor: '#F59E0B' },
  { defaultName: 'LEO-BOT', bodyColor: '#1B4DFF', shadeColor: '#1034B8', batColor: '#F4F0E8' },
  { defaultName: 'MAX-BOT', bodyColor: '#F59E0B', shadeColor: '#C27803', batColor: '#FF4F00' },
  { defaultName: 'NICO-BOT', bodyColor: '#15803D', shadeColor: '#0E5829', batColor: '#F59E0B' }
];

const EMOTE_LABELS = ['¡EZ!', '¡UY!', '💀 K.O.', '¡MÍRAME!'];
const LAYOUT_ORDER: CourtLayout[] = ['PINBALL', 'CLASSIC', 'CORE'];

export class ArenaEngine {
  public tick = 0;
  public phase: RoundPhase = 'PLAYING';
  public botDifficulty: BotDifficulty = 'NORMAL';
  public courtLayout: CourtLayout = 'PINBALL';
  public roundIndex = 0;
  public roundTimer = 0;
  public multiballActive = false;
  public comboCount = 0;
  public lastRoundWinnerId: number | null = null;
  public draftOptions: string[] = [];

  public players: PlayerState[] = [];
  public balls: GyroBallState[] = [];
  public bumpers: PinballBumper[] = [];
  public particles: ParticleEffect[] = [];
  public looseParts: LoosePart[] = [];
  public callouts: FloatingCallout[] = [];

  public hitStopTimer = 0;
  public screenShake = 0;

  private nextPassId = 1;
  private remoteInputs = new Map<number, ClientInputPacket>();
  private onPhaseChange?: () => void;

  constructor(onPhaseChange?: () => void) {
    this.onPhaseChange = onPhaseChange;
    this.initPlayers();
    this.spawnRound();
  }

  public initPlayers(): void {
    this.players = SLOT_PALETTE.map((cfg, idx) => ({
      id: idx,
      peerId: idx === 0 ? 'LOCAL' : null,
      name: cfg.defaultName,
      bodyColor: cfg.bodyColor,
      shadeColor: cfg.shadeColor,
      batColor: cfg.batColor,
      isBot: idx !== 0,
      score: 0,
      x: COURT_CENTER_X,
      y: COURT_CENTER_Y,
      vx: 0,
      vy: 0,
      radius: 19,
      alive: true,
      walkCycle: 0,
      tiltX: 0,
      parryTimer: 0,
      parryCooldown: 0,
      chargeTime: 0,
      feintPrimed: false,
      batSwingDir: 1,
      dashTimer: 0,
      dashCooldown: 0,
      aimAngle: 0,
      emoteText: null,
      emoteTimer: 0,
      botEvaluatedPassId: -1,
      botWillParry: true,
      botTriggerDist: 52,
      parryRadiusMult: 1.0,
      parryWindowBonus: 0.0,
      curvePower: 0.0,
      dashCooldownMult: 1.0,
      speedMult: 1.0,
      smashPower: 1.0,
      dashShockwave: false,
      magnetPull: false,
      installedModCodes: []
    }));
  }

  public resetChampionship(): void {
    const preservedPeers = this.players.map((p) => ({
      peerId: p.peerId,
      name: p.name,
      isBot: p.isBot
    }));
    this.roundIndex = 0;
    this.initPlayers();
    preservedPeers.forEach((saved, idx) => {
      this.players[idx].peerId = saved.peerId;
      this.players[idx].name = saved.name;
      this.players[idx].isBot = saved.isBot;
    });
    this.phase = 'PLAYING';
    this.spawnRound();
    this.onPhaseChange?.();
  }

  public spawnRound(): void {
    this.courtLayout = LAYOUT_ORDER[this.roundIndex % LAYOUT_ORDER.length];
    this.roundIndex++;
    this.roundTimer = 0;
    this.multiballActive = false;
    this.comboCount = 0;
    this.looseParts = [];

    // Setup Mechanical Pinball Bumpers based on Layout
    this.bumpers = [];
    if (this.courtLayout === 'PINBALL') {
      this.bumpers.push(
        { x: COURT_CENTER_X - 135, y: COURT_CENTER_Y, radius: 24, hitAnim: 0 },
        { x: COURT_CENTER_X + 135, y: COURT_CENTER_Y, radius: 24, hitAnim: 0 }
      );
    } else if (this.courtLayout === 'CORE') {
      this.bumpers.push({ x: COURT_CENTER_X, y: COURT_CENTER_Y, radius: 30, hitAnim: 0 });
    }

    const startAngles = [Math.PI, 0, -Math.PI / 2, Math.PI / 2];
    const botsActive = this.botDifficulty !== 'OFF';

    this.players.forEach((p, idx) => {
      const activeParticipant = !p.isBot || botsActive;
      p.alive = activeParticipant;
      p.x = COURT_CENTER_X + Math.cos(startAngles[idx]) * (COURT_RX * 0.68);
      p.y = COURT_CENTER_Y + Math.sin(startAngles[idx]) * (COURT_RY * 0.68);
      p.vx = 0;
      p.vy = 0;
      p.parryTimer = 0;
      p.parryCooldown = 0;
      p.chargeTime = 0;
      p.feintPrimed = false;
      p.dashTimer = 0;
      p.dashCooldown = 0;
      p.botEvaluatedPassId = -1;
      p.aimAngle = Math.atan2(COURT_CENTER_Y - p.y, COURT_CENTER_X - p.x);
    });

    this.balls = [this.createBall(0, '#FF4F00')];
  }

  private createBall(id: number, accentColor: string): GyroBallState {
    const alivePlayers = this.players.filter((p) => p.alive);
    const firstTarget =
      alivePlayers.length > 0
        ? alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id
        : 0;

    return {
      id,
      x: COURT_CENTER_X,
      y: COURT_CENTER_Y - 35 + id * 70,
      z: 18,
      vx: (Math.random() - 0.5) * 90,
      vy: (Math.random() - 0.5) * 90,
      speed: 250,
      baseSpeed: 250,
      radius: 11,
      rotation: 0,
      targetId: firstTarget,
      ownerId: -1,
      passId: this.nextPassId++,
      isFeint: false,
      accentColor,
      curveSpin: 0,
      trail: []
    };
  }

  public triggerEmote(p: PlayerState, emoteIndex: number): void {
    const label = EMOTE_LABELS[(emoteIndex - 1) % EMOTE_LABELS.length];
    if (!label) return;
    p.emoteText = label;
    p.emoteTimer = 1.8;
    sfx.playHornEmote(emoteIndex);
  }

  public applyRemoteInput(packet: ClientInputPacket): void {
    const slot = this.players[packet.slotId];
    if (!slot) return;
    if (packet.name) slot.name = packet.name.slice(0, 10).toUpperCase();
    this.remoteInputs.set(packet.slotId, packet);

    if (packet.emotePressed > 0) {
      this.triggerEmote(slot, packet.emotePressed);
    }

    if (this.phase === 'PLAYING' && slot.alive) {
      if (packet.parryPressed) {
        this.triggerParry(slot, packet.clientBallDist);
      }
      if (packet.dashPressed) {
        const dirX = packet.moveX || Math.cos(packet.aimAngle);
        const dirY = packet.moveY || Math.sin(packet.aimAngle);
        this.triggerDash(slot, dirX, dirY);
      }
    }
  }

  public triggerParry(p: PlayerState, clientBallDist?: number): void {
    if (!p.alive || p.parryCooldown > 0) return;
    p.parryTimer = 0.24 + p.parryWindowBonus;
    p.parryCooldown = 0.45;
    p.batSwingDir *= -1;

    // Lag-Compensated Parry Validation for remote clients
    if (clientBallDist !== undefined && this.balls.length > 0) {
      const batReach = (p.radius + 26) * p.parryRadiusMult;
      const closestBall = this.balls.reduce((best, b) => {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        return d < Math.hypot(best.x - p.x, best.y - p.y) ? b : best;
      }, this.balls[0]);

      if (clientBallDist <= batReach + closestBall.radius + 18 && closestBall.ownerId !== p.id) {
        this.executeDeflection(p, closestBall, true);
      }
    }
  }

  public triggerDash(p: PlayerState, dirX: number, dirY: number): void {
    if (!p.alive || p.dashCooldown > 0) return;
    const len = Math.hypot(dirX, dirY) || 1;
    p.vx = (dirX / len) * 620;
    p.vy = (dirY / len) * 620;
    p.dashTimer = 0.14;
    p.dashCooldown = 1.2 * p.dashCooldownMult;
    sfx.playDashPiston();
    this.spawnDust(p.x, p.y + 10, 7);

    if (p.dashShockwave) {
      this.players.forEach((other) => {
        if (other.id !== p.id && other.alive) {
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d < 105) {
            const ang = Math.atan2(other.y - p.y, other.x - p.x);
            other.vx += Math.cos(ang) * 480;
            other.vy += Math.sin(ang) * 480;
          }
        }
      });
    }
  }

  public selectDraftMod(slotId: number, modId: string): void {
    if (this.phase !== 'CARD_DRAFT') return;
    const player = this.players[slotId];
    if (player) {
      applyHardwareMod(player, modId);
    }
    this.players.forEach((p) => {
      if (p.isBot && p.id !== slotId) {
        const randomMod = this.draftOptions[Math.floor(Math.random() * this.draftOptions.length)];
        if (randomMod) applyHardwareMod(p, randomMod);
      }
    });

    sfx.playCartridgeClick();
    this.phase = 'PLAYING';
    this.spawnRound();
    this.onPhaseChange?.();
  }

  private chooseNextTarget(deflector: PlayerState): number {
    const aliveOthers = this.players.filter((p) => p.alive && p.id !== deflector.id);
    if (aliveOthers.length === 0) return deflector.id;

    let best = aliveOthers[0];
    let bestDiff = 999;
    aliveOthers.forEach((other) => {
      const ang = Math.atan2(other.y - deflector.y, other.x - deflector.x);
      const diff = Math.abs(
        Math.atan2(Math.sin(ang - deflector.aimAngle), Math.cos(ang - deflector.aimAngle))
      );
      if (diff < bestDiff) {
        bestDiff = diff;
        best = other;
      }
    });
    return best.id;
  }

  private executeDeflection(p: PlayerState, ball: GyroBallState, isPerfect: boolean): void {
    this.comboCount++;
    ball.ownerId = p.id;
    ball.targetId = this.chooseNextTarget(p);
    ball.passId = this.nextPassId++;

    const usedFeint = p.feintPrimed;
    p.feintPrimed = false;
    p.chargeTime = 0;

    if (usedFeint) {
      // Rhythm-change Drop-Shot / Heavy Curve Feint!
      ball.isFeint = true;
      ball.speed = Math.max(210, ball.speed * 0.68);
      ball.curveSpin = (3.4 + p.curvePower) * (Math.random() > 0.5 ? 1 : -1);
    } else {
      ball.isFeint = false;
      const accel = isPerfect ? 1.2 * p.smashPower : 1.12;
      ball.speed = Math.min(950, ball.speed * accel);
      ball.curveSpin = p.curvePower * (Math.random() > 0.5 ? 2.5 : -2.5);
    }

    const launchAngle = !p.isBot
      ? p.aimAngle
      : Math.atan2(
          this.players[ball.targetId].y - p.y,
          this.players[ball.targetId].x - p.x
        );

    ball.vx = Math.cos(launchAngle) * ball.speed;
    ball.vy = Math.sin(launchAngle) * ball.speed;

    p.parryTimer = 0;
    p.parryCooldown = 0.06;

    this.hitStopTimer = isPerfect || usedFeint ? 0.065 : 0.032;
    this.screenShake = isPerfect ? 10 : 5;
    sfx.playBatParry(this.comboCount, isPerfect, usedFeint);
    this.spawnImpactSparks(ball.x, ball.y, p.bodyColor, isPerfect ? 15 : 8);

    if (usedFeint) {
      this.addCallout(p.x, p.y - 36, `¡AMAGO CURVO!`, '#1B4DFF');
    } else {
      this.addCallout(
        p.x,
        p.y - 36,
        isPerfect ? `¡CLANK! x${this.comboCount}` : `BATAZO x${this.comboCount}`,
        isPerfect ? '#FF4F00' : '#18181B'
      );
    }
  }

  private getBotBaseSuccessChance(): number {
    switch (this.botDifficulty) {
      case 'CHILL':
        return 0.54; // Very approachable: bots miss ~46% of shots, especially fast/curvy ones
      case 'NORMAL':
        return 0.68; // Balanced fun: bots sustain 3-5 hit rallies then make human mistakes
      case 'PRO':
        return 0.85; // Competitive challenge
      default:
        return 0.0;
    }
  }

  public step(dt: number, localInput: ClientInputPacket): void {
    this.tick++;

    // Update particles & callouts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= pt.decay * dt;
      if (pt.type === 'ring') pt.size += 195 * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 36 * dt;
      c.life -= 1.35 * dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
    this.looseParts.forEach((part) => {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vx *= Math.pow(0.88, dt * 60);
      part.vy *= Math.pow(0.88, dt * 60);
      part.rot += part.vRot * dt;
      part.vRot *= Math.pow(0.88, dt * 60);
    });
    this.bumpers.forEach((b) => {
      if (b.hitAnim > 0) b.hitAnim = Math.max(0, b.hitAnim - dt * 5);
    });

    if (this.phase !== 'PLAYING') return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    // Overtime "¡MULTIBOLA!" Trigger at 15 seconds!
    this.roundTimer += dt;
    if (!this.multiballActive && this.roundTimer >= 15.0) {
      const aliveCount = this.players.filter((p) => p.alive).length;
      if (aliveCount >= 2) {
        this.multiballActive = true;
        this.balls.push(this.createBall(1, '#1B4DFF'));
        sfx.playMultiballSiren();
        this.screenShake = 9;
        this.addCallout(COURT_CENTER_X, COURT_CENTER_Y - 25, '⚠️ ¡ALERTA MULTIBOLA!', '#1B4DFF');
      }
    }

    this.remoteInputs.set(localInput.slotId, localInput);

    // 1. Update All 4 Players
    this.players.forEach((p) => {
      if (p.emoteTimer > 0) {
        p.emoteTimer = Math.max(0, p.emoteTimer - dt);
        if (p.emoteTimer <= 0) p.emoteText = null;
      }

      if (!p.alive) return;

      if (p.parryTimer > 0) p.parryTimer = Math.max(0, p.parryTimer - dt);
      if (p.parryCooldown > 0) p.parryCooldown = Math.max(0, p.parryCooldown - dt);
      if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - dt);
      if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);

      const moveSpeed = 235 * p.speedMult;

      if (!p.isBot) {
        const input = this.remoteInputs.get(p.id);
        if (input) {
          if (input.moveX !== 0 || input.moveY !== 0) {
            const len = Math.hypot(input.moveX, input.moveY);
            p.vx += (input.moveX / len) * moveSpeed * 9.5 * dt;
            p.vy += (input.moveY / len) * moveSpeed * 9.5 * dt;
          }
          p.aimAngle = input.aimAngle;

          if (input.chargingParry) {
            p.chargeTime += dt;
            if (p.chargeTime >= 0.18) {
              p.feintPrimed = true;
            }
          } else if (p.parryTimer <= 0) {
            p.chargeTime = 0;
          }
        }
      } else {
        // HUMANIZED BOT AI (Single decision per incoming ball pass!)
        const normDx = (p.x - COURT_CENTER_X) / COURT_RX;
        const normDy = (p.y - COURT_CENTER_Y) / COURT_RY;
        const normDist = Math.hypot(normDx, normDy);
        const toCenterAng = Math.atan2(COURT_CENTER_Y - p.y, COURT_CENTER_X - p.x);
        let desiredAng = toCenterAng + Math.PI * 0.52;
        if (normDist > 0.72) desiredAng = toCenterAng;

        p.vx += Math.cos(desiredAng) * moveSpeed * 6.0 * dt;
        p.vy += Math.sin(desiredAng) * moveSpeed * 6.0 * dt;

        // Find any ball targeting this bot
        const threatBall = this.balls.find((b) => b.targetId === p.id) || this.balls[0];
        if (threatBall) {
          p.aimAngle = Math.atan2(threatBall.y - p.y, threatBall.x - p.x);

          if (threatBall.targetId === p.id) {
            // Roll ONCE when this pass begins targeting the bot
            if (p.botEvaluatedPassId !== threatBall.passId) {
              p.botEvaluatedPassId = threatBall.passId;

              const baseChance = this.getBotBaseSuccessChance();
              const speedPenalty = Math.max(0, (threatBall.speed - 310) / 720);
              const feintPenalty = threatBall.isFeint ? 0.28 : 0.0;
              const finalChance = Math.max(0.12, baseChance - speedPenalty - feintPenalty);

              p.botWillParry = Math.random() < finalChance;
              // Human reaction distance jitter (sometimes late or normal parry instead of always perfect)
              p.botTriggerDist = 36 + Math.random() * 24 + threatBall.speed * 0.04;
            }

            const distBall = Math.hypot(threatBall.x - p.x, threatBall.y - p.y);
            if (distBall < p.botTriggerDist && p.parryCooldown <= 0) {
              if (p.botWillParry) {
                this.triggerParry(p);
              } else {
                // Bot misjudged timing! Either swings way too early/late or panics with a sideways dash
                if (Math.random() < 0.45) {
                  this.triggerDash(p, -(threatBall.y - p.y), threatBall.x - p.x);
                }
              }
            }
          }
        }
      }

      const damping = p.dashTimer > 0 ? 0.94 : 0.83;
      p.vx *= Math.pow(damping, dt * 60);
      p.vy *= Math.pow(damping, dt * 60);

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Collide player with Pinball Bumpers
      this.bumpers.forEach((bmp) => {
        const d = Math.hypot(p.x - bmp.x, p.y - bmp.y);
        const minDist = p.radius + bmp.radius;
        if (d < minDist && d > 0.001) {
          const nx = (p.x - bmp.x) / d;
          const ny = (p.y - bmp.y) / d;
          p.x = bmp.x + nx * minDist;
          p.y = bmp.y + ny * minDist;
          p.vx += nx * 240;
          p.vy += ny * 240;
          bmp.hitAnim = 1.0;
        }
      });

      const spd = Math.hypot(p.vx, p.vy);
      p.walkCycle = spd > 15 ? p.walkCycle + spd * dt * 0.11 : 0;
      p.tiltX = Math.max(-0.22, Math.min(0.22, p.vx * 0.0008));

      // Keep inside elliptical court bumper
      const ex = (p.x - COURT_CENTER_X) / (COURT_RX - p.radius);
      const ey = (p.y - COURT_CENTER_Y) / (COURT_RY - p.radius);
      const eLen = Math.hypot(ex, ey);
      if (eLen > 1) {
        p.x = COURT_CENTER_X + (ex / eLen) * (COURT_RX - p.radius);
        p.y = COURT_CENTER_Y + (ey / eLen) * (COURT_RY - p.radius);
      }
    });

    // 2. Update All Active Gyro Balls
    this.balls.forEach((ball) => {
      let target = this.players[ball.targetId];
      if (!target || !target.alive) {
        const aliveList = this.players.filter((pl) => pl.alive);
        if (aliveList.length > 0) {
          ball.targetId = aliveList[0].id;
          ball.passId = this.nextPassId++;
          target = aliveList[0];
        }
      }

      if (target && target.alive) {
        const desiredAngle = Math.atan2(target.y - ball.y, target.x - ball.x);
        const currentAngle = Math.atan2(ball.vy, ball.vx);
        const diff = Math.atan2(
          Math.sin(desiredAngle - currentAngle),
          Math.cos(desiredAngle - currentAngle)
        );
        const turnRate = 5.5 + ball.speed * 0.004;
        const newAngle =
          currentAngle + diff * Math.min(1, turnRate * dt) + ball.curveSpin * dt;
        ball.vx = Math.cos(newAngle) * ball.speed;
        ball.vy = Math.sin(newAngle) * ball.speed;
        ball.curveSpin *= Math.pow(0.95, dt * 60);
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.rotation += ball.speed * dt * 0.04;
      ball.z = 12 + Math.abs(Math.sin(performance.now() * 0.012 + ball.id * 2)) * 8;

      // Pinball Bumper Collisions for Ball
      this.bumpers.forEach((bmp) => {
        const d = Math.hypot(ball.x - bmp.x, ball.y - bmp.y);
        const minDist = ball.radius + bmp.radius;
        if (d < minDist && d > 0.001) {
          const nx = (ball.x - bmp.x) / d;
          const ny = (ball.y - bmp.y) / d;
          ball.x = bmp.x + nx * minDist;
          ball.y = bmp.y + ny * minDist;
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
          ball.speed = Math.min(950, ball.speed * 1.06);
          ball.ownerId = -1;
          bmp.hitAnim = 1.0;
          sfx.playPinballBumper();
          this.spawnImpactSparks(ball.x, ball.y, '#F59E0B', 7);
        }
      });

      // Outer Court Bumper Bounce
      const bx = (ball.x - COURT_CENTER_X) / (COURT_RX - ball.radius);
      const by = (ball.y - COURT_CENTER_Y) / (COURT_RY - ball.radius);
      const bLen = Math.hypot(bx, by);
      if (bLen > 1) {
        ball.x = COURT_CENTER_X + (bx / bLen) * (COURT_RX - ball.radius);
        ball.y = COURT_CENTER_Y + (by / bLen) * (COURT_RY - ball.radius);
        const nx = bx / bLen;
        const ny = by / bLen;
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
        // Allow solo player (when bots are OFF) to parry again after wall bounce
        ball.ownerId = -1;
        this.spawnDust(ball.x, ball.y, 4);
      }

      ball.trail.push({ x: ball.x, y: ball.y, z: ball.z });
      if (ball.trail.length > 11) ball.trail.shift();

      // Check Bat Parry & Direct Hit
      this.players.forEach((p) => {
        if (!p.alive) return;
        const d = Math.hypot(ball.x - p.x, ball.y - p.y);
        const batReach = (p.radius + 26) * p.parryRadiusMult;

        if (p.parryTimer > 0 && d <= batReach + ball.radius && ball.ownerId !== p.id) {
          const isPerfect = p.parryTimer > 0.15;
          this.executeDeflection(p, ball, isPerfect);
        } else if (d <= p.radius + ball.radius - 2) {
          p.alive = false;
          this.hitStopTimer = 0.095;
          this.screenShake = 14;
          sfx.playKODisassembly();
          this.spawnKOMechanicalParts(p.x, p.y, p.bodyColor);
          this.addCallout(p.x, p.y - 26, '¡DESARMADO!', '#FF4F00');

          const remaining = this.players.filter((pl) => pl.alive);
          const botsActive = this.botDifficulty !== 'OFF';
          const totalActive = this.players.filter((pl) => !pl.isBot || botsActive).length;

          if (remaining.length <= 1 && totalActive > 1) {
            const winner = remaining[0] || null;
            if (winner) {
              winner.score += 1;
              this.lastRoundWinnerId = winner.id;
            } else {
              this.lastRoundWinnerId = null;
            }

            if (winner && winner.score >= WINNING_SCORE) {
              setTimeout(() => {
                this.phase = 'MATCH_OVER';
                this.onPhaseChange?.();
              }, 700);
            } else {
              this.draftOptions = pickRandomModIds(3);
              setTimeout(() => {
                this.phase = 'CARD_DRAFT';
                this.onPhaseChange?.();
              }, 700);
            }
          } else if (remaining.length === 0) {
            this.spawnRound();
          } else {
            ball.ownerId = -1;
            ball.speed = Math.max(ball.baseSpeed * 1.12, ball.speed * 0.78);
            ball.targetId = remaining[Math.floor(Math.random() * remaining.length)].id;
            ball.passId = this.nextPassId++;
          }
        }
      });
    });
  }

  public getSnapshot(): WorldSnapshotPacket {
    return {
      activeGame: 'BASH_BOT',
      tick: this.tick,
      phase: this.phase,
      courtLayout: this.courtLayout,
      roundTimer: this.roundTimer,
      multiballActive: this.multiballActive,
      comboCount: this.comboCount,
      lastRoundWinnerId: this.lastRoundWinnerId,
      draftOptions: this.draftOptions,
      players: this.players,
      balls: this.balls,
      bumpers: this.bumpers
    };
  }

  public applySnapshot(snap: WorldSnapshotPacket): void {
    const prevPhase = this.phase;
    this.tick = snap.tick;
    this.phase = snap.phase;
    this.courtLayout = snap.courtLayout;
    this.roundTimer = snap.roundTimer;
    this.multiballActive = snap.multiballActive;
    this.comboCount = snap.comboCount;
    this.lastRoundWinnerId = snap.lastRoundWinnerId;
    this.draftOptions = snap.draftOptions;
    this.players = snap.players;
    this.balls = snap.balls;
    this.bumpers = snap.bumpers;
    if (prevPhase !== this.phase) {
      this.onPhaseChange?.();
    }
  }

  public spawnDust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 90;
      this.particles.push({
        type: 'dust',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1.0,
        decay: 2.2 + Math.random(),
        color: '#F4F0E8',
        size: 5 + Math.random() * 5
      });
    }
  }

  public spawnImpactSparks(x: number, y: number, color: string, count: number): void {
    this.particles.push({
      type: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 1.0,
      decay: 4.5,
      color: '#18181B',
      size: 9
    });
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 85 + Math.random() * 210;
      this.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1.0,
        decay: 2.5 + Math.random() * 1.4,
        color,
        size: 4 + Math.random() * 3
      });
    }
  }

  public spawnKOMechanicalParts(x: number, y: number, bodyColor: string): void {
    this.spawnDust(x, y, 12);
    for (let i = 0; i < 9; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 65 + Math.random() * 150;
      this.looseParts.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
        color: i % 2 === 0 ? bodyColor : '#71717A'
      });
    }
  }

  public addCallout(
    x: number,
    y: number,
    text: string,
    bgColor: string,
    textColor = '#F4F0E8'
  ): void {
    this.callouts.push({ x, y, text, bgColor, textColor, life: 1.0 });
  }
}
