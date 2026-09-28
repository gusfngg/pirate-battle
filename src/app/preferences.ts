import { normalizeMatchOptions, type MatchOptions } from "@/game/config";
import type { EndReason } from "@/game/sim/types";
import { createStore } from "@/lib/store";

const OPTIONS_KEY = "pirate-battle:options";
const LAST_RESULT_KEY = "pirate-battle:last-result";

export interface LastResult {
  playerId?: string;
  playerName?: string;
  matchId: string;
  playedAt: string;
  score: number;
  durationMs: number;
  endReason: EndReason;
  config: MatchOptions;
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// o que vem do storage pode estar velho ou editado à mão, sempre passa pela validação
export const optionsStore = createStore<MatchOptions>(normalizeMatchOptions(readJson<Partial<MatchOptions>>(OPTIONS_KEY) ?? {}));

export function saveOptions(options: MatchOptions) {
  const safe = normalizeMatchOptions(options);
  optionsStore.replace(safe);
  return writeJson(OPTIONS_KEY, safe);
}

function isLastResult(value: unknown): value is LastResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<LastResult>;
  return typeof result.matchId === "string" && typeof result.score === "number" && typeof result.durationMs === "number";
}

export const lastResultStore = createStore<{ result: LastResult | null }>({
  result: (() => {
    const stored = readJson<unknown>(LAST_RESULT_KEY);
    return isLastResult(stored) ? stored : null;
  })(),
});

export function saveLastResult(result: LastResult) {
  lastResultStore.replace({ result });
  writeJson(LAST_RESULT_KEY, result);
}
