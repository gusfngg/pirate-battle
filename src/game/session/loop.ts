export const FIXED_STEP = 1 / 60;

// a slow frame never turns into a huge jump, the simulation just catches up a bit
const MAX_FRAME = 0.25;

export class FixedStepLoop {
  private accumulator = 0;

  advance(frameSeconds: number, step: (dt: number) => void) {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), MAX_FRAME);
    let steps = 0;
    while (this.accumulator >= FIXED_STEP) {
      step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps++;
    }
    return steps;
  }

  reset() {
    this.accumulator = 0;
  }
}
