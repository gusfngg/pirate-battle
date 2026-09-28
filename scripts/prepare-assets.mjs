import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "assets");
const target = join(root, "public", "game");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

function writeJson(file, data) {
  writeFileSync(join(target, file), JSON.stringify(data));
}

function frameName(file) {
  return file.replace(/\.png$/, "");
}

// kenney starling xml -> pixi spritesheet json
function convertShipsAtlas() {
  const xml = readFileSync(join(source, "spritesheet", "ships_miscellaneous_sheet.xml"), "utf8");
  const frames = {};
  const pattern = /<SubTexture name="([^"]+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g;

  for (const [, name, x, y, w, h] of xml.matchAll(pattern)) {
    const frame = { x: Number(x), y: Number(y), w: Number(w), h: Number(h) };
    frames[frameName(name)] = {
      frame,
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frame.w, h: frame.h },
      sourceSize: { w: frame.w, h: frame.h },
    };
  }

  cpSync(join(source, "spritesheet", "ships_miscellaneous_sheet.png"), join(target, "ships.png"));
  writeJson("ships.json", { frames, meta: { image: "ships.png", scale: "1", size: { w: 1024, h: 512 } } });
  return Object.keys(frames).length;
}

// the tilesheet is a plain 16 x 6 grid of 64px tiles
function buildTilesAtlas(scale, imageName, outputName) {
  const size = 64 * scale;
  const frames = {};

  for (let index = 0; index < 96; index++) {
    const column = index % 16;
    const row = Math.floor(index / 16);
    const frame = { x: column * size, y: row * size, w: size, h: size };
    frames[`tile_${index + 1}`] = {
      frame,
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: size, h: size },
      sourceSize: { w: size, h: size },
    };
  }

  cpSync(join(source, "tilesheet", imageName), join(target, `${outputName}.png`));
  writeJson(`${outputName}.json`, {
    frames,
    meta: { image: `${outputName}.png`, scale: String(scale), size: { w: 1024 * scale, h: 384 * scale } },
  });
}

// keeps only what pixi needs from the ui atlas and points it at the copied image
function copyUiAtlas(jsonName, imageName, outputName) {
  const atlas = JSON.parse(readFileSync(join(source, "spritesheet", jsonName), "utf8"));
  const frames = {};

  for (const [name, entry] of Object.entries(atlas.frames)) {
    frames[name] = {
      frame: entry.frame,
      rotated: entry.rotated,
      trimmed: entry.trimmed,
      spriteSourceSize: entry.spriteSourceSize,
      sourceSize: entry.sourceSize,
    };
  }

  cpSync(join(source, "spritesheet", imageName), join(target, `${outputName}.png`));
  writeJson(`${outputName}.json`, {
    frames,
    meta: { image: `${outputName}.png`, scale: atlas.meta.scale, size: atlas.meta.size },
  });
}

const shipFrames = convertShipsAtlas();
buildTilesAtlas(1, "tiles_sheet.png", "tiles");
buildTilesAtlas(2, "tiles_sheet_retina.png", "tiles@2x");
copyUiAtlas("ui_sheet.json", "ui_sheet.png", "ui");
copyUiAtlas("ui_sheet_retina.json", "ui_sheet_retina.png", "ui@2x");

// css uses the loose ui pngs, sounds are streamed as they are
cpSync(join(source, "png", "default", "ui"), join(target, "ui"), { recursive: true });
cpSync(join(source, "png", "retina", "ui"), join(target, "ui@2x"), { recursive: true });
cpSync(join(source, "png", "default", "ships"), join(target, "ships"), { recursive: true });
cpSync(join(source, "sounds"), join(target, "sounds"), { recursive: true });
cpSync(join(source, "logo_jungle_gaming.svg"), join(target, "logo_jungle_gaming.svg"));

console.log(`assets ready: ${shipFrames} ship frames, 96 tiles, ui atlas, sounds`);
