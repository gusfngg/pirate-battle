import { angleBetween, angleDifference, distance, wrapAngle } from "../math";
import { hitsAnyObstacle } from "../world/obstacles";
import type { SimContext } from "./context";
import { damageShip, destroyShip } from "./damage";
import { coolDown, hullFor, sail, separate, shipsTouch, steer } from "./ships";
import type { Ship } from "./types";
import { fireBow } from "./weapons";

const LOOK_AHEAD = 110;
const WHISKER_ANGLE = 0.6;

function isBlocked(context: SimContext, ship: Ship, angle: number, reach: number) {
  const x = ship.x + Math.cos(angle) * reach;
  const y = ship.y + Math.sin(angle) * reach;
  const { width, height } = context.config.arena;
  const outside = x < ship.radius || y < ship.radius || x > width - ship.radius || y > height - ship.radius;
  return outside || hitsAnyObstacle(context.obstacles, x, y, ship.radius * 0.8);
}

// steer towards a heading, but bend around islands with two whisker probes
function avoidObstacles(context: SimContext, ship: Ship, desired: number) {
  if (!isBlocked(context, ship, desired, LOOK_AHEAD)) return desired;

  const leftClear = !isBlocked(context, ship, desired - WHISKER_ANGLE, LOOK_AHEAD);
  const rightClear = !isBlocked(context, ship, desired + WHISKER_ANGLE, LOOK_AHEAD);

  if (leftClear && !rightClear) return desired - WHISKER_ANGLE * 1.4;
  if (rightClear && !leftClear) return desired + WHISKER_ANGLE * 1.4;
  if (leftClear && rightClear) {
    const leftTurn = Math.abs(angleDifference(ship.angle, desired - WHISKER_ANGLE));
    const rightTurn = Math.abs(angleDifference(ship.angle, desired + WHISKER_ANGLE));
    return desired + (leftTurn < rightTurn ? -WHISKER_ANGLE : WHISKER_ANGLE) * 1.4;
  }
  return wrapAngle(ship.angle + Math.PI * 0.75);
}

function helmTowards(ship: Ship, heading: number) {
  const difference = angleDifference(ship.angle, heading);
  return Math.max(-1, Math.min(1, difference * 2.5));
}

function updateChaser(context: SimContext, chaser: Ship, dt: number) {
  const { player } = context.state;
  const hull = hullFor("chaser", context.config);
  const heading = avoidObstacles(context, chaser, angleBetween(chaser, player));
  const turn = helmTowards(chaser, heading);
  const throttle = Math.abs(angleDifference(chaser.angle, heading)) > 1.3 ? 0.45 : 1;

  steer(chaser, hull, { throttle, turn }, dt);
  sail(chaser, dt, context);

  if (player.alive && shipsTouch(chaser, player)) {
    damageShip(context, player, context.config.chaser.impactDamage);
    destroyShip(context, chaser, "impact");
  }
}

function updateShooter(context: SimContext, shooter: Ship, dt: number) {
  const { player } = context.state;
  const config = context.config.shooter;
  const range = distance(shooter, player);

  // leads the target a little so a straight line is not a safe line
  const travelTime = range / config.cannon.speed;
  const aimX = player.x + Math.cos(player.angle) * player.speed * travelTime * 0.6;
  const aimY = player.y + Math.sin(player.angle) * player.speed * travelTime * 0.6;
  const aim = angleBetween(shooter, { x: aimX, y: aimY });

  const closingIn = range > config.preferredDistance;
  const heading = closingIn ? avoidObstacles(context, shooter, angleBetween(shooter, player)) : aim;
  const throttle = closingIn ? 1 : 0.15;

  coolDown(shooter, dt);
  steer(shooter, config, { throttle, turn: helmTowards(shooter, heading) }, dt);
  sail(shooter, dt, context);

  const lined = Math.abs(angleDifference(shooter.angle, aim)) < config.aimTolerance;
  if (player.alive && range <= config.attackRange && lined) {
    fireBow(context, shooter, "enemy", config.cannon);
  }
}

export function updateEnemies(context: SimContext, dt: number) {
  const { enemies, player } = context.state;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (enemy.kind === "chaser") updateChaser(context, enemy, dt);
    else updateShooter(context, enemy, dt);
  }

  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (!a?.alive) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (b?.alive) separate(a, b);
    }
    if (a.kind === "shooter" && player.alive) separate(a, player);
  }
}
