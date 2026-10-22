/** Snapshot correction preserves immediate local input while always converging to host authority. */
export function reconcilePlayer<T extends { x: number; y: number; vx: number; vy: number }>(
  previous: T | undefined,
  authoritative: T,
  local: boolean,
  reset: boolean,
  predictionLeadSeconds = 0
): T {
  if (!previous || reset) return { ...authoritative };
  const state = authoritative as T & { alive?: boolean; stunTimer?: number; fallTimer?: number; isDangling?: boolean; sunkInCup?: boolean };
  const canLead = local && state.alive !== false && !state.isDangling && !state.sunkInCup
    && !(state.stunTimer && state.stunTimer > 0) && !(state.fallTimer && state.fallTimer > 0);
  const lead = canLead && Number.isFinite(predictionLeadSeconds)
    ? Math.max(0, Math.min(0.12, predictionLeadSeconds, 60 / (Math.hypot(authoritative.vx, authoritative.vy) || 1))) : 0;
  // Lead uses only host velocity and measured RTT. It never accepts a client's claimed position.
  const target = { ...authoritative, x: authoritative.x + authoritative.vx * lead, y: authoritative.y + authoritative.vy * lead };
  const distance = Math.hypot(target.x - previous.x, target.y - previous.y);
  if (distance >= (local ? 120 : 160)) return target;
  // A nonzero correction is essential: permanently ignoring a moving player's host state
  // lets small collision/prediction errors accumulate and makes hits disagree across peers.
  const blend = local ? (distance > 48 ? 0.35 : 0.18) : 0.55;
  return {
    ...target,
    x: previous.x + (target.x - previous.x) * blend,
    y: previous.y + (target.y - previous.y) * blend,
    vx: local ? previous.vx + (authoritative.vx - previous.vx) * 0.25 : authoritative.vx,
    vy: local ? previous.vy + (authoritative.vy - previous.vy) * 0.25 : authoritative.vy
  };
}
