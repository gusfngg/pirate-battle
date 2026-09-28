import { delay, http, HttpResponse } from "msw";
import { isMatchRecord, type ApiErrorBody } from "@/api/contracts";
import { OPTION_LIMITS } from "@/game/config";
import { emptyPage, mockDb } from "./db";
import { scenarioLatency, scenarioStore, type ScenarioId } from "./scenarios";

type Endpoint = "ranking" | "history" | "register";

function fail(status: number, code: string, message: string) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

// aplica o cenário escolhido: atraso, queda de conexão ou erro http
async function applyScenario(endpoint: Endpoint): Promise<Response | null> {
  const scenario: ScenarioId = scenarioStore.get().scenario;
  if (scenario === "register-timeout-after-commit" && endpoint === "register") return null;

  await delay(scenarioLatency(scenario));

  if (scenario === "offline") return HttpResponse.error();
  if (scenario === "server-error") return fail(500, "internal", "The harbour master's office is on fire. Try again later.");
  if (scenario === "client-error") return fail(400, "bad_request", "The harbour master rejected this request.");
  if (scenario === "ranking-down" && endpoint === "ranking") return fail(503, "unavailable", "The ranking board is closed for repairs.");
  if (scenario === "history-down" && endpoint === "history") return fail(503, "unavailable", "The logbook is locked right now.");
  if (scenario === "register-unavailable" && endpoint === "register") return fail(503, "unavailable", "The logbook cannot take new entries right now.");
  return null;
}

function readPage(url: URL) {
  const page = Number(url.searchParams.get("page") ?? "1");
  return Number.isInteger(page) && page > 0 ? page : null;
}

function readConfig(url: URL) {
  const sessionSeconds = Number(url.searchParams.get("sessionSeconds"));
  const spawnSeconds = Number(url.searchParams.get("spawnSeconds"));
  const valid =
    sessionSeconds >= OPTION_LIMITS.sessionSeconds.min &&
    sessionSeconds <= OPTION_LIMITS.sessionSeconds.max &&
    spawnSeconds >= OPTION_LIMITS.spawnSeconds.min &&
    spawnSeconds <= OPTION_LIMITS.spawnSeconds.max;
  return valid ? { sessionSeconds, spawnSeconds } : null;
}

const pendingCommits = new Set<string>();

export const handlers = [
  http.get("/api/ranking", async ({ request }) => {
    const failure = await applyScenario("ranking");
    if (failure) return failure;
    const url = new URL(request.url);
    const page = readPage(url);
    const config = readConfig(url);
    if (!page || !config) return fail(400, "bad_query", "Ranking needs a valid page and match configuration.");
    if (scenarioStore.get().scenario === "empty") return HttpResponse.json(emptyPage());
    return HttpResponse.json(mockDb.ranking(config, page));
  }),

  http.get("/api/players/:playerId/matches", async ({ request, params }) => {
    const failure = await applyScenario("history");
    if (failure) return failure;
    const page = readPage(new URL(request.url));
    if (!page) return fail(400, "bad_query", "History needs a valid page.");
    if (scenarioStore.get().scenario === "empty") return HttpResponse.json(emptyPage());
    return HttpResponse.json(mockDb.history(String(params.playerId), page));
  }),

  http.put("/api/matches/:matchId", async ({ request, params }) => {
    const failure = await applyScenario("register");
    if (failure) return failure;

    const body: unknown = await request.json().catch(() => null);
    if (!isMatchRecord(body)) return fail(422, "invalid_record", "The match record is incomplete.");
    if (body.matchId !== params.matchId) return fail(400, "id_mismatch", "The match id in the path and body differ.");

    const result = mockDb.register(body);

    // grava primeiro e só responde depois do timeout do cliente, como um servidor lento de verdade
    if (scenarioStore.get().scenario === "register-timeout-after-commit" && result.created && !pendingCommits.has(body.matchId)) {
      pendingCommits.add(body.matchId);
      await delay(8000);
    }
    return HttpResponse.json(result, { status: result.created ? 201 : 200 });
  }),
];
