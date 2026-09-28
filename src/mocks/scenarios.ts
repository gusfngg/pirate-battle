import { readJson, writeJson } from "@/app/preferences";
import { createRandom } from "@/game/random";
import { createStore } from "@/lib/store";

export const SCENARIOS = {
  healthy: "Everything works, with a short realistic delay.",
  empty: "The ranking and the history come back empty.",
  slow: "Every answer takes about 2.5 seconds.",
  jitter: "Latency jumps between 0.1 and 2.5 seconds.",
  "out-of-order": "Every other request is slow, so answers arrive out of order.",
  timeout: "Nothing answers before the 5 second client timeout.",
  offline: "The connection drops, requests fail with a network error.",
  "server-error": "Every endpoint answers 500.",
  "client-error": "Every endpoint answers 400.",
  "ranking-down": "Only the ranking fails with 503.",
  "history-down": "Only the match history fails with 503.",
  "register-timeout-after-commit": "Saving a match commits on the server but the answer arrives after the timeout.",
  "register-unavailable": "Saving a match fails with 503 until you switch back to healthy.",
} as const;

export type ScenarioId = keyof typeof SCENARIOS;

const SCENARIO_KEY = "pirate-battle:network";

function isScenario(value: string | null): value is ScenarioId {
  return value !== null && value in SCENARIOS;
}

function initialScenario(): ScenarioId {
  const fromUrl = new URLSearchParams(window.location.search).get("network");
  if (isScenario(fromUrl)) {
    writeJson(SCENARIO_KEY, fromUrl);
    return fromUrl;
  }
  const stored = readJson<string>(SCENARIO_KEY);
  return isScenario(stored) ? stored : "healthy";
}

export const scenarioStore = createStore<{ scenario: ScenarioId }>({ scenario: initialScenario() });

export function setScenario(scenario: ScenarioId) {
  writeJson(SCENARIO_KEY, scenario);
  scenarioStore.replace({ scenario });
}

// ?latency=0 fixa o atraso nos testes, ?netseed=7 fixa a sequência aleatória
const params = new URLSearchParams(window.location.search);
const fixedLatency = params.has("latency") ? Number(params.get("latency")) : null;
const random = createRandom(Number(params.get("netseed")) || 1);
let requestCount = 0;

export function scenarioLatency(scenario: ScenarioId) {
  requestCount++;
  if (scenario === "timeout") return 8000;
  if (scenario === "slow") return 2500;
  if (scenario === "jitter") return Math.round(random.range(100, 2500));
  if (scenario === "out-of-order") return requestCount % 2 === 1 ? 2200 : 250;
  if (fixedLatency !== null && Number.isFinite(fixedLatency)) return fixedLatency;
  return Math.round(random.range(150, 450));
}
