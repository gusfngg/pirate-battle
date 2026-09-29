import type { Controls } from "../sim/types";

export type Action = Exclude<keyof Controls, "stick">;
type Stick = NonNullable<Controls["stick"]>;

export const ACTIONS: readonly Action[] = ["forward", "turnLeft", "turnRight", "fireFront", "fireLeft", "fireRight"];

// teclado e toque escrevem aqui, cada fonte solta só o que ela apertou
export class ControlPad {
  private readonly held = new Map<Action, Set<string>>();
  private readonly sticks = new Map<string, Stick>();

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

  setStick(source: string, angle: number, power: number) {
    this.sticks.set(source, { angle, power: Math.max(0, Math.min(1, power)) });
  }

  releaseSource(source: string) {
    for (const sources of this.held.values()) sources.delete(source);
    this.sticks.delete(source);
  }

  releaseAll() {
    this.held.clear();
    this.sticks.clear();
  }

  isHeld(action: Action) {
    return (this.held.get(action)?.size ?? 0) > 0;
  }

  snapshot(): Controls {
    let stick: Stick | null = null;
    for (const value of this.sticks.values()) stick = value;
    return {
      forward: this.isHeld("forward"),
      turnLeft: this.isHeld("turnLeft"),
      turnRight: this.isHeld("turnRight"),
      fireFront: this.isHeld("fireFront"),
      fireLeft: this.isHeld("fireLeft"),
      fireRight: this.isHeld("fireRight"),
      stick,
    };
  }
}
