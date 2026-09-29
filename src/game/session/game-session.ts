import { createStore, type Store } from "@/lib/store";
import type { GameAssets } from "../assets/game-assets";
import { sounds } from "../audio/sound-board";
import { createMatchConfig, type GameConfig, type MatchOptions } from "../config";
import { ControlPad } from "../input/control-pad";
import { bindKeyboard } from "../input/keyboard";
import { GameRenderer } from "../render/game-renderer";
import { Simulation } from "../sim/simulation";
import type { EndReason, EnemyKind, GameEvent } from "../sim/types";
import { ARENA_LAYOUT } from "../world/layout";
import { bindAutoPause } from "./auto-pause";
import { crossedWarningSecond, readHud, type HudState, type PauseReason } from "./hud-state";
import { FIXED_STEP, FixedStepLoop } from "./loop";
import { PixiStage } from "./pixi-stage";

export type { HudState, PauseReason } from "./hud-state";

export interface MatchSummary {
  score: number;
  elapsedSeconds: number;
  reason: EndReason;
  config: MatchOptions;
}

export interface GameSessionOptions {
  host: HTMLElement;
  assets: GameAssets;
  options: MatchOptions;
  seed: number;
  manualClock?: boolean;
  countdownSeconds?: number;
  onEnded(summary: MatchSummary): void;
}

// tempo pra ver a explosão final antes de ir pra tela de resultado
const END_DELAY_MS = 1600;

// orquestra uma partida: liga a simulação ao pixi, ao input, ao som e ao hud do react
export class GameSession {
  readonly hud: Store<HudState>;
  readonly pad = new ControlPad();
  private stage: PixiStage | null = null;
  private renderer: GameRenderer | null = null;
  private simulation: Simulation;
  private config: GameConfig;
  private seed: number;
  private readonly loop = new FixedStepLoop();
  private readonly cleanups: (() => void)[] = [];
  private destroyed = false;
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: GameSessionOptions) {
    this.seed = options.seed;
    this.config = this.freezeConfig();
    this.simulation = this.createSimulation();
    this.hud = createStore<HudState>(readHud(this.state, null));
  }

  get state() {
    return this.simulation.state;
  }

  get matchConfig() {
    return this.config;
  }

  get isPaused() {
    return this.hud.get().paused !== null;
  }

  async mount() {
    this.stage = await PixiStage.create({
      host: this.options.host,
      isCancelled: () => this.destroyed,
      onFrame: (frameSeconds) => this.onFrame(frameSeconds),
      onResize: (width, height) => {
        this.renderer?.resize(width, height);
        this.renderer?.render(this.state, 0);
      },
    });
    if (!this.stage) return;

    this.attachRenderer();
    const isLive = () => !this.isPaused && this.state.phase !== "ended";
    this.cleanups.push(bindKeyboard({ pad: this.pad, isActive: isLive, onPause: () => this.pause("manual") }));
    this.cleanups.push(bindAutoPause((reason) => this.pause(reason)));
    this.handleEvents(this.simulation.drainEvents());
  }

  pause(reason: PauseReason) {
    if (this.destroyed || this.isPaused || this.state.phase === "ended") return;
    this.pad.releaseAll();
    this.loop.reset();
    this.hud.set({ paused: reason });
    sounds.play("game_pause");
    sounds.setLoopsMuted(true);
  }

  // retomar sempre exige ação do jogador e começa sem teclas presas
  resume() {
    if (!this.isPaused) return;
    this.pad.releaseAll();
    this.loop.reset();
    this.hud.set({ paused: null });
    sounds.play("game_resume");
    sounds.setLoopsMuted(false);
  }

  restart(seed = this.seed + 1) {
    if (this.destroyed) return;
    this.clearEndTimer();
    this.seed = seed;
    this.config = this.freezeConfig();
    this.simulation = this.createSimulation();
    this.pad.releaseAll();
    this.loop.reset();
    this.renderer?.destroy();
    this.renderer = null;
    if (this.stage) this.attachRenderer();
    this.hud.replace(readHud(this.state, null));
    sounds.setLoopsMuted(false);
    this.handleEvents(this.simulation.drainEvents());
  }

  // relógio manual dos testes: avança a simulação real em passos fixos
  advance(seconds: number) {
    const steps = Math.round(seconds / FIXED_STEP);
    for (let i = 0; i < steps; i++) this.tick(FIXED_STEP);
  }

  spawnEnemyForTest(kind: EnemyKind, x: number, y: number, angle?: number) {
    const ship = this.simulation.spawnEnemyAt(kind, x, y, angle);
    this.flush();
    return ship.id;
  }

  stats() {
    return { ...(this.renderer?.stats() ?? { ships: 0, projectiles: 0, effects: 0, foam: 0 }), enemies: this.state.enemies.length };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearEndTimer();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.pad.releaseAll();
    sounds.stopLoops();
    this.renderer?.destroy();
    this.renderer = null;
    this.stage?.destroy();
    this.stage = null;
  }

  private freezeConfig() {
    const { options, countdownSeconds } = this.options;
    return createMatchConfig(options, countdownSeconds === undefined ? {} : { countdownSeconds });
  }

  private createSimulation() {
    return new Simulation({ config: this.config, layout: ARENA_LAYOUT, seed: this.seed });
  }

  private attachRenderer() {
    this.renderer = new GameRenderer(this.options.assets, ARENA_LAYOUT, this.seed);
    this.stage?.show(this.renderer.stage);
    this.stage?.resize();
  }

  private onFrame(frameSeconds: number) {
    if (!this.renderer) return;
    if (this.options.manualClock || this.isPaused) {
      this.renderer.render(this.state, 0);
      return;
    }
    this.loop.advance(frameSeconds, (dt) => this.simulation.step(dt, this.pad.snapshot()));
    this.flush();
    this.renderer.render(this.state, frameSeconds);
  }

  private tick(dt: number) {
    if (this.isPaused) return;
    this.simulation.step(dt, this.pad.snapshot());
    this.flush();
    this.renderer?.render(this.state, dt);
  }

  private flush() {
    this.handleEvents(this.simulation.drainEvents());
    const before = this.hud.get();
    this.hud.set(readHud(this.state, before.paused));
    if (crossedWarningSecond(before, this.hud.get())) sounds.play("time_warning");
  }

  private handleEvents(events: GameEvent[]) {
    if (events.length === 0) return;
    this.renderer?.consume(events);
    sounds.consume(events, this.state);

    for (const event of events) {
      if (event.type !== "matchEnded") continue;
      this.pad.releaseAll();
      const summary: MatchSummary = {
        score: event.score,
        elapsedSeconds: event.elapsed,
        reason: event.reason,
        config: { sessionSeconds: this.config.match.durationSeconds, spawnSeconds: this.config.match.spawnIntervalSeconds },
      };
      this.endTimer = setTimeout(() => {
        this.endTimer = null;
        if (!this.destroyed) this.options.onEnded(summary);
      }, END_DELAY_MS);
    }
  }

  private clearEndTimer() {
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = null;
  }
}
