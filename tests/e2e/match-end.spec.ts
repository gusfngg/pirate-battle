import { advance, expect, holdKey, openApp, readState, spawnEnemy, startMatch, test } from "./support";

async function surviveFor(page: Parameters<typeof advance>[0], ms: number) {
  // mantém o jogador vivo pra testar o fim por tempo, o resto da simulação segue real
  let state = await readState(page);
  for (let elapsed = 0; elapsed < ms; elapsed += 2000) {
    await page.evaluate(() => window.__pirate!.setPlayerHealth(100));
    state = await advance(page, Math.min(2000, ms - elapsed));
  }
  return state;
}

test.describe("match end", () => {
  test("ends by time and freezes the simulation", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 60, spawnSeconds: 4 } } });
    await startMatch(page);

    const ended = await surviveFor(page, 60_500);
    expect(ended.phase).toBe("ended");
    expect(ended.endReason).toBe("time");
    expect(ended.remaining).toBe(0);
    expect(ended.elapsed).toBeCloseTo(60, 1);
    expect(ended.projectiles).toHaveLength(0);

    // depois do fim nada mais se mexe: nem tempo, nem navios, nem pontos, nem spawns
    await page.keyboard.down("KeyW");
    await page.keyboard.down("Space");
    const frozen = await advance(page, 3000);
    await page.keyboard.up("KeyW");
    await page.keyboard.up("Space");
    expect(frozen.elapsed).toBe(ended.elapsed);
    expect(frozen.player).toEqual(ended.player);
    expect(frozen.enemies).toEqual(ended.enemies);
    expect(frozen.projectiles).toHaveLength(0);
    expect(frozen.spawnedByKind).toEqual(ended.spawnedByKind);

    await expect(page.getByRole("heading", { name: "Battle complete" })).toBeVisible();
    await expect(page.getByTestId("result-reason")).toHaveText("Time up");
    await expect(page.getByTestId("result-duration")).toHaveText("01:00");
  });

  test("ends when the player is destroyed", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
    await page.evaluate(() => window.__pirate!.setPlayerHealth(20));
    await spawnEnemy(page, "chaser", 800, 330, Math.PI / 2);

    const state = await advance(page, 1500);
    expect(state.phase).toBe("ended");
    expect(state.endReason).toBe("destroyed");
    expect(state.player.alive).toBe(false);
    expect(state.score).toBe(0);

    const after = await holdKey(page, "KeyW", 1000);
    expect(after.player.x).toBe(state.player.x);
    expect(after.player.y).toBe(state.player.y);

    await expect(page.getByRole("heading", { name: "Ship destroyed" })).toBeVisible();
    await expect(page.getByTestId("result-reason")).toHaveText("Defeated");
  });

  test("restart builds a brand new match", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 90, spawnSeconds: 1 } } });
    await startMatch(page);
    await spawnEnemy(page, "shooter", 660, 430, Math.PI / 2);
    await holdKey(page, "KeyQ", 50);
    await holdKey(page, "KeyW", 3000);
    const dirty = await readState(page);
    expect(dirty.score).toBe(1);
    expect(dirty.enemies.length).toBeGreaterThan(0);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Restart" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const fresh = await readState(page);
    expect(fresh.paused).toBeNull();
    expect(fresh.score).toBe(0);
    expect(fresh.remaining).toBe(90);
    expect(fresh.elapsed).toBe(0);
    expect(fresh.player.health).toBe(100);
    expect(fresh.player.x).toBe(800);
    expect(fresh.player.y).toBe(430);
    expect(fresh.enemies).toHaveLength(0);
    expect(fresh.projectiles).toHaveLength(0);
    await expect(page.getByTestId("status-score")).toHaveText("0");
    await expect(page.getByTestId("status-time")).toHaveText("01:30");
  });

  test("play again from the result starts clean", async ({ page }) => {
    await openApp(page);
    await startMatch(page);
    await page.evaluate(() => window.__pirate!.setPlayerHealth(1));
    await spawnEnemy(page, "chaser", 800, 330, Math.PI / 2);
    await advance(page, 1500);
    await page.getByRole("button", { name: "Play again" }).click();
    await page.waitForFunction(() => window.__pirate?.getState().elapsed === 0);
    const state = await readState(page);
    expect(state.player.health).toBe(100);
    expect(state.enemies).toHaveLength(0);
    await expect(page.locator("canvas")).toHaveCount(1);
  });
});
