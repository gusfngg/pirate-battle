import { describe, expect, it } from "vitest";
import { ARENA_LAYOUT } from "./layout";
import { buildObstacles, findContact, hitsAnyObstacle, type IslandObstacle, type RockObstacle } from "./obstacles";

const rock: RockObstacle = { kind: "rock", id: "rock", x: 100, y: 100, radius: 20 };
const island: IslandObstacle = { kind: "island", id: "island", x: 0, y: 0, width: 200, height: 100, corner: 20 };

describe("obstacles", () => {
  it("builds one collider per island and rock of the layout", () => {
    expect(buildObstacles(ARENA_LAYOUT)).toHaveLength(ARENA_LAYOUT.islands.length + ARENA_LAYOUT.rocks.length);
  });

  it("pushes a ship out of a rock along the line between centres", () => {
    const contact = findContact(rock, 130, 100, 15);
    expect(contact).not.toBeNull();
    expect(contact!.normalX).toBeCloseTo(1);
    expect(contact!.normalY).toBeCloseTo(0);
    expect(contact!.depth).toBeCloseTo(5);
  });

  it("finds no contact once the ship clears the rock", () => {
    expect(findContact(rock, 140, 100, 15)).toBeNull();
  });

  it("pushes out through the nearest island edge", () => {
    const contact = findContact(island, 100, 110, 15);
    expect(contact!.normalX).toBeCloseTo(0);
    expect(contact!.normalY).toBeCloseTo(1);
    expect(contact!.depth).toBeCloseTo(5);
  });

  it("rounds the island corners", () => {
    // o canto quadrado encostaria, o canto arredondado não
    expect(findContact(island, -8, -8, 10)).toBeNull();
    const diagonal = findContact(island, 5, 5, 10);
    expect(diagonal!.normalX).toBeCloseTo(-Math.SQRT1_2);
    expect(diagonal!.normalY).toBeCloseTo(-Math.SQRT1_2);
  });

  it("escapes through the closest side when the centre is deep inside", () => {
    const contact = findContact(island, 190, 50, 10);
    expect(contact!.normalX).toBe(1);
    expect(hitsAnyObstacle([island, rock], 190, 50, 10)).toBe(true);
  });
});
