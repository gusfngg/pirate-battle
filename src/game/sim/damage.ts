import type { SimContext } from "./context";
import type { Ship } from "./types";

export function destroyShip(context: SimContext, ship: Ship, cause: "cannon" | "impact") {
  if (!ship.alive) return;
  ship.alive = false;
  ship.health = 0;
  ship.speed = 0;
  context.emit({ type: "shipDestroyed", shipId: ship.id, kind: ship.kind, x: ship.x, y: ship.y, angle: ship.angle, cause });
}

export function damageShip(context: SimContext, ship: Ship, amount: number) {
  if (!ship.alive) return;
  ship.health = Math.max(0, ship.health - amount);
  context.emit({
    type: "hit",
    side: ship.kind === "player" ? "player" : "enemy",
    shipId: ship.id,
    x: ship.x,
    y: ship.y,
    damage: amount,
    health: ship.health,
  });
}

// só tiro de canhão do jogador pontua, chaser batendo em você não conta
export function sinkByCannon(context: SimContext, ship: Ship) {
  destroyShip(context, ship, "cannon");
  if (ship.kind !== "player" && context.state.phase === "running") {
    context.state.score += 1;
    context.emit({ type: "scored", score: context.state.score });
  }
}
