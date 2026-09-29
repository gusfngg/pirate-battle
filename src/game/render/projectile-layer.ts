import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { Projectile } from "../sim/types";

const TRAIL_LENGTH = 0.06;

// sprites de bala reaproveitados, nada é criado ou destruído a cada tiro
export class ProjectileLayer {
  readonly display = new Container();
  private readonly trails = new Graphics();
  private readonly balls = new Container();
  private readonly active = new Map<number, Sprite>();
  private readonly pool: Sprite[] = [];
  private readonly seen = new Set<number>();

  constructor(private readonly texture: Texture) {
    this.display.addChild(this.trails, this.balls);
  }

  get count() {
    return this.active.size;
  }

  sync(projectiles: readonly Projectile[], alpha: number) {
    this.seen.clear();
    this.trails.clear();

    for (const projectile of projectiles) {
      this.seen.add(projectile.id);
      let sprite = this.active.get(projectile.id);
      if (!sprite) {
        sprite = this.pool.pop() ?? this.createBall();
        sprite.visible = true;
        this.active.set(projectile.id, sprite);
      }
      const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
      const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha;
      sprite.position.set(x, y);
      sprite.tint = projectile.side === "player" ? 0xffffff : 0xffc9b8;

      this.trails
        .moveTo(x, y)
        .lineTo(x - projectile.vx * TRAIL_LENGTH, y - projectile.vy * TRAIL_LENGTH);
    }
    if (projectiles.length > 0) this.trails.stroke({ width: 3, color: 0xffffff, alpha: 0.45, cap: "round" });

    for (const [id, sprite] of this.active) {
      if (this.seen.has(id)) continue;
      sprite.visible = false;
      this.active.delete(id);
      this.pool.push(sprite);
    }
  }

  private createBall() {
    const sprite = new Sprite(this.texture);
    sprite.anchor.set(0.5);
    sprite.scale.set(1.2);
    this.balls.addChild(sprite);
    return sprite;
  }

  destroy() {
    this.display.destroy({ children: true });
    this.active.clear();
    this.pool.length = 0;
  }
}
