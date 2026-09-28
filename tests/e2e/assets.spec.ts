import { expect, openApp, readState, test } from "./support";

test.describe("asset loading", () => {
  test("shows progress, reports a failure and recovers on retry", async ({ page, context }) => {
    let failures = 0;
    // a primeira tentativa do atlas de navios falha, a segunda passa
    await context.route(/\/game\/ships\.json/, async (route) => {
      if (failures === 0) {
        failures++;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await openApp(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();

    await expect(page.getByRole("alert")).toContainText("could not be loaded");
    await expect(page.getByRole("heading", { name: "Charts lost" })).toBeVisible();
    expect(failures).toBe(1);

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("play-screen")).toBeVisible();
    await page.waitForFunction(() => window.__pirate !== undefined);
    expect((await readState(page)).phase).toBe("running");
  });

  test("shows a loading state with a progress bar", async ({ page, context }) => {
    await context.route(/\/game\/tiles(@2x)?\.png/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await openApp(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByTestId("play-screen")).toBeVisible();
  });
});
