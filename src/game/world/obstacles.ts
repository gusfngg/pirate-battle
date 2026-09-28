import { clamp } from "../math";
import type { ArenaLayout } from "./layout";

export interface IslandObstacle {
  kind: "island";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  corner: number;
}

export interface RockObstacle {
  kind: "rock";
  id: string;
  x: number;
  y: number;
  radius: number;
}

export type Obstacle = IslandObstacle | RockObstacle;

export interface Contact {
  depth: number;
  normalX: number;
  normalY: number;
}

// a areia tem uma borda transparente, o colisor acompanha a praia visível
const SHORE_INSET = 14;
const SHORE_CORNER = 38;

export function buildObstacles(layout: ArenaLayout): Obstacle[] {
  const size = layout.tileSize;

  const islands = layout.islands.map<IslandObstacle>((island) => ({
    kind: "island",
    id: island.id,
    x: island.column * size + SHORE_INSET,
    y: island.row * size + SHORE_INSET,
    width: island.columns * size - SHORE_INSET * 2,
    height: island.rows * size - SHORE_INSET * 2,
    corner: SHORE_CORNER,
  }));

  const rocks = layout.rocks.map<RockObstacle>((rock, index) => ({
    kind: "rock",
    id: `rock-${index}`,
    x: rock.x,
    y: rock.y,
    radius: rock.radius,
  }));

  return [...islands, ...rocks];
}

function contactWithRock(rock: RockObstacle, x: number, y: number, radius: number): Contact | null {
  const dx = x - rock.x;
  const dy = y - rock.y;
  const distance = Math.hypot(dx, dy);
  const depth = rock.radius + radius - distance;
  if (depth <= 0) return null;
  if (distance === 0) return { depth, normalX: 1, normalY: 0 };
  return { depth, normalX: dx / distance, normalY: dy / distance };
}

// retângulo arredondado = retângulo interno expandido pelo raio do canto
function contactWithIsland(island: IslandObstacle, x: number, y: number, radius: number): Contact | null {
  const innerLeft = island.x + island.corner;
  const innerTop = island.y + island.corner;
  const innerRight = island.x + island.width - island.corner;
  const innerBottom = island.y + island.height - island.corner;

  const closestX = clamp(x, innerLeft, innerRight);
  const closestY = clamp(y, innerTop, innerBottom);
  const dx = x - closestX;
  const dy = y - closestY;
  const distance = Math.hypot(dx, dy);
  const reach = island.corner + radius;

  if (distance > 0) {
    if (distance >= reach) return null;
    return { depth: reach - distance, normalX: dx / distance, normalY: dy / distance };
  }

  // o centro está dentro do retângulo interno, empurra pelo lado mais próximo
  const toLeft = x - innerLeft;
  const toRight = innerRight - x;
  const toTop = y - innerTop;
  const toBottom = innerBottom - y;
  const nearest = Math.min(toLeft, toRight, toTop, toBottom);

  if (nearest === toLeft) return { depth: toLeft + reach, normalX: -1, normalY: 0 };
  if (nearest === toRight) return { depth: toRight + reach, normalX: 1, normalY: 0 };
  if (nearest === toTop) return { depth: toTop + reach, normalX: 0, normalY: -1 };
  return { depth: toBottom + reach, normalX: 0, normalY: 1 };
}

export function findContact(obstacle: Obstacle, x: number, y: number, radius: number) {
  return obstacle.kind === "rock"
    ? contactWithRock(obstacle, x, y, radius)
    : contactWithIsland(obstacle, x, y, radius);
}

export function hitsAnyObstacle(obstacles: readonly Obstacle[], x: number, y: number, radius: number) {
  return obstacles.some((obstacle) => findContact(obstacle, x, y, radius) !== null);
}
