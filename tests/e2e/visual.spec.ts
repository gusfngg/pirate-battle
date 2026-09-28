import { advance, expect, openApp, startMatch, test } from "./support";

const LAST_RESULT = {
  matchId: "visual-match",
  playerId: "visual-player",
  playerName: "Visual Tester",
  playedAt: "2026-09-08T19:36:00.000Z",
  score: 24,
  durationMs: 120_000,
  endReason: "time",
  config: { sessionSeconds: 120, spawnSeconds: 3 },
};

// telas estáveis: seed fixa, relógio manual, sem animação e fontes carregadas
test.describe("visual regression", () => {
  test("main menu", async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("menu.png");
  });

  test("arena in a stable state", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);
    await page.evaluate(() => {
      window.__pirate!.spawnEnemy("chaser", 1180, 250, Math.PI);
      window.__pirate!.spawnEnemy("shooter", 420, 640, 0);
    });
    await advance(page, 0);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("arena.png");
  });

  test("result screen", async ({ page }) => {
    await openApp(page, {
      route: "result",
      storage: {
        "pirate-battle:last-result": LAST_RESULT,
        "pirate-battle:outbox": { pending: [], registered: ["visual-match"] },
      },
    });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", "registered");
    await expect(page).toHaveScreenshot("result.png");
  });
});
