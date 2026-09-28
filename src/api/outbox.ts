import { readJson, writeJson } from "@/app/preferences";
import { createStore } from "@/lib/store";
import { isMatchRecord, type MatchRecord } from "./contracts";

export interface PendingRecord {
  record: MatchRecord;
  attempts: number;
  lastError: string | null;
}

interface OutboxState {
  pending: PendingRecord[];
  registered: string[];
}

const OUTBOX_KEY = "pirate-battle:outbox";
const REMEMBERED = 30;

function loadOutbox(): OutboxState {
  const stored = readJson<Partial<OutboxState>>(OUTBOX_KEY);
  const pending = Array.isArray(stored?.pending) ? stored.pending.filter((item) => isMatchRecord(item?.record)) : [];
  const registered = Array.isArray(stored?.registered) ? stored.registered.filter((id) => typeof id === "string") : [];
  return { pending, registered };
}

// partidas concluídas esperando confirmação do servidor, sobrevivem a refresh e falhas
export const outboxStore = createStore<OutboxState>(loadOutbox());

function commit(next: OutboxState) {
  outboxStore.replace(next);
  writeJson(OUTBOX_KEY, next);
}

export function enqueue(record: MatchRecord) {
  const state = outboxStore.get();
  if (state.pending.some((item) => item.record.matchId === record.matchId)) return;
  commit({ ...state, pending: [...state.pending, { record, attempts: 0, lastError: null }] });
}

export function markRegistered(matchId: string) {
  const state = outboxStore.get();
  commit({
    pending: state.pending.filter((item) => item.record.matchId !== matchId),
    registered: [matchId, ...state.registered.filter((id) => id !== matchId)].slice(0, REMEMBERED),
  });
}

export function markFailed(matchId: string, message: string) {
  const state = outboxStore.get();
  commit({
    ...state,
    pending: state.pending.map((item) =>
      item.record.matchId === matchId ? { ...item, attempts: item.attempts + 1, lastError: message } : item,
    ),
  });
}

export function resetOutbox() {
  commit({ pending: [], registered: [] });
}

export type RegistrationStatus = "registered" | "pending" | "failed" | "unknown";

export function registrationStatus(state: OutboxState, matchId: string): RegistrationStatus {
  if (state.registered.includes(matchId)) return "registered";
  const item = state.pending.find((entry) => entry.record.matchId === matchId);
  if (!item) return "unknown";
  return item.lastError ? "failed" : "pending";
}

const syncRequests = new EventTarget();

export function requestSync() {
  syncRequests.dispatchEvent(new Event("sync"));
}

export function onSyncRequest(listener: () => void) {
  syncRequests.addEventListener("sync", listener);
  return () => syncRequests.removeEventListener("sync", listener);
}
