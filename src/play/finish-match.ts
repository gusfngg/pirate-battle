import type { MatchRecord } from "@/api/contracts";
import { enqueue, requestSync } from "@/api/outbox";
import { playerStore } from "@/api/player";
import { saveLastResult } from "@/app/preferences";
import { navigate } from "@/app/router";
import type { MatchSummary } from "@/game/session/game-session";

// só partida concluída chega aqui, abandonar a tela nunca chama isso
export function finishMatch(summary: MatchSummary) {
  const { playerId, playerName } = playerStore.get();
  const record: MatchRecord = {
    matchId: crypto.randomUUID(),
    playerId,
    playerName,
    playedAt: new Date().toISOString(),
    score: summary.score,
    durationMs: Math.round(summary.elapsedSeconds * 1000),
    endReason: summary.reason,
    config: summary.config,
  };
  saveLastResult(record);
  // primeiro guarda na fila local, depois tenta enviar: refresh ou queda de rede não perdem a partida
  enqueue(record);
  requestSync();
  navigate("result");
}
