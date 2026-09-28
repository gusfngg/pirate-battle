import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// profiling separado da suíte e2e: build otimizado, gpu real e um teste por vez
export default defineConfig({
  testDir: "tests/perf",
  fullyParallel: false,
  workers: 1,
  timeout: 10 * 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "reports/perf-playwright" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
    trace: "off",
    launchOptions: {
      args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--js-flags=--expose-gc", "--disable-renderer-backgrounding"],
    },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
