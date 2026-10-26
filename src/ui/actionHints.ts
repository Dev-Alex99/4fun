import type { ActiveGameId } from '../types';
import type { ArenaEngine } from '../game/arenaEngine';
import type { ChainPanicEngine } from '../game/chainPanicEngine';
import type { CargoCrewEngine } from '../game/cargoCrewEngine';
import type { PuttWarEngine } from '../game/puttWarEngine';
import type { HotCoreEngine } from '../game/hotCoreEngine';
import type { VoltCrownEngine } from '../game/voltCrownEngine';
import type { HexCrushEngine } from '../game/hexCrushEngine';
import type { RicochetEngine } from '../game/ricochetEngine';

export interface ActionCue {
  label: string;
  hint: string;
  cooldown: number;
  progress: number;
  available: boolean;
  active?: boolean;
  hidden?: boolean;
}
export interface ActionPresentation {
  A: ActionCue; B: ActionCue; E: ActionCue;
  message: string;
  tone: 'info' | 'warning' | 'danger' | 'success';
}
export interface ActionContext {
  game: ActiveGameId; slot: number; touch: boolean; connected: boolean; blocked: boolean; holdingA: boolean;
  arena: ArenaEngine; chain: ChainPanicEngine; cargo: CargoCrewEngine; putt: PuttWarEngine;
  hot: HotCoreEngine; volt: VoltCrownEngine; hex: HexCrushEngine; ricochet: RicochetEngine;
}
const cue = (label: string, hint: string, cooldown = 0, total = 1): ActionCue => ({
  label, hint, cooldown: Math.max(0, cooldown), progress: Math.max(0, Math.min(1, 1 - cooldown / total)), available: cooldown <= 0
});

/** Presentation reads the same ranges and cooldowns as gameplay; it never mutates a game. */
export function actionPresentation(c: ActionContext): ActionPresentation {
  const primary = c.touch ? 'A' : 'ESPACIO', secondary = c.touch ? 'B' : 'SHIFT';
  const result: ActionPresentation = { A: cue('BATEAR', 'Devuelve la bola'), B: cue('TURBO', 'Esquiva'),
    E: cue('AMAGO', 'Prepara un golpe con curva'), message: '', tone: 'info' };
  if (c.game === 'BASH_BOT') {
    const p = c.arena.players[c.slot];
    result.A = { ...cue('BATEAR', 'Devuelve la bola; mantén para cargar', p.parryCooldown, 0.42), active: c.holdingA || p.parryTimer > 0 };
    result.B = cue('TURBO', 'Esquiva con un impulso', p.dashCooldown, 1.2 * p.dashCooldownMult);
    result.E = { ...cue('AMAGO', 'Prepara un golpe con curva'), active: p.feintPrimed };
    result.message = `Mira a quién apunta la bola y pulsa ${primary} justo antes del impacto.`;
    if (!p.alive) result.A.available = result.B.available = result.E.available = false;
  } else if (c.game === 'CHAIN_PANIC') {
    const p = c.chain.players[c.slot], active = c.chain.getActivePlayers(), index = active.indexOf(p);
    const friend = active.find((other, i) => Math.abs(i - index) === 1 && other.isDangling);
    result.A = { ...cue('SALTAR', 'Salta sobre los láseres'), available: p.onGround && !p.isDangling };
    result.B = { ...cue('ANCLAR', 'Mantén para anclarte'), available: !p.isDangling, active: p.isAnchored };
    result.E = cue(friend ? 'RESCATAR' : 'TIRAR', 'Tira de los vecinos de tu cadena', p.yankCooldown, 1.1);
    if (p.isDangling) { result.message = '¡Cuelgas del cable! Pide a tu vecino que se ancle y tire con E.'; result.tone = 'danger'; }
    else if (friend) { result.message = `${friend.name} cuelga. Mantén ${secondary} para anclar y pulsa E para rescatar.`; result.tone = 'warning'; }
    else if (c.chain.windWarning || c.chain.windActive) { result.message = `¡Turbina! Mantén ${secondary} para resistir el viento.`; result.tone = 'warning'; }
    else result.message = `Activen los interruptores y crucen juntos. ${primary}: saltar · E: tirar del cable.`;
  } else if (c.game === 'CARGO_CREW') {
    const p = c.cargo.players[c.slot], distance = Math.hypot(p.x - c.cargo.battery.x, p.y - c.cargo.battery.y);
    result.A = { ...cue(p.gripping ? 'SOLTAR' : 'ENGANCHAR', p.gripping ? 'Suelta tu cable' : distance <= 86 ? 'Engancha la batería' : 'Acércate a la batería para enganchar'), available: p.gripping || distance <= 86, active: p.gripping };
    result.B = { ...cue('ANCLAR', 'Mantén para resistir las cintas'), active: p.isAnchored };
    result.E = { ...cue('REPARAR', distance > 96 ? 'Acércate a la batería para reparar' : c.cargo.integrity >= 100 ? 'La batería ya está al 100%' : 'Repara 12 puntos de integridad', p.toolCooldown, 8),
      available: distance <= 96 && c.cargo.integrity < 100 && p.toolCooldown <= 0 };
    const feedback = c.cargo.feedback;
    if (feedback && c.cargo.elapsedSeconds - feedback.atSeconds < 3.5) {
      result.message = feedback.text; result.tone = ['PIT', 'FALL', 'CRANE'].includes(feedback.kind) ? 'danger' : 'success';
    } else if (c.cargo.craneActive || c.cargo.craneWarning) { result.message = c.cargo.craneActive ? '¡Grúa abajo! Mantén la batería fuera de la zona roja.' : '¡La grúa va a bajar! Detén o desvía la carga.'; result.tone = 'warning'; }
    else if (distance > 86 && !p.gripping) result.message = `Acércate a la batería hasta que se ilumine el enganche de ${primary}.`;
    else if (c.cargo.integrity < 100 && distance <= 96) result.message = p.toolCooldown > 0 ? 'La herramienta se está recargando. Mantén la carga lejos de las grúas.' : 'Reparación disponible: pulsa E cerca de la batería.';
    else result.message = p.gripping ? `${primary}: soltar el cable · mantén ${secondary} para frenar las cintas.` : `Pulsa ${primary} para enganchar. Los ayudantes bot siguen tu movimiento.`;
  } else if (c.game === 'TURBO_PUTT') {
    const p = c.putt.players[c.slot];
    result.A = { ...cue(p.isCharging ? 'SOLTAR' : 'CARGAR', 'Mantén y suelta para golpear', p.puttCooldown, 0.65), active: p.isCharging };
    result.B = cue(p.heldPowerup === 'NITRO' ? 'NITRO' : p.heldPowerup === 'ANVIL' ? 'YUNQUE' : 'PULSO', 'Usa el potenciador o el pulso', ['NITRO', 'ANVIL'].includes(p.heldPowerup) ? 0 : p.shockwaveCooldown, 4.2);
    result.E = cue(p.heldPowerup === 'BAZOOKA' ? 'COHETE' : 'MINA', 'Lanza tu arma', p.heldPowerup === 'BAZOOKA' ? 0 : p.bombCooldown, 3.8);
    result.message = p.sunkInCup ? '¡Bola embocada! Espera a que termine el hoyo.' : `Mantén ${primary} para cargar y suelta para golpear. La barra muestra la potencia.`;
    if (p.sunkInCup) result.A.available = result.B.available = result.E.available = false;
  } else if (c.game === 'HOT_CORE') {
    const p = c.hot.players[c.slot], carrying = c.hot.core.holderId === p.id;
    result.A = cue(carrying ? 'LANZAR' : 'ESCUDO', carrying ? 'Lanza el núcleo antes de que explote' : 'Refleja el lanzamiento rival', carrying ? 0 : p.shieldCooldown, 0.68);
    result.B = cue('TURBO', 'Esquiva o placa al portador', p.dashCooldown, 1.05);
    result.E = cue(carrying ? 'SOBRECARGA' : 'EMP', 'Activa el pulso del núcleo', p.empCooldown, 2.6);
    result.message = carrying ? `¡Tienes el núcleo! Pulsa ${primary} para lanzarlo antes de que termine la mecha.` : `${primary}: escudo para reflejar el núcleo · ${secondary}: perseguir o esquivar.`;
    if (carrying && c.hot.core.fuseTimer < 3) result.tone = 'danger';
    if (!p.alive) result.A.available = result.B.available = result.E.available = false;
  } else if (c.game === 'VOLT_CROWN') {
    const p = c.volt.players[c.slot], king = c.volt.crown.holderId === p.id;
    result.A = cue(king ? 'ESCUDO' : 'TÁSER', king ? 'Defiende la corona' : 'Dispara al rival', king ? p.shieldCooldown : p.taserCooldown, king ? 0.75 : 1.15);
    result.B = cue('TURBO', 'Persigue o escapa', p.dashCooldown, 1.05);
    result.E = cue(king ? 'PULSO' : 'TRAMPA', king ? 'Aleja a los perseguidores' : 'Activa una trampa cercana', king ? p.dashCooldown : 0, 2.8);
    const allyKing = c.volt.crown.holderId !== null && c.volt.areAllies(p.id, c.volt.crown.holderId);
    result.message = king ? `Llevas la corona. ${primary}: escudo · E: pulso para alejar rivales.` : allyKing ? 'Tu compañero lleva la corona. Protégelo e intercepta a sus perseguidores.' : `Dispara con ${primary} para quitar la corona al rival.`;
    if (!p.alive || p.stunTimer > 0) result.A.available = result.B.available = result.E.available = false;
  } else if (c.game === 'HEX_CRUSH') {
    const p = c.hex.players[c.slot], airborne = p.z > 4;
    result.A = cue('MARTILLO', 'Rompe las losetas frente a ti', p.hammerCooldown, 1.15);
    result.B = cue(airborne ? 'PISOTÓN' : 'SALTAR', airborne ? 'Vuelve a pulsar para caer con fuerza' : 'Salta entre losetas', airborne ? 0 : p.jumpCooldown, 1.6);
    if (p.isGroundPounding) result.B.available = false;
    result.E = cue('PUENTE', 'Crea losetas de emergencia', p.bridgeCooldown, 7.5);
    result.message = airborne ? `Pulsa ${secondary} de nuevo para pisotear. E crea un puente de emergencia.` : 'El suelo cede si te quedas quieto. Conserva una ruta de escape.';
    if (!p.alive || p.stunTimer > 0 || p.fallTimer > 0) result.A.available = result.B.available = result.E.available = false;
  } else if (c.game === 'RICOCHET_1') {
    const p = c.ricochet.players[c.slot];
    result.A = cue('PARRY', 'Devuelve la bala con precisión', p.parryCooldown, 0.45);
    result.B = cue('BARRIDA', 'Esquiva por debajo de la bala', p.slideCooldown, 0.85);
    result.E = { ...cue('', ''), hidden: true, available: false };
    result.message = `${primary}: parry · ${secondary}: barrida. Los espejos cambian la trayectoria.`;
    if (!p.alive) result.A.available = result.B.available = false;
  }
  if (!c.connected || c.blocked) {
    result.A.available = result.B.available = result.E.available = false;
    result.A.active = result.B.active = result.E.active = false;
    if (!c.connected) { result.message = 'Reconectando con la sala… tus controles volverán al recibir el estado del anfitrión.'; result.tone = 'warning'; }
  }
  return result;
}
