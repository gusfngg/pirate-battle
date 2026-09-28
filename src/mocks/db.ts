import { compareRanking, PAGE_SIZE, type MatchConfigSnapshot, type MatchRecord, type Page, type RankingEntry } from "@/api/contracts";
import { readJson, writeJson } from "@/app/preferences";
import { createFixtures } from "./fixtures";

const DB_KEY = "pirate-battle:mock-db";

// o "servidor" de mentira: fixtures fixas + partidas confirmadas guardadas no navegador
let confirmed: MatchRecord[] = readJson<MatchRecord[]>(DB_KEY) ?? [];
const fixtures = createFixtures();

function allRecords() {
  return [...fixtures, ...confirmed];
}

function paginate<T>(items: T[], page: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return { items: items.slice(start, start + PAGE_SIZE), page: safePage, pageSize: PAGE_SIZE, totalItems: items.length, totalPages };
}

export const mockDb = {
  ranking(config: MatchConfigSnapshot, page: number): Page<RankingEntry> {
    const ranked = allRecords()
      .filter((record) => record.config.sessionSeconds === config.sessionSeconds && record.config.spawnSeconds === config.spawnSeconds)
      .sort(compareRanking)
      .map((record, index) => ({ ...record, rank: index + 1 }));
    return paginate(ranked, page);
  },

  history(playerId: string, page: number): Page<MatchRecord> {
    const mine = allRecords()
      .filter((record) => record.playerId === playerId)
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt) || b.matchId.localeCompare(a.matchId));
    return paginate(mine, page);
  },

  find(matchId: string) {
    return allRecords().find((record) => record.matchId === matchId) ?? null;
  },

  // mesmo id devolve o registro original, nunca cria uma segunda linha
  register(record: MatchRecord) {
    const existing = this.find(record.matchId);
    if (existing) return { record: existing, created: false };
    confirmed = [...confirmed, record];
    writeJson(DB_KEY, confirmed);
    return { record, created: true };
  },

  reset() {
    confirmed = [];
    writeJson(DB_KEY, confirmed);
  },
};

export function emptyPage<T>(): Page<T> {
  return { items: [], page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 };
}
