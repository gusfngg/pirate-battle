import type { Controls } from "../sim/types";

export type Action = keyof Controls;

export const ACTIONS: readonly Action[] = ["forward", "turnLeft", "turnRight", "fireFront", "fireLeft", "fireRight"];

// teclado e toque escrevem aqui, cada fonte solta só o que ela apertou
export class ControlPad {
  private readonly held = new Map<Action, Set<string>>();

  press(action: Action, source: string) {
    let sources = this.held.get(action);
    if (!sources) {
      sources = new Set();
      this.held.set(action, sources);
    }
    sources.add(source);
  }

  release(action: Action, source: string) {
    this.held.get(action)?.delete(source);
  }

  releaseSource(source: string) {
    for (const sources of this.held.values()) sources.delete(source);
  }

  releaseAll() {
    this.held.clear();
  }

  isHeld(action: Action) {
    return (this.held.get(action)?.size ?? 0) > 0;
  }

  snapshot(): Controls {
    return {
      forward: this.isHeld("forward"),
      turnLeft: this.isHeld("turnLeft"),
      turnRight: this.isHeld("turnRight"),
      fireFront: this.isHeld("fireFront"),
      fireLeft: this.isHeld("fireLeft"),
      fireRight: this.isHeld("fireRight"),
    };
  }
}
