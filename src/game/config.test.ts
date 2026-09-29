import { describe, expect, it } from "vitest";
import { BASE_CONFIG, createMatchConfig, normalizeMatchOptions } from "./config";

describe("match options", () => {
  it("clamps to the documented limits and snaps to the step", () => {
    expect(normalizeMatchOptions({ sessionSeconds: 500, spawnSeconds: 0 })).toEqual({ sessionSeconds: 180, spawnSeconds: 1 });
    expect(normalizeMatchOptions({ sessionSeconds: 94, spawnSeconds: 2.3 })).toEqual({ sessionSeconds: 90, spawnSeconds: 2.5 });
  });

  it("falls back to defaults for missing or broken values", () => {
    expect(normalizeMatchOptions({})).toEqual({ sessionSeconds: 120, spawnSeconds: 3 });
    expect(normalizeMatchOptions({ sessionSeconds: Number.NaN })).toEqual({ sessionSeconds: 120, spawnSeconds: 3 });
  });

  it("gives every match a frozen snapshot and leaves the base config untouched", () => {
    const config = createMatchConfig({ sessionSeconds: 60, spawnSeconds: 5 });
    expect(config.match.durationSeconds).toBe(60);
    expect(config.match.spawnIntervalSeconds).toBe(5);
    expect(Object.isFrozen(config)).toBe(true);
    expect(BASE_CONFIG.match.durationSeconds).toBe(120);
  });
});
