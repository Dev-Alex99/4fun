/**
 * Local movement the host has not applied yet: the client's own predicted displacement after the
 * newest input the host acknowledged. Adding it to host state cancels the one-RTT lag of a snapshot.
 */
export interface PredictionOffset { dx: number; dy: number; dz?: number }
/** Seconds of velocity lead (legacy hosts without input acknowledgements) or an acknowledged offset. */
export type PredictionHint = number | PredictionOffset;

/** Larger offsets mean the prediction no longer describes host state; converge to the host instead. */
const MAX_PREDICTION_OFFSET = 360;
/**
 * Timers started by the local player's own abilities. While that action is still in flight the host copy
 * is one RTT old, so keeping the larger value stops a predicted dash or cooldown from being cut short.
 */
const SELF_TIMERS = ['parryTimer', 'parryCooldown', 'dashTimer', 'dashCooldown', 'slideTimer', 'slideCooldown',
  'shieldTimer', 'shieldCooldown', 'hammerCooldown', 'jumpCooldown', 'bridgeCooldown', 'yankCooldown',
  'empCooldown', 'taserCooldown', 'puttCooldown', 'bombCooldown', 'shockwaveCooldown'];

function usableOffset(hint: PredictionHint): PredictionOffset | null {
  if (typeof hint === 'number') return null;
  if (!Number.isFinite(hint.dx) || !Number.isFinite(hint.dy) || (hint.dz !== undefined && !Number.isFinite(hint.dz))) return null;
  return Math.hypot(hint.dx, hint.dy) <= MAX_PREDICTION_OFFSET ? hint : null;
}

/** Snapshot correction preserves immediate local input while always converging to host authority. */
export function reconcilePlayer<T extends { x: number; y: number; vx: number; vy: number }>(
  previous: T | undefined,
  authoritative: T,
  local: boolean,
  reset: boolean,
  prediction: PredictionHint = 0
): T {
  if (!previous || reset) return { ...authoritative };
  const state = authoritative as T & { alive?: boolean; stunTimer?: number; fallTimer?: number; isDangling?: boolean; sunkInCup?: boolean };
  const canLead = local && state.alive !== false && !state.isDangling && !state.sunkInCup
    && !(state.stunTimer && state.stunTimer > 0) && !(state.fallTimer && state.fallTimer > 0);
  const offset = canLead ? usableOffset(prediction) : null;
  let target: T;
  if (offset) {
    target = { ...authoritative, x: authoritative.x + offset.dx, y: authoritative.y + offset.dy };
    const z = (authoritative as Record<string, unknown>).z;
    if (typeof z === 'number' && offset.dz !== undefined) (target as Record<string, unknown>).z = Math.max(0, z + offset.dz);
  } else {
    const leadSeconds = typeof prediction === 'number' ? prediction : 0;
    const lead = canLead && Number.isFinite(leadSeconds)
      ? Math.max(0, Math.min(0.12, leadSeconds, 60 / (Math.hypot(authoritative.vx, authoritative.vy) || 1))) : 0;
    // Lead uses only host velocity and measured RTT. It never accepts a client's claimed position.
    target = { ...authoritative, x: authoritative.x + authoritative.vx * lead, y: authoritative.y + authoritative.vy * lead };
  }
  const distance = Math.hypot(target.x - previous.x, target.y - previous.y);
  if (distance >= (local ? 120 : 160)) return target;
  // A nonzero correction is essential: permanently ignoring a moving player's host state
  // lets small collision/prediction errors accumulate and makes hits disagree across peers.
  const blend = local ? (distance > 48 ? 0.35 : 0.18) : 0.55;
  const result: T = {
    ...target,
    x: previous.x + (target.x - previous.x) * blend,
    y: previous.y + (target.y - previous.y) * blend
  };
  if (!local) {
    result.vx = authoritative.vx; result.vy = authoritative.vy;
  } else if (offset) {
    // Host velocity is one RTT old. Keep the predicted velocity unless the host clearly disagrees
    // (knockback, collision), in which case its velocity is blended in like a position correction.
    const velocityBlend = distance > 24 ? 0.35 : 0;
    result.vx = previous.vx + (authoritative.vx - previous.vx) * velocityBlend;
    result.vy = previous.vy + (authoritative.vy - previous.vy) * velocityBlend;
    const before = previous as Record<string, unknown>, host = authoritative as Record<string, unknown>;
    const out = result as Record<string, unknown>;
    if (typeof before.z === 'number' && typeof out.z === 'number') {
      out.z = before.z + (out.z - before.z) * blend;
      if (typeof before.vz === 'number') out.vz = before.vz;
    }
    for (const key of SELF_TIMERS) {
      if (typeof before[key] === 'number' && typeof host[key] === 'number') out[key] = Math.max(before[key] as number, host[key] as number);
    }
  } else {
    result.vx = previous.vx + (authoritative.vx - previous.vx) * 0.25;
    result.vy = previous.vy + (authoritative.vy - previous.vy) * 0.25;
  }
  return result;
}
