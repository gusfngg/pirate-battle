import { describe, expect, it } from "vitest";
import { compareRanking, isMatchRecord, type MatchRecord } from "./contracts";

function record(overrides: Partial<MatchRecord>): MatchRecord {
  return {
    matchId: "a",
    playerId: "p",
    playerName: "Captain",
    playedAt: "2026-09-08T12:00:00.000Z",
    score: 10,
    durationMs: 120_000,
    endReason: "time",
    config: { sessionSeconds: 120, spawnSeconds: 3 },
    ...overrides,
  };
}

describe("ranking order", () => {
  it("breaks ties by score, then duration, then date, then id", () => {
    const ranked = [
      record({ matchId: "late", playedAt: "2026-09-08T13:00:00.000Z" }),
      record({ matchId: "sunk", durationMs: 80_000, endReason: "destroyed" }),
      record({ matchId: "best", score: 20 }),
      record({ matchId: "b" }),
      record({ matchId: "a" }),
    ].sort(compareRanking);

    expect(ranked.map((entry) => entry.matchId)).toEqual(["best", "a", "b", "late", "sunk"]);
  });
});

describe("match record validation", () => {
  it("accepts a complete record", () => {
    expect(isMatchRecord(record({}))).toBe(true);
  });

  it("rejects broken records", () => {
    expect(isMatchRecord(record({ score: -1 }))).toBe(false);
    expect(isMatchRecord(record({ score: 1.5 }))).toBe(false);
    expect(isMatchRecord(record({ playedAt: "yesterday" }))).toBe(false);
    expect(isMatchRecord({ ...record({}), endReason: "quit" })).toBe(false);
    expect(isMatchRecord(null)).toBe(false);
  });
});
