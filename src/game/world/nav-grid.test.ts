import { describe, expect, it } from "vitest";
import { createRandom } from "../random";
import { ARENA_LAYOUT } from "./layout";
import { buildNavGrid, findPath, hasClearLine, type NavGrid } from "./nav-grid";
import { buildObstacles, hitsAnyObstacle } from "./obstacles";

const obstacles = buildObstacles(ARENA_LAYOUT);
const grid = buildNavGrid(obstacles, 1600, 896, 26);

function isOpen(g: NavGrid, x: number, y: number) {
  return g.blocked[Math.floor(y / g.cell) * g.columns + Math.floor(x / g.cell)] === 0;
}

function everySegmentClear(from: { x: number; y: number }, route: { x: number; y: number }[]) {
  let anchor = from;
  for (const point of route) {
    if (!hasClearLine(grid, anchor, point)) return false;
    anchor = point;
  }
  return true;
}

describe("navigation grid", () => {
  it("blocks islands and the arena rim and keeps open water free", () => {
    expect(isOpen(grid, 256, 192)).toBe(false); // meio da ilha palm-grove
    expect(isOpen(grid, 8, 400)).toBe(false); // colado na borda
    expect(isOpen(grid, 800, 430)).toBe(true); // onde o jogador nasce
  });

  it("goes straight when nothing is in the way", () => {
    const target = { x: 900, y: 430 };
    expect(findPath(grid, { x: 700, y: 430 }, target)).toEqual([target]);
  });

  it("routes around an island with a few clear legs", () => {
    // de baixo pra cima da turtle-isle (x 832..1152, y 512..768)
    const from = { x: 1000, y: 830 };
    const to = { x: 1000, y: 440 };
    expect(hasClearLine(grid, from, to)).toBe(false);

    const route = findPath(grid, from, to)!;
    expect(route.length).toBeGreaterThan(1);
    expect(route.length).toBeLessThan(6);
    expect(route[route.length - 1]).toEqual(to);
    expect(everySegmentClear(from, route)).toBe(true);
  });

  it("finds clear routes between random points on open water quickly", () => {
    const random = createRandom(9);
    const points: { x: number; y: number }[] = [];
    while (points.length < 120) {
      const point = { x: random.range(40, 1560), y: random.range(40, 856) };
      // alvos reais são centros de casco, que a colisão nunca deixa a menos de 26px de uma ilha
      if (!hitsAnyObstacle(obstacles, point.x, point.y, 26)) points.push(point);
    }

    const started = performance.now();
    for (let i = 0; i < points.length - 1; i++) {
      const route = findPath(grid, points[i]!, points[i + 1]!);
      expect(route).not.toBeNull();
      expect(everySegmentClear(points[i]!, route!)).toBe(true);
    }
    // um inimigo recalcula a cada 0.5s, então isso cobre muito mais do que uma partida real pede
    expect(performance.now() - started).toBeLessThan(500);
  });
});
