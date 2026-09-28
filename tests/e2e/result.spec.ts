import { advance, expect, openApp, spawnEnemy, startMatch, test } from "./support";

test.describe("result", () => {
  test("shows the result and keeps it after a refresh", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 120, spawnSeconds: 10 } } });
    await startMatch(page);

    // afunda um inimigo e depois deixa um chaser acabar com o jogador
    await spawnEnemy(page, "shooter", 660, 430, Math.PI / 2);
    await page.keyboard.down("KeyQ");
    await advance(page, 50);
    await page.keyboard.up("KeyQ");
    await advance(page, 2950);
    await page.evaluate(() => window.__pirate!.setPlayerHealth(10));
    await spawnEnemy(page, "chaser", 800, 330, Math.PI / 2);
    await advance(page, 1500);

    await expect(page.getByRole("heading", { name: "Ship destroyed" })).toBeVisible();
    await expect(page.getByTestId("result-score")).toHaveText("1");
    await expect(page.getByTestId("result-duration")).toHaveText(/00:0[34]/);
    await expect(page.getByTestId("result-reason")).toHaveText("Defeated");
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", "registered");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Ship destroyed" })).toBeVisible();
    await expect(page.getByTestId("result-score")).toHaveText("1");
    await expect(page.getByTestId("result-reason")).toHaveText("Defeated");
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", "registered");

    await page.getByRole("button", { name: "Main menu" }).click();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });

  test("offers to play when there is no result yet", async ({ page }) => {
    await openApp(page, { route: "result" });
    await expect(page.getByRole("heading", { name: "No battles yet" })).toBeVisible();
  });
});
