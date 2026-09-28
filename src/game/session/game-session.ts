import { Application } from "pixi.js";
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
import { FIXED_STEP, FixedStepLoop } from "./loop";

export type PauseReason = "manual" | "blur" | "hidden" | "rotate";
export type HudPhase = "countdown" | "running" | "ended";

export interface HudState {
  phase: HudPhase;
  paused: PauseReason | null;
  countdown: number;
  health: number;
  maxHealth: number;
  score: number;
  remainingSeconds: number;
}

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

// dono do ciclo de vida: app do pixi, simulação, input e o store do hud
export class GameSession {
  readonly hud: Store<HudState>;
  readonly pad = new ControlPad();
  private app: Application | null = null;
  private renderer: GameRenderer | null = null;
  private simulation: Simulation;
  private config: GameConfig;
  private seed: number;
  private readonly loop = new FixedStepLoop();
  private readonly cleanups: (() => void)[] = [];
  private destroyed = false;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly options: GameSessionOptions) {
    this.seed = options.seed;
    this.config = this.freezeConfig();
    this.simulation = this.createSimulation();
    this.hud = createStore<HudState>(this.readHud());
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

  // o init do pixi é assíncrono, então o strict mode pode destruir antes de terminar
  async mount() {
    const { host } = this.options;
    const app = new Application();
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      background: "#1a6d96",
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: "webgl",
    });

    if (this.destroyed) {
      app.destroy({ removeView: true }, { children: true });
      return;
    }

    this.app = app;
    app.canvas.setAttribute("aria-hidden", "true");
    app.canvas.classList.add("game-canvas");
    host.appendChild(app.canvas);

    this.attachRenderer();
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    app.ticker.add(this.onFrame);
    this.bindInput();
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
    if (this.app) {
      this.attachRenderer();
      this.resize();
    }
    this.hud.replace({ ...this.readHud(), paused: null });
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
    this.resizeObserver?.disconnect();
    this.pad.releaseAll();
    sounds.stopLoops();

    if (this.app) {
      this.app.ticker.remove(this.onFrame);
      this.renderer?.destroy();
      // as texturas são compartilhadas entre partidas, então ficam vivas
      this.app.destroy({ removeView: true }, { children: true });
    }
    this.renderer = null;
    this.app = null;
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
    this.app?.stage.addChild(this.renderer.stage);
  }

  private resize() {
    const { host } = this.options;
    if (!this.app || !this.renderer) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.app.renderer.resize(width, height);
    this.renderer.resize(width, height);
    this.renderer.render(this.state, 0);
  }

  private bindInput() {
    const isLive = () => !this.isPaused && this.state.phase !== "ended";
    this.cleanups.push(bindKeyboard({ pad: this.pad, isActive: isLive, onPause: () => this.pause("manual") }));

    const onBlur = () => this.pause("blur");
    const onVisibility = () => {
      if (document.visibilityState === "hidden") this.pause("hidden");
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanups.push(() => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    });
  }

  private readonly onFrame = () => {
    if (!this.app || !this.renderer) return;
    const frameSeconds = this.app.ticker.deltaMS / 1000;

    if (this.options.manualClock || this.isPaused) {
      this.renderer.render(this.state, 0);
      return;
    }

    this.loop.advance(frameSeconds, (dt) => this.step(dt));
    this.flush();
    this.renderer.render(this.state, frameSeconds);
  };

  private tick(dt: number) {
    if (this.isPaused) return;
    this.step(dt);
    this.flush();
    this.renderer?.render(this.state, dt);
  }

  private step(dt: number) {
    this.simulation.step(dt, this.pad.snapshot());
  }

  private flush() {
    this.handleEvents(this.simulation.drainEvents());
    this.hud.set(this.readHud());
  }

  private handleEvents(events: GameEvent[]) {
    if (events.length === 0) return;
    this.renderer?.consume(events);
    sounds.consume(events, this.state);

    const ended = events.find((event) => event.type === "matchEnded");
    if (ended && ended.type === "matchEnded") {
      this.pad.releaseAll();
      const summary: MatchSummary = {
        score: ended.score,
        elapsedSeconds: ended.elapsed,
        reason: ended.reason,
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

  private readHud(): HudState {
    const { state } = this;
    return {
      phase: state.phase,
      paused: this.hud?.get().paused ?? null,
      countdown: Math.ceil(state.countdown),
      health: Math.ceil(state.player.health),
      maxHealth: state.player.maxHealth,
      score: state.score,
      remainingSeconds: Math.ceil(state.remaining),
    };
  }
}
