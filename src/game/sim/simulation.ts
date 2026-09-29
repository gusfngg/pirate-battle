import type { GameConfig } from "../config";
import { createRandom } from "../random";
import type { ArenaLayout } from "../world/layout";
import { buildNavGrid, type NavGrid } from "../world/nav-grid";
import { buildObstacles, type Obstacle } from "../world/obstacles";
import type { SimContext } from "./context";
import { updateEnemies } from "./enemies";
import { updatePlayer } from "./player";
import { updateProjectiles } from "./projectiles";
import { createShip } from "./ships";
import { spawnEnemy, updateSpawner } from "./spawner";
import type { Controls, EndReason, EnemyKind, GameEvent, MatchState } from "./types";

export interface SimulationOptions {
  config: GameConfig;
  layout: ArenaLayout;
  seed: number;
}

// a partida inteira mora aqui, sem pixi e sem react, só números andando no tempo
export class Simulation {
  readonly config: GameConfig;
  readonly obstacles: readonly Obstacle[];
  readonly navGrid: NavGrid;
  readonly seed: number;
  readonly state: MatchState;

  private readonly context: SimContext;
  private events: GameEvent[] = [];
  private idCounter = 1;
  private lastCountdownTick: number;

  constructor({ config, layout, seed }: SimulationOptions) {
    this.config = config;
    this.seed = seed;
    this.obstacles = buildObstacles(layout);
    // a folga é o raio do maior inimigo, assim toda rota cabe pra qualquer casco
    this.navGrid = buildNavGrid(this.obstacles, config.arena.width, config.arena.height, Math.max(config.chaser.radius, config.shooter.radius));

    const start = layout.playerStart;
    this.state = {
      phase: config.countdownSeconds > 0 ? "countdown" : "running",
      countdown: config.countdownSeconds,
      elapsed: 0,
      remaining: config.match.durationSeconds,
      score: 0,
      endReason: null,
      player: createShip(this.idCounter++, "player", start.x, start.y, start.angle, config),
      enemies: [],
      projectiles: [],
      spawnTimer: config.match.firstSpawnDelaySeconds,
      spawnBag: [],
      spawnedByKind: { chaser: 0, shooter: 0 },
    };
    this.lastCountdownTick = Math.ceil(config.countdownSeconds);

    this.context = {
      config,
      obstacles: this.obstacles,
      navGrid: this.navGrid,
      random: createRandom(seed),
      state: this.state,
      emit: (event) => this.events.push(event),
      nextId: () => this.idCounter++,
    };

    if (this.state.phase === "running") this.events.push({ type: "matchStarted" });
    else this.events.push({ type: "countdown", value: this.lastCountdownTick });
  }

  step(dt: number, controls: Controls) {
    if (this.state.phase === "ended") return;
    if (this.state.phase === "countdown") {
      this.tickCountdown(dt);
      return;
    }

    const context = this.context;
    this.state.elapsed += dt;
    this.state.remaining = Math.max(0, this.state.remaining - dt);

    updatePlayer(context, controls, dt);
    updateSpawner(context, dt);
    updateEnemies(context, dt);
    updateProjectiles(context, dt);

    this.state.enemies = this.state.enemies.filter((enemy) => enemy.alive);

    if (!this.state.player.alive || this.state.player.health <= 0) this.end("destroyed");
    else if (this.state.remaining <= 0) this.end("time");
  }

  drainEvents(): GameEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  // usado pela ponte de e2e pra montar cenas, passa pelas regras reais de spawn
  spawnEnemyAt(kind: EnemyKind, x: number, y: number, angle?: number) {
    return spawnEnemy(this.context, kind, x, y, angle);
  }

  private tickCountdown(dt: number) {
    this.state.countdown = Math.max(0, this.state.countdown - dt);
    const tick = Math.ceil(this.state.countdown);
    if (tick !== this.lastCountdownTick && tick > 0) {
      this.lastCountdownTick = tick;
      this.events.push({ type: "countdown", value: tick });
    }
    if (this.state.countdown <= 0) {
      this.state.phase = "running";
      this.events.push({ type: "matchStarted" });
    }
  }

  private end(reason: EndReason) {
    const { state } = this;
    state.phase = "ended";
    state.endReason = reason;
    state.projectiles = [];
    if (reason === "destroyed") {
      const { player } = state;
      player.alive = false;
      player.speed = 0;
      this.events.push({ type: "shipDestroyed", shipId: player.id, kind: "player", x: player.x, y: player.y, angle: player.angle, cause: "cannon" });
    }
    this.events.push({ type: "matchEnded", reason, score: state.score, elapsed: state.elapsed });
  }
}
