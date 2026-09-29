import type { GameConfig } from "../config";
import type { Random } from "../random";
import type { NavGrid } from "../world/nav-grid";
import type { Obstacle } from "../world/obstacles";
import type { GameEvent, MatchState } from "./types";

export interface SimContext {
  readonly config: GameConfig;
  readonly obstacles: readonly Obstacle[];
  readonly navGrid: NavGrid;
  readonly random: Random;
  readonly state: MatchState;
  emit(event: GameEvent): void;
  nextId(): number;
}
