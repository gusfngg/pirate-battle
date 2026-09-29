import { describe, expect, it } from "vitest";
import { createMatchConfig } from "../config";
import { Simulation } from "../sim/simulation";
import { ARENA_LAYOUT } from "../world/layout";
import { crossedWarningSecond, readHud } from "./hud-state";

function state() {
  const config = createMatchConfig({ sessionSeconds: 60, spawnSeconds: 5 }, { countdownSeconds: 0 });
  return new Simulation({ config, layout: ARENA_LAYOUT, seed: 1 }).state;
}

describe("hud state", () => {
  it("rounds continuous values up to whole numbers", () => {
    const match = state();
    match.remaining = 42.01;
    match.player.health = 66.2;
    const hud = readHud(match, null);
    expect(hud.remainingSeconds).toBe(43);
    expect(hud.health).toBe(67);
  });

  it("keeps the same numbers for a whole second, so react does not re-render every frame", () => {
    const match = state();
    match.remaining = 30.9;
    const first = readHud(match, null);
    match.remaining = 30.1;
    expect(readHud(match, null)).toEqual(first);
  });

  it("warns once per second in the last ten seconds of a running match", () => {
    const match = state();
    match.remaining = 11;
    const before = readHud(match, null);
    match.remaining = 10;
    expect(crossedWarningSecond(before, readHud(match, null))).toBe(true);
    expect(crossedWarningSecond(readHud(match, null), readHud(match, null))).toBe(false);
    match.remaining = 20;
    const early = readHud(match, null);
    match.remaining = 19;
    expect(crossedWarningSecond(early, readHud(match, null))).toBe(false);
  });
});
