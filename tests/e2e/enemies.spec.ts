import { advance, expect, openApp, readState, spawnEnemy, startMatch, teleportPlayer, test } from "./support";

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test.describe("enemies", () => {
  test("a chaser hunts the player, explodes on impact and gives no point", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
    const id = await spawnEnemy(page, "chaser", 1200, 430, 0);

    const start = await readState(page);
    const chaser = start.enemies.find((enemy) => enemy.id === id)!;
    const closer = await advance(page, 2000);
    const moved = closer.enemies.find((enemy) => enemy.id === id)!;
    expect(distance(moved, closer.player)).toBeLessThan(distance(chaser, start.player));
    // começou olhando pro lado oposto e virou na direção do jogador
    expect(Math.abs(moved.angle)).toBeGreaterThan(1.5);

    const after = await advance(page, 4000);
    expect(after.enemies.find((enemy) => enemy.id === id)).toBeUndefined();
    expect(after.player.health).toBe(75);
    expect(after.score).toBe(0);
  });

  test("a chaser steers around an island instead of getting stuck", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
    // jogador acima da ilha turtle-isle, chaser embaixo dela
    await teleportPlayer(page, 1000, 440);
    const id = await spawnEnemy(page, "chaser", 1000, 830, -Math.PI / 2);
    const state = await advance(page, 7000);
    expect(state.enemies.find((enemy) => enemy.id === id)).toBeUndefined();
    expect(state.player.health).toBeLessThan(100);
  });

  test("a shooter closes in and fires once in range", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
    await teleportPlayer(page, 500, 430);
    const id = await spawnEnemy(page, "shooter", 1150, 430, Math.PI);

    const start = await readState(page);
    expect(start.projectiles.filter((ball) => ball.side === "enemy")).toHaveLength(0);

    let fired = false;
    let state = start;
    for (let i = 0; i < 32 && !fired; i++) {
      state = await advance(page, 250);
      fired = state.projectiles.some((ball) => ball.side === "enemy");
    }
    const shooter = state.enemies.find((enemy) => enemy.id === id)!;
    expect(fired).toBe(true);
    expect(distance(shooter, state.player)).toBeLessThanOrEqual(430);
    expect(distance(shooter, state.player)).toBeLessThan(distance(start.enemies.find((enemy) => enemy.id === id)!, start.player));

    const hit = await advance(page, 2500);
    expect(hit.player.health).toBeLessThan(100);
  });

  test("enemies spawn on the configured interval and both kinds appear", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 60, spawnSeconds: 2 } } });
    await startMatch(page);
    const total = (state: Awaited<ReturnType<typeof readState>>) => state.spawnedByKind.chaser + state.spawnedByKind.shooter;

    // o primeiro chega aos 1.5s, depois um a cada 2s
    expect(total(await advance(page, 1400))).toBe(0);
    expect(total(await advance(page, 200))).toBe(1);
    expect(total(await advance(page, 1800))).toBe(1);
    expect(total(await advance(page, 300))).toBe(2);
    const later = await advance(page, 6000);
    expect(total(later)).toBe(5);
    expect(later.spawnedByKind.chaser).toBeGreaterThan(0);
    expect(later.spawnedByKind.shooter).toBeGreaterThan(0);
  });

  test("spawn points keep their distance from the player", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 60, spawnSeconds: 1 } } });
    await startMatch(page);
    const seen = new Set<number>();
    for (let i = 0; i < 8; i++) {
      const state = await advance(page, 1000);
      for (const enemy of state.enemies) {
        if (seen.has(enemy.id)) continue;
        seen.add(enemy.id);
        expect(distance(enemy, state.player)).toBeGreaterThan(400);
      }
      await page.evaluate(() => window.__pirate!.setPlayerHealth(100));
    }
    expect(seen.size).toBeGreaterThan(4);
  });
});
