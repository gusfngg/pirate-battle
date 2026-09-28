import { createStore } from "@/lib/store";
import type { GameEvent, MatchState } from "../sim/types";

const SOUND_NAMES = [
  "cannon_broadside",
  "cannon_fire_1",
  "cannon_fire_2",
  "cannon_fire_3",
  "cannonball_water_hit_1",
  "cannonball_water_hit_2",
  "game_complete",
  "game_over",
  "game_pause",
  "game_resume",
  "game_start",
  "health_low",
  "ocean_ambience_loop",
  "score_point",
  "ship_collision",
  "ship_explosion_1",
  "ship_explosion_2",
  "ship_sailing_loop",
  "ship_sinking",
  "ship_wood_hit_1",
  "ship_wood_hit_2",
  "time_warning",
  "ui_back",
  "ui_click",
  "ui_close",
  "ui_hover",
  "ui_open",
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];
type LoopName = "ocean_ambience_loop" | "ship_sailing_loop";

const MUTE_KEY = "pirate-battle:muted";
const VOLUME: Partial<Record<SoundName, number>> = {
  ocean_ambience_loop: 0.35,
  ship_sailing_loop: 0.25,
  ui_hover: 0.3,
  cannonball_water_hit_1: 0.5,
  cannonball_water_hit_2: 0.5,
};

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

// um único contexto de áudio pro app todo, destravado no primeiro gesto do jogador
class SoundBoard {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly loops = new Map<LoopName, { source: AudioBufferSourceNode; gain: GainNode }>();
  private loading: Promise<void> | null = null;
  private loopsMuted = false;
  private lastPlayed = new Map<SoundName, number>();
  readonly settings = createStore({ muted: readMuted() });

  get muted() {
    return this.settings.get().muted;
  }

  unlock() {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") void this.context.resume().catch(() => undefined);
    this.loading ??= this.loadAll();
  }

  setMuted(muted: boolean) {
    this.settings.set({ muted });
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // armazenamento bloqueado, o mute só vale nesta aba
    }
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  // som é enfeite: se um arquivo falhar, o jogo segue em silêncio
  private async loadAll() {
    const context = this.context;
    if (!context) return;
    await Promise.all(
      SOUND_NAMES.map(async (name) => {
        try {
          const response = await fetch(`/game/sounds/${name}.wav`);
          if (!response.ok) return;
          this.buffers.set(name, await context.decodeAudioData(await response.arrayBuffer()));
        } catch {
          // ignora, fica sem esse som
        }
      }),
    );
  }

  play(name: SoundName, volume = 1) {
    const context = this.context;
    const buffer = this.buffers.get(name);
    if (!context || !this.master || !buffer) return;

    // evita empilhar o mesmo som dezenas de vezes no mesmo instante
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < 0.04) return;
    this.lastPlayed.set(name, now);

    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = (VOLUME[name] ?? 0.8) * volume;
    source.buffer = buffer;
    source.connect(gain).connect(this.master);
    source.start();
  }

  startLoops() {
    void this.loading?.then(() => {
      this.startLoop("ocean_ambience_loop");
      this.startLoop("ship_sailing_loop", 0);
    });
  }

  private startLoop(name: LoopName, level = VOLUME[name] ?? 0.3) {
    const context = this.context;
    const buffer = this.buffers.get(name);
    if (!context || !this.master || !buffer || this.loops.has(name)) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = this.loopsMuted ? 0 : level;
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(this.master);
    source.start();
    this.loops.set(name, { source, gain });
  }

  setLoopsMuted(muted: boolean) {
    this.loopsMuted = muted;
    for (const [name, loop] of this.loops) {
      loop.gain.gain.value = muted ? 0 : name === "ship_sailing_loop" ? 0 : (VOLUME[name] ?? 0.3);
    }
  }

  stopLoops() {
    for (const loop of this.loops.values()) {
      try {
        loop.source.stop();
      } catch {
        // já parado
      }
      loop.source.disconnect();
    }
    this.loops.clear();
  }

  consume(events: readonly GameEvent[], state: MatchState) {
    for (const event of events) {
      switch (event.type) {
        case "countdown":
          this.play("ui_click");
          break;
        case "matchStarted":
          this.play("game_start");
          this.startLoops();
          break;
        case "shot":
          if (event.side === "player") this.play(event.weapon === "front" ? "cannon_fire_1" : "cannon_broadside");
          else this.play("cannon_fire_3", 0.6);
          break;
        case "hit":
          this.play(event.side === "player" ? "ship_wood_hit_1" : "ship_wood_hit_2");
          if (event.side === "player" && event.health > 0 && event.health <= 30) this.play("health_low");
          break;
        case "splash":
          this.play(event.onShore ? "cannonball_water_hit_2" : "cannonball_water_hit_1");
          break;
        case "bump":
          this.play("ship_collision", 0.6);
          break;
        case "shipDestroyed":
          this.play(event.kind === "player" ? "ship_explosion_2" : "ship_explosion_1");
          this.play("ship_sinking", 0.5);
          break;
        case "scored":
          this.play("score_point");
          break;
        case "matchEnded":
          this.stopLoops();
          this.play(event.reason === "time" ? "game_complete" : "game_over");
          break;
        default:
          break;
      }
    }

    const sailing = this.loops.get("ship_sailing_loop");
    if (sailing && !this.loopsMuted) sailing.gain.gain.value = (state.player.speed / 190) * (VOLUME.ship_sailing_loop ?? 0.25);
  }
}

export const sounds = new SoundBoard();
