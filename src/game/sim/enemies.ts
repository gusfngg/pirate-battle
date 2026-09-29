import { angleBetween, angleDifference, distance, wrapAngle, type Vec } from "../math";
import { findPath, hasClearLine } from "../world/nav-grid";
import { hitsAnyObstacle } from "../world/obstacles";
import type { SimContext } from "./context";
import { damageShip, destroyShip } from "./damage";
import { coolDown, hullFor, sail, separate, shipsTouch, steer } from "./ships";
import type { Ship } from "./types";
import { fireBow } from "./weapons";

const LOOK_AHEAD = 110;
const FAN_STEP = 0.35;
const FAN_STEPS = 9;
const REPATH_SECONDS = 0.5;
const WAYPOINT_REACHED = 36;

function isBlocked(context: SimContext, ship: Ship, angle: number, reach: number) {
  const x = ship.x + Math.cos(angle) * reach;
  const y = ship.y + Math.sin(angle) * reach;
  const { width, height } = context.config.arena;
  const outside = x < ship.radius || y < ship.radius || x > width - ship.radius || y > height - ship.radius;
  return outside || hitsAnyObstacle(context.obstacles, x, y, ship.radius * 0.8);
}

function isClear(context: SimContext, ship: Ship, angle: number, reach: number) {
  return !isBlocked(context, ship, angle, reach) && !isBlocked(context, ship, angle, reach * 0.5);
}

// desvio local: se tiver algo na frente, abre um leque de direções e contorna sempre pelo mesmo lado
function avoidObstacles(context: SimContext, ship: Ship, desired: number, reach: number) {
  if (isClear(context, ship, desired, reach)) {
    ship.detour = 0;
    return desired;
  }

  // primeira vez bloqueado: escolhe o lado com o menor desvio livre
  if (ship.detour === 0) {
    const leftTurn = Math.abs(angleDifference(ship.angle, desired - FAN_STEP));
    const rightTurn = Math.abs(angleDifference(ship.angle, desired + FAN_STEP));
    const sides = leftTurn < rightTurn ? [-1, 1] : [1, -1];
    for (let step = 1; step <= FAN_STEPS && ship.detour === 0; step++) {
      for (const side of sides) {
        if (isClear(context, ship, desired + side * step * FAN_STEP, reach)) {
          ship.detour = side;
          break;
        }
      }
    }
    if (ship.detour === 0) ship.detour = sides[0]!;
  }

  // esgota o lado escolhido antes de tentar o outro, senão o navio fica indo e voltando
  for (const side of [ship.detour, -ship.detour]) {
    for (let step = 1; step <= FAN_STEPS; step++) {
      const angle = wrapAngle(desired + side * step * FAN_STEP);
      if (isClear(context, ship, angle, reach)) {
        ship.detour = side;
        return angle;
      }
    }
  }
  return wrapAngle(ship.angle + Math.PI * 0.75);
}

// com linha livre vai direto; com ilha no meio segue a rota do a*, recalculada porque o alvo se mexe
function navigateTowards(context: SimContext, ship: Ship, target: Vec, dt: number) {
  const grid = context.navGrid;
  if (hasClearLine(grid, ship, target)) {
    ship.route = [];
    return avoidObstacles(context, ship, angleBetween(ship, target), LOOK_AHEAD);
  }

  ship.routeTimer -= dt;
  if (ship.routeTimer <= 0 || ship.route.length === 0) {
    ship.route = findPath(grid, ship, target) ?? [];
    ship.routeTimer = REPATH_SECONDS;
  }
  while (ship.route.length > 1 && distance(ship, ship.route[0]!) < WAYPOINT_REACHED) ship.route.shift();

  // a rota já passa longe das ilhas, o leque só entra se algo aparecer bem perto da proa
  const waypoint = ship.route[0] ?? target;
  return avoidObstacles(context, ship, angleBetween(ship, waypoint), LOOK_AHEAD * 0.45);
}

function helmTowards(ship: Ship, heading: number) {
  const difference = angleDifference(ship.angle, heading);
  return Math.max(-1, Math.min(1, difference * 2.5));
}

function updateChaser(context: SimContext, chaser: Ship, dt: number) {
  const { player } = context.state;
  const hull = hullFor("chaser", context.config);
  const heading = navigateTowards(context, chaser, player, dt);
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

  // mira um pouco à frente do alvo, andar reto não é seguro
  const travelTime = range / config.cannon.speed;
  const aimX = player.x + Math.cos(player.angle) * player.speed * travelTime * 0.6;
  const aimY = player.y + Math.sin(player.angle) * player.speed * travelTime * 0.6;
  const aim = angleBetween(shooter, { x: aimX, y: aimY });

  const closingIn = range > config.preferredDistance;
  const heading = closingIn ? navigateTowards(context, shooter, player, dt) : aim;
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
