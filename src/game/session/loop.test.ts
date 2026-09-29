import { describe, expect, it } from "vitest";
import { FIXED_STEP, FixedStepLoop } from "./loop";

describe("fixed step loop", () => {
  it("runs as many fixed steps as the elapsed time allows and keeps the rest", () => {
    const loop = new FixedStepLoop();
    const steps: number[] = [];
    expect(loop.advance(0.06, (dt) => steps.push(dt))).toBe(3);
    expect(steps.every((dt) => dt === FIXED_STEP)).toBe(true);
    // sobraram 0.01s do frame anterior, que com mais 0.007s completam um passo
    expect(loop.advance(0.007, () => undefined)).toBe(1);
  });

  it("clamps a huge frame so the simulation never jumps", () => {
    const loop = new FixedStepLoop();
    expect(loop.advance(5, () => undefined)).toBe(15);
  });

  it("ignores negative time and forgets leftovers on reset", () => {
    const loop = new FixedStepLoop();
    expect(loop.advance(-1, () => undefined)).toBe(0);
    loop.advance(FIXED_STEP * 0.9, () => undefined);
    loop.reset();
    expect(loop.advance(FIXED_STEP * 0.2, () => undefined)).toBe(0);
  });
});
