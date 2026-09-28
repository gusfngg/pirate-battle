import { advance, expect, holdKey, openApp, readState, startMatch, test } from "./support";

test.describe("pause", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
    await advance(page, 1000);
  });

  test("manual pause freezes the clock, cooldowns and input", async ({ page }) => {
    await holdKey(page, "Space", 50);
    const before = await readState(page);
    expect(before.player.cooldowns.front).toBeGreaterThan(0);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume" })).toBeFocused();

    await page.keyboard.down("KeyW");
    const paused = await advance(page, 3000);
    await page.keyboard.up("KeyW");
    expect(paused.paused).toBe("manual");
    expect(paused.remaining).toBe(before.remaining);
    expect(paused.player.cooldowns).toEqual(before.player.cooldowns);
    expect(paused.player.y).toBe(before.player.y);
    expect(paused.projectiles).toEqual(before.projectiles);

    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const resumed = await advance(page, 1000);
    expect(resumed.remaining).toBeCloseTo(before.remaining - 1, 1);
  });

  test("keys held through a pause do not keep sailing after resume", async ({ page }) => {
    await page.keyboard.down("KeyW");
    await advance(page, 500);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Resume" }).click();
    const resumed = await readState(page);
    const later = await advance(page, 2500);
    await page.keyboard.up("KeyW");
    // sem tecla pressionada de novo, o navio só desacelera
    expect(later.player.speed).toBe(0);
    expect(Math.abs(later.player.y - resumed.player.y)).toBeLessThan(80);
  });

  test("losing window focus pauses and needs an action to resume", async ({ page }) => {
    const before = await readState(page);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.getByRole("dialog", { name: "Paused" })).toContainText("lost focus");

    const paused = await advance(page, 2000);
    expect(paused.paused).toBe("blur");
    expect(paused.remaining).toBe(before.remaining);

    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    expect((await readState(page)).paused).toBe("blur");

    await page.getByRole("button", { name: "Resume" }).click();
    expect((await advance(page, 500)).remaining).toBeLessThan(before.remaining);
  });

  test("hiding the tab pauses the match", async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByRole("dialog", { name: "Paused" })).toContainText("tab was hidden");
    expect((await readState(page)).paused).toBe("hidden");
  });

  test("the real clock does not run while paused", async ({ page }) => {
    await openApp(page, { clock: "real", storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
    await page.waitForFunction(() => window.__pirate!.getState().elapsed > 0.5);

    await page.getByRole("button", { name: "Pause" }).click();
    const paused = await readState(page);
    await page.waitForTimeout(1500);
    const still = await readState(page);
    expect(still.remaining).toBe(paused.remaining);
    expect(still.elapsed).toBe(paused.elapsed);

    await page.getByRole("button", { name: "Resume" }).click();
    await page.waitForTimeout(1200);
    const running = await readState(page);
    expect(running.elapsed).toBeGreaterThan(paused.elapsed + 0.8);
    expect(running.elapsed).toBeLessThan(paused.elapsed + 2);
  });
});
