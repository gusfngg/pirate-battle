import type { GameConfig, HullConfig } from "../config";
import { approach, clamp, wrapAngle } from "../math";
import { findContact } from "../world/obstacles";
import type { SimContext } from "./context";
import type { Ship, ShipKind } from "./types";

export interface Helm {
  throttle: number;
  turn: number;
}

export function hullFor(kind: ShipKind, config: GameConfig): HullConfig {
  if (kind === "player") return config.player;
  return config[kind];
}

export function createShip(id: number, kind: ShipKind, x: number, y: number, angle: number, config: GameConfig): Ship {
  const hull = hullFor(kind, config);
  return {
    id,
    kind,
    x,
    y,
    angle,
    speed: 0,
    health: hull.maxHealth,
    maxHealth: hull.maxHealth,
    radius: hull.radius,
    alive: true,
    cooldowns: { front: 0, left: 0, right: 0 },
  };
}

export function coolDown(ship: Ship, dt: number) {
  ship.cooldowns.front = Math.max(0, ship.cooldowns.front - dt);
  ship.cooldowns.left = Math.max(0, ship.cooldowns.left - dt);
  ship.cooldowns.right = Math.max(0, ship.cooldowns.right - dt);
}

// ships keep some rudder at rest so they can always point away from trouble
export function steer(ship: Ship, hull: HullConfig, helm: Helm, dt: number) {
  const speedRatio = clamp(ship.speed / hull.maxSpeed, 0, 1);
  const rudder = 0.55 + 0.45 * speedRatio;
  ship.angle = wrapAngle(ship.angle + helm.turn * hull.turnSpeed * rudder * dt);

  const targetSpeed = hull.maxSpeed * clamp(helm.throttle, 0, 1);
  const rate = targetSpeed > ship.speed ? hull.acceleration : hull.drag;
  ship.speed = approach(ship.speed, targetSpeed, rate * dt);
}

// moves along the heading, then resolves islands, rocks and the arena edge
export function sail(ship: Ship, dt: number, context: SimContext) {
  ship.x += Math.cos(ship.angle) * ship.speed * dt;
  ship.y += Math.sin(ship.angle) * ship.speed * dt;

  let bumped = false;
  for (const obstacle of context.obstacles) {
    const contact = findContact(obstacle, ship.x, ship.y, ship.radius);
    if (!contact) continue;
    ship.x += contact.normalX * contact.depth;
    ship.y += contact.normalY * contact.depth;
    bumped = true;
  }

  const { width, height } = context.config.arena;
  const clampedX = clamp(ship.x, ship.radius, width - ship.radius);
  const clampedY = clamp(ship.y, ship.radius, height - ship.radius);
  if (clampedX !== ship.x || clampedY !== ship.y) bumped = true;
  ship.x = clampedX;
  ship.y = clampedY;

  if (bumped) {
    const wasFast = ship.speed > 40;
    ship.speed *= 0.55;
    if (wasFast) context.emit({ type: "bump", shipId: ship.id, x: ship.x, y: ship.y });
  }
}

// keeps two hulls from overlapping by pushing both apart
export function separate(a: Ship, b: Ship) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const overlap = a.radius + b.radius - distance;
  if (overlap <= 0) return false;
  const nx = distance === 0 ? 1 : dx / distance;
  const ny = distance === 0 ? 0 : dy / distance;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;
  return true;
}

export function shipsTouch(a: Ship, b: Ship) {
  return Math.hypot(b.x - a.x, b.y - a.y) < a.radius + b.radius;
}
