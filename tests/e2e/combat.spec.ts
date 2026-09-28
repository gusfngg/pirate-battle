import { advance, expect, holdKey, openApp, spawnEnemy, startMatch, test } from "./support";

// o jogador começa em (800, 430) olhando pra cima, os inimigos de teste nascem perto dele
test.describe("combat", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
  });

  test("the bow cannon fires one ball forward and respects its cooldown", async ({ page }) => {
    const state = await holdKey(page, "Space", 350);
    const balls = state.projectiles.filter((ball) => ball.side === "player");
    expect(balls).toHaveLength(1);
    expect(balls[0]!.y).toBeLessThan(430);
    expect(balls[0]!.x).toBeCloseTo(800, 0);
    expect(state.player.cooldowns.front).toBeGreaterThan(0);

    // segurando por 1s a 0.4s de recarga: tiros em 0, 0.4 e 0.8
    await advance(page, 2000);
    await page.keyboard.down("Space");
    let fired = 0;
    let previous = 0;
    for (let i = 0; i < 60; i++) {
      const tick = await advance(page, 1000 / 60);
      if (tick.player.cooldowns.front > previous) fired++;
      previous = tick.player.cooldowns.front;
    }
    await page.keyboard.up("Space");
    expect(fired).toBe(3);
  });

  test("each broadside fires three parallel balls to its side", async ({ page }) => {
    const left = await holdKey(page, "KeyQ", 100);
    const leftBalls = left.projectiles.filter((ball) => ball.side === "player");
    expect(leftBalls).toHaveLength(3);
    for (const ball of leftBalls) expect(ball.x).toBeLessThan(800);
    const rows = leftBalls.map((ball) => ball.y).sort((a, b) => a - b);
    expect(rows[1]! - rows[0]!).toBeCloseTo(22, 0);
    expect(left.player.cooldowns.left).toBeGreaterThan(0);
    expect(left.player.cooldowns.right).toBe(0);

    const right = await holdKey(page, "KeyE", 100);
    const rightBalls = right.projectiles.filter((ball) => ball.side === "player" && ball.x > 800);
    expect(rightBalls).toHaveLength(3);

    // a bordada da esquerda ainda está recarregando
    const again = await holdKey(page, "KeyQ", 100);
    expect(again.projectiles.filter((ball) => ball.side === "player" && ball.x < 800).length).toBeLessThanOrEqual(3);
  });

  test("hits damage the target once and a sunk ship scores exactly one point", async ({ page }) => {
    const id = await spawnEnemy(page, "shooter", 660, 430, Math.PI / 2);
    // três balas da bordada somam 102 de dano num shooter de 100 de vida
    await holdKey(page, "KeyQ", 50);
    const state = await advance(page, 600);
    expect(state.enemies.find((enemy) => enemy.id === id)).toBeUndefined();
    expect(state.score).toBe(1);
    await expect(page.getByTestId("status-score")).toHaveText("1");

    const later = await advance(page, 1500);
    expect(later.score).toBe(1);
  });

  test("damage accumulates until the enemy sinks", async ({ page }) => {
    const id = await spawnEnemy(page, "chaser", 800, 250, -Math.PI / 2);
    await holdKey(page, "Space", 50);
    let state = await advance(page, 350);
    const damaged = state.enemies.find((enemy) => enemy.id === id);
    expect(damaged?.health).toBe(60 - 34);
    expect(state.score).toBe(0);

    await holdKey(page, "Space", 50);
    state = await advance(page, 500);
    expect(state.enemies.find((enemy) => enemy.id === id)).toBeUndefined();
    expect(state.score).toBe(1);
  });

  test("islands stop cannon balls", async ({ page }) => {
    // atira pra esquerda na direção da ilha skull-beach a partir da água
    await page.evaluate(() => window.__pirate!.teleportPlayer(560, 660, Math.PI));
    const fired = await holdKey(page, "Space", 50);
    expect(fired.projectiles.filter((ball) => ball.side === "player")).toHaveLength(1);
    const state = await advance(page, 400);
    expect(state.projectiles.filter((ball) => ball.side === "player")).toHaveLength(0);
  });
});
