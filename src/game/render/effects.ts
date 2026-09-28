import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { frame, type GameAssets } from "../assets/game-assets";
import { createRandom, type Random } from "../random";
import type { ShipKind } from "../sim/types";
import { hullTexture } from "./ship-view";

interface Effect {
  display: Container;
  age: number;
  life: number;
  update(effect: Effect, t: number, dt: number): void;
}

const EXPLOSION_FRAMES = ["explosion_3", "explosion_2", "explosion_1"];

// efeitos de curta duração, criados por eventos e removidos sozinhos ao terminar
export class EffectsLayer {
  readonly below = new Container();
  readonly above = new Container();
  private readonly effects: Effect[] = [];
  private readonly random: Random;
  private shakePower = 0;
  private shakeTime = 0;

  constructor(
    private readonly assets: GameAssets,
    seed: number,
  ) {
    this.random = createRandom(seed ^ 0x5eed);
  }

  get count() {
    return this.effects.length;
  }

  private add(layer: Container, display: Container, life: number, update: Effect["update"]) {
    layer.addChild(display);
    const effect = { display, age: 0, life, update };
    this.effects.push(effect);
    update(effect, 0, 0);
  }

  private sprite(name: string, x: number, y: number) {
    const sprite = new Sprite(frame(this.assets.ships, name));
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    return sprite;
  }

  muzzle(x: number, y: number, angle: number, big: boolean) {
    const flash = this.sprite("explosion_3", x, y);
    flash.rotation = angle;
    const size = big ? 0.75 : 0.55;
    this.add(this.above, flash, 0.16, (effect, t) => {
      effect.display.scale.set(size * (0.6 + t * 0.8));
      effect.display.alpha = 1 - t;
    });

    const smoke = new Graphics().circle(0, 0, 10).fill({ color: 0xf2efe6 });
    smoke.position.set(x, y);
    const driftX = Math.cos(angle) * 22;
    const driftY = Math.sin(angle) * 22;
    this.add(this.above, smoke, 0.6, (effect, t) => {
      effect.display.position.set(x + driftX * t, y + driftY * t);
      effect.display.scale.set(0.6 + t * 1.6);
      effect.display.alpha = 0.55 * (1 - t);
    });
  }

  splash(x: number, y: number, onShore: boolean) {
    const ring = new Graphics().circle(0, 0, 10).stroke({ width: 3, color: onShore ? 0xe8cf95 : 0xffffff });
    ring.position.set(x, y);
    this.add(this.below, ring, 0.5, (effect, t) => {
      effect.display.scale.set(0.4 + t * 1.4);
      effect.display.alpha = 0.8 * (1 - t);
    });
  }

  impact(x: number, y: number) {
    const burst = this.sprite("explosion_3", x, y);
    this.add(this.above, burst, 0.22, (effect, t) => {
      effect.display.scale.set(0.45 + t * 0.4);
      effect.display.alpha = 1 - t;
    });
    this.debris(x, y, 3);
  }

  explode(x: number, y: number, big: boolean) {
    const blast = this.sprite(EXPLOSION_FRAMES[0]!, x, y);
    const textures: Texture[] = EXPLOSION_FRAMES.map((name) => frame(this.assets.ships, name));
    const scale = big ? 1.5 : 1.1;
    this.add(this.above, blast, 0.6, (effect, t) => {
      const index = Math.min(textures.length - 1, Math.floor(t * 5));
      (effect.display as Sprite).texture = textures[index]!;
      effect.display.scale.set(scale * (0.7 + t * 0.5));
      effect.display.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    });
    this.debris(x, y, big ? 7 : 5);
  }

  sink(kind: ShipKind, x: number, y: number, angle: number) {
    const wreck = new Sprite(hullTexture(this.assets, kind, 3));
    wreck.anchor.set(0.5);
    wreck.position.set(x, y);
    wreck.rotation = angle - Math.PI / 2;
    const drift = this.random.range(-0.4, 0.4);
    this.add(this.below, wreck, 2.2, (effect, t) => {
      effect.display.scale.set(0.78 * (1 - t * 0.35));
      effect.display.rotation = angle - Math.PI / 2 + drift * t;
      effect.display.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
    });
  }

  private debris(x: number, y: number, pieces: number) {
    for (let i = 0; i < pieces; i++) {
      const piece = this.sprite(`wood_${1 + Math.floor(this.random.next() * 4)}`, x, y);
      const heading = this.random.range(0, Math.PI * 2);
      const reach = this.random.range(24, 64);
      const spin = this.random.range(-6, 6);
      piece.scale.set(this.random.range(0.35, 0.6));
      this.add(this.above, piece, 0.9, (effect, t, dt) => {
        const eased = 1 - (1 - t) * (1 - t);
        effect.display.position.set(x + Math.cos(heading) * reach * eased, y + Math.sin(heading) * reach * eased);
        effect.display.rotation += spin * dt;
        effect.display.alpha = 1 - t * t;
      });
    }
  }

  shake(power: number) {
    this.shakePower = Math.max(this.shakePower, power);
    this.shakeTime = 0.3;
  }

  // deslocamento da câmera pro tremor da tela, zero quando parado
  shakeOffset() {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const power = this.shakePower * (this.shakeTime / 0.3);
    return { x: this.random.range(-power, power), y: this.random.range(-power, power) };
  }

  update(dt: number) {
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    if (this.shakeTime === 0) this.shakePower = 0;

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]!;
      effect.age += dt;
      if (effect.age >= effect.life) {
        effect.display.destroy();
        this.effects.splice(i, 1);
        continue;
      }
      effect.update(effect, effect.age / effect.life, dt);
    }
  }

  destroy() {
    for (const effect of this.effects) effect.display.destroy();
    this.effects.length = 0;
    this.below.destroy();
    this.above.destroy();
  }
}
