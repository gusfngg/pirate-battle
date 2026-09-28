import { angleBetween, distance } from "../math";
import { hitsAnyObstacle } from "../world/obstacles";
import type { SimContext } from "./context";
import { createShip } from "./ships";
import type { EnemyKind, Ship } from "./types";

const EDGE_MARGIN = 70;
const CLEARANCE = 36;
const ATTEMPTS = 40;

function randomEdgePoint(context: SimContext) {
  const { width, height } = context.config.arena;
  const { random } = context;
  const edge = Math.floor(random.next() * 4);
  if (edge === 0) return { x: random.range(EDGE_MARGIN, width - EDGE_MARGIN), y: EDGE_MARGIN };
  if (edge === 1) return { x: width - EDGE_MARGIN, y: random.range(EDGE_MARGIN, height - EDGE_MARGIN) };
  if (edge === 2) return { x: random.range(EDGE_MARGIN, width - EDGE_MARGIN), y: height - EDGE_MARGIN };
  return { x: EDGE_MARGIN, y: random.range(EDGE_MARGIN, height - EDGE_MARGIN) };
}

function isOpenWater(context: SimContext, x: number, y: number, radius: number) {
  if (hitsAnyObstacle(context.obstacles, x, y, radius + CLEARANCE)) return false;
  return context.state.enemies.every((enemy) => !enemy.alive || distance(enemy, { x, y }) > enemy.radius + radius + CLEARANCE);
}

// inimigos entram pelas bordas, em água livre e longe o bastante pra ser justo
export function findSpawnPoint(context: SimContext, radius: number) {
  const { player } = context.state;
  const minDistance = context.config.match.spawnMinDistance;
  let fallback: { x: number; y: number } | null = null;
  let fallbackDistance = -1;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const point = randomEdgePoint(context);
    if (!isOpenWater(context, point.x, point.y, radius)) continue;
    const away = distance(point, player);
    if (away >= minDistance) return point;
    if (away > fallbackDistance) {
      fallback = point;
      fallbackDistance = away;
    }
  }
  return fallback;
}

function nextKind(context: SimContext): EnemyKind {
  const { state, random, config } = context;
  if (state.spawnBag.length === 0) state.spawnBag = random.shuffle(config.match.spawnBag);
  return state.spawnBag.pop() ?? "chaser";
}

export function spawnEnemy(context: SimContext, kind: EnemyKind, x: number, y: number, angle?: number): Ship {
  const heading = angle ?? angleBetween({ x, y }, context.state.player);
  const ship = createShip(context.nextId(), kind, x, y, heading, context.config);
  context.state.enemies.push(ship);
  context.state.spawnedByKind[kind] += 1;
  context.emit({ type: "enemySpawned", shipId: ship.id, kind, x, y });
  return ship;
}

export function updateSpawner(context: SimContext, dt: number) {
  const { state, config } = context;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;

  const alive = state.enemies.filter((enemy) => enemy.alive).length;
  if (alive >= config.match.maxEnemies) {
    state.spawnTimer = 0.5;
    return;
  }

  const kind = nextKind(context);
  const point = findSpawnPoint(context, config[kind].radius);
  if (!point) {
    state.spawnTimer = 0.25;
    state.spawnBag.push(kind);
    return;
  }

  spawnEnemy(context, kind, point.x, point.y);
  state.spawnTimer += config.match.spawnIntervalSeconds;
}
