import { expect, test as base, type Page } from "@playwright/test";
import type {} from "../../src/game/testing/test-bridge";

// erros esperados nos cenários de falha: o chrome loga respostas 4xx/5xx e requisições abortadas
const EXPECTED_CONSOLE = [/Failed to load resource/, /game assets failed to load/, /net::ERR_/];

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        if (EXPECTED_CONSOLE.some((pattern) => pattern.test(message.text()))) return;
        errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      await use(errors);
      expect(errors, "the console must stay free of unhandled errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export interface OpenOptions {
  route?: string;
  seed?: number;
  network?: string;
  countdown?: number;
  latency?: number;
  clock?: "manual" | "real";
  storage?: Record<string, unknown>;
}

// cada teste abre um contexto novo, então o storage começa vazio a não ser que a gente semeie
export async function openApp(page: Page, options: OpenOptions = {}) {
  const params = new URLSearchParams({
    e2e: "1",
    seed: String(options.seed ?? 7),
    countdown: String(options.countdown ?? 0),
    latency: String(options.latency ?? 30),
    network: options.network ?? "healthy",
  });
  if (options.clock === "real") params.set("clock", "real");

  if (options.storage) {
    await page.addInitScript((entries) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, JSON.stringify(value));
    }, options.storage);
  }

  await page.goto(`/?${params.toString()}#/${options.route ?? ""}`);
  await expect(page.locator("main h1").first()).toBeVisible();
}

export async function startMatch(page: Page) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByTestId("play-screen")).toBeVisible();
  await page.waitForFunction(() => window.__pirate !== undefined && document.querySelector("canvas") !== null);
}

export type GameState = Awaited<ReturnType<typeof readState>>;

export function readState(page: Page) {
  return page.evaluate(() => window.__pirate!.getState());
}

export function advance(page: Page, ms: number) {
  return page.evaluate((duration) => window.__pirate!.advance(duration), ms);
}

export function spawnEnemy(page: Page, kind: "chaser" | "shooter", x: number, y: number, angle?: number) {
  return page.evaluate(({ kind, x, y, angle }) => window.__pirate!.spawnEnemy(kind, x, y, angle), { kind, x, y, angle });
}

export function teleportPlayer(page: Page, x: number, y: number, angle?: number) {
  return page.evaluate(({ x, y, angle }) => window.__pirate!.teleportPlayer(x, y, angle), { x, y, angle });
}

// segura uma tecla de verdade enquanto o relógio da simulação anda
export async function holdKey(page: Page, code: string, ms: number) {
  await page.keyboard.down(code);
  const state = await advance(page, ms);
  await page.keyboard.up(code);
  return state;
}

export const UP = -Math.PI / 2;
export const RIGHT = 0;
