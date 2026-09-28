import type { Action, ControlPad } from "./control-pad";

export const KEY_BINDINGS: Readonly<Record<string, Action>> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyA: "turnLeft",
  ArrowLeft: "turnLeft",
  KeyD: "turnRight",
  ArrowRight: "turnRight",
  Space: "fireFront",
  KeyK: "fireFront",
  KeyQ: "fireLeft",
  KeyJ: "fireLeft",
  KeyE: "fireRight",
  KeyL: "fireRight",
};

export const PAUSE_KEYS: readonly string[] = ["Escape", "KeyP"];

const SOURCE = "keyboard";

interface KeyboardOptions {
  pad: ControlPad;
  isActive: () => boolean;
  onPause: () => void;
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// só captura teclas com a partida ativa, os menus mantêm o teclado normal
export function bindKeyboard({ pad, isActive, onPause }: KeyboardOptions) {
  function onKeyDown(event: KeyboardEvent) {
    if (!isActive() || isTyping(event.target)) return;

    if (PAUSE_KEYS.includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) onPause();
      return;
    }

    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    event.preventDefault();
    pad.press(action, SOURCE);
  }

  function onKeyUp(event: KeyboardEvent) {
    const action = KEY_BINDINGS[event.code];
    if (action) pad.release(action, SOURCE);
  }

  function onBlur() {
    pad.releaseSource(SOURCE);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    pad.releaseSource(SOURCE);
  };
}
