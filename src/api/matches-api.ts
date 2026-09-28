import type { MatchConfigSnapshot, MatchRecord, Page, RankingEntry, RegisterMatchResponse } from "./contracts";
import { http } from "./http";

export async function fetchRanking(config: MatchConfigSnapshot, page: number, signal?: AbortSignal) {
  const { data } = await http.get<Page<RankingEntry>>("/ranking", {
    params: { sessionSeconds: config.sessionSeconds, spawnSeconds: config.spawnSeconds, page },
    signal,
  });
  return data;
}

export async function fetchHistory(playerId: string, page: number, signal?: AbortSignal) {
  const { data } = await http.get<Page<MatchRecord>>(`/players/${encodeURIComponent(playerId)}/matches`, {
    params: { page },
    signal,
  });
  return data;
}

// put com o id da partida é idempotente: repetir o envio devolve o registro que já existe
export async function registerMatch(record: MatchRecord) {
  const { data } = await http.put<RegisterMatchResponse>(`/matches/${encodeURIComponent(record.matchId)}`, record);
  return data;
}
