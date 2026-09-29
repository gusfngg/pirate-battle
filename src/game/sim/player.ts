import { angleDifference, clamp } from "../math";
import type { SimContext } from "./context";
import { coolDown, sail, steer, type Helm } from "./ships";
import type { Controls, Ship } from "./types";
import { fireBow, fireBroadside } from "./weapons";

const STICK_DEAD_ZONE = 0.18;

// joystick: vira a proa pra direção apontada e acelera conforme a força; curva fechada tira o pé antes
function helmFromStick(player: Ship, stick: NonNullable<Controls["stick"]>): Helm {
  const difference = angleDifference(player.angle, stick.angle);
  const turn = clamp(difference * 3, -1, 1);
  const alignment = Math.abs(difference) > 1.9 ? 0.25 : 1;
  return { turn, throttle: stick.power * alignment };
}

function helmFromButtons(controls: Controls): Helm {
  return {
    turn: (controls.turnRight ? 1 : 0) - (controls.turnLeft ? 1 : 0),
    throttle: controls.forward ? 1 : 0,
  };
}

export function updatePlayer(context: SimContext, controls: Controls, dt: number) {
  const { player } = context.state;
  const hull = context.config.player;
  const buttons = helmFromButtons(controls);
  const usingButtons = buttons.turn !== 0 || buttons.throttle > 0;
  const stick = controls.stick && controls.stick.power > STICK_DEAD_ZONE ? controls.stick : null;
  const helm = stick && !usingButtons ? helmFromStick(player, stick) : buttons;

  coolDown(player, dt);
  steer(player, hull, helm, dt);
  sail(player, dt, context);

  if (controls.fireFront) fireBow(context, player, "player", hull.frontCannon);
  if (controls.fireLeft) fireBroadside(context, player, "left");
  if (controls.fireRight) fireBroadside(context, player, "right");
}
