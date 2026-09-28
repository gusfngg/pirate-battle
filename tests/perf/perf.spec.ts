import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { expect, test, type Page } from "@playwright/test";
import type {} from "../../src/game/testing/test-bridge";

const OUTPUT = "docs/perf";
const MATCH_SECONDS = Number(process.env.PERF_SECONDS ?? 180);
const SETUP = { sessionSeconds: 180, spawnSeconds: Number(process.env.PERF_SPAWN ?? 3) };
const CYCLES = Number(process.env.PERF_CYCLES ?? 5);
const CYCLE_SECONDS = Number(process.env.PERF_CYCLE_SECONDS ?? 20);

interface FrameReport {
  frames: number;
  averageFps: number;
  p50FrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  worstFrameMs: number;
  slowFrames: number;
}

function percentile(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0;
}

function summarize(deltas: number[]): FrameReport {
  const sorted = [...deltas].sort((a, b) => a - b);
  const total = deltas.reduce((sum, value) => sum + value, 0);
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    frames: deltas.length,
    averageFps: round((deltas.length / total) * 1000),
    p50FrameMs: round(percentile(sorted, 0.5)),
    p95FrameMs: round(percentile(sorted, 0.95)),
    p99FrameMs: round(percentile(sorted, 0.99)),
    worstFrameMs: round(sorted[sorted.length - 1] ?? 0),
    slowFrames: deltas.filter((delta) => delta > 1000 / 50).length,
  };
}

async function environment(page: Page) {
  const gpu = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "unknown";
  });
  const screen = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio }));
  return {
    date: new Date().toISOString(),
    cpu: os.cpus()[0]?.model ?? "unknown",
    cores: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    os: `${os.type()} ${os.release()}`,
    browser: `Chromium ${page.context().browser()?.version() ?? ""}`,
    gpu,
    viewport: screen,
  };
}

async function openMatch(page: Page, extra = "") {
  await page.goto(`/?e2e=1&clock=real&countdown=0&seed=11${extra}#/`);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => window.__pirate !== undefined && document.querySelector("canvas") !== null);
}

// um piloto simples: navega em círculos e dispara todas as armas, pra ter combate de verdade na tela
async function autopilot(page: Page, seconds: number, onSecond: (second: number) => Promise<void>) {
  await page.keyboard.down("KeyW");
  for (let second = 0; second < seconds; second++) {
    const turn = second % 6 < 3 ? "KeyD" : "KeyA";
    await page.keyboard.down(turn);
    await page.keyboard.down("Space");
    await page.keyboard.press(second % 2 === 0 ? "KeyQ" : "KeyE");
    await page.waitForTimeout(1000);
    await page.keyboard.up(turn);
    await page.keyboard.up("Space");
    await onSecond(second);
  }
  await page.keyboard.up("KeyW");
}

test.beforeAll(() => mkdirSync(OUTPUT, { recursive: true }));

test("three minute match frame rate and entity count", async ({ page }) => {
  await page.addInitScript((setup) => localStorage.setItem("pirate-battle:options", JSON.stringify(setup)), SETUP);
  await openMatch(page);

  await page.evaluate(() => {
    const deltas: number[] = [];
    let last = performance.now();
    const loop = (now: number) => {
      deltas.push(now - last);
      last = now;
      (window as unknown as { __frames: number[] }).__frames = deltas;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  const samples: { second: number; enemies: number; projectiles: number; effects: number; ships: number }[] = [];
  // cada volta do piloto leva um pouco mais de 1s, então para antes do relógio da partida zerar
  await autopilot(page, Math.max(1, MATCH_SECONDS - 6), async (second) => {
    // o jogador não pode morrer antes dos 3 minutos, então a vida é reposta a cada segundo
    const stats = await page.evaluate(() => {
      if (!window.__pirate) return null;
      window.__pirate.setPlayerHealth(100);
      return window.__pirate.stats();
    });
    if (!stats) return;
    samples.push({ second, enemies: stats.enemies, projectiles: stats.projectiles, effects: stats.effects, ships: stats.ships });
  });

  const deltas = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice(30));
  const frames = summarize(deltas);
  const state = await page.evaluate(() => window.__pirate!.getState());
  const peak = (key: "enemies" | "projectiles" | "effects" | "ships") => Math.max(...samples.map((sample) => sample[key]));
  const average = (key: "enemies" | "projectiles" | "effects" | "ships") =>
    Math.round((samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length) * 10) / 10;

  const report = {
    environment: await environment(page),
    match: { ...SETUP, measuredSeconds: Math.round(deltas.reduce((sum, delta) => sum + delta, 0) / 1000), phaseAtEnd: state.phase, score: state.score, spawned: state.spawnedByKind },
    frames,
    entities: {
      peak: { enemies: peak("enemies"), projectiles: peak("projectiles"), effects: peak("effects"), ships: peak("ships") },
      average: { enemies: average("enemies"), projectiles: average("projectiles"), effects: average("effects"), ships: average("ships") },
      perSecond: samples,
    },
  };
  writeFileSync(`${OUTPUT}/match-${MATCH_SECONDS}s-spawn${SETUP.spawnSeconds}s.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ frames, entities: report.entities.peak, environment: report.environment }, null, 2));

  expect(frames.frames).toBeGreaterThan(MATCH_SECONDS * 30);
});

test("memory after five start, play and leave cycles", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");

  async function measure(label: string) {
    await cdp.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(300);
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const pick = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? 0;
    return {
      label,
      heapMb: Math.round((pick("JSHeapUsedSize") / 1024 ** 2) * 100) / 100,
      domNodes: pick("Nodes"),
      listeners: pick("JSEventListeners"),
      canvases: await page.locator("canvas").count(),
    };
  }

  await page.goto("/?e2e=1&clock=real&countdown=0&seed=5#/");
  await page.getByRole("button", { name: "Play", exact: true }).waitFor();
  const readings = [await measure("menu before")];

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => window.__pirate !== undefined);
    await autopilot(page, CYCLE_SECONDS, async () => {
      await page.evaluate(() => window.__pirate?.setPlayerHealth(100));
    });
    readings.push({ ...(await measure(`cycle ${cycle} in match`)) });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Main menu" }).click();
    await page.getByRole("button", { name: "Play", exact: true }).waitFor();
    readings.push(await measure(`cycle ${cycle} back in menu`));
  }

  const menus = readings.filter((reading) => reading.label.includes("menu"));
  const firstMenuAfterPlay = menus[1]!;
  const lastMenu = menus[menus.length - 1]!;
  const report = {
    environment: await environment(page),
    readings,
    growthAfterFirstCycleMb: Math.round((lastMenu.heapMb - firstMenuAfterPlay.heapMb) * 100) / 100,
    listenerGrowth: lastMenu.listeners - firstMenuAfterPlay.listeners,
    domNodeGrowth: lastMenu.domNodes - firstMenuAfterPlay.domNodes,
  };
  writeFileSync(`${OUTPUT}/memory-${CYCLES}-cycles.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  expect(lastMenu.canvases).toBe(0);
  expect(report.listenerGrowth).toBeLessThanOrEqual(5);
  expect(report.growthAfterFirstCycleMb).toBeLessThan(8);
});
