/** One simulation clock shared by foreground frames and the background pump. */
export class FixedStepClock {
  public readonly stepSeconds: number;
  private lastTimeMs: number | null = null;
  private accumulator = 0;

  constructor(hz = 60, private readonly maxSteps = 8) {
    if (!Number.isFinite(hz) || hz <= 0 || !Number.isInteger(maxSteps) || maxSteps < 1) {
      throw new RangeError('Invalid simulation clock configuration');
    }
    this.stepSeconds = 1 / hz;
  }

  public reset(nowMs: number): void {
    this.lastTimeMs = nowMs;
    this.accumulator = 0;
  }

  public advance(nowMs: number, step: (dt: number) => void): number {
    if (!Number.isFinite(nowMs)) return 0;
    if (this.lastTimeMs === null) {
      this.reset(nowMs);
      return 0;
    }
    if (nowMs <= this.lastTimeMs) return 0;
    const elapsed = (nowMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = nowMs;
    // A resumed/suspended tab must not fast-forward seconds of unplayed combat.
    this.accumulator = Math.min(this.accumulator + elapsed, this.stepSeconds * this.maxSteps);
    let steps = 0;
    while (this.accumulator + 1e-9 >= this.stepSeconds && steps < this.maxSteps) {
      this.accumulator -= this.stepSeconds;
      step(this.stepSeconds);
      steps++;
    }
    this.accumulator = Math.max(0, this.accumulator);
    return steps;
  }
}
