import { expect, openApp, test } from "./support";

test.describe("captain's log", () => {
  test("ranking pages through the fixtures in score order", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Ranking", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Ranking" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("120 second battles · 3 second spawn interval")).toBeVisible();

    const table = page.getByTestId("logbook-table");
    await expect(table.locator("tbody tr")).toHaveCount(5);
    await expect(page.getByTestId("pager-label")).toHaveText("Page 1 of 4");
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();

    const scores = await table.locator(".cell-points").allTextContents();
    const numbers = scores.map(Number);
    expect([...numbers].sort((a, b) => b - a)).toEqual(numbers);
    await expect(table.locator("tbody tr").first().locator(".cell-rank")).toHaveText("01");

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByTestId("pager-label")).toHaveText("Page 2 of 4");
    await expect(table.locator("tbody tr").first().locator(".cell-rank")).toHaveText("06");

    await page.getByRole("button", { name: "Next page" }).click();
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByTestId("pager-label")).toHaveText("Page 4 of 4");
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  test("the ranking only compares matches with the same setup", async ({ page }) => {
    await openApp(page, { route: "logbook/ranking", storage: { "pirate-battle:options": { sessionSeconds: 60, spawnSeconds: 3 } } });
    await expect(page.getByText("60 second battles · 3 second spawn interval")).toBeVisible();
    await expect(page.getByTestId("pager-label")).toHaveText("Page 1 of 2");
  });

  test("shows a loading state while the answer is slow", async ({ page }) => {
    await openApp(page, { network: "slow" });
    await page.getByRole("button", { name: "Ranking", exact: true }).click();
    await expect(page.getByTestId("logbook-loading")).toBeVisible();
    await expect(page.getByTestId("logbook-table")).toBeVisible();
    await expect(page.getByTestId("logbook-loading")).toBeHidden();
  });

  test("shows an empty state", async ({ page }) => {
    await openApp(page, { network: "empty" });
    await page.getByRole("button", { name: "Ranking", exact: true }).click();
    await expect(page.getByTestId("logbook-empty")).toContainText("No battles recorded");
    await page.getByRole("tab", { name: "Match history" }).click();
    await expect(page.getByTestId("logbook-empty")).toContainText("No battles in your log");
  });

  test("shows an error and recovers with a retry", async ({ page }) => {
    await openApp(page, { network: "ranking-down" });
    await page.getByRole("button", { name: "Ranking", exact: true }).click();
    await expect(page.getByTestId("logbook-error")).toContainText("closed for repairs");

    // a outra aba segue funcionando
    await page.getByRole("tab", { name: "Match history" }).click();
    await expect(page.getByTestId("logbook-empty")).toBeVisible();

    await page.getByRole("button", { name: /Network lab/ }).click();
    await page.getByRole("radio", { name: /^healthy/ }).check();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("tab", { name: "Ranking" }).click();
    await expect(page.getByTestId("logbook-table")).toBeVisible();
  });

  test("history failures do not block the game", async ({ page }) => {
    await openApp(page, { network: "server-error" });
    await page.getByRole("button", { name: "Match history", exact: true }).click();
    await expect(page.getByTestId("logbook-error")).toBeVisible();
    await expect(page.getByTestId("logbook-error").getByRole("button", { name: "Try again" })).toBeVisible();
    await page.getByRole("button", { name: "Main menu" }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
  });

  test("tabs switch with the arrow keys", async ({ page }) => {
    await openApp(page, { route: "logbook/ranking" });
    await page.getByRole("tab", { name: "Ranking" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Match history" })).toHaveAttribute("aria-selected", "true");
  });
});
