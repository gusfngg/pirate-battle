// contratos compartilhados entre o app, os handlers do msw e os testes

export type EndReason = "time" | "destroyed";

export interface MatchConfigSnapshot {
  sessionSeconds: number;
  spawnSeconds: number;
}

export interface MatchRecord {
  matchId: string;
  playerId: string;
  playerName: string;
  playedAt: string;
  score: number;
  durationMs: number;
  endReason: EndReason;
  config: MatchConfigSnapshot;
}

export interface RankingEntry extends MatchRecord {
  rank: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface RegisterMatchResponse {
  record: MatchRecord;
  created: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export const PAGE_SIZE = 5;

// desempate determinístico: pontos, depois quem durou mais, quem jogou antes e por fim o id
export function compareRanking(a: MatchRecord, b: MatchRecord) {
  return b.score - a.score || b.durationMs - a.durationMs || a.playedAt.localeCompare(b.playedAt) || a.matchId.localeCompare(b.matchId);
}

export function isMatchRecord(value: unknown): value is MatchRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const config = record.config as Record<string, unknown> | undefined;
  return (
    typeof record.matchId === "string" &&
    record.matchId.length > 0 &&
    typeof record.playerId === "string" &&
    typeof record.playerName === "string" &&
    typeof record.playedAt === "string" &&
    !Number.isNaN(Date.parse(record.playedAt)) &&
    Number.isInteger(record.score) &&
    (record.score as number) >= 0 &&
    typeof record.durationMs === "number" &&
    (record.durationMs as number) >= 0 &&
    (record.endReason === "time" || record.endReason === "destroyed") &&
    !!config &&
    typeof config.sessionSeconds === "number" &&
    typeof config.spawnSeconds === "number"
  );
}
