import type { CannonConfig } from "../config";
import type { SimContext } from "./context";
import type { Ship, Side, Weapon } from "./types";

interface Volley {
  ship: Ship;
  side: Side;
  weapon: Weapon;
  cannon: CannonConfig;
  angle: number;
  offsets: number[];
  muzzle: number;
}

function launch(context: SimContext, volley: Volley) {
  const { ship, cannon, angle } = volley;
  const alongX = Math.cos(ship.angle);
  const alongY = Math.sin(ship.angle);
  const outX = Math.cos(angle);
  const outY = Math.sin(angle);

  for (const offset of volley.offsets) {
    const x = ship.x + outX * volley.muzzle + alongX * offset;
    const y = ship.y + outY * volley.muzzle + alongY * offset;
    context.state.projectiles.push({
      id: context.nextId(),
      side: volley.side,
      ownerId: ship.id,
      x,
      y,
      prevX: x,
      prevY: y,
      vx: outX * cannon.speed,
      vy: outY * cannon.speed,
      damage: cannon.damage,
      travelled: 0,
      range: cannon.range,
      radius: context.config.projectileRadius,
    });
  }

  ship.cooldowns[volley.weapon] = cannon.cooldown;
  context.emit({
    type: "shot",
    side: volley.side,
    weapon: volley.weapon,
    shipId: ship.id,
    x: ship.x + outX * volley.muzzle,
    y: ship.y + outY * volley.muzzle,
    angle,
  });
}

export function fireBow(context: SimContext, ship: Ship, side: Side, cannon: CannonConfig) {
  if (ship.cooldowns.front > 0) return false;
  launch(context, {
    ship,
    side,
    weapon: "front",
    cannon,
    angle: ship.angle,
    offsets: [0],
    muzzle: ship.radius + 10,
  });
  return true;
}

// três balas saem lado a lado pela lateral do casco
export function fireBroadside(context: SimContext, ship: Ship, weapon: "left" | "right") {
  if (ship.cooldowns[weapon] > 0) return false;
  const broadside = context.config.player.broadside;
  const sideAngle = ship.angle + (weapon === "left" ? -Math.PI / 2 : Math.PI / 2);
  const middle = (broadside.count - 1) / 2;
  const offsets = Array.from({ length: broadside.count }, (_, index) => (index - middle) * broadside.spacing);

  launch(context, {
    ship,
    side: "player",
    weapon,
    cannon: broadside,
    angle: sideAngle,
    offsets,
    muzzle: ship.radius * 0.7,
  });
  return true;
}
