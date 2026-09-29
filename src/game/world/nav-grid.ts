import type { Vec } from "../math";
import { hitsAnyObstacle, type Obstacle } from "./obstacles";

export interface NavGrid {
  cell: number;
  columns: number;
  rows: number;
  width: number;
  height: number;
  clearance: number;
  blocked: Uint8Array;
  obstacles: readonly Obstacle[];
}

const CELL = 32;
const SQRT2 = Math.SQRT2;

function isOpenPoint(grid: Pick<NavGrid, "width" | "height" | "clearance" | "obstacles">, x: number, y: number) {
  const { width, height, clearance } = grid;
  if (x < clearance || y < clearance || x > width - clearance || y > height - clearance) return false;
  return !hitsAnyObstacle(grid.obstacles, x, y, clearance);
}

// grade de navegação: cada célula guarda se um casco com essa folga cabe no centro dela
export function buildNavGrid(obstacles: readonly Obstacle[], width: number, height: number, clearance: number): NavGrid {
  const columns = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const blocked = new Uint8Array(columns * rows);
  const grid = { cell: CELL, columns, rows, width, height, clearance, blocked, obstacles };
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = (column + 0.5) * CELL;
      const y = (row + 0.5) * CELL;
      blocked[row * columns + column] = isOpenPoint(grid, x, y) ? 0 : 1;
    }
  }
  return grid;
}

function cellCentre(grid: NavGrid, index: number): Vec {
  return { x: ((index % grid.columns) + 0.5) * grid.cell, y: (Math.floor(index / grid.columns) + 0.5) * grid.cell };
}

function cellOf(grid: NavGrid, point: Vec) {
  const column = Math.min(grid.columns - 1, Math.max(0, Math.floor(point.x / grid.cell)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(point.y / grid.cell)));
  return row * grid.columns + column;
}

// se o ponto caiu numa célula bloqueada (navio encostado na praia), usa a livre mais próxima
// que enxerga o ponto em linha reta, senão a rota poderia terminar do outro lado de uma quina
function nearestOpenCell(grid: NavGrid, point: Vec) {
  const index = cellOf(grid, point);
  if (!grid.blocked[index]) return index;
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  for (let radius = 1; radius < 6; radius++) {
    let fallback = -1;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const c = column + dx;
        const r = row + dy;
        if (c < 0 || r < 0 || c >= grid.columns || r >= grid.rows) continue;
        const candidate = r * grid.columns + c;
        if (grid.blocked[candidate]) continue;
        if (hasClearLine(grid, cellCentre(grid, candidate), point)) return candidate;
        if (fallback < 0) fallback = candidate;
      }
    }
    if (fallback >= 0) return fallback;
  }
  return -1;
}

// confere pontos ao longo do segmento com a mesma folga da grade (um pouco menor, pra não travar rente à praia)
export function hasClearLine(grid: NavGrid, from: Vec, to: Vec) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(length / (grid.cell / 2)));
  const probe = { ...grid, clearance: grid.clearance * 0.8 };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!isOpenPoint(probe, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)) return false;
  }
  return true;
}

// fila de prioridade mínima simples, suficiente pras ~1400 células da arena
class MinHeap {
  private readonly items: number[] = [];
  constructor(private readonly score: Float64Array) {}

  get size() {
    return this.items.length;
  }

  push(index: number) {
    const items = this.items;
    items.push(index);
    let child = items.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (this.score[items[parent]!]! <= this.score[items[child]!]!) break;
      [items[parent], items[child]] = [items[child]!, items[parent]!];
      child = parent;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        if (left < items.length && this.score[items[left]!]! < this.score[items[smallest]!]!) smallest = left;
        if (right < items.length && this.score[items[right]!]! < this.score[items[smallest]!]!) smallest = right;
        if (smallest === parent) break;
        [items[parent], items[smallest]] = [items[smallest]!, items[parent]!];
        parent = smallest;
      }
    }
    return top;
  }
}

const NEIGHBOURS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
] as const;

function octile(grid: NavGrid, a: number, b: number) {
  const dx = Math.abs((a % grid.columns) - (b % grid.columns));
  const dy = Math.abs(Math.floor(a / grid.columns) - Math.floor(b / grid.columns));
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

// a* na grade e depois "puxa o barbante": só ficam os pontos onde o navio precisa virar
export function findPath(grid: NavGrid, from: Vec, to: Vec): Vec[] | null {
  if (hasClearLine(grid, from, to)) return [to];

  const start = nearestOpenCell(grid, from);
  const goal = nearestOpenCell(grid, to);
  if (start < 0 || goal < 0) return null;

  const total = grid.columns * grid.rows;
  const cost = new Float64Array(total).fill(Infinity);
  const score = new Float64Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const open = new MinHeap(score);

  cost[start] = 0;
  score[start] = octile(grid, start, goal);
  open.push(start);

  while (open.size > 0) {
    const current = open.pop();
    if (current === goal) break;
    if (closed[current]) continue;
    closed[current] = 1;

    const column = current % grid.columns;
    const row = Math.floor(current / grid.columns);
    for (const [dx, dy, step] of NEIGHBOURS) {
      const c = column + dx;
      const r = row + dy;
      if (c < 0 || r < 0 || c >= grid.columns || r >= grid.rows) continue;
      const next = r * grid.columns + c;
      if (grid.blocked[next] || closed[next]) continue;
      // na diagonal, as duas células vizinhas precisam estar livres pra não cortar a quina da ilha
      if (dx !== 0 && dy !== 0 && (grid.blocked[row * grid.columns + c] || grid.blocked[r * grid.columns + column])) continue;

      const tentative = cost[current]! + step;
      if (tentative >= cost[next]!) continue;
      cost[next] = tentative;
      parent[next] = current;
      score[next] = tentative + octile(grid, next, goal);
      open.push(next);
    }
  }

  if (parent[goal] === -1 && goal !== start) return null;

  const cells: Vec[] = [];
  for (let index = goal; index !== -1 && index !== start; index = parent[index]!) cells.push(cellCentre(grid, index));
  cells.reverse();
  cells.push(to);

  const route: Vec[] = [];
  let anchor = from;
  let i = 0;
  while (i < cells.length) {
    let farthest = i;
    for (let j = cells.length - 1; j > i; j--) {
      if (hasClearLine(grid, anchor, cells[j]!)) {
        farthest = j;
        break;
      }
    }
    route.push(cells[farthest]!);
    anchor = cells[farthest]!;
    i = farthest + 1;
  }
  return route;
}
