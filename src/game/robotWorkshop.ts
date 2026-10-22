/**
 * ROBOT WORKSHOP & COSMETICS ENGINE
 * Hats, Visor LED Colors, and Chassis Skins.
 * Real-time canvas preview and multi-renderer cosmetic overlay.
 */

import { RobotCosmetics, RobotHatId, RobotSkinId, RobotVisorId } from '../types';

export interface CosmeticOption<T> {
  id: T;
  label: string;
  icon?: string;
  desc?: string;
  color?: string;
}

export const ROBOT_HATS: CosmeticOption<RobotHatId>[] = [
  { id: 'NONE', label: 'SIN ACCESORIO', icon: '🚫', desc: 'Chasis limpio de fábrica' },
  { id: 'CROWN', label: 'CORONA ORO', icon: '👑', desc: 'Corona dorada con gemas para el rey' },
  { id: 'CONE', label: 'CONO VIAL', icon: '🚧', desc: 'Cono de obra reflectivo naranja' },
  { id: 'RADAR', label: 'RADAR MILITAR', icon: '📡', desc: 'Antena parabólica giratoria de telemetría' },
  { id: 'PROP', label: 'HÉLICE RETRO', icon: '🚁', desc: 'Rotor giratorio giroscópico superior' },
  { id: 'VIKING', label: 'CASCO VIKINGO', icon: '🪖', desc: 'Casco nórdico con cuernos reforzados' },
  { id: 'HEADPHONES', label: 'AURICULARES DJ', icon: '🎧', desc: 'Auriculares de estudio para alta fidelidad' }
];

export const ROBOT_VISORS: CosmeticOption<RobotVisorId>[] = [
  { id: 'CYAN', label: 'CYAN NEÓN', color: '#00e5ff', desc: 'Luz turquesa futurista' },
  { id: 'AMBER', label: 'ÁMBAR CRT', color: '#ffaa00', desc: 'Fósforo ámbar monitor retro' },
  { id: 'EMERALD', label: 'VERDE MATRIX', color: '#00ff66', desc: 'Terminal verde fósforo' },
  { id: 'MAGENTA', label: 'VIOLETA RETRO', color: '#ff007f', desc: 'Cyberpunk neón intenso' },
  { id: 'RED', label: 'ROJO BERSERK', color: '#ff2222', desc: 'Modo combate destructor' },
  { id: 'WHITE', label: 'BLANCO PUREZA', color: '#f4f0e8', desc: 'Luz fría clásica de fábrica' }
];

export const ROBOT_SKINS: CosmeticOption<RobotSkinId>[] = [
  { id: 'STOCK', label: 'STOCK FACTORY', desc: 'Pintura según posición de jugador' },
  { id: 'STEALTH', label: 'SIGILO MATE', desc: 'Negro carbón militar con bisel dorado', color: '#27272a' },
  { id: 'WARNING', label: 'PELIGRO HAZARD', desc: 'Rayas amarillas y negras de precaución', color: '#f59e0b' },
  { id: 'VAPOR', label: "SYNTHWAVE '84", desc: 'Degradado violeta y magenta retro', color: '#d946ef' }
];

export const DEFAULT_ROBOT_COSMETICS: Readonly<RobotCosmetics> = Object.freeze({
  hat: 'NONE', visor: 'CYAN', skin: 'STOCK'
});

/** Validate persisted, UI, or network data instead of trusting a TypeScript cast. */
export function normalizeRobotCosmetics(value: unknown, fallback: RobotCosmetics = DEFAULT_ROBOT_COSMETICS): RobotCosmetics {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    hat: ROBOT_HATS.some((item) => item.id === data.hat) ? data.hat as RobotHatId : fallback.hat,
    visor: ROBOT_VISORS.some((item) => item.id === data.visor) ? data.visor as RobotVisorId : fallback.visor,
    skin: ROBOT_SKINS.some((item) => item.id === data.skin) ? data.skin as RobotSkinId : fallback.skin
  };
}

export class RobotWorkshopManager {
  public cosmetics: RobotCosmetics = {
    hat: 'NONE',
    visor: 'CYAN',
    skin: 'STOCK'
  };

  constructor() {
    this.loadFromStorage();
  }

  public loadFromStorage(): RobotCosmetics {
    try {
      if (typeof localStorage === 'undefined') return this.cosmetics;
      const savedHat = localStorage.getItem('tp04_robot_hat') as RobotHatId;
      const savedVisor = localStorage.getItem('tp04_robot_visor') as RobotVisorId;
      const savedSkin = localStorage.getItem('tp04_robot_skin') as RobotSkinId;

      if (ROBOT_HATS.some((h) => h.id === savedHat)) this.cosmetics.hat = savedHat;
      if (ROBOT_VISORS.some((v) => v.id === savedVisor)) this.cosmetics.visor = savedVisor;
      if (ROBOT_SKINS.some((s) => s.id === savedSkin)) this.cosmetics.skin = savedSkin;
    } catch {
      // Ignore localStorage read errors
    }
    return this.cosmetics;
  }

  public saveCosmetics(update: Partial<RobotCosmetics>): RobotCosmetics {
    this.cosmetics = normalizeRobotCosmetics(update, this.cosmetics);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tp04_robot_hat', this.cosmetics.hat);
        localStorage.setItem('tp04_robot_visor', this.cosmetics.visor);
        localStorage.setItem('tp04_robot_skin', this.cosmetics.skin);
      }
    } catch {
      // A browser may deny both access to storage and writes to it.
    }
    return this.cosmetics;
  }

  public resolveCosmetics(value: unknown, isLocal = false): RobotCosmetics {
    return normalizeRobotCosmetics(value, value == null && isLocal ? this.cosmetics : DEFAULT_ROBOT_COSMETICS);
  }

  public getVisorColor(visorId?: RobotVisorId): string {
    const v = ROBOT_VISORS.find((item) => item.id === (visorId || DEFAULT_ROBOT_COSMETICS.visor));
    return v?.color || '#00e5ff';
  }

  public getSkinColors(
    skinId: RobotSkinId | undefined,
    defaultBody: string,
    defaultShade: string
  ): { body: string; shade: string } {
    const skin = skinId || DEFAULT_ROBOT_COSMETICS.skin;
    if (skin === 'STEALTH') {
      return { body: '#27272a', shade: '#18181b' };
    }
    if (skin === 'WARNING') {
      return { body: '#f59e0b', shade: '#b45309' };
    }
    if (skin === 'VAPOR') {
      return { body: '#d946ef', shade: '#86198f' };
    }
    return { body: defaultBody, shade: defaultShade };
  }

  public drawSkinStripes(ctx: CanvasRenderingContext2D, skinId: RobotSkinId, x: number, y: number, width: number, height: number, radius: number): void {
    if (skinId !== 'WARNING') return;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.clip();
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 3.5;
    for (let offset = -height; offset < width; offset += 8) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y);
      ctx.lineTo(x + offset + height, y + height);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Draw equipped Hat on top of the robot's head.
   * headX, headY is the center top of the robot chassis (around y = -21 in bot space).
   */
  public drawHat(
    ctx: CanvasRenderingContext2D,
    hatId: RobotHatId,
    headX: number,
    headY: number,
    animTime: number
  ): void {
    if (hatId === 'NONE') return;

    ctx.save();
    ctx.translate(headX, headY);

    if (hatId === 'CROWN') {
      // Golden Crown with 3 points and jewels
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(-15, -12);
      ctx.lineTo(-7, -6);
      ctx.lineTo(0, -15);
      ctx.lineTo(7, -6);
      ctx.lineTo(15, -12);
      ctx.lineTo(13, 0);
      ctx.closePath();
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.2;
      ctx.fill();
      ctx.stroke();

      // Crown rim band
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-13, -2.5, 26, 3);

      // Jewel dots
      ctx.fillStyle = '#ef4444'; // Ruby center
      ctx.beginPath();
      ctx.arc(0, -10, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10b981'; // Emerald left
      ctx.beginPath();
      ctx.arc(-7, -4.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b82f6'; // Sapphire right
      ctx.beginPath();
      ctx.arc(7, -4.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (hatId === 'CONE') {
      // Traffic safety cone
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-11, -1, 22, 3); // base
      ctx.beginPath();
      ctx.moveTo(-9, -1);
      ctx.lineTo(-2, -22);
      ctx.lineTo(2, -22);
      ctx.lineTo(9, -1);
      ctx.closePath();
      ctx.fillStyle = '#ff4f00';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // White reflective tape
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(-4, -14);
      ctx.lineTo(4, -14);
      ctx.lineTo(6, -8);
      ctx.closePath();
      ctx.fillStyle = '#f4f0e8';
      ctx.fill();
    } else if (hatId === 'RADAR') {
      // Spinning telemetry radar dish
      const radarAngle = (animTime * 4.5) % (Math.PI * 2);
      const dishW = Math.cos(radarAngle) * 16;

      // Mount pole
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -9);
      ctx.stroke();

      // Dish arc
      ctx.beginPath();
      ctx.ellipse(0, -9, Math.abs(dishW) + 2, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#71717a';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Flashing telemetry led
      ctx.fillStyle = Math.sin(animTime * 12) > 0 ? '#ef4444' : '#18181b';
      ctx.beginPath();
      ctx.arc(0, -11, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (hatId === 'PROP') {
      // Beanie helicopter spinning propeller
      const bladeW = Math.cos(animTime * 18) * 22;

      // Cap cap
      ctx.beginPath();
      ctx.arc(0, 0, 8, Math.PI, 0);
      ctx.fillStyle = '#3b82f6';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Propeller rod
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -8);
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Spinning blade
      ctx.beginPath();
      ctx.ellipse(0, -8, Math.abs(bladeW) + 3, 2.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1.8;
      ctx.fill();
      ctx.stroke();
    } else if (hatId === 'VIKING') {
      // Viking horned helmet
      ctx.beginPath();
      ctx.arc(0, 0, 15, Math.PI, 0);
      ctx.fillStyle = '#52525b';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.2;
      ctx.fill();
      ctx.stroke();

      // Left horn
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.quadraticCurveTo(-22, -8, -19, -18);
      ctx.quadraticCurveTo(-14, -10, -9, -3);
      ctx.closePath();
      ctx.fillStyle = '#f4f0e8';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Right horn
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.quadraticCurveTo(22, -8, 19, -18);
      ctx.quadraticCurveTo(14, -10, 9, -3);
      ctx.closePath();
      ctx.fillStyle = '#f4f0e8';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    } else if (hatId === 'HEADPHONES') {
      // DJ Studio over-ear headphones
      // Arch band
      ctx.beginPath();
      ctx.arc(0, 4, 18, Math.PI, 0);
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Left earcup
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-21, 3, 6, 12, 3);
      ctx.fill();
      ctx.stroke();

      // Right earcup
      ctx.beginPath();
      ctx.roundRect(15, 3, 6, 12, 3);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render real-time animated robot preview inside Workshop modal canvas
   */
  public renderPreview(
    canvas: HTMLCanvasElement,
    cosmetics: RobotCosmetics,
    animTime: number
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 18;
    const walkCycle = animTime * 4.5;
    const bobY = Math.abs(Math.sin(walkCycle)) * 4;
    const footL = Math.sin(walkCycle) * 4;
    const footR = -Math.sin(walkCycle) * 4;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.7, 1.7); // Zoomed in showcase scale

    // Contact shadow
    ctx.beginPath();
    ctx.ellipse(0, 14, 22, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.2)';
    ctx.fill();

    // Feet
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.roundRect(-12, 5 + footL, 9, 10, 3);
    ctx.roundRect(3, 5 + footR, 9, 10, 3);
    ctx.fill();

    // Upper chassis
    ctx.save();
    ctx.translate(0, -bobY);

    const { body, shade } = this.getSkinColors(cosmetics.skin, '#38bdf8', '#0284c7');

    // Bevel
    ctx.fillStyle = shade;
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-18, -15, 36, 28, 9);
    ctx.fill();
    ctx.stroke();

    // Shell
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-18, -22, 36, 26, 9);
    ctx.fill();
    ctx.stroke();

    // Warning stripes if WARNING skin
    if (cosmetics.skin === 'WARNING') {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 4;
      for (let x = -30; x < 30; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, -24);
        ctx.lineTo(x + 10, 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Default antenna (if not wearing a hat that takes the spot)
    if (cosmetics.hat === 'NONE') {
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(0, -31);
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -32, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f4f0e8';
      ctx.fill();
      ctx.stroke();
    }

    // Visor dark glass
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.roundRect(-13, -16, 26, 13, 4);
    ctx.fill();

    // Visor Expressive Eyes
    const visorColor = this.getVisorColor(cosmetics.visor);
    ctx.fillStyle = visorColor;
    ctx.shadowColor = visorColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-5.5, -9.5, 2.8, 0, Math.PI * 2);
    ctx.arc(5.5, -9.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset blur

    // Render Equipped Hat on Top
    this.drawHat(ctx, cosmetics.hat, 0, -22, animTime);

    ctx.restore(); // chassis bob
    ctx.restore(); // root scale
  }
}

export const robotWorkshop = new RobotWorkshopManager();
