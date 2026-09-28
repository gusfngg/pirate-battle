import { useSyncExternalStore } from "react";

export type Route = "menu" | "options" | "ranking" | "history" | "play" | "result";

const PATHS: Record<Route, string> = {
  menu: "#/",
  options: "#/options",
  ranking: "#/logbook/ranking",
  history: "#/logbook/history",
  play: "#/play",
  result: "#/result",
};

export function parseRoute(hash: string): Route {
  const found = (Object.entries(PATHS) as [Route, string][]).find(([, path]) => path === hash);
  return found ? found[0] : "menu";
}

export function navigate(route: Route, options: { replace?: boolean } = {}) {
  const path = PATHS[route];
  if (window.location.hash === path) return;
  if (options.replace) {
    window.history.replaceState(null, "", path);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = path;
  }
}

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseRoute(window.location.hash));
}

// recarregar no meio da partida abandona ela, volta pro menu sem registrar nada
export function leaveInterruptedMatch() {
  if (parseRoute(window.location.hash) === "play") navigate("menu", { replace: true });
}
