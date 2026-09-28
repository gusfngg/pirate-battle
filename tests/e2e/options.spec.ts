import { expect, openApp, readState, startMatch, test } from "./support";

test.describe("options", () => {
  test("navigates, validates and persists the options", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Options" }).click();
    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();

    const session = page.getByRole("spinbutton", { name: "Game session time" });
    const spawn = page.getByRole("spinbutton", { name: "Enemy spawn time" });
    const save = page.getByRole("button", { name: "Save" });
    await expect(session).toHaveValue("120");
    await expect(spawn).toHaveValue("3");
    await expect(save).toBeDisabled();

    await session.fill("200");
    await expect(page.getByRole("alert").filter({ hasText: "between 60 and 180" })).toBeVisible();
    await expect(session).toHaveAttribute("aria-invalid", "true");
    await expect(save).toBeDisabled();

    await session.fill("95");
    await expect(page.getByRole("alert").filter({ hasText: "steps of 10" })).toBeVisible();

    await spawn.fill("0");
    await expect(page.getByRole("alert").filter({ hasText: "between 1 and 10" })).toBeVisible();

    await session.fill("90");
    await spawn.fill("2.5");
    await page.getByRole("button", { name: "Increase game session time" }).click();
    await expect(session).toHaveValue("100");
    await page.getByRole("button", { name: "Decrease enemy spawn time" }).click();
    await expect(spawn).toHaveValue("2");

    await save.click();
    await expect(page.getByRole("status").filter({ hasText: "Options saved" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("spinbutton", { name: "Game session time" })).toHaveValue("100");
    await expect(page.getByRole("spinbutton", { name: "Enemy spawn time" })).toHaveValue("2");

    await page.getByRole("button", { name: "Main menu" }).click();
    await startMatch(page);
    const state = await readState(page);
    expect(state.config).toEqual({ sessionSeconds: 100, spawnSeconds: 2 });
    expect(state.remaining).toBe(100);
  });

  test("keeps a running match on its snapshot when options change later", async ({ page }) => {
    await openApp(page, { storage: { "pirate-battle:options": { sessionSeconds: 60, spawnSeconds: 5 } } });
    await startMatch(page);
    await page.evaluate(() => localStorage.setItem("pirate-battle:options", JSON.stringify({ sessionSeconds: 180, spawnSeconds: 1 })));
    const state = await readState(page);
    expect(state.config).toEqual({ sessionSeconds: 60, spawnSeconds: 5 });
  });

  test("validates the captain name", async ({ page }) => {
    await openApp(page, { route: "options" });
    const name = page.getByLabel("Captain name");
    await name.fill("X");
    await expect(page.getByRole("alert").filter({ hasText: "at least 2" })).toBeVisible();
    await name.fill("Captain Test");
    await page.getByRole("button", { name: "Save" }).click();
    await page.reload();
    await expect(page.getByLabel("Captain name")).toHaveValue("Captain Test");
  });
});
