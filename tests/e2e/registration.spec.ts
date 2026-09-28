import type { Page } from "@playwright/test";
import { advance, expect, openApp, spawnEnemy, startMatch, test } from "./support";

// setup sem fixtures, assim a única partida no ranking é a do teste
const UNIQUE_SETUP = { "pirate-battle:options": { sessionSeconds: 90, spawnSeconds: 5 } };

async function finishQuickly(page: Page) {
  await startMatch(page);
  await page.evaluate(() => window.__pirate!.setPlayerHealth(5));
  await spawnEnemy(page, "chaser", 800, 330, Math.PI / 2);
  await advance(page, 1500);
  await expect(page.getByTestId("result-score")).toBeVisible();
}

function mockRecords(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("pirate-battle:mock-db") ?? "[]") as unknown[]);
}

test.describe("match registration", () => {
  test("a finished match shows up once in both tabs", async ({ page }) => {
    await openApp(page, { storage: UNIQUE_SETUP });

    // abre o ranking antes da partida pra ter uma versão velha em cache
    await page.getByRole("button", { name: "Ranking", exact: true }).click();
    await expect(page.getByTestId("logbook-empty")).toBeVisible();
    await page.getByRole("button", { name: "Main menu" }).click();

    await finishQuickly(page);
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", "registered");

    await page.getByRole("button", { name: "Main menu" }).click();
    await page.getByRole("button", { name: "Ranking", exact: true }).click();
    const rows = page.getByTestId("logbook-table").locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("You");

    await page.getByRole("tab", { name: "Match history" }).click();
    await expect(page.getByTestId("logbook-table").locator("tbody tr")).toHaveCount(1);
    await expect(page.getByTestId("logbook-table")).toContainText("Defeated");
    expect(await mockRecords(page)).toHaveLength(1);
  });

  test("a failed registration stays pending across a refresh and syncs after recovery", async ({ page }) => {
    await openApp(page, { network: "register-unavailable", storage: UNIQUE_SETUP });
    await finishQuickly(page);
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", "failed");
    await expect(page.getByTestId("registration-status")).toContainText("cannot take new entries");

    await page.reload();
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", /failed|pending/);
    expect(await mockRecords(page)).toHaveLength(0);

    // dá pra jogar outra partida com o registro ainda pendente
    await page.getByRole("button", { name: "Main menu" }).click();
    await page.getByRole("button", { name: "Match history", exact: true }).click();
    await expect(page.getByText("waiting to be saved")).toBeVisible();

    await page.getByRole("button", { name: /Network lab/ }).click();
    await page.getByRole("radio", { name: /^healthy/ }).check();
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByTestId("logbook-table").locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("waiting to be saved")).toHaveCount(0);
    expect(await mockRecords(page)).toHaveLength(1);
  });

  test("a new match can start while an older one is still pending", async ({ page }) => {
    await openApp(page, { network: "register-unavailable", storage: UNIQUE_SETUP });
    await finishQuickly(page);
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", "failed");
    await page.getByRole("button", { name: "Play again" }).click();
    await page.waitForFunction(() => window.__pirate?.getState().phase === "running");
    const pending = await page.evaluate(() => JSON.parse(localStorage.getItem("pirate-battle:outbox")!).pending.length as number);
    expect(pending).toBe(1);
  });
});
