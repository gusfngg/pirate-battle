import { Assets, type Spritesheet, type Texture } from "pixi.js";
import { createStore } from "@/lib/store";

export interface GameAssets {
  ships: Spritesheet;
  tiles: Spritesheet;
  ui: Spritesheet;
}

// frames que o renderer precisa, conferidos antes da partida começar
const REQUIRED_FRAMES: Record<keyof GameAssets, string[]> = {
  ships: ["ship_2", "ship_3", "ship_5", "ship_20", "ship_21", "ship_23", "cannon_ball", "explosion_1", "explosion_2", "explosion_3", "fire_1", "fire_2", "wood_1"],
  tiles: ["tile_1", "tile_6", "tile_73"],
  ui: ["enemy_health_frame", "enemy_health_fill_green", "enemy_health_fill_red"],
};

let loaded: GameAssets | null = null;
let attempt = 0;

function sheetUrls() {
  const dense = typeof window !== "undefined" && window.devicePixelRatio >= 1.5;
  // query nova a cada tentativa ignora o que o navegador ou o pixi guardaram da falha
  const bust = attempt > 0 ? `?retry=${attempt}` : "";
  return {
    ships: `/game/ships.json${bust}`,
    tiles: `/game/${dense ? "tiles@2x" : "tiles"}.json${bust}`,
    ui: `/game/${dense ? "ui@2x" : "ui"}.json${bust}`,
  };
}

function validate(assets: GameAssets) {
  for (const [sheet, frames] of Object.entries(REQUIRED_FRAMES) as [keyof GameAssets, string[]][]) {
    const missing = frames.filter((frame) => !assets[sheet].textures[frame]);
    if (missing.length > 0) throw new Error(`the ${sheet} atlas is missing ${missing.join(", ")}`);
  }
}

export function getLoadedAssets() {
  return loaded;
}

export const assetProgress = createStore({ progress: 0 });
let pending: Promise<GameAssets> | null = null;

// carrega uma vez e reaproveita as texturas nas próximas partidas
// quem chamar durante o carregamento recebe a mesma promise (o strict mode chama duas vezes)
export function loadGameAssets(): Promise<GameAssets> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= fetchSheets().then(
    (assets) => {
      loaded = assets;
      pending = null;
      return assets;
    },
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}

async function fetchSheets(): Promise<GameAssets> {
  assetProgress.set({ progress: 0 });
  const urls = sheetUrls();
  attempt++;
  const list = [urls.ships, urls.tiles, urls.ui];
  const result = await Assets.load<Spritesheet>(list, (progress) => assetProgress.set({ progress }));

  const assets: GameAssets = {
    ships: result[urls.ships] as Spritesheet,
    tiles: result[urls.tiles] as Spritesheet,
    ui: result[urls.ui] as Spritesheet,
  };
  validate(assets);
  return assets;
}

export function frame(sheet: Spritesheet, name: string): Texture {
  const texture = sheet.textures[name];
  if (!texture) throw new Error(`missing frame ${name}`);
  return texture;
}
