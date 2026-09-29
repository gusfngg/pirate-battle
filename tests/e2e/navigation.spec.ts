import { advance, expect, openApp, readState, startMatch, test } from "./support";

test.describe("navigation", () => {
  test("leaving a match abandons it without recording anything", async ({ page }) => {
    await openApp(page);
    await startMatch(page);
    await advance(page, 5000);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Main menu" }).click();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await page.evaluate(() => window.__pirate)).toBeUndefined();

    await page.getByRole("button", { name: "Match history", exact: true }).click();
    await expect(page.getByTestId("logbook-empty")).toBeVisible();
    const stored = await page.evaluate(() => [localStorage.getItem("pirate-battle:last-result"), localStorage.getItem("pirate-battle:outbox")]);
    expect(stored[0]).toBeNull();
    expect(stored[1]).toBeNull();
  });

  test("refreshing during a match goes back to the menu", async ({ page }) => {
    await openApp(page);
    await startMatch(page);
    await advance(page, 2000);
    await page.reload();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("the browser back button abandons the match too", async ({ page }) => {
    await openApp(page);
    await startMatch(page);
    await page.goBack();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("survives repeated trips between screens", async ({ page }) => {
    await openApp(page);
    for (let round = 0; round < 4; round++) {
      await startMatch(page);
      await advance(page, 500);
      expect((await readState(page)).elapsed).toBeCloseTo(0.5, 1);
      await expect(page.locator("canvas")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Main menu" }).click();
      await page.getByRole("button", { name: "Options" }).click();
      await page.getByRole("button", { name: "Main menu" }).click();
      await page.getByRole("button", { name: "Ranking", exact: true }).click();
      await expect(page.getByTestId("logbook-table")).toBeVisible();
      await page.getByRole("button", { name: "Main menu" }).click();
    }
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("menus stay usable with the keyboard alone", async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Options" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
    // no menu, as teclas do jogo não são capturadas: espaço e w digitam normalmente
    await page.getByLabel("Captain name").fill("");
    await page.getByLabel("Captain name").pressSequentially("W Space");
    await expect(page.getByLabel("Captain name")).toHaveValue("W Space");
  });
});

test.describe("touch controls", () => {
  test.skip(({ isMobile }) => !isMobile, "touch controls only show on coarse pointers");

  test("the steering stick and the cannons drive the ship", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
    const stick = page.getByTestId("touch-stick");
    const fire = page.getByTestId("touch-fireFront");
    await expect(stick).toBeVisible();
    await expect(fire).toBeVisible();

    // polegar esquerdo encosta e arrasta pra direita, o direito segura o canhão ao mesmo tempo
    const zone = (await stick.boundingBox())!;
    const start = { x: zone.x + 120, y: zone.y + zone.height - 120 };
    await stick.dispatchEvent("pointerdown", { pointerId: 11, pointerType: "touch", isPrimary: true, clientX: start.x, clientY: start.y });
    await stick.dispatchEvent("pointermove", { pointerId: 11, pointerType: "touch", clientX: start.x + 80, clientY: start.y });
    await fire.dispatchEvent("pointerdown", { pointerId: 12, pointerType: "touch" });
    const moving = await advance(page, 1200);
    await fire.dispatchEvent("pointerup", { pointerId: 12, pointerType: "touch" });
    await stick.dispatchEvent("pointerup", { pointerId: 11, pointerType: "touch", clientX: start.x + 80, clientY: start.y });

    expect(moving.player.speed).toBeGreaterThan(100);
    expect(Math.abs(moving.player.angle)).toBeLessThan(0.3);
    expect(moving.player.x).toBeGreaterThan(830);
    expect(moving.projectiles.some((ball) => ball.side === "player")).toBe(true);

    const released = await advance(page, 3000);
    expect(released.player.speed).toBe(0);
  });

  test("the arena and hud fit the landscape screen", async ({ page }) => {
    await openApp(page);
    await startMatch(page);
    const viewport = page.viewportSize()!;
    const canvas = await page.locator("canvas").boundingBox();
    expect(canvas!.width).toBeCloseTo(viewport.width, 0);
    expect(canvas!.height).toBeCloseTo(viewport.height, 0);
    for (const id of ["hud-score", "hud-time"]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
    }
  });
});
