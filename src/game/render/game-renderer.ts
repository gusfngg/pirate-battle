import { Container, Graphics } from "pixi.js";
import { frame, type GameAssets } from "../assets/game-assets";
import type { GameEvent, MatchState, Ship } from "../sim/types";
import type { ArenaLayout } from "../world/layout";
import { ArenaView } from "./arena-view";
import { EffectsLayer } from "./effects";
import { ProjectileLayer } from "./projectile-layer";
import { ShipView } from "./ship-view";

interface Foam {
  x: number;
  y: number;
  age: number;
}

const FOAM_LIFE = 1.1;
const FOAM_EVERY = 0.07;

// monta as camadas do pixi e só lê o estado da simulação, nunca altera
export class GameRenderer {
  readonly stage = new Container();
  private readonly world = new Container();
  private readonly arena: ArenaView;
  private readonly wakes = new Graphics();
  private readonly hulls = new Container();
  private readonly bars = new Container();
  private readonly projectiles: ProjectileLayer;
  private readonly effects: EffectsLayer;
  private readonly ships = new Map<number, ShipView>();
  private readonly foam: Foam[] = [];
  private foamClock = 0;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(
    private readonly assets: GameAssets,
    layout: ArenaLayout,
    seed: number,
  ) {
    this.worldWidth = layout.columns * layout.tileSize;
    this.worldHeight = layout.rows * layout.tileSize;
    this.arena = new ArenaView(assets, layout);
    this.projectiles = new ProjectileLayer(frame(assets.ships, "cannon_ball"));
    this.effects = new EffectsLayer(assets, seed);

    this.world.addChild(
      this.arena.water,
      this.wakes,
      this.arena.ground,
      this.effects.below,
      this.hulls,
      this.projectiles.display,
      this.effects.above,
      this.bars,
    );
    this.stage.addChild(this.world);
  }

  // encaixa a arena inteira na tela (contain) e centraliza, sem distorcer
  resize(width: number, height: number) {
    this.scale = Math.min(width / this.worldWidth, height / this.worldHeight);
    this.offsetX = (width - this.worldWidth * this.scale) / 2;
    this.offsetY = (height - this.worldHeight * this.scale) / 2;
    this.world.scale.set(this.scale);
    this.arena.cover(-this.offsetX / this.scale - 40, -this.offsetY / this.scale - 40, width / this.scale + 80, height / this.scale + 80);
    this.world.position.set(this.offsetX, this.offsetY);
  }

  consume(events: readonly GameEvent[]) {
    for (const event of events) {
      switch (event.type) {
        case "shot":
          this.effects.muzzle(event.x, event.y, event.angle, event.weapon !== "front");
          break;
        case "hit":
          this.ships.get(event.shipId)?.hit();
          this.effects.impact(event.x, event.y);
          if (event.side === "player") this.effects.shake(7);
          break;
        case "splash":
          this.effects.splash(event.x, event.y, event.onShore);
          break;
        case "shipDestroyed":
          this.effects.explode(event.x, event.y, event.kind === "player");
          if (event.kind !== "player") this.effects.sink(event.kind, event.x, event.y, event.angle);
          if (event.kind === "player") this.effects.shake(14);
          break;
        case "bump":
          this.effects.splash(event.x, event.y, false);
          break;
        default:
          break;
      }
    }
  }

  // alpha = quanto do próximo passo da simulação já passou (1 desenha o estado mais recente)
  render(state: MatchState, dt: number, alpha = 1) {
    this.syncShips(state, dt, alpha);
    this.projectiles.sync(state.projectiles, alpha);
    this.effects.update(dt);
    this.arena.update(dt);
    this.updateWakes(state, dt);

    const shake = this.effects.shakeOffset();
    this.world.position.set(this.offsetX + shake.x * this.scale, this.offsetY + shake.y * this.scale);
  }

  stats() {
    return { ships: this.ships.size, projectiles: this.projectiles.count, effects: this.effects.count, foam: this.foam.length };
  }

  private syncShips(state: MatchState, dt: number, alpha: number) {
    const present = new Set<number>();
    const all: Ship[] = [state.player, ...state.enemies];

    for (const ship of all) {
      present.add(ship.id);
      let view = this.ships.get(ship.id);
      if (!view) {
        view = new ShipView(this.assets, ship);
        this.ships.set(ship.id, view);
        this.hulls.addChild(view.hull);
        this.bars.addChild(view.bar);
      }
      view.sync(dt, alpha);
    }

    for (const [id, view] of this.ships) {
      if (present.has(id)) continue;
      view.destroy();
      this.ships.delete(id);
    }
  }

  // espuma atrás dos navios em movimento, desenhada num único graphics
  private updateWakes(state: MatchState, dt: number) {
    this.foamClock += dt;
    if (this.foamClock >= FOAM_EVERY) {
      this.foamClock = 0;
      for (const ship of [state.player, ...state.enemies]) {
        if (!ship.alive || ship.speed < 25) continue;
        const back = ship.radius * 1.3;
        this.foam.push({ x: ship.x - Math.cos(ship.angle) * back, y: ship.y - Math.sin(ship.angle) * back, age: 0 });
      }
    }

    this.wakes.clear();
    for (let i = this.foam.length - 1; i >= 0; i--) {
      const dot = this.foam[i]!;
      dot.age += dt;
      if (dot.age >= FOAM_LIFE) {
        this.foam.splice(i, 1);
        continue;
      }
      const t = dot.age / FOAM_LIFE;
      this.wakes.circle(dot.x, dot.y, 6 + t * 14).fill({ color: 0xffffff, alpha: 0.28 * (1 - t) });
    }
  }

  destroy() {
    for (const view of this.ships.values()) view.destroy();
    this.ships.clear();
    this.projectiles.destroy();
    this.effects.destroy();
    this.arena.destroy();
    this.stage.destroy({ children: true });
  }
}
