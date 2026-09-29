import { Application, type Container } from "pixi.js";

interface PixiStageOptions {
  host: HTMLElement;
  // o strict mode pode desmontar a tela enquanto o init ainda está rodando
  isCancelled(): boolean;
  onFrame(frameSeconds: number): void;
  onResize(width: number, height: number): void;
}

// dono do canvas: cria o app do pixi, acompanha o tamanho do host e libera tudo no fim
export class PixiStage {
  private readonly observer: ResizeObserver;
  private readonly tick = () => this.options.onFrame(this.app.ticker.deltaMS / 1000);

  private constructor(
    private readonly app: Application,
    private readonly options: PixiStageOptions,
  ) {
    const { host } = options;
    app.canvas.setAttribute("aria-hidden", "true");
    app.canvas.classList.add("game-canvas");
    host.appendChild(app.canvas);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    app.ticker.add(this.tick);
  }

  // devolve null se a tela saiu antes do pixi terminar de iniciar
  static async create(options: PixiStageOptions): Promise<PixiStage | null> {
    const { host } = options;
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

    if (options.isCancelled()) {
      app.destroy({ removeView: true }, { children: true });
      return null;
    }
    return new PixiStage(app, options);
  }

  show(content: Container) {
    this.app.stage.addChild(content);
  }

  resize() {
    const { host } = this.options;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.app.renderer.resize(width, height);
    this.options.onResize(width, height);
  }

  // as texturas são compartilhadas entre partidas, então só os objetos de cena são destruídos
  destroy() {
    this.observer.disconnect();
    this.app.ticker.remove(this.tick);
    this.app.destroy({ removeView: true }, { children: true });
  }
}
