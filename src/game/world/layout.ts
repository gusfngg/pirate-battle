import layoutData from "./arena-layout.json";

export type IslandStyle = "grass" | "sand";

export interface DecorPlacement {
  tile: number;
  x: number;
  y: number;
  scale: number;
}

export interface IslandLayout {
  id: string;
  style: IslandStyle;
  column: number;
  row: number;
  columns: number;
  rows: number;
  decor: DecorPlacement[];
}

export interface RockLayout {
  tile: number;
  x: number;
  y: number;
  radius: number;
}

export interface ArenaLayout {
  tileSize: number;
  columns: number;
  rows: number;
  playerStart: { x: number; y: number; angle: number };
  islands: IslandLayout[];
  rocks: RockLayout[];
}

export interface TilePlacement {
  tile: number;
  column: number;
  row: number;
}

export const ARENA_LAYOUT = layoutData as ArenaLayout;

// the tilesheet draws islands as nine slice blocks, these are the tile ids per slice
const SAND_SLICES = [
  [1, 2, 3],
  [17, 18, 19],
  [33, 34, 35],
];

const GRASS_SLICES = [
  [6, 7, 8, 9],
  [22, 23, 24, 25],
  [38, 39, 40, 41],
  [54, 55, 56, 57],
];

function sliceIndex(position: number, size: number, sliceCount: number) {
  if (position === 0) return 0;
  if (position === size - 1) return sliceCount - 1;
  const innerSlices = sliceCount - 2;
  return 1 + ((position - 1) % innerSlices);
}

export function islandTiles(island: IslandLayout): TilePlacement[] {
  const slices = island.style === "grass" ? GRASS_SLICES : SAND_SLICES;
  const tiles: TilePlacement[] = [];

  for (let row = 0; row < island.rows; row++) {
    const sliceRow = slices[sliceIndex(row, island.rows, slices.length)] ?? [];
    for (let column = 0; column < island.columns; column++) {
      const tile = sliceRow[sliceIndex(column, island.columns, sliceRow.length)];
      if (tile !== undefined) {
        tiles.push({ tile, column: island.column + column, row: island.row + row });
      }
    }
  }

  return tiles;
}
