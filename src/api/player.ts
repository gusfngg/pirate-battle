import { readJson, writeJson } from "@/app/preferences";
import { createStore } from "@/lib/store";

export interface PlayerIdentity {
  playerId: string;
  playerName: string;
}

const PLAYER_KEY = "pirate-battle:player";
const NAME_PATTERN = /^[\p{L}\p{N} .'-]{2,18}$/u;
const FIRST = ["Salty", "Iron", "Red", "Silver", "Stormy", "Lucky", "Brave", "Grim"];
const LAST = ["Anchor", "Gull", "Barnacle", "Kraken", "Compass", "Marlin", "Cutlass", "Tide"];

export function validateCaptainName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Use at least 2 characters.";
  if (trimmed.length > 18) return "Use at most 18 characters.";
  if (!NAME_PATTERN.test(trimmed)) return "Use letters, numbers, spaces, dots, dashes or apostrophes.";
  return null;
}

function createIdentity(): PlayerIdentity {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)] ?? list[0]!;
  return { playerId: crypto.randomUUID(), playerName: `${pick(FIRST)} ${pick(LAST)}` };
}

// o id nasce uma vez por navegador, é ele que liga o jogador ao próprio histórico
function loadIdentity(): PlayerIdentity {
  const stored = readJson<Partial<PlayerIdentity>>(PLAYER_KEY);
  if (stored?.playerId && stored.playerName && !validateCaptainName(stored.playerName)) {
    return { playerId: stored.playerId, playerName: stored.playerName };
  }
  const fresh = createIdentity();
  writeJson(PLAYER_KEY, fresh);
  return fresh;
}

export const playerStore = createStore<PlayerIdentity>(loadIdentity());

export function renameCaptain(name: string) {
  const next = { ...playerStore.get(), playerName: name.trim() };
  playerStore.replace(next);
  return writeJson(PLAYER_KEY, next);
}
