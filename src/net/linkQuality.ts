/**
 * Link-quality estimates that let fixed protocol windows stretch for slow or jittery players.
 * Samples come only from challenges the measuring side issued itself; remote clocks are never trusted.
 */
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** RFC 6298 smoothed round-trip time and mean deviation. */
export class RttEstimator {
  public srtt = 0;
  public rttvar = 0;
  public samples = 0;

  public add(sampleMs: number): void {
    if (!Number.isFinite(sampleMs) || sampleMs < 0) return;
    const sample = Math.min(sampleMs, 10000);
    if (this.samples === 0) {
      this.srtt = sample;
      this.rttvar = sample / 2;
    } else {
      this.rttvar = 0.75 * this.rttvar + 0.25 * Math.abs(this.srtt - sample);
      this.srtt = 0.875 * this.srtt + 0.125 * sample;
    }
    this.samples++;
  }

  public reset(): void {
    this.srtt = 0; this.rttvar = 0; this.samples = 0;
  }
}

/** Time without a fresh snapshot before a client pauses prediction. 500 ms until the link is measured. */
export function syncGraceMs(rtt: RttEstimator): number {
  return rtt.samples ? clamp(350 + rtt.srtt + 4 * rtt.rttvar, 500, 1500) : 500;
}

/** Maximum age, on the host clock, of the snapshot an input refers to. 500 ms until the link is measured. */
export function inputFreshnessMs(rtt: RttEstimator | undefined): number {
  return rtt?.samples ? clamp(250 + rtt.srtt + 4 * rtt.rttvar, 500, 1500) : 500;
}

/** Gap in a peer's input stream before the host neutralizes held controls. 250 ms on a steady link. */
export function inputExpiryMs(rtt: RttEstimator | undefined): number {
  return rtt?.samples ? clamp(250 + 2 * rtt.rttvar, 250, 600) : 250;
}
