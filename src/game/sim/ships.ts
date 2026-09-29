import type { GameConfig, HullConfig } from "../config";
import { angleDifference, approach, clamp, wrapAngle } from "../math";
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
    prevX: x,
    prevY: y,
    prevAngle: angle,
    speed: 0,
    turnRate: 0,
    course: angle,
    health: hull.maxHealth,
    maxHealth: hull.maxHealth,
    radius: hull.radius,
    alive: true,
    cooldowns: { front: 0, left: 0, right: 0 },
    detour: 0,
    route: [],
    routeTimer: 0,
  };
}

export function coolDown(ship: Ship, dt: number) {
  ship.cooldowns.front = Math.max(0, ship.cooldowns.front - dt);
  ship.cooldowns.left = Math.max(0, ship.cooldowns.left - dt);
  ship.cooldowns.right = Math.max(0, ship.cooldowns.right - dt);
}

// o leme ganha e perde força aos poucos; parado o navio ainda gira um pouco, pra sempre sair de enrascada
export function steer(ship: Ship, hull: HullConfig, helm: Helm, dt: number) {
  const speedRatio = clamp(ship.speed / hull.maxSpeed, 0, 1);
  const rudder = 0.55 + 0.45 * speedRatio;
  const targetRate = clamp(helm.turn, -1, 1) * hull.turnSpeed * rudder;
  ship.turnRate = approach(ship.turnRate, targetRate, hull.turnAcceleration * dt);
  ship.angle = wrapAngle(ship.angle + ship.turnRate * dt);
  // o deslocamento persegue a proa com atraso proporcional, é isso que dá a deriva nas curvas
  ship.course = wrapAngle(ship.course + angleDifference(ship.course, ship.angle) * Math.min(1, hull.grip * dt));

  const targetSpeed = hull.maxSpeed * clamp(helm.throttle, 0, 1);
  const rate = targetSpeed > ship.speed ? hull.acceleration : hull.drag;
  ship.speed = approach(ship.speed, targetSpeed, rate * dt);
}

// anda na direção da proa e depois resolve ilhas, pedras e borda da arena
export function sail(ship: Ship, dt: number, context: SimContext) {
  const headingX = Math.cos(ship.course);
  const headingY = Math.sin(ship.course);
  ship.x += headingX * ship.speed * dt;
  ship.y += headingY * ship.speed * dt;

  // quanto do movimento vai de frente contra o obstáculo: 0 raspando de lado, 1 batendo de proa
  let impact = 0;
  for (const obstacle of context.obstacles) {
    const contact = findContact(obstacle, ship.x, ship.y, ship.radius);
    if (!contact) continue;
    ship.x += contact.normalX * contact.depth;
    ship.y += contact.normalY * contact.depth;
    impact = Math.max(impact, -(headingX * contact.normalX + headingY * contact.normalY));
  }

  const { width, height } = context.config.arena;
  const clampedX = clamp(ship.x, ship.radius, width - ship.radius);
  const clampedY = clamp(ship.y, ship.radius, height - ship.radius);
  if (clampedX !== ship.x) impact = Math.max(impact, Math.abs(headingX));
  if (clampedY !== ship.y) impact = Math.max(impact, Math.abs(headingY));
  ship.x = clampedX;
  ship.y = clampedY;

  if (impact > 0) {
    const hard = ship.speed * impact > 40;
    ship.speed *= 1 - 0.45 * impact;
    if (hard) context.emit({ type: "bump", shipId: ship.id, x: ship.x, y: ship.y });
  }
}

// empurra os dois cascos pra eles não se sobreporem
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
