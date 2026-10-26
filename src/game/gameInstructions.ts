import type { ActiveGameId } from '../types';
export type PlayableGameId = Exclude<ActiveGameId, 'HUB'>;

interface GameInstructions {
  title: string;
  objective: string;
  actions: [string, string, string?];
  tip: string;
}

export const GAME_INSTRUCTIONS: Record<PlayableGameId, GameInstructions> = {
  CHAIN_PANIC: {
    title: 'CHAIN-PANIC', objective: 'Crucen juntos hasta la extracción. Activen los interruptores para abrir el puente y lleven la batería si el sector tiene una.',
    actions: ['Saltar sobre láseres', 'Mantener para anclarse', 'Tirar del cable y rescatar al vecino'],
    tip: 'Si un compañero cuelga, ancla tu robot y usa el tirón. En campaña, abrir el puente activa un checkpoint.'
  },
  CARGO_CREW: {
    title: 'CARGO-CREW', objective: 'Transporten la batería al reactor en tres etapas. Eviten el vacío y la grúa, y activen los dos seguros de la última entrega.',
    actions: ['Enganchar o soltar cerca de la batería', 'Mantener para anclar y resistir las cintas', 'Reparar cerca de la batería; recarga de 8 segundos'],
    tip: 'La grúa avisa en ámbar antes de bajar. Suelta el cable cuando necesites alejarte para activar un seguro.'
  },
  BASH_BOT: {
    title: 'BASH-BOT',
    objective: 'Devuelve la bola, elimina rivales y llega a 5 puntos para ganar la partida.',
    actions: ['Batear / mantener para cargar', 'Turbo para esquivar', 'Preparar un amago con curva'],
    tip: 'La bola acelera con cada intercambio. Mira a quién apunta antes de batear.'
  },
  HEX_CRUSH: {
    title: 'HEX-CRUSH',
    objective: 'Rompe el suelo bajo tus rivales y sé el último en pie. Gana 3 asaltos para llevarte la partida.',
    actions: ['Martillazo sísmico', 'Saltar / volver a pulsar en el aire para pisotear', 'Crear un nanopuente de emergencia'],
    tip: 'Las losetas también ceden si te quedas quieto. Conserva una ruta de escape.'
  },
  HOT_CORE: {
    title: 'HOT-CORE',
    objective: 'Pasa el núcleo antes de que explote. Sé el último superviviente 5 veces para ganar la partida.',
    actions: ['Lanzar el núcleo / escudo si no lo llevas', 'Turbo para esquivar o placar', 'Pulso EMP / sobrecarga'],
    tip: 'Puedes devolver un lanzamiento activando el escudo justo antes del impacto.'
  },
  VOLT_CROWN: {
    title: 'VOLT-CROWN',
    objective: 'Lleva la corona para cargar tu batería al 100% antes que tus rivales.',
    actions: ['Disparar táser / defender la corona', 'Turbo para perseguir o escapar', 'Activar trampas / pulso'],
    tip: 'Mantener la corona 15 segundos seguidos desata una sobrecarga y da carga extra. ¡Interrumpe al rey!'
  },
  TURBO_PUTT: {
    title: 'TURBO-PUTT',
    objective: 'Sé el primero en embocar. Si nadie lo logra en 90 segundos, gana quien quede más cerca del hoyo.',
    actions: ['Mantener para cargar y soltar para golpear', 'Pulso magnético / usar potenciador', 'Lanzar mina o cohete'],
    tip: 'Todos juegan a la vez. Si alguien emboca, empieza la cuenta atrás para los demás.'
  },
  RICOCHET_1: {
    title: 'RICOCHET-1',
    objective: 'Desvía la bala de plasma contra tus rivales. Gana con 5 KOs o siendo el único con vidas restantes.',
    actions: ['Parry para desviar la bala', 'Barrida para esquivar por debajo'],
    tip: 'Los espejos cambian la trayectoria. Busca una carambola y prepara el siguiente parry.'
  }
};

export function instructionControls(game: PlayableGameId, touch: boolean): Array<{ key: string; action: string }> {
  const [primary, secondary, skill] = GAME_INSTRUCTIONS[game].actions;
  const cooperative = game === 'CHAIN_PANIC' || game === 'CARGO_CREW';
  const controls = [
    { key: touch ? 'JOYSTICK' : 'WASD / FLECHAS', action: cooperative ? 'Mover el robot' : touch ? 'Mover y apuntar' : 'Mover · apunta con el mouse' },
    { key: touch ? 'A' : 'CLIC IZQ / ESPACIO', action: primary },
    { key: touch ? 'B' : 'CLIC DER / SHIFT', action: secondary }
  ];
  if (skill) controls.push({ key: 'E', action: skill });
  return controls;
}
