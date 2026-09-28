import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import { frame, type GameAssets } from "../assets/game-assets";
import type { Ship, ShipKind } from "../sim/types";

// cada linha do atlas é um estágio de dano: inteiro, avariado, destruído, naufrágio
const BASE_FRAME: Record<ShipKind, number> = { player: 3, chaser: 2, shooter: 5 };
const STAGE_STEP = 6;
const HULL_SCALE: Record<ShipKind, number> = { player: 0.8, chaser: 0.68, shooter: 0.8 };

const BAR_SCALE = 0.45;
const FILL_LEFT = 24;
const FILL_WIDTH = 112;
const FLASH_SECONDS = 0.14;

export function damageStage(health: number, maxHealth: number) {
  if (health <= 0) return 3;
  const ratio = health / maxHealth;
  if (ratio > 0.66) return 0;
  if (ratio > 0.33) return 1;
  return 2;
}

export function hullTexture(assets: GameAssets, kind: ShipKind, stage: number) {
  return frame(assets.ships, `ship_${BASE_FRAME[kind] + stage * STAGE_STEP}`);
}

// a barra de vida fica fora do casco pra não girar junto com o navio
export class ShipView {
  readonly hull = new Container();
  readonly bar = new Container();
  private readonly body: Sprite;
  private readonly fires: Sprite[];
  private readonly fill: Sprite;
  private readonly fillSource: Texture;
  private stage = -1;
  private shownHealth = -1;
  private flash = 0;
  private time = Math.random() * 10;

  constructor(
    private readonly assets: GameAssets,
    readonly ship: Ship,
  ) {
    this.body = new Sprite(hullTexture(assets, ship.kind, 0));
    this.body.anchor.set(0.5);
    this.body.scale.set(HULL_SCALE[ship.kind]);
    this.hull.addChild(this.body);

    this.fires = [
      { name: "fire_1", x: -8, y: -14 },
      { name: "fire_2", x: 9, y: 16 },
    ].map(({ name, x, y }) => {
      const fire = new Sprite(frame(assets.ships, name));
      fire.anchor.set(0.5, 0.9);
      fire.position.set(x, y);
      fire.visible = false;
      this.hull.addChild(fire);
      return fire;
    });

    const isPlayer = ship.kind === "player";
    const barFrame = new Sprite(frame(assets.ui, "enemy_health_frame"));
    this.fillSource = frame(assets.ui, isPlayer ? "enemy_health_fill_green" : "enemy_health_fill_red");
    this.fill = new Sprite(this.fillSource);
    this.bar.addChild(barFrame, this.fill);
    this.bar.scale.set(BAR_SCALE);
    this.bar.pivot.set(80, 20);

    this.sync(0);
  }

  hit() {
    this.flash = FLASH_SECONDS;
  }

  sync(dt: number) {
    const { ship } = this;
    this.time += dt;
    this.hull.position.set(ship.x, ship.y);
    // o sprite nasce com a proa pra baixo, o ângulo zero da simulação aponta pra direita
    this.hull.rotation = ship.angle - Math.PI / 2;
    this.bar.position.set(ship.x, ship.y - 54);
    this.bar.visible = ship.alive;

    const stage = damageStage(ship.health, ship.maxHealth);
    if (stage !== this.stage) {
      this.stage = stage;
      this.body.texture = hullTexture(this.assets, ship.kind, stage);
      this.fires[0]!.visible = stage === 1 || stage === 2;
      this.fires[1]!.visible = stage === 2;
    }

    for (const [index, fire] of this.fires.entries()) {
      if (!fire.visible) continue;
      const flicker = 1 + Math.sin(this.time * 18 + index * 2) * 0.12;
      fire.scale.set(flicker, 1 / flicker);
    }

    if (ship.health !== this.shownHealth) {
      this.shownHealth = ship.health;
      this.cropFill(ship.health / ship.maxHealth);
    }

    this.flash = Math.max(0, this.flash - dt);
    this.body.tint = this.flash > 0 ? 0xff8a7a : 0xffffff;
  }

  // corta a textura do preenchimento em vez de esticar, assim a ponta arredondada não deforma
  private cropFill(ratio: number) {
    const source = this.fillSource.frame;
    const visible = FILL_LEFT + FILL_WIDTH * Math.max(0, Math.min(1, ratio));
    const previous = this.fill.texture;
    this.fill.texture = new Texture({
      source: this.fillSource.source,
      frame: new Rectangle(source.x, source.y, Math.max(1, visible), source.height),
    });
    if (previous !== this.fillSource) previous.destroy(false);
  }

  destroy() {
    const cropped = this.fill.texture;
    this.hull.destroy({ children: true });
    this.bar.destroy({ children: true });
    if (cropped !== this.fillSource) cropped.destroy(false);
  }
}
