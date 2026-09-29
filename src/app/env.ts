import { randomSeed } from "@/game/random";

const params = new URLSearchParams(window.location.search);

// liga a ponte de testes e o relógio manual, ?seed=42 fixa a aleatoriedade
export const E2E = params.get("e2e") === "1";
// o teste de performance precisa do relógio real
export const MANUAL_CLOCK = E2E && params.get("clock") !== "real";

export function matchSeed() {
  const seed = Number(params.get("seed"));
  return Number.isInteger(seed) && seed > 0 ? seed : randomSeed();
}

export function countdownOverride() {
  const value = params.get("countdown");
  if (value === null) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}
