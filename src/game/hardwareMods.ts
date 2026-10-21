import { HardwareMod, PlayerState } from '../types';

export const HARDWARE_MODS: HardwareMod[] = [
  {
    id: 'heavy_paddle',
    code: 'MOD-01',
    title: 'Bate Anodizado XL',
    desc: '+35% alcance del bate mecánico y ventana de bloqueo más amplia.',
    tag: 'CHASIS',
    color: '#FF4F00'
  },
  {
    id: 'gyro_spin',
    code: 'MOD-02',
    title: 'Giroscopio con Efecto',
    desc: 'Tus batazos imprimen curva lateral fuerte para engañar el timing rival.',
    tag: 'BALÍSTICA',
    color: '#1B4DFF'
  },
  {
    id: 'pneumatic_dash',
    code: 'MOD-03',
    title: 'Pistón Neumático',
    desc: '-40% recarga de impulso y +20% velocidad de desplazamiento.',
    tag: 'MOTOR',
    color: '#15803D'
  },
  {
    id: 'overdrive_spring',
    code: 'MOD-04',
    title: 'Resorte de Titanio',
    desc: 'Tus batazos perfectos aceleran la bola un +45% adicional de golpe.',
    tag: 'POTENCIA',
    color: '#F59E0B'
  },
  {
    id: 'bumper_shock',
    code: 'MOD-05',
    title: 'Parachoques Sísmico',
    desc: 'Al activar tu impulso empujas violentamente a los amigos cercanos.',
    tag: 'SABOTAJE',
    color: '#FF4F00'
  },
  {
    id: 'magnet_core',
    code: 'MOD-06',
    title: 'Electroimán de Cierre',
    desc: 'Atrae ligeramente la bola hacia tu paleta cuando activas el bateo.',
    tag: 'CONTROL',
    color: '#1B4DFF'
  }
];

export function applyHardwareMod(player: PlayerState, modId: string): void {
  const mod = HARDWARE_MODS.find((m) => m.id === modId);
  if (!mod) return;

  player.installedModCodes.push(mod.code);

  switch (mod.id) {
    case 'heavy_paddle':
      player.parryRadiusMult *= 1.32;
      player.parryWindowBonus += 0.05;
      break;
    case 'gyro_spin':
      player.curvePower += 1.4;
      break;
    case 'pneumatic_dash':
      player.dashCooldownMult *= 0.62;
      player.speedMult *= 1.18;
      break;
    case 'overdrive_spring':
      player.smashPower *= 1.42;
      break;
    case 'bumper_shock':
      player.dashShockwave = true;
      break;
    case 'magnet_core':
      player.magnetPull = true;
      player.parryRadiusMult *= 1.15;
      break;
  }
}

export function pickRandomModIds(count = 3): string[] {
  const copy = [...HARDWARE_MODS].sort(() => Math.random() - 0.5);
  return copy.slice(0, count).map((m) => m.id);
}
