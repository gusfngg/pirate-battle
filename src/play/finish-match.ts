import { saveLastResult, type LastResult } from "@/app/preferences";
import { navigate } from "@/app/router";
import type { MatchSummary } from "@/game/session/game-session";

// só partida concluída chega aqui, abandonar a tela nunca chama isso
export function finishMatch(summary: MatchSummary) {
  const result: LastResult = {
    matchId: crypto.randomUUID(),
    playedAt: new Date().toISOString(),
    score: summary.score,
    durationMs: Math.round(summary.elapsedSeconds * 1000),
    endReason: summary.reason,
    config: summary.config,
  };
  saveLastResult(result);
  navigate("result");
}
