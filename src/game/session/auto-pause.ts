import type { PauseReason } from "./hud-state";

// perder o foco da janela ou esconder a aba pausa a partida sozinho
export function bindAutoPause(pause: (reason: PauseReason) => void) {
  const onBlur = () => pause("blur");
  const onVisibility = () => {
    if (document.visibilityState === "hidden") pause("hidden");
  };
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
