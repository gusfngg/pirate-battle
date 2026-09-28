import { advance, expect, holdKey, openApp, readState, RIGHT, startMatch, teleportPlayer, test, UP } from "./support";

test.describe("movement", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
  });

  test("starts the match with a countdown and full health", async ({ page }) => {
    await openApp(page, { countdown: 3 });
    await startMatch(page);
    let state = await readState(page);
    expect(state.phase).toBe("countdown");
    await expect(page.getByTestId("status-phase")).toHaveText("Get ready");

    state = await advance(page, 3100);
    expect(state.phase).toBe("running");
    expect(state.player.health).toBe(100);
    expect(state.remaining).toBeCloseTo(119.9, 0);
    await expect(page.getByTestId("status-phase")).toHaveText("In battle");
  });

  test("sails forward along the bow", async ({ page }) => {
    const before = await readState(page);
    const after = await holdKey(page, "KeyW", 1000);
    expect(after.player.y).toBeLessThan(before.player.y - 100);
    expect(after.player.x).toBeCloseTo(before.player.x, 0);
    expect(after.player.speed).toBeGreaterThan(100);

    // sem vento: soltar a tecla faz o navio desacelerar até parar
    const coasting = await advance(page, 2500);
    expect(coasting.player.speed).toBe(0);
  });

  test("turns both ways, also while standing still", async ({ page }) => {
    const start = (await readState(page)).player.angle;
    const right = await holdKey(page, "KeyD", 500);
    expect(right.player.angle).toBeGreaterThan(start + 0.3);
    const left = await holdKey(page, "KeyA", 1000);
    expect(left.player.angle).toBeLessThan(right.player.angle - 0.6);
  });

  test("moves and turns at the same time", async ({ page }) => {
    await page.keyboard.down("KeyW");
    await page.keyboard.down("KeyD");
    const state = await advance(page, 1200);
    await page.keyboard.up("KeyW");
    await page.keyboard.up("KeyD");
    expect(state.player.angle).toBeGreaterThan(UP + 0.5);
    expect(state.player.x).toBeGreaterThan(810);
  });

  test("stays inside the visible arena", async ({ page }) => {
    await teleportPlayer(page, 1500, 700, RIGHT);
    const state = await holdKey(page, "KeyW", 2500);
    expect(state.player.x).toBeLessThanOrEqual(1600 - 26 + 0.01);
    expect(state.player.x).toBeGreaterThan(1560);
  });

  test("cannot sail through an island", async ({ page }) => {
    // a ilha palm-grove ocupa x 128..384 e y 64..320
    await teleportPlayer(page, 256, 460, UP);
    const state = await holdKey(page, "KeyW", 2500);
    expect(state.player.y).toBeGreaterThan(320);
    expect(state.player.x).toBeCloseTo(256, 0);
  });
});
