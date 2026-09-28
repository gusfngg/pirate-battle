import { hitsAnyObstacle } from "../world/obstacles";
import type { SimContext } from "./context";
import { damageShip, sinkByCannon } from "./damage";
import type { Projectile, Ship } from "./types";

function touches(projectile: Projectile, ship: Ship) {
  return Math.hypot(ship.x - projectile.x, ship.y - projectile.y) < ship.radius + projectile.radius;
}

function strike(context: SimContext, projectile: Projectile) {
  const { player, enemies } = context.state;

  if (projectile.side === "enemy") {
    if (!player.alive || !touches(projectile, player)) return false;
    damageShip(context, player, projectile.damage);
    return true;
  }

  for (const enemy of enemies) {
    if (!enemy.alive || !touches(projectile, enemy)) continue;
    damageShip(context, enemy, projectile.damage);
    if (enemy.health <= 0) sinkByCannon(context, enemy);
    return true;
  }
  return false;
}

// a bala some no instante em que acerta, então só causa dano uma vez
export function updateProjectiles(context: SimContext, dt: number) {
  const { width, height } = context.config.arena;
  const survivors: Projectile[] = [];

  for (const projectile of context.state.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.travelled += Math.hypot(projectile.vx, projectile.vy) * dt;

    if (strike(context, projectile)) continue;

    if (hitsAnyObstacle(context.obstacles, projectile.x, projectile.y, projectile.radius)) {
      context.emit({ type: "splash", x: projectile.x, y: projectile.y, onShore: true });
      continue;
    }

    const outside = projectile.x < 0 || projectile.y < 0 || projectile.x > width || projectile.y > height;
    if (outside) continue;

    if (projectile.travelled >= projectile.range) {
      context.emit({ type: "splash", x: projectile.x, y: projectile.y, onShore: false });
      continue;
    }

    survivors.push(projectile);
  }

  context.state.projectiles = survivors;
}
