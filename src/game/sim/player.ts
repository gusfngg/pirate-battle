import type { SimContext } from "./context";
import { coolDown, sail, steer } from "./ships";
import type { Controls } from "./types";
import { fireBow, fireBroadside } from "./weapons";

export function updatePlayer(context: SimContext, controls: Controls, dt: number) {
  const { player } = context.state;
  const hull = context.config.player;
  const turn = (controls.turnRight ? 1 : 0) - (controls.turnLeft ? 1 : 0);

  coolDown(player, dt);
  steer(player, hull, { throttle: controls.forward ? 1 : 0, turn }, dt);
  sail(player, dt, context);

  if (controls.fireFront) fireBow(context, player, "player", hull.frontCannon);
  if (controls.fireLeft) fireBroadside(context, player, "left");
  if (controls.fireRight) fireBroadside(context, player, "right");
}
