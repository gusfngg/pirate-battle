import type { MatchPhase, MatchState } from "../sim/types";

export type PauseReason = "manual" | "blur" | "hidden" | "rotate";

export interface HudState {
  phase: MatchPhase;
  paused: PauseReason | null;
  countdown: number;
  health: number;
  maxHealth: number;
  score: number;
  remainingSeconds: number;
}

// só valores inteiros: assim o react só renderiza quando algo visível muda de verdade
export function readHud(state: MatchState, paused: PauseReason | null): HudState {
  return {
    phase: state.phase,
    paused,
    countdown: Math.ceil(state.countdown),
    health: Math.ceil(state.player.health),
    maxHealth: state.player.maxHealth,
    score: state.score,
    remainingSeconds: Math.ceil(state.remaining),
  };
}

// aviso sonoro nos últimos 10 segundos, uma vez por segundo
export function crossedWarningSecond(before: HudState, after: HudState) {
  return after.phase === "running" && after.remainingSeconds !== before.remainingSeconds && after.remainingSeconds <= 10 && after.remainingSeconds > 0;
}
