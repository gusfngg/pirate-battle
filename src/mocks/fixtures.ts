import type { MatchConfigSnapshot, MatchRecord } from "@/api/contracts";
import { createRandom } from "@/game/random";

const CAPTAINS = [
  "Captain Flint",
  "Red Sparrow",
  "Storm Rider",
  "Sea Wolf",
  "Anne Bonny",
  "Calico Jack",
  "Mary Read",
  "Black Bart",
  "Grace O'Malley",
  "Ching Shih",
  "Long Ben",
  "Blue Marlin",
];

// configurações mais comuns primeiro, a padrão tem páginas suficientes pra testar paginação
const CONFIGS: { config: MatchConfigSnapshot; matches: number }[] = [
  { config: { sessionSeconds: 120, spawnSeconds: 3 }, matches: 17 },
  { config: { sessionSeconds: 60, spawnSeconds: 3 }, matches: 6 },
  { config: { sessionSeconds: 180, spawnSeconds: 2 }, matches: 5 },
];

const FIRST_DAY = Date.UTC(2026, 8, 8, 12, 0, 0);

// sempre as mesmas partidas: mesma seed, mesmas datas, mesma ordem
export function createFixtures(): MatchRecord[] {
  const random = createRandom(2026);
  const records: MatchRecord[] = [];
  let index = 0;

  for (const { config, matches } of CONFIGS) {
    for (let i = 0; i < matches; i++) {
      const captainIndex = index % CAPTAINS.length;
      const destroyed = random.next() < 0.35;
      const sessionMs = config.sessionSeconds * 1000;
      const durationMs = destroyed ? Math.round(sessionMs * random.range(0.35, 0.95)) : sessionMs;
      const pace = config.sessionSeconds / 120;
      records.push({
        matchId: `fixture-${String(index + 1).padStart(3, "0")}`,
        playerId: `captain-${captainIndex + 1}`,
        playerName: CAPTAINS[captainIndex]!,
        playedAt: new Date(FIRST_DAY - index * 47 * 60_000).toISOString(),
        score: Math.round(random.range(4, 38) * pace * (destroyed ? 0.6 : 1)),
        durationMs,
        endReason: destroyed ? "destroyed" : "time",
        config,
      });
      index++;
    }
  }
  return records;
}
