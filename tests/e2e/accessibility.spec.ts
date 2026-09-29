import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { advance, expect, openApp, startMatch, test } from "./support";

// auditoria automática wcag 2.1 a/aa em cada tela e diálogo
async function audit(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(" ")).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

test.describe("accessibility", () => {
  test("main menu with the controls help open", async ({ page }) => {
    await openApp(page);
    await page.getByText("How to sail").click();
    await audit(page);
  });

  test("options with a validation error", async ({ page }) => {
    await openApp(page, { route: "options" });
    await page.getByRole("spinbutton", { name: "Game session time" }).fill("500");
    await expect(page.getByRole("alert")).toBeVisible();
    await audit(page);
  });

  test("ranking and match history", async ({ page }) => {
    await openApp(page, { route: "logbook/ranking" });
    await expect(page.getByTestId("logbook-table")).toBeVisible();
    await audit(page);
    await page.getByRole("tab", { name: "Match history" }).click();
    await expect(page.getByTestId("logbook-empty")).toBeVisible();
    await audit(page);
  });

  test("captain's log error state", async ({ page }) => {
    await openApp(page, { route: "logbook/ranking", network: "ranking-down" });
    await expect(page.getByTestId("logbook-error")).toBeVisible();
    await audit(page);
  });

  test("result screen with a pending registration", async ({ page }) => {
    await openApp(page, { network: "register-unavailable", storage: { "pirate-battle:options": { sessionSeconds: 90, spawnSeconds: 5 } } });
    await startMatch(page);
    await page.evaluate(() => window.__pirate!.setPlayerHealth(5));
    await page.evaluate(() => window.__pirate!.spawnEnemy("chaser", 800, 330, Math.PI / 2));
    await advance(page, 1500);
    await expect(page.getByTestId("registration-status")).toHaveAttribute("data-status", "failed");
    await audit(page);
  });

  test("match hud and pause dialog", async ({ page }) => {
    await openApp(page);
    await startMatch(page);
    await audit(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await audit(page);
  });

  test("network lab dialog", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: /Network lab/ }).click();
    await expect(page.getByRole("dialog", { name: "Network lab" })).toBeVisible();
    await audit(page);
  });
});
