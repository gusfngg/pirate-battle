import { advance, expect, openApp, spawnEnemy, startMatch, test } from "./support";

test.describe("network resilience", () => {
  test("a timeout after the server committed is retried without a duplicate", async ({ page }) => {
    await openApp(page, { network: "register-timeout-after-commit", storage: { "pirate-battle:options": { sessionSeconds: 90, spawnSeconds: 5 } } });
    const puts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes("/api/matches/")) puts.push(request.url());
    });
    await startMatch(page);
    await page.evaluate(() => window.__pirate!.setPlayerHealth(5));
    await spawnEnemy(page, "chaser", 800, 330, Math.PI / 2);
    await advance(page, 1500);

    const status = page.getByTestId("registration-status");
    await expect(status).toHaveAttribute("data-status", "pending");
    // o cliente desiste em 5s, mas o servidor já tinha gravado; o reenvio acha o registro existente
    await expect(status).toHaveAttribute("data-status", "registered", { timeout: 20_000 });
    expect(puts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(puts).size).toBe(1);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("pirate-battle:mock-db") ?? "[]").length as number);
    expect(stored).toBe(1);

    await page.getByRole("button", { name: "Main menu" }).click();
    await page.getByRole("button", { name: "Match history", exact: true }).click();
    await expect(page.getByTestId("logbook-table").locator("tbody tr")).toHaveCount(1);
    await page.getByRole("tab", { name: "Ranking" }).click();
    await expect(page.getByTestId("logbook-table").locator("tbody tr")).toHaveCount(1);
  });

  test("a late answer never replaces the page on screen", async ({ page }) => {
    // no cenário out-of-order as requisições ímpares demoram 2.2s e as pares 0.25s
    await openApp(page, { network: "out-of-order" });
    await page.getByRole("button", { name: "Ranking", exact: true }).click();
    await expect(page.getByTestId("pager-label")).toHaveText("Page 1 of 4");

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByTestId("pager-label")).toHaveText("Page 2 of 4");
    // pede a página 3 (lenta) e volta pra 2 antes da resposta chegar
    await page.getByRole("button", { name: "Next page" }).click();
    await page.getByRole("button", { name: "Previous page" }).click();
    await page.waitForTimeout(2600);

    await expect(page.getByTestId("pager-label")).toHaveText("Page 2 of 4");
    await expect(page.getByTestId("logbook-table").locator("tbody tr").first().locator(".cell-rank")).toHaveText("06");
  });

  test("an offline network keeps the menus and the game available", async ({ page }) => {
    await openApp(page, { network: "offline" });
    await page.getByRole("button", { name: "Ranking", exact: true }).click();
    await expect(page.getByTestId("logbook-error")).toContainText("No connection");
    await page.getByRole("button", { name: "Main menu" }).click();
    await page.getByRole("button", { name: "Options" }).click();
    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
  });

  test("network lab reset restores the initial state", async ({ page }) => {
    await openApp(page, { network: "register-unavailable", storage: { "pirate-battle:options": { sessionSeconds: 90, spawnSeconds: 5 } } });
    await startMatch(page);
    await page.evaluate(() => window.__pirate!.setPlayerHealth(5));
    await spawnEnemy(page, "chaser", 800, 330, Math.PI / 2);
    await advance(page, 1500);
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", "failed");

    await page.getByRole("button", { name: /Network lab/ }).click();
    await page.getByRole("button", { name: "Reset data" }).click();
    await expect(page.getByRole("radio", { name: /^healthy/ })).toBeChecked();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", "unknown");
  });
});
