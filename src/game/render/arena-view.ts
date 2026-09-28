import { Container, Graphics, Sprite, TilingSprite } from "pixi.js";
import { frame, type GameAssets } from "../assets/game-assets";
import { islandTiles, type ArenaLayout } from "../world/layout";

const WATER_TILE = "tile_73";
const SHALLOW_REACH = 34;

// o mar é maior que a arena, assim as sobras da tela continuam parecendo oceano
export class ArenaView {
  readonly water: TilingSprite;
  readonly ground = new Container();
  private readonly edge = new Graphics();
  private time = 0;

  constructor(assets: GameAssets, layout: ArenaLayout) {
    const size = layout.tileSize;
    const width = layout.columns * size;
    const height = layout.rows * size;

    this.water = new TilingSprite({ texture: frame(assets.tiles, WATER_TILE), width: 64, height: 64 });

    const shallows = new Graphics();
    for (const island of layout.islands) {
      shallows
        .roundRect(
          island.column * size - SHALLOW_REACH,
          island.row * size - SHALLOW_REACH,
          island.columns * size + SHALLOW_REACH * 2,
          island.rows * size + SHALLOW_REACH * 2,
          56,
        )
        .fill({ color: 0xbff4ff, alpha: 0.22 });
    }
    this.ground.addChild(shallows);

    for (const island of layout.islands) {
      for (const tile of islandTiles(island)) {
        const sprite = new Sprite(frame(assets.tiles, `tile_${tile.tile}`));
        // meio pixel de sobra esconde as costuras entre tiles quando a tela escala
        sprite.position.set(tile.column * size - 0.5, tile.row * size - 0.5);
        sprite.setSize(size + 1, size + 1);
        this.ground.addChild(sprite);
      }
      for (const decor of island.decor) {
        const sprite = new Sprite(frame(assets.tiles, `tile_${decor.tile}`));
        sprite.anchor.set(0.5);
        sprite.position.set((island.column + decor.x) * size, (island.row + decor.y) * size);
        sprite.setSize(size * decor.scale, size * decor.scale);
        this.ground.addChild(sprite);
      }
    }

    for (const rock of layout.rocks) {
      const sprite = new Sprite(frame(assets.tiles, `tile_${rock.tile}`));
      sprite.anchor.set(0.5);
      sprite.position.set(rock.x, rock.y);
      const scale = (rock.radius * 2.6) / 64;
      sprite.setSize(64 * scale, 64 * scale);
      this.ground.addChild(sprite);
    }

    this.edge.rect(0, 0, width, height).stroke({ width: 6, color: 0x0b3d5c, alpha: 0.35, alignment: 1 });
    this.ground.addChild(this.edge);

    // ilhas não se mexem, então viram uma textura só desenhada uma vez
    this.ground.cacheAsTexture(true);
  }

  // a água cobre a tela toda em unidades do mundo, qualquer que seja a proporção
  cover(left: number, top: number, width: number, height: number) {
    this.water.position.set(left, top);
    this.water.setSize(width, height);
  }

  update(dt: number) {
    this.time += dt;
    this.water.tilePosition.set(this.time * 6 - this.water.x, Math.sin(this.time * 0.4) * 8 - this.water.y);
  }

  destroy() {
    this.ground.cacheAsTexture(false);
  }
}
